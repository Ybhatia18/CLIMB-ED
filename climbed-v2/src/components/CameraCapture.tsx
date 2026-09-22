"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CaptureStatus = "idle" | "requesting" | "streaming" | "denied" | "unsupported";
type UploadStatus = "idle" | "uploading" | "done" | "error";

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    setError(null);
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("streaming");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
      } else {
        setStatus("unsupported");
        setError(err instanceof Error ? err.message : "Could not access the camera.");
      }
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the async getUserMedia request; state updates happen after the await, not synchronously
      startStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, photo]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.92));
    stopStream();
  };

  const retake = () => {
    setPhoto(null);
    setUploadStatus("idle");
    setError(null);
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      stopStream();
    };
    reader.readAsDataURL(file);
  };

  const usePhoto = async () => {
    if (!photo) return;
    setUploadStatus("uploading");
    setError(null);
    try {
      const blob = await (await fetch(photo)).blob();
      const form = new FormData();
      form.append("photo", blob, "wall.jpg");

      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      setUploadStatus("done");
    } catch (err) {
      setUploadStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  if (photo) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Captured climbing wall" className="w-full" />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {uploadStatus === "done" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Photo uploaded. Route segmentation isn&apos;t wired up yet — this
              is the Phase 0 round trip.
            </p>
            <button
              onClick={retake}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Take another photo
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={retake}
              disabled={uploadStatus === "uploading"}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              disabled={uploadStatus === "uploading"}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {uploadStatus === "uploading" ? "Uploading..." : "Use this photo"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {status !== "streaming" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
            {status === "requesting" && <p>Requesting camera access…</p>}
            {status === "idle" && <p>Starting camera…</p>}
            {status === "denied" && (
              <>
                <p className="font-medium">Camera access was denied.</p>
                <p className="text-sm text-zinc-300">
                  Allow camera access in your browser settings, or upload a
                  photo instead.
                </p>
                <button
                  onClick={startStream}
                  className="rounded-full border border-white/40 px-4 py-1.5 text-sm hover:bg-white/10"
                >
                  Try again
                </button>
              </>
            )}
            {status === "unsupported" && (
              <>
                <p className="font-medium">Camera isn&apos;t available here.</p>
                <p className="text-sm text-zinc-300">
                  {error ?? "Try a different browser, or upload a photo instead."}
                </p>
              </>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={capture}
          disabled={status !== "streaming"}
          className="rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#ccc]"
        >
          Capture wall
        </button>
        <button
          onClick={() =>
            setFacingMode((m) => (m === "environment" ? "user" : "environment"))
          }
          className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Flip camera
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Upload instead
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileSelected}
          className="hidden"
        />
      </div>
    </div>
  );
}
