"""Run the zero-shot hold detector on a local image file, no server needed.
Fastest way to tune --threshold: swap it and re-run, look at overlay.png.

    python scripts/detect_holds_cli.py path/to/wall.jpg --threshold 0.5

Usage note: everything downstream of SAM+CLIP model loading takes a few
seconds; the model loads themselves (first run only) take much longer.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image

from app.vision import config
from app.vision.pipeline import detect_holds


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image_path", type=Path)
    parser.add_argument("--threshold", type=float, default=config.DEFAULT_THRESHOLD)
    parser.add_argument("--out", type=Path, default=Path("overlay.png"))
    args = parser.parse_args()

    image = Image.open(args.image_path)
    result = detect_holds(image, threshold=args.threshold)

    result.overlay_image.save(args.out)

    summary = {
        "image_size": [result.image_width, result.image_height],
        "threshold": result.threshold,
        "num_candidate_masks": result.num_candidate_masks,
        "num_kept": len(result.detections),
        "detections": [
            {"id": d.id, "bbox": d.bbox, "score": d.score, "area_px": d.area_px}
            for d in result.detections
        ],
    }
    print(json.dumps(summary, indent=2))
    print(f"\nOverlay saved to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
