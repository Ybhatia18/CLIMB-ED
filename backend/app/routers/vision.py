import base64
import io

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from PIL import Image, UnidentifiedImageError

from app.vision import config
from app.vision.pipeline import detect_holds, image_to_png_bytes

router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/detect-holds")
async def detect_holds_endpoint(
    photo: UploadFile = File(...),
    threshold: float = Query(default=config.DEFAULT_THRESHOLD, ge=0.0, le=1.0),
):
    """Zero-shot SAM+CLIP hold detection prototype. No auth — not wired into
    the rest of the API yet, see backend/README.md."""
    raw = await photo.read()
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Could not read that as an image.") from exc

    result = detect_holds(image, threshold=threshold)

    overlay_b64 = base64.b64encode(image_to_png_bytes(result.overlay_image)).decode("ascii")

    return {
        "image_width": result.image_width,
        "image_height": result.image_height,
        "threshold": result.threshold,
        "num_candidate_masks": result.num_candidate_masks,
        "detections": [
            {"id": d.id, "bbox": d.bbox, "score": d.score, "area_px": d.area_px}
            for d in result.detections
        ],
        "overlay_image_base64": overlay_b64,
    }
