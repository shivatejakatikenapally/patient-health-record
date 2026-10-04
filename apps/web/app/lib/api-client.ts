const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export type AccountRole = "patient" | "provider" | "caregiver";
export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: { id: string; email: string; role: AccountRole };
};

export async function authenticate(
  path: "register" | "login",
  body: { email: string; password: string; role?: AccountRole },
): Promise<AuthResponse> {
  if (!apiBase) throw new Error("The API URL is not configured yet.");
  const response = await fetch(`${apiBase}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail ?? "Could not complete sign in.");
  return result as AuthResponse;
}
