import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BackendError, googleAuth } from "@/lib/backend";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const { id_token: idToken } = await request.json();

  if (typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing Google ID token." }, { status: 400 });
  }

  try {
    const { access_token, user } = await googleAuth(idToken);
    (await cookies()).set(SESSION_COOKIE, access_token, sessionCookieOptions);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Google sign-in failed." }, { status: 502 });
  }
}
