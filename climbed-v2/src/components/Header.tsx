"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { UserProfile } from "@/lib/backend";

export default function Header({ user }: { user: UserProfile | null }) {
  const router = useRouter();

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <header className="flex w-full items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-black">
      <Link href="/" className="font-semibold tracking-tight text-black dark:text-zinc-50">
        BetaVision
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        <Link href="/capture" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          Scan a wall
        </Link>

        {user ? (
          <>
            <Link href="/account" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
              Account
            </Link>
            <button
              onClick={onLogout}
              className="rounded-full border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-foreground px-3 py-1.5 font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
