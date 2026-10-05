const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export type AccountRole = "patient" | "provider" | "caregiver";
export type ConsentPurpose = "treatment" | "care_coordination" | "diagnostic_review" | "emergency_break_glass";
export type ConsentState = "pending" | "granted" | "denied" | "revoked" | "expired";

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: { id: string; email: string; role: AccountRole };
};

export type PatientProfile = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  reference_id: string;
  reference_id_issued: boolean;
};

export type ProviderProfile = {
  id: string;
  full_name: string;
  specialty: string;
  facility: string;
  registration_number: string | null;
  verification_status: string;
};

export type HealthRecord = {
  id: string;
  category: string;
  title: string;
  details: string;
  occurred_on: string;
  created_at: string;
  updated_at: string;
};

export type PatientDocument = {
  id: string;
  record_id: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export type DocumentDownloadView = {
  url: string;
  expires_in: number;
};

export type ConsentView = {
  id: string;
  patient_id: string;
  patient_reference_id: string;
  patient_name: string;
  provider_id: string;
  provider_name: string;
  provider_specialty: string;
  provider_facility: string;
  purpose: ConsentPurpose;
  duration_minutes: number;
  status: ConsentState;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsentStatusView = {
  has_active_consent: boolean;
  consent_id: string | null;
  status: ConsentState;
  purpose: ConsentPurpose | null;
  expires_at: string | null;
  time_remaining_seconds: number | null;
};

export type AuditLogEntry = {
  id: string;
  actor_user_id: string | null;
  patient_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

function getApiBase(): string {
  if (!apiBase) throw new Error("The API URL is not configured yet.");
  return apiBase;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.sessionStorage.getItem("ps3-access-token") : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getApiBase()}/api/v1${path}`, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = result.detail;
    const message = Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(". ") : detail;
    throw new Error(typeof message === "string" ? message : "The request could not be completed.");
  }
  return result as T;
}

export async function authenticate(
  path: "register" | "login",
  body: { email: string; password: string; role?: AccountRole },
): Promise<AuthResponse> {
  const response = await fetch(`${getApiBase()}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail ?? "Could not complete sign in.");
  return result as AuthResponse;
}
