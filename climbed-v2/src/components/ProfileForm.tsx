"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserProfile } from "@/lib/backend";

const DOMINANT_HAND_OPTIONS = ["left", "right", "ambidextrous"] as const;

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [heightCm, setHeightCm] = useState(user.height_cm?.toString() ?? "");
  const [apeIndexCm, setApeIndexCm] = useState(user.ape_index_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(user.weight_kg?.toString() ?? "");
  const [dominantHand, setDominantHand] = useState(user.dominant_hand ?? "");
  const [currentGrade, setCurrentGrade] = useState(user.current_grade ?? "");
  const [injuriesNotes, setInjuriesNotes] = useState(user.injuries_notes ?? "");

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() === "" ? null : name,
          height_cm: toNumberOrNull(heightCm),
          ape_index_cm: toNumberOrNull(apeIndexCm),
          weight_kg: toNumberOrNull(weightKg),
          dominant_hand: dominantHand === "" ? null : dominantHand,
          current_grade: currentGrade.trim() === "" ? null : currentGrade,
          injuries_notes: injuriesNotes.trim() === "" ? null : injuriesNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save profile.");
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save profile.");
    }
  };

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">Signed in as</p>
        <p className="font-medium">{user.email}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Height (cm)
          <input
            type="number"
            step="0.1"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ape index (cm)
          <input
            type="number"
            step="0.1"
            value={apeIndexCm}
            onChange={(e) => setApeIndexCm(e.target.value)}
            placeholder="wingspan − height"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Weight (kg)
          <input
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Dominant hand
          <select
            value={dominantHand}
            onChange={(e) => setDominantHand(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">—</option>
            {DOMINANT_HAND_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt[0].toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Current grade
        <input
          type="text"
          value={currentGrade}
          onChange={(e) => setCurrentGrade(e.target.value)}
          placeholder="e.g. V3"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Known injuries or weaknesses
        <textarea
          value={injuriesNotes}
          onChange={(e) => setInjuriesNotes(e.target.value)}
          rows={3}
          placeholder="e.g. tight hips, weak fingers"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {status === "saved" && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </div>
    </form>
  );
}
