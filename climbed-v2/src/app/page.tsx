import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          BetaVision
        </h1>
        <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Photograph a climbing wall and get a step-by-step beta walkthrough
          for the route you pick.
        </p>
        <Link
          href="/capture"
          className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Scan a wall
        </Link>
        <p className="text-xs text-zinc-400">
          Camera capture only for now — hold detection and beta generation
          come in later phases.
        </p>
      </main>
    </div>
  );
}
