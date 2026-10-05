"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type ProviderProfile } from "@/app/lib/api-client";

const empty = { full_name: "", specialty: "", facility: "", registration_number: "" };

export default function ProviderDashboard() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ProviderProfile>("/providers/me/profile").then((value) => {
      setProfile(value);
      setForm({ full_name: value.full_name, specialty: value.specialty, facility: value.facility, registration_number: value.registration_number ?? "" });
    }).catch((reason) => {
      if (!(reason instanceof Error) || !reason.message.includes("not created")) setError(reason instanceof Error ? reason.message : "Could not load your profile.");
    }).finally(() => setLoading(false));
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const value = await apiFetch<ProviderProfile>("/providers/me/profile", { method: "PUT", body: JSON.stringify({ ...form, registration_number: form.registration_number || null }) });
      setProfile(value);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
    finally { setSaving(false); }
  }

  return (
    <AccountShell role="provider">
      <div className="page-heading">
        <p className="eyebrow">PROVIDER ACCOUNT</p>
        <h1>Professional profile</h1>
        <p>Manage your professional details and request consent-driven patient access.</p>
      </div>

      <div className="quick-links" style={{ marginBottom: "24px" }}>
        <Link href="/request-access" className="content-card link-card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <span>
            <b>Request patient access</b>
            <small>Enter a patient reference ID to request time-limited access</small>
          </span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="skeleton skeleton-card" />
      ) : (
        <section className="content-card" aria-labelledby="provider-profile-title">
          <div className="card-heading">
            <div>
              <p className="eyebrow">YOUR DETAILS</p>
              <h2 id="provider-profile-title">Provider profile</h2>
            </div>
            {profile && <span className="pending-label">Verification pending</span>}
          </div>

          <form className="stack-form" onSubmit={save}>
            <label className="field-label" htmlFor="provider-name">Full name</label>
            <input className="text-field" id="provider-name" autoComplete="name" required minLength={2} maxLength={160} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
            
            <label className="field-label" htmlFor="provider-specialty">Specialty</label>
            <input className="text-field" id="provider-specialty" maxLength={120} value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} placeholder="For example, general medicine" />
            
            <label className="field-label" htmlFor="provider-facility">Hospital or clinic</label>
            <input className="text-field" id="provider-facility" maxLength={160} value={form.facility} onChange={(event) => setForm({ ...form, facility: event.target.value })} placeholder="Facility name" />
            
            <label className="field-label" htmlFor="provider-registration">Registration number <span className="optional-label">Optional</span></label>
            <input className="text-field" id="provider-registration" maxLength={100} value={form.registration_number} onChange={(event) => setForm({ ...form, registration_number: event.target.value })} />
            
            <button className="primary-button compact-button" type="submit" disabled={saving}>
              {saving ? "Saving profile" : profile ? "Save changes" : "Create provider profile"}
            </button>
            {error && <p className="form-message" role="alert">{error}</p>}
          </form>

          <p className="phase-disclaimer">The profile is self-entered and has not been independently verified.</p>
        </section>
      )}

      <p className="phase-disclaimer">
        Phase 2: Provider access is governed by explicit, patient-approved consent with instant revocation and audit logging.
      </p>
    </AccountShell>
  );
}
