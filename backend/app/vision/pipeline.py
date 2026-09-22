"""Zero-shot climbing hold detection: SAM proposes candidate object masks,
CLIP scores each crop against "climbing hold" vs. "blank wall" text prompts,
and we keep whatever clears the threshold. No training, no labeled data —
see climbing_app_spec.md §4.3 item 4 and backend/README.md for the tuning
knobs and why this is expected to be noisy out of the box.
"""

import io
from dataclasses import dataclass, field

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont

from app.vision import config
from app.vision.models import embed_text_prompts, get_clip, get_mask_generator

_PALETTE = [
    (230, 25, 75), (60, 180, 75), (255, 225, 25), (0, 130, 200),
    (245, 130, 48), (145, 30, 180), (70, 240, 240), (240, 50, 230),
    (210, 245, 60), (250, 190, 212), (0, 128, 128), (220, 190, 255),
]


@dataclass
class Detection:
    id: int
    bbox: list[int]  # [x, y, w, h] in the (resized) image's pixel coords
    score: float
    area_px: int


@dataclass
class DetectionResult:
    image_width: int
    image_height: int
    threshold: float
    num_candidate_masks: int
    detections: list[Detection] = field(default_factory=list)
    overlay_image: Image.Image = None


def _resize_to_max_side(image: Image.Image, max_side: int) -> Image.Image:
    w, h = image.size
    scale = max_side / max(w, h)
    if scale >= 1:
        return image
    return image.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def _padded_crop(image: Image.Image, bbox_xywh: list[int], pad_frac: float = 0.15) -> Image.Image:
    x, y, w, h = bbox_xywh
    pad = int(max(w, h) * pad_frac)
    left = max(0, x - pad)
    top = max(0, y - pad)
    right = min(image.width, x + w + pad)
    bottom = min(image.height, y + h + pad)
    return image.crop((left, top, right, bottom))


@torch.no_grad()
def _score_crops_as_holds(crops: list[Image.Image]) -> list[float]:
    """Returns P(hold) for each crop via 2-class CLIP zero-shot (hold vs.
    background), using prompt-averaged class embeddings."""
    model, preprocess, _ = get_clip()

    hold_embed = embed_text_prompts(config.HOLD_PROMPTS)  # [1, D]
    background_embed = embed_text_prompts(config.BACKGROUND_PROMPTS)  # [1, D]
    class_embeds = torch.cat([hold_embed, background_embed], dim=0)  # [2, D]

    batch = torch.stack([preprocess(crop) for crop in crops]).to(config.DEVICE)
    image_features = model.encode_image(batch)
    image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    logit_scale = model.logit_scale.exp()
    logits = logit_scale * image_features @ class_embeds.T  # [N, 2] — [hold, background]
    probs = logits.softmax(dim=-1)
    return probs[:, 0].cpu().tolist()


def _draw_overlay(base_image: Image.Image, kept: list[tuple[Detection, np.ndarray]]) -> Image.Image:
    overlay = base_image.convert("RGBA")
    font = ImageFont.load_default()

    for i, (det, mask) in enumerate(kept):
        color = _PALETTE[i % len(_PALETTE)]

        fill_layer = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
        fill_arr = np.zeros((*mask.shape, 4), dtype=np.uint8)
        fill_arr[mask] = (*color, 110)
        fill_layer = Image.fromarray(fill_arr, mode="RGBA")
        overlay = Image.alpha_composite(overlay, fill_layer)

        draw = ImageDraw.Draw(overlay)
        x, y, w, h = det.bbox
        draw.rectangle([x, y, x + w, y + h], outline=(*color, 255), width=2)
        label = f"{det.score:.2f}"
        draw.rectangle([x, y - 12, x + 8 + 7 * len(label), y], fill=(*color, 220))
        draw.text((x + 2, y - 12), label, fill=(0, 0, 0, 255), font=font)

    return overlay.convert("RGB")


def detect_holds(image: Image.Image, threshold: float = config.DEFAULT_THRESHOLD) -> DetectionResult:
    image = image.convert("RGB")
    image = _resize_to_max_side(image, config.MAX_IMAGE_SIDE)
    image_np = np.array(image)

    mask_generator = get_mask_generator()
    masks = mask_generator.generate(image_np)

    max_area = config.SAM_MAX_MASK_AREA_FRACTION * image.width * image.height
    masks = [m for m in masks if m["area"] <= max_area]

    if not masks:
        return DetectionResult(
            image_width=image.width, image_height=image.height,
            threshold=threshold, num_candidate_masks=0,
            detections=[], overlay_image=image,
        )

    crops = [_padded_crop(image, m["bbox"]) for m in masks]
    scores = _score_crops_as_holds(crops)

    kept: list[tuple[Detection, np.ndarray]] = []
    for i, (mask, score) in enumerate(zip(masks, scores)):
        if score < threshold:
            continue
        bbox = [int(v) for v in mask["bbox"]]
        kept.append((
            Detection(id=i, bbox=bbox, score=round(float(score), 4), area_px=int(mask["area"])),
            mask["segmentation"],
        ))

    kept.sort(key=lambda pair: pair[0].score, reverse=True)
    overlay_image = _draw_overlay(image, kept)

    return DetectionResult(
        image_width=image.width,
        image_height=image.height,
        threshold=threshold,
        num_candidate_masks=len(masks),
        detections=[det for det, _ in kept],
        overlay_image=overlay_image,
    )


def image_to_png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
