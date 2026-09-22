import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BackendError, fetchProfile, updateProfile } from "@/lib/backend";
import { SESSION_COOKIE } from "@/lib/session";

async function getToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const profile = await fetchProfile(token);
    return NextResponse.json({ user: profile });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not load profile." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const updates = await request.json();

  try {
    const profile = await updateProfile(token, updates);
    return NextResponse.json({ user: profile });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not update profile." }, { status: 502 });
  }
}
