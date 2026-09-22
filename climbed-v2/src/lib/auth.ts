import { cookies } from "next/headers";

import { fetchCurrentUser, type UserProfile } from "@/lib/backend";
import { SESSION_COOKIE } from "@/lib/session";

// Any backend failure (expired token, backend unreachable, etc.) just means
// "not signed in" as far as rendering the rest of the page goes.
export async function getCurrentUser(): Promise<UserProfile | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await fetchCurrentUser(token);
  } catch {
    return null;
  }
}
