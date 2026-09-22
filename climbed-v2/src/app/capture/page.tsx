import Link from "next/link";
import CameraCapture from "@/components/CameraCapture";

export default function CapturePage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="flex w-full max-w-md items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back
        </Link>
        <h1 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Scan a wall
        </h1>
        <span className="w-10" />
      </div>

      <CameraCapture />
    </div>
  );
}
