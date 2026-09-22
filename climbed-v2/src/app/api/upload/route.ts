import { NextResponse } from "next/server";

// Phase 0 stub: accepts the captured wall photo and acknowledges receipt.
// Route segmentation (hold detection, color clustering) lands in a later phase.
export async function POST(request: Request) {
  const form = await request.formData();
  const photo = form.get("photo");

  if (!(photo instanceof Blob) || photo.size === 0) {
    return NextResponse.json({ error: "No photo provided." }, { status: 400 });
  }

  return NextResponse.json({ status: "received", bytes: photo.size });
}
