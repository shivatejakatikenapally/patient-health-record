import type { AccountRole } from "./api-client";

export type AuthenticatedUser = { id: string; email: string; role: AccountRole };

export function saveAccessToken(token: string): void {
  if (typeof window !== "undefined") window.sessionStorage.setItem("ps3-access-token", token);
}

export function clearAccessToken(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem("ps3-access-token");
}
