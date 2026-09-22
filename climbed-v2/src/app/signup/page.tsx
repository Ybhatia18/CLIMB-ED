import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Create your account
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Save your morphology so beta suggestions are tuned to your body.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
