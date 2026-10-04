"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type PatientProfile } from "@/app/lib/api-client";

export default function PatientDashboard() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

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

  return <AccountShell role="patient">
    <div className="page-heading"><p className="eyebrow">PATIENT ACCOUNT</p><h1>Your health record</h1><p>Keep your profile and health history together. You control who can access your records.</p></div>
    {loading ? <div className="skeleton skeleton-card" /> : <section className="content-card" aria-labelledby="profile-heading">
      <div className="card-heading"><div><p className="eyebrow">PROFILE</p><h2 id="profile-heading">Your details</h2></div>{profile && <span className="status-label">Profile saved</span>}</div>
      <form onSubmit={saveProfile} className="stack-form">
        <label className="field-label" htmlFor="patient-name">Full name</label><input className="text-field" id="patient-name" autoComplete="name" required minLength={2} maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <label className="field-label" htmlFor="patient-dob">Date of birth <span className="optional-label">Optional</span></label><input className="text-field" id="patient-dob" type="date" autoComplete="bday" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
        <button className="primary-button compact-button" type="submit" disabled={saving}>{saving ? "Saving profile" : profile ? "Save changes" : "Create patient profile"}</button>
        {error && <p className="form-message" role="alert">{error}</p>}
      </form>
      {profile && <div className="reference-panel"><div><p className="eyebrow">YOUR REFERENCE ID</p><p className="reference-value">{profile.reference_id}</p><p className="muted-copy">Identifies your account. It does not give anyone access to your records.</p></div><span className="verified-label">Issued</span></div>}
    </section>}
    <div className="quick-links"><Link href="/timeline" className="content-card link-card"><span><b>Health timeline</b><small>Add and update your health history</small></span><span aria-hidden="true">→</span></Link><Link href="/documents" className="content-card link-card"><span><b>Documents</b><small>Upload private health documents</small></span><span aria-hidden="true">→</span></Link></div>
    <p className="phase-disclaimer">Reference IDs identify an account only. Provider access requests are not enabled in this phase.</p>
  </AccountShell>;
}
