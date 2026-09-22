const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export type UserProfile = {
  id: number;
  email: string;
  name: string | null;
  height_cm: number | null;
  ape_index_cm: number | null;
  weight_kg: number | null;
  dominant_hand: string | null;
  current_grade: string | null;
  injuries_notes: string | null;
  created_at: string;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: UserProfile;
};

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg).join(", ");
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new BackendError(res.status, await parseErrorDetail(res));
  return res.json() as Promise<T>;
}

export async function backendAuthGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new BackendError(res.status, await parseErrorDetail(res));
  return res.json() as Promise<T>;
}

export async function backendAuthPatch<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new BackendError(res.status, await parseErrorDetail(res));
  return res.json() as Promise<T>;
}

export async function signup(email: string, password: string, name?: string) {
  return backendPost<AuthResponse>("/auth/signup", { email, password, name });
}

export async function login(email: string, password: string) {
  return backendPost<AuthResponse>("/auth/login", { email, password });
}

export async function googleAuth(idToken: string) {
  return backendPost<AuthResponse>("/auth/google", { id_token: idToken });
}

export async function fetchCurrentUser(token: string) {
  return backendAuthGet<UserProfile>("/auth/me", token);
}

export async function fetchProfile(token: string) {
  return backendAuthGet<UserProfile>("/users/me", token);
}

export async function updateProfile(token: string, updates: Partial<UserProfile>) {
  return backendAuthPatch<UserProfile>("/users/me", token, updates);
}
