# CLIMB-ED API

FastAPI backend: email/password + Google auth, and the personalization
profile fields from the spec (§3.4 — height, ape index, weight, dominant
hand, current grade, injuries/weaknesses). PostgreSQL via SQLAlchemy +
Alembic. Also has a zero-shot hold-detection prototype (see below) — the
real fine-tuned CV pipeline (§4.3) isn't built yet.

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # then fill in JWT_SECRET, GOOGLE_CLIENT_ID

docker compose up -d   # starts local Postgres on :5432
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`.

Without Docker, `DATABASE_URL` can point at SQLite instead
(`sqlite:///./climbed.db`) for quick local testing — just don't use that
in production.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Email + password signup |
| POST | `/auth/login` | — | Email + password login |
| POST | `/auth/google` | — | Exchange a Google ID token for a session |
| GET | `/auth/me` | Bearer | Current user |
| GET | `/users/me` | Bearer | Current user's profile |
| PATCH | `/users/me` | Bearer | Update personalization fields |
| GET | `/health` | — | Liveness check |
| POST | `/vision/detect-holds` | — | Zero-shot hold detection prototype (see below) |

Auth is a JWT bearer token returned from signup/login/google, expiring after
`JWT_EXPIRE_MINUTES`. This API does not set cookies itself — the Next.js
frontend's `/api/auth/*` routes proxy to this service and hold the session
in a first-party httpOnly cookie, which avoids cross-origin cookie issues
between the Vercel frontend and this backend's own domain.

## Zero-shot hold detection prototype

`app/vision/` — no training, no labeled data, just two pretrained models
run locally: **SAM** (ViT-B) proposes candidate object masks on a wall
photo, then **CLIP** (open_clip, `ViT-B-32`/`laion2b_s34b_b79k`) scores
each masked crop against "a photo of a climbing hold"-style prompts vs.
"a photo of a blank wall"-style prompts. Whatever clears the score
threshold gets kept, and each kept hold gets a dominant color (median
RGB under its mask, named via HSV hue bucket — spec §3.1's "cluster
by color to select a route") baked in for free since we already have
the mask. This is the stopgap from the spec discussion, not the real
pipeline (§4.3) — it exists to validate the idea before spending time
on a labeled dataset and a fine-tuned YOLO model.

**Setup.** Already installed if you ran `pip install -r requirements.txt`
after this was added. Two one-time downloads happen automatically the
first time the pipeline runs (not on `pip install`):

- The SAM ViT-B checkpoint (~375MB) — auto-downloaded to
  `backend/checkpoints/sam_vit_b_01ec64.pth` on first use if not already
  there. To fetch it manually ahead of time instead:
  ```bash
  curl -L -o checkpoints/sam_vit_b_01ec64.pth \
    https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
  ```
- The CLIP weights (~600MB) — downloaded via `open_clip`/Hugging Face Hub
  on first use, cached in `~/.cache`.

**Fastest way to iterate — the CLI script, not the server:**

```bash
source .venv/bin/activate
python3 scripts/detect_holds_cli.py path/to/wall.jpg
```

Saves `overlay.png` (original image with kept masks tinted, boxed, and
labeled with score + color name) next to wherever you run it from, and
prints the detection list as JSON, including `color_hex`/`color_name` per
hold. Swap `--threshold` and re-run — model loading is the slow part
(SAM + CLIP take a while on first load each process run), so keep one
Python process alive across edits (e.g. `python3 -i`) if you're iterating
a lot, rather than re-running the script from scratch each time.

**Via the API** (same pipeline, multipart upload, returns the overlay as
base64 PNG instead of a file):

```bash
curl -X POST "http://localhost:8000/vision/detect-holds" -F "photo=@wall.jpg"
```

Or use `http://localhost:8000/docs` — Swagger UI gives you a file picker
and shows the JSON response inline, no curl needed.

**What the threshold does, and why the default is "auto."** Each SAM
candidate mask gets a CLIP-derived `P(hold)` score in `[0, 1]` — softmax
between the "hold" and "background" prompt classes, not a raw similarity
score. A single static cutoff (0.5, or anything else) is wrong for a lot
of photos: some walls give CLIP a confident, well-separated score
distribution; others sit clustered near the middle. `threshold=auto`
(the default, both here and in the CLI) runs
[**Otsu's method**](https://en.wikipedia.org/wiki/Otsu%27s_method) on the
scores for *that specific photo* — the classic automatic-thresholding
technique, picks whatever cutoff maximizes the separation between the
"hold" cluster and the "background" cluster, clamped to
`[AUTO_THRESHOLD_MIN, AUTO_THRESHOLD_MAX]` (0.35–0.75) so a weird
distribution can't pick something degenerate. The response's `threshold`
field always reports the actual numeric value used, and `threshold_auto`
says whether it was picked automatically. Pass a number in `[0, 1]`
(`--threshold 0.5`, `?threshold=0.5`) to override it manually — lower
catches more holds at the cost of more false positives, higher does the
reverse and starts dropping real ones, which is exactly the "auto" mode
exists to avoid guessing at per-photo.

**If results look bad** (expected — CLIP wasn't trained on climbing
holds specifically): tune `app/vision/config.py` in this order before
assuming something's broken:

1. `HOLD_PROMPTS` / `BACKGROUND_PROMPTS` — add more phrasings, or ones
   more specific to what you're actually photographing (gym lighting,
   hold material, wall color). These get mean-pooled into one embedding
   per class, so more variants generally helps more than it hurts.
2. `--threshold` — override "auto" manually if it's landing somewhere
   consistently wrong for your photos; see above.
3. `SAM_POINTS_PER_SIDE` — more points means SAM proposes more/finer
   candidate masks (slower); fewer means faster but you'll miss small or
   oddly-shaped holds. Default (24) is already below SAM's own default
   (32) to keep CPU/MPS runtime sane.
4. `SAM_MAX_MASK_AREA_FRACTION` — SAM's automatic generator always
   proposes a few large background/merged-region masks. A crop of "most
   of the wall" isn't blank, so CLIP scores it as a hold too — that's a
   bad SAM candidate, not a prompt problem. Masks bigger than this
   fraction of the image are dropped before CLIP ever sees them.

**Apple Silicon note.** CLIP runs on MPS (`config.DEVICE`, auto-detected).
SAM's automatic mask generator does not — it builds float64 tensors
internally and MPS has no float64 support, so it hard-crashes with
`Cannot convert a MPS Tensor to float64 dtype`. This is a known upstream
limitation, not a bug in this code, so SAM is pinned to CPU
(`config.SAM_DEVICE`) regardless of what `config.DEVICE` resolves to.
Override either with the `VISION_DEVICE` / `VISION_SAM_DEVICE` env vars if
that ever changes upstream.

**Known limitations, on purpose (prototype, not production):** no auth on
the endpoint yet; SAM's masks aren't mutually exclusive, so overlapping
holds can each surface as separate detections (no dedup/NMS implemented);
color naming is a fixed hue-wheel bucket (`pipeline._COLOR_NAME_BUCKETS`),
not calibrated to any real gym's palette, and will mis-bucket anything
near a hue boundary or under colored gym lighting; runs synchronously
in-request, so a real deployment would need a queue or background worker
instead of blocking an HTTP request for tens of seconds.

## Database migrations

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Deploying (Railway / Fly.io)

1. Provision a PostgreSQL instance (Railway's Postgres plugin, or `fly
   postgres create`) and set `DATABASE_URL` on the service to its
   `postgresql+psycopg://...` connection string.
2. Set `JWT_SECRET` (long random value), `GOOGLE_CLIENT_ID`, and
   `FRONTEND_ORIGINS` (your Vercel deployment URL(s), comma-separated) as
   env vars.
3. The included `Procfile` runs `alembic upgrade head` before starting
   `uvicorn`, so migrations apply automatically on deploy.
