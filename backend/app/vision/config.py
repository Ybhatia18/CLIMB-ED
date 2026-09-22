import os
from pathlib import Path

import torch

VISION_DIR = Path(__file__).resolve().parent
BACKEND_DIR = VISION_DIR.parent.parent
CHECKPOINT_DIR = BACKEND_DIR / "checkpoints"

SAM_CHECKPOINT_PATH = CHECKPOINT_DIR / "sam_vit_b_01ec64.pth"
SAM_CHECKPOINT_URL = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
SAM_MODEL_TYPE = "vit_b"

CLIP_MODEL_NAME = "ViT-B-32"
CLIP_PRETRAINED = "laion2b_s34b_b79k"

# Longest side an input image is resized to before running SAM. Phone photos
# are huge (3000px+); SAM on CPU/MPS over that is minutes, not seconds.
MAX_IMAGE_SIDE = 1024

# SamAutomaticMaskGenerator knobs. Halved points_per_side vs. SAM's own
# default (32) trades some recall for a lot of speed on CPU/MPS — bump this
# back up once you're past "does the pipeline run at all."
SAM_POINTS_PER_SIDE = 24
SAM_PRED_IOU_THRESH = 0.86
SAM_STABILITY_SCORE_THRESH = 0.92
SAM_MIN_MASK_REGION_AREA = 200  # px; drops speckle/noise masks

# SAM's automatic generator always proposes a few large background/merged
# masks. A crop of "most of the wall" isn't a blank wall, so CLIP scores it
# as a hold too — that's a bad SAM candidate, not a prompt-wording problem,
# so it's filtered by area fraction before CLIP ever sees it.
SAM_MAX_MASK_AREA_FRACTION = 0.35

# Zero-shot CLIP prompts. Single-prompt zero-shot on a narrow domain like
# "climbing hold" is noisy — average several phrasings per class instead.
# Tune these first if detections look bad before assuming the pipeline is
# broken (see backend/README.md).
HOLD_PROMPTS = [
    "a photo of a climbing hold",
    "a rock climbing hold bolted to a wall",
    "a colorful plastic climbing hold on an indoor gym wall",
    "a bouldering hold",
]
BACKGROUND_PROMPTS = [
    "a photo of a blank wall",
    "a photo of a wall texture",
    "an empty section of a climbing gym wall",
    "a photo of a textured wall surface with no holds",
]

DEFAULT_THRESHOLD = 0.5

def _default_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


# CLIP runs fine on MPS. SAM's automatic mask generator does not — it builds
# float64 point-grid tensors internally, and MPS has no float64 support, so
# it hard-crashes with "Cannot convert a MPS Tensor to float64 dtype".
# Known upstream limitation (facebookresearch/segment-anything on Apple
# Silicon), not something to patch around — SAM just runs on CPU here.
# Override either with VISION_DEVICE / VISION_SAM_DEVICE if that changes.
DEVICE = os.environ.get("VISION_DEVICE", _default_device())
SAM_DEVICE = os.environ.get("VISION_SAM_DEVICE", "cpu")
