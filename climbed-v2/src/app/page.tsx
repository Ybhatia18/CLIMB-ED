import Link from "next/link";

const FEATURES = [
  {
    title: "Route segmentation",
    description:
      "Take a photo of the wall. CLIMB-ED detects every hold and clusters them by color, so tapping one route lights up the whole line — including the ones tucked in shadow.",
  },
  {
    title: "Honest difficulty calibration",
    description:
      "Gym grades drift from setter to setter and gym to gym. CLIMB-ED scores hold type, spacing, and wall angle to give a gym-agnostic grade with a confidence interval.",
  },
  {
    title: "Step-by-step beta walkthrough",
    description:
      "A stick-figure climber overlaid on your photo, advancing one move at a time. Every step shows where your hands and feet go and what the body position should look like.",
  },
];

const STEPS = [
  { label: "Scan", detail: "Photograph the wall from the ground." },
  { label: "Pick a route", detail: "Tap the color or hold you want to climb." },
  { label: "Study the beta", detail: "Step through the dummy walkthrough before you climb." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <section className="flex flex-col items-center gap-6 px-6 pb-20 pt-24 text-center">
        <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
          For climbers in their first 6–18 months
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
          You can see the holds. CLIMB-ED shows you the movement.
        </h1>
        <p className="max-w-xl text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Photograph a climbing wall, tap a route, and get a physics-aware,
          step-by-step beta guide — no live AR, no guesswork, just a plan you
          can study before you climb.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-8 py-3 text-base font-semibold text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Create an account
          </Link>
          <Link
            href="/capture"
            className="rounded-full border border-zinc-300 px-8 py-3 text-base font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Try scanning a wall
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-white px-6 py-20 dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
                {feature.title}
              </h2>
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-10">
          <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            How it works
          </h2>
          <ol className="grid w-full gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.label} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  {i + 1}
                </span>
                <p className="font-medium text-black dark:text-zinc-50">{step.label}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
        <p className="text-sm text-zinc-500">
          Route segmentation is live. Difficulty calibration and the beta
          engine are still in development.
        </p>
      </section>
    </div>
  );
}
