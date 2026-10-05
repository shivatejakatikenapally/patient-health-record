"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, QrCode, ShieldCheck } from "lucide-react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type PatientProfile } from "@/app/lib/api-client";

export default function PatientDashboard() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<PatientProfile>("/patients/me/profile").then((value) => {
      setProfile(value);
      setFullName(value.full_name);
      setDateOfBirth(value.date_of_birth ?? "");
    }).catch((reason: unknown) => {
      if (!(reason instanceof Error) || !reason.message.includes("not created")) setError(reason instanceof Error ? reason.message : "Could not load your profile.");
    }).finally(() => setLoading(false));
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await apiFetch<PatientProfile>("/patients/me/profile", { method: "PUT", body: JSON.stringify({ full_name: fullName, date_of_birth: dateOfBirth || null }) });
      setProfile(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function copyReferenceId() {
    if (!profile) return;
    navigator.clipboard.writeText(profile.reference_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AccountShell role="patient">
      <div className="page-heading">
        <p className="eyebrow">PATIENT ACCOUNT</p>
        <h1>Your health record</h1>
        <p>Keep your profile, health timeline, and documents together. You hold the key and authorize care provider access.</p>
      </div>

      {loading ? (
        <div className="skeleton skeleton-card" />
      ) : (
        <section className="content-card" aria-labelledby="profile-heading">
          <div className="card-heading">
            <div>
              <p className="eyebrow">PROFILE</p>
              <h2 id="profile-heading">Your details</h2>
            </div>
            {profile && <span className="status-label">Profile saved</span>}
          </div>

          <form onSubmit={saveProfile} className="stack-form">
            <label className="field-label" htmlFor="patient-name">Full name</label>
            <input className="text-field" id="patient-name" autoComplete="name" required minLength={2} maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            
            <label className="field-label" htmlFor="patient-dob">Date of birth <span className="optional-label">Optional</span></label>
            <input className="text-field" id="patient-dob" type="date" autoComplete="bday" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
            
            <button className="primary-button compact-button" type="submit" disabled={saving}>
              {saving ? "Saving profile" : profile ? "Save changes" : "Create patient profile"}
            </button>
            {error && <p className="form-message" role="alert">{error}</p>}
          </form>

          {profile && (
            <div className="reference-panel" style={{ marginTop: "24px" }}>
              <div style={{ flex: 1 }}>
                <p className="eyebrow">YOUR RECORD REFERENCE ID</p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "6px 0 10px" }}>
                  <p className="reference-value" style={{ margin: 0, fontFamily: "monospace", fontSize: "22px" }}>
                    {profile.reference_id}
                  </p>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={copyReferenceId}
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 8px", fontSize: "11px" }}
                  >
                    {copied ? <><Check size={13} color="var(--accent)" /> Copied</> : <><Copy size={13} /> Copy ID</>}
                  </button>
                </div>
                <p className="muted-copy">
                  Give this reference ID or show your QR code to your doctor. Scanning or entering this ID only identifies your record—it does <b>not</b> grant access until you approve their request.
                </p>
                <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <Link
                    href={`/scan/${profile.reference_id}`}
                    className="quiet-button"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                    target="_blank"
                  >
                    <QrCode size={14} /> Preview QR scan page <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
              <span className="verified-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <ShieldCheck size={14} /> Issued
              </span>
            </div>
          )}
        </section>
      )}

      <div className="quick-links" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Link href="/consents" className="content-card link-card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <span>
            <b>Consent requests</b>
            <small>Approve, deny, or revoke provider access</small>
          </span>
          <ArrowRight size={16} />
        </Link>
        <Link href="/timeline" className="content-card link-card">
          <span>
            <b>Health timeline</b>
            <small>Add and update your health history</small>
          </span>
          <ArrowRight size={16} />
        </Link>
        <Link href="/documents" className="content-card link-card">
          <span>
            <b>Documents</b>
            <small>Upload private health documents</small>
          </span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <p className="phase-disclaimer">
        Phase 2: Consent requests, purpose scoping, time expiry, and instant revocation are active.
      </p>
    </AccountShell>
  );
}
