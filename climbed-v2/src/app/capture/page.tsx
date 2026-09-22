import CameraCapture from "@/components/CameraCapture";

export default function CapturePage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <h1 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Scan a wall
      </h1>
      <CameraCapture />
    </div>
  );
}
