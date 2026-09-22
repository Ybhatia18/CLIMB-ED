"""Lazy-loaded singletons for SAM and CLIP. Both are slow to load (checkpoint
I/O + moving weights to device), so we load each exactly once per process,
on first use, and cache them here.
"""

import sys
import urllib.request

import open_clip
import torch
from segment_anything import SamAutomaticMaskGenerator, sam_model_registry

from app.vision import config

_mask_generator: SamAutomaticMaskGenerator | None = None
_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None


def _ensure_sam_checkpoint() -> None:
    if config.SAM_CHECKPOINT_PATH.exists():
        return

    print(f"[vision] SAM checkpoint not found, downloading to {config.SAM_CHECKPOINT_PATH} ...", file=sys.stderr)
    config.CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(config.SAM_CHECKPOINT_URL, config.SAM_CHECKPOINT_PATH)
    print("[vision] SAM checkpoint downloaded.", file=sys.stderr)


def get_mask_generator() -> SamAutomaticMaskGenerator:
    global _mask_generator
    if _mask_generator is not None:
        return _mask_generator

    _ensure_sam_checkpoint()
    print(f"[vision] Loading SAM ({config.SAM_MODEL_TYPE}) on {config.SAM_DEVICE} ...", file=sys.stderr)

    sam = sam_model_registry[config.SAM_MODEL_TYPE](checkpoint=str(config.SAM_CHECKPOINT_PATH))
    sam.to(device=config.SAM_DEVICE)

    _mask_generator = SamAutomaticMaskGenerator(
        sam,
        points_per_side=config.SAM_POINTS_PER_SIDE,
        pred_iou_thresh=config.SAM_PRED_IOU_THRESH,
        stability_score_thresh=config.SAM_STABILITY_SCORE_THRESH,
        min_mask_region_area=config.SAM_MIN_MASK_REGION_AREA,
        output_mode="binary_mask",
    )
    print("[vision] SAM ready.", file=sys.stderr)
    return _mask_generator


def get_clip():
    """Returns (model, preprocess, tokenizer), loading + caching on first call."""
    global _clip_model, _clip_preprocess, _clip_tokenizer
    if _clip_model is not None:
        return _clip_model, _clip_preprocess, _clip_tokenizer

    print(f"[vision] Loading CLIP ({config.CLIP_MODEL_NAME}/{config.CLIP_PRETRAINED}) on {config.DEVICE} ...", file=sys.stderr)
    model, _, preprocess = open_clip.create_model_and_transforms(
        config.CLIP_MODEL_NAME, pretrained=config.CLIP_PRETRAINED
    )
    model.to(config.DEVICE)
    model.eval()
    tokenizer = open_clip.get_tokenizer(config.CLIP_MODEL_NAME)

    _clip_model, _clip_preprocess, _clip_tokenizer = model, preprocess, tokenizer
    print("[vision] CLIP ready.", file=sys.stderr)
    return _clip_model, _clip_preprocess, _clip_tokenizer


@torch.no_grad()
def embed_text_prompts(prompts: list[str]) -> torch.Tensor:
    """Mean-pools the (normalized) embeddings of several prompt phrasings into
    one class embedding — single-prompt zero-shot is noisy on a narrow
    domain like this."""
    model, _, tokenizer = get_clip()
    tokens = tokenizer(prompts).to(config.DEVICE)
    features = model.encode_text(tokens)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.mean(dim=0, keepdim=True)
