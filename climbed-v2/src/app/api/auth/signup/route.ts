import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BackendError, signup } from "@/lib/backend";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const { access_token, user } = await signup(email, password, name);
    (await cookies()).set(SESSION_COOKIE, access_token, sessionCookieOptions);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Sign up failed." }, { status: 502 });
  }
}
