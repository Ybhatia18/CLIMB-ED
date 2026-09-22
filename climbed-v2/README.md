# CLIMB-ED — web client

Next.js (App Router, TypeScript, Tailwind) client for CLIMB-ED, per
[`climbing_app_spec.md`](../../ClimbED_v2/climbing_app_spec.md), pivoted from
the spec's React Native/Expo plan to a browser-based webapp for deployment on
Vercel.

## What's here (Phase 0)

- `/` — landing page.
- `/capture` — camera capture screen (`src/components/CameraCapture.tsx`).
  Requests the device camera via `getUserMedia` (rear camera by default,
  flip to front), captures a still frame to a canvas, and falls back to a
  file/gallery picker when the camera is unavailable or permission is
  denied.
- `POST /api/upload` — stub endpoint that accepts the captured photo and
  acknowledges receipt (`{ status: "received", bytes }`). No storage or CV
  pipeline yet — this is the Phase 0 round trip from the spec's roadmap.

## Not built yet

Hold detection, color clustering, difficulty calibration, and the beta
optimizer (spec sections 3.1–3.3) all require a backend CV/ML pipeline and
are out of scope for this pass.

## Local development

```bash
npm install
npm run dev
```

Camera access requires HTTPS (or `localhost`), so it works out of the box in
local dev and on Vercel, but not over a plain HTTP LAN address.

## Deploying

This is a stock Next.js app — connect the repo (root directory
`climbed-v2`) to a new Vercel project and it deploys with no extra config.
