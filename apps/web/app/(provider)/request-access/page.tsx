"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, Clock, FileText, Send, ShieldCheck } from "lucide-react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type ConsentPurpose, type ConsentView } from "@/app/lib/api-client";

function RequestAccessContent() {
  const searchParams = useSearchParams();
  const initialRefId = searchParams.get("refId") || "";

  const [refId, setRefId] = useState(initialRefId);
  const [purpose, setPurpose] = useState<ConsentPurpose>("treatment");
  const [duration, setDuration] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successConsent, setSuccessConsent] = useState<ConsentView | null>(null);
  const [myRequests, setMyRequests] = useState<ConsentView[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadRequests() {
    try {
      const items = await apiFetch<ConsentView[]>("/consents/provider");
      setMyRequests(items);
    } catch {
      // ignore history load error on initial mount
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccessConsent(null);

    try {
      const result = await apiFetch<ConsentView>("/consents/requests", {
        method: "POST",
        body: JSON.stringify({
          patient_reference_id: refId.trim().toUpperCase(),
          purpose,
          duration_minutes: Number(duration),
        }),
      });
      setSuccessConsent(result);
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit access request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell role="provider">
      <div className="page-heading">
        <p className="eyebrow">PATIENT CONSENT</p>
        <h1>Request patient access</h1>
        <p>
          Enter a patient’s reference ID to request time-limited access to their health records. Access is only authorized after the patient explicitly approves your request.
        </p>
      </div>

      <section className="content-card" aria-labelledby="request-form-heading">
        <div className="card-heading">
          <div>
            <p className="eyebrow">NEW REQUEST</p>
            <h2 id="request-form-heading">Access request form</h2>
          </div>
        </div>

        <form onSubmit={submit} className="stack-form">
          <label className="field-label" htmlFor="patient-ref-id">
            Patient reference ID
          </label>
          <input
            id="patient-ref-id"
            className="text-field"
            type="text"
            required
            placeholder="e.g. PHR-A1B2C3D4E5"
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}
          />

          <div className="form-row">
            <div>
              <label className="field-label" htmlFor="request-purpose">
                Stated purpose
              </label>
              <select
                id="request-purpose"
                className="text-field"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as ConsentPurpose)}
              >
                <option value="treatment">Direct Clinical Treatment</option>
                <option value="care_coordination">Care Coordination / Referral</option>
                <option value="diagnostic_review">Diagnostic Review / Second Opinion</option>
                <option value="emergency_break_glass">Emergency Care</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="request-duration">
                Requested duration
              </label>
              <select
                id="request-duration"
                className="text-field"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={15}>15 minutes (single consultation)</option>
                <option value={60}>1 hour (standard visit)</option>
                <option value={240}>4 hours (day procedure/observation)</option>
                <option value={1440}>24 hours (hospital admission)</option>
                <option value={10080}>7 days (multi-day care)</option>
              </select>
            </div>
          </div>

          <button className="primary-button compact-button" type="submit" disabled={busy} style={{ marginTop: "20px" }}>
            {busy ? "Sending request..." : <><Send size={15} /> Send access request</>}
          </button>

          {error && <p className="form-message" role="alert" style={{ borderColor: "#9b3834", background: "#fdf5f5" }}>{error}</p>}
        </form>

        {successConsent && (
          <div style={{ marginTop: "20px", padding: "16px", borderRadius: "8px", background: "#f2f7f4", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={18} color="var(--accent)" />
              <b style={{ fontSize: "14px" }}>
                {successConsent.status === "granted" ? "Access is active!" : "Access request submitted"}
              </b>
            </div>
            <p className="muted-copy" style={{ marginTop: "6px" }}>
              {successConsent.status === "granted"
                ? "You already have active, granted consent for this patient."
                : `Request sent to ${successConsent.patient_name} (${successConsent.patient_reference_id}). The patient must log in and approve your request before records become visible.`}
            </p>
            <div style={{ marginTop: "12px" }}>
              <Link
                href={`/patient/${successConsent.patient_reference_id}`}
                className="primary-button compact-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
              >
                <FileText size={15} /> Open patient view <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* RECENT ACCESS REQUESTS BY THIS PROVIDER */}
      <section className="timeline-section" aria-labelledby="provider-requests-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR REQUESTS</p>
            <h2 id="provider-requests-heading">Recent access status ({myRequests.length})</h2>
          </div>
        </div>

        {loadingHistory ? (
          <div className="skeleton skeleton-card" />
        ) : myRequests.length ? (
          <div className="timeline-list">
            {myRequests.map((item) => {
              const isActive = item.status === "granted" && item.expires_at && new Date(item.expires_at) > new Date();

              return (
                <article key={item.id} className="content-card">
                  <div className="card-heading">
                    <div>
                      <span className="category-label">{item.purpose.replace("_", " ")}</span>
                      <h3 style={{ margin: "4px 0 0", fontSize: "15px" }}>
                        {item.patient_name} <span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: "13px" }}>({item.patient_reference_id})</span>
                      </h3>
                    </div>
                    {isActive ? (
                      <span className="status-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={14} /> Active
                      </span>
                    ) : item.status === "pending" ? (
                      <span className="pending-label">Pending</span>
                    ) : (
                      <span className="muted-copy" style={{ textTransform: "capitalize" }}>{item.status}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
                      <Clock size={14} />
                      <span>
                        {isActive
                          ? `Expires: ${new Date(item.expires_at!).toLocaleTimeString()}`
                          : `Requested on ${new Date(item.created_at).toLocaleDateString()}`}
                      </span>
                    </div>

                    <Link
                      href={`/patient/${item.patient_reference_id}`}
                      className="quiet-button"
                      style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      Open record <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No requests sent yet</h3>
            <p>Enter a patient’s reference ID above to request access to their health timeline and reports.</p>
          </div>
        )}
      </section>
    </AccountShell>
  );
}

export default function RequestAccessPage() {
  return (
    <Suspense fallback={<main className="account-loading"><div className="skeleton skeleton-card" /></main>}>
      <RequestAccessContent />
    </Suspense>
  );
}
