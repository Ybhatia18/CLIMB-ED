"use client";

import { useMemo, useState } from "react";

import type { DetectHoldsResponse, HoldDetection } from "@/lib/backend";

const HOLD_TYPES = [
  "Jug",
  "Crimp",
  "Sloper",
  "Pinch",
  "Pocket",
  "Edge",
  "Sidepull",
  "Undercling",
  "Gaston",
  "Horn",
  "Volume",
  "Dual-texture hold",
  "Foothold (chip)",
] as const;

type HoldTag = { type: (typeof HOLD_TYPES)[number] } | { type: "Custom"; description: string };

function tagLabel(tag: HoldTag | undefined): string | null {
  if (!tag) return null;
  return tag.type === "Custom" ? tag.description || "Custom" : tag.type;
}

export default function HoldResults({
  photo,
  result,
  onRetake,
  onTryDifferentThreshold,
}: {
  photo: string;
  result: DetectHoldsResponse;
  onRetake: () => void;
  onTryDifferentThreshold: () => void;
}) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeHoldId, setActiveHoldId] = useState<number | null>(null);
  const [holdTags, setHoldTags] = useState<Record<number, HoldTag>>({});
  const [customDraft, setCustomDraft] = useState("");

  const routes = useMemo(() => {
    const byColor = new Map<string, { hex: string; count: number }>();
    for (const d of result.detections) {
      const existing = byColor.get(d.color_name);
      if (existing) existing.count += 1;
      else byColor.set(d.color_name, { hex: d.color_hex, count: 1 });
    }
    return Array.from(byColor.entries()).map(([name, { hex, count }]) => ({ name, hex, count }));
  }, [result.detections]);

  const activeHold: HoldDetection | undefined = result.detections.find((d) => d.id === activeHoldId);

  const setTag = (id: number, tag: HoldTag) => {
    setHoldTags((prev) => ({ ...prev, [id]: tag }));
  };

  const selectRoute = (name: string) => {
    setSelectedColor((prev) => (prev === name ? null : name));
    setActiveHoldId(null);
  };

  const selectHold = (id: number) => {
    setActiveHoldId((prev) => (prev === id ? null : id));
    setCustomDraft("");
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Kept {result.detections.length} of {result.num_candidate_masks} candidate
        masks at threshold {result.threshold.toFixed(2)}
        {result.threshold_auto ? " (auto-selected)" : ""}. Zero-shot SAM+CLIP
        prototype — no trained model, expect misses and false positives.
      </p>

      {routes.length > 0 && (
        <div className="flex w-full flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Select a route
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {routes.map((route) => (
              <button
                key={route.name}
                onClick={() => selectRoute(route.name)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  selectedColor === route.name
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/20"
                  style={{ backgroundColor: route.hex }}
                />
                {route.name} route ({route.count})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Captured climbing wall" className="w-full" />

        {result.detections.map((d) => {
          const [x, y, w, h] = d.bbox;
          const dimmed = selectedColor !== null && d.color_name !== selectedColor;
          const tag = tagLabel(holdTags[d.id]);
          const isActive = activeHoldId === d.id;

          return (
            <button
              key={d.id}
              onClick={() => selectHold(d.id)}
              className="absolute flex items-start justify-start transition-opacity"
              style={{
                left: `${(x / result.image_width) * 100}%`,
                top: `${(y / result.image_height) * 100}%`,
                width: `${(w / result.image_width) * 100}%`,
                height: `${(h / result.image_height) * 100}%`,
                border: `${isActive ? 3 : tag ? 2.5 : 2}px solid ${d.color_hex}`,
                opacity: dimmed ? 0.25 : 1,
                boxShadow: isActive ? "0 0 0 2px white, 0 0 0 4px black" : undefined,
              }}
              title={`${d.color_name} · ${d.score.toFixed(2)}${tag ? ` · ${tag}` : ""}`}
            >
              <span
                className="-translate-y-full whitespace-nowrap px-1 text-[10px] font-semibold leading-tight text-black"
                style={{ backgroundColor: d.color_hex }}
              >
                {d.score.toFixed(2)}
                {tag ? ` · ${tag}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {activeHold && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-zinc-300 p-3 text-sm dark:border-zinc-700">
          <p className="font-medium">
            Hold #{activeHold.id} — {activeHold.color_name} · {activeHold.score.toFixed(2)}
          </p>

          <select
            value={holdTags[activeHold.id]?.type ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "Custom") {
                setTag(activeHold.id, { type: "Custom", description: "" });
              } else if (value) {
                setTag(activeHold.id, { type: value as (typeof HOLD_TYPES)[number] });
              }
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              What kind of hold is this?
            </option>
            {HOLD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="Custom">Custom…</option>
          </select>

          {holdTags[activeHold.id]?.type === "Custom" && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="e.g. wet sloper, sharp crimp"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                onClick={() => setTag(activeHold.id, { type: "Custom", description: customDraft })}
                className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Save
              </button>
            </div>
          )}

          <button
            onClick={() => setActiveHoldId(null)}
            className="self-start text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Done with this hold
          </button>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onRetake}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Take another photo
        </button>
        <button
          onClick={onTryDifferentThreshold}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Try a different threshold
        </button>
      </div>
    </div>
  );
}
