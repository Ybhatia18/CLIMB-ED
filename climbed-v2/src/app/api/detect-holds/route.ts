import { NextResponse } from "next/server";

import { BackendError, detectHolds } from "@/lib/backend";

// Proxies to the zero-shot SAM+CLIP prototype (backend/app/vision/) — no
// fine-tuned model yet, see climbing_app_spec.md §4.3 item 4. Extends the
// allowed duration for when this is deployed as a Vercel function; the
// backend itself still needs to be reachable at BACKEND_URL, which for now
// means running it locally (see backend/README.md) rather than on Vercel.
export const maxDuration = 60;

export async function POST(request: Request) {
  const form = await request.formData();
  const photo = form.get("photo");
  const thresholdRaw = form.get("threshold");

  if (!(photo instanceof Blob) || photo.size === 0) {
    return NextResponse.json({ error: "No photo provided." }, { status: 400 });
  }

  const threshold: number | "auto" =
    typeof thresholdRaw === "string" && thresholdRaw !== "" && thresholdRaw !== "auto"
      ? Number(thresholdRaw)
      : "auto";

  try {
    const result = await detectHolds(photo, threshold);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not reach the hold-detection backend. Is it running locally?" },
      { status: 502 }
    );
  }
}
