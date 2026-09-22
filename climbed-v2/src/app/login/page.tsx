import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Welcome back
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Log in to pick up where you left off.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
