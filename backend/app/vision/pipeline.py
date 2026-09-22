"""Zero-shot climbing hold detection: SAM proposes candidate object masks,
CLIP scores each crop against "climbing hold" vs. "blank wall" text prompts,
and we keep whatever clears the threshold. No training, no labeled data —
see climbing_app_spec.md §4.3 item 4 and backend/README.md for the tuning
knobs and why this is expected to be noisy out of the box.
"""

import colorsys
import io
from dataclasses import dataclass, field
from typing import Literal

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont

from app.vision import config
from app.vision.models import embed_text_prompts, get_clip, get_mask_generator

# Hue-wheel buckets for naming a hold's dominant color — good enough to group
# holds into "the red route" / "the blue route" (spec §3.1), not a precise
# color model. Checked in order; saturation/value gates come first so dim or
# washed-out pixels don't get assigned a confident hue.
_COLOR_NAME_BUCKETS: list[tuple[str, tuple[float, float]]] = [
    ("red", (345, 360)), ("red", (0, 15)),
    ("orange", (15, 45)),
    ("yellow", (45, 70)),
    ("green", (70, 170)),
    ("blue", (170, 260)),
    ("purple", (260, 300)),
    ("pink", (300, 345)),
]

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
    color_rgb: tuple[int, int, int]
    color_hex: str
    color_name: str


@dataclass
class DetectionResult:
    image_width: int
    image_height: int
    threshold: float
    threshold_auto: bool
    num_candidate_masks: int
    detections: list[Detection] = field(default_factory=list)
    overlay_image: Image.Image = None


def _resize_to_max_side(image: Image.Image, max_side: int) -> Image.Image:
    w, h = image.size
    scale = max_side / max(w, h)
    if scale >= 1:
        return image
    return image.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def _dominant_color(image_np: np.ndarray, mask: np.ndarray) -> tuple[int, int, int]:
    """Median RGB under the mask — robust to a few shadow/specular-highlight
    pixels in a way a mean wouldn't be."""
    pixels = image_np[mask]
    if len(pixels) == 0:
        return (128, 128, 128)
    r, g, b = np.median(pixels, axis=0)
    return (int(r), int(g), int(b))


def _color_name(rgb: tuple[int, int, int]) -> str:
    h, s, v = colorsys.rgb_to_hsv(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
    hue_deg = h * 360

    if v < 0.2:
        return "black"
    if s < 0.15:
        return "white" if v > 0.8 else "gray"

    for name, (lo, hi) in _COLOR_NAME_BUCKETS:
        if lo <= hue_deg < hi:
            return name
    return "gray"  # unreachable given the bucket table covers 0-360, kept as a safe fallback


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


def _otsu_threshold(scores: list[float], num_bins: int = 256) -> float:
    """The score cutoff that best separates `scores` into two clusters —
    maximizes between-cluster variance, a classic automatic-thresholding
    technique. Picks a per-photo threshold instead of one static guess:
    a photo where CLIP is confident about everything wants a different
    cutoff than one where every score sits near 0.5.
    """
    arr = np.asarray(scores, dtype=np.float64)
    if len(arr) < 2 or arr.max() == arr.min():
        return config.DEFAULT_THRESHOLD

    hist, bin_edges = np.histogram(arr, bins=num_bins, range=(0.0, 1.0))
    hist = hist.astype(np.float64)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    total = hist.sum()
    sum_total = (hist * bin_centers).sum()

    sum_bg = 0.0
    weight_bg = 0.0
    best_thresh = bin_centers[0]
    best_between_var = -1.0

    for count, center in zip(hist, bin_centers):
        weight_bg += count
        if weight_bg == 0:
            continue
        weight_fg = total - weight_bg
        if weight_fg == 0:
            break
        sum_bg += count * center
        mean_bg = sum_bg / weight_bg
        mean_fg = (sum_total - sum_bg) / weight_fg
        between_var = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if between_var > best_between_var:
            best_between_var = between_var
            best_thresh = center

    return float(np.clip(best_thresh, config.AUTO_THRESHOLD_MIN, config.AUTO_THRESHOLD_MAX))


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
        label = f"{det.score:.2f} {det.color_name}"
        draw.rectangle([x, y - 12, x + 8 + 6 * len(label), y], fill=(*color, 220))
        draw.text((x + 2, y - 12), label, fill=(0, 0, 0, 255), font=font)

    return overlay.convert("RGB")


def detect_holds(image: Image.Image, threshold: float | Literal["auto"] = "auto") -> DetectionResult:
    image = image.convert("RGB")
    image = _resize_to_max_side(image, config.MAX_IMAGE_SIDE)
    image_np = np.array(image)

    mask_generator = get_mask_generator()
    masks = mask_generator.generate(image_np)

    max_area = config.SAM_MAX_MASK_AREA_FRACTION * image.width * image.height
    masks = [m for m in masks if m["area"] <= max_area]

    is_auto = threshold == "auto"

    if not masks:
        resolved_threshold = config.DEFAULT_THRESHOLD if is_auto else float(threshold)
        return DetectionResult(
            image_width=image.width, image_height=image.height,
            threshold=resolved_threshold, threshold_auto=is_auto, num_candidate_masks=0,
            detections=[], overlay_image=image,
        )

    crops = [_padded_crop(image, m["bbox"]) for m in masks]
    scores = _score_crops_as_holds(crops)

    resolved_threshold = _otsu_threshold(scores) if is_auto else float(threshold)

    kept: list[tuple[Detection, np.ndarray]] = []
    for i, (mask, score) in enumerate(zip(masks, scores)):
        if score < resolved_threshold:
            continue
        bbox = [int(v) for v in mask["bbox"]]
        segmentation = mask["segmentation"]
        rgb = _dominant_color(image_np, segmentation)
        kept.append((
            Detection(
                id=i,
                bbox=bbox,
                score=round(float(score), 4),
                area_px=int(mask["area"]),
                color_rgb=rgb,
                color_hex="#{:02x}{:02x}{:02x}".format(*rgb),
                color_name=_color_name(rgb),
            ),
            segmentation,
        ))

    kept.sort(key=lambda pair: pair[0].score, reverse=True)
    overlay_image = _draw_overlay(image, kept)

    return DetectionResult(
        image_width=image.width,
        image_height=image.height,
        threshold=round(resolved_threshold, 4),
        threshold_auto=is_auto,
        num_candidate_masks=len(masks),
        detections=[det for det, _ in kept],
        overlay_image=overlay_image,
    )


def image_to_png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
