"use client";

import { useEffect, useState } from "react";
import { Check, Clock, RefreshCw, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type ConsentPurpose, type ConsentView } from "@/app/lib/api-client";

const purposeLabels: Record<ConsentPurpose, string> = {
  treatment: "Direct Treatment",
  care_coordination: "Care Coordination",
  diagnostic_review: "Diagnostic Review",
  emergency_break_glass: "Emergency Break-Glass",
};

export default function ConsentsPage() {
  const [consents, setConsents] = useState<ConsentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customDurations, setCustomDurations] = useState<Record<string, number>>({});

  async function loadConsents() {
    try {
      const items = await apiFetch<ConsentView[]>("/consents/patient");
      setConsents(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load consent requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConsents();
    const interval = setInterval(loadConsents, 15000);
    return () => clearInterval(interval);
  }, []);

  async function approve(consentId: string) {
    setActingId(consentId);
    setError("");
    setMessage("");
    try {
      const duration = customDurations[consentId];
      await apiFetch<ConsentView>(`/consents/${consentId}/approve`, {
        method: "POST",
        body: JSON.stringify(duration ? { duration_minutes: duration } : {}),
      });
      setMessage("Access request approved. The provider can now view authorized records for the specified duration.");
      await loadConsents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve request.");
    } finally {
      setActingId(null);
    }
  }

  async function deny(consentId: string) {
    setActingId(consentId);
    setError("");
    setMessage("");
    try {
      await apiFetch<ConsentView>(`/consents/${consentId}/deny`, { method: "POST" });
      setMessage("Access request denied.");
      await loadConsents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deny request.");
    } finally {
      setActingId(null);
    }
  }

  async function revoke(consentId: string) {
    if (!window.confirm("Immediately revoke this provider's access? They will no longer be able to read your records.")) return;
    setActingId(consentId);
    setError("");
    setMessage("");
    try {
      await apiFetch<ConsentView>(`/consents/${consentId}/revoke`, { method: "POST" });
      setMessage("Access revoked immediately. All subsequent reads by this provider are now blocked.");
      await loadConsents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access.");
    } finally {
      setActingId(null);
    }
  }

  const now = new Date();
  const pending = consents.filter((c) => c.status === "pending");
  const active = consents.filter(
    (c) => c.status === "granted" && c.expires_at && new Date(c.expires_at) > now
  );
  const history = consents.filter(
    (c) => c.status === "revoked" || c.status === "denied" || c.status === "expired" || (c.status === "granted" && c.expires_at && new Date(c.expires_at) <= now)
  );

  return (
    <AccountShell role="patient">
      <div className="page-heading">
        <p className="eyebrow">CONSENT CONTROL</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <h1>Consent requests</h1>
          <button
            type="button"
            className="quiet-button"
            onClick={() => { setLoading(true); loadConsents(); }}
            title="Refresh requests"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
        <p>
          You hold the key to your health records. Care providers cannot read your data without your explicit approval, and you can revoke access at any time.
        </p>
      </div>

      {error && <p className="form-message" role="alert" style={{ borderColor: "#9b3834", background: "#fdf5f5" }}>{error}</p>}
      {message && <p className="form-message success-message" role="status">{message}</p>}

      {/* PENDING REQUESTS */}
      <section className="timeline-section" aria-labelledby="pending-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow" style={{ color: "#8a5800" }}>ACTION REQUIRED</p>
            <h2 id="pending-heading">Pending access requests ({pending.length})</h2>
          </div>
        </div>

        {loading && !consents.length ? (
          <div className="skeleton skeleton-card" />
        ) : pending.length ? (
          <div className="timeline-list">
            {pending.map((req) => (
              <article key={req.id} className="content-card" style={{ borderLeft: "4px solid #b87c00" }}>
                <div className="card-heading">
                  <div>
                    <span className="category-label" style={{ color: "#8a5800" }}>
                      {purposeLabels[req.purpose] || req.purpose}
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>{req.provider_name}</h3>
                    <p className="muted-copy">
                      {req.provider_specialty || "General Practice"} · {req.provider_facility || "Clinical Facility"}
                    </p>
                  </div>
                  <span className="pending-label">Pending your decision</span>
                </div>

                <div style={{ margin: "16px 0", padding: "12px", background: "#f9faf9", borderRadius: "6px", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Clock size={16} color="var(--muted)" />
                    <span><b>Requested duration:</b> {req.duration_minutes} minutes</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label htmlFor={`duration-${req.id}`} style={{ fontSize: "12px", color: "var(--muted)" }}>Adjust duration before approving:</label>
                    <select
                      id={`duration-${req.id}`}
                      className="text-field"
                      style={{ height: "32px", width: "auto", minHeight: "32px", padding: "0 8px", fontSize: "12px" }}
                      value={customDurations[req.id] || req.duration_minutes}
                      onChange={(e) => setCustomDurations({ ...customDurations, [req.id]: Number(e.target.value) })}
                    >
                      <option value={15}>15 minutes (quick visit)</option>
                      <option value={60}>1 hour (consultation)</option>
                      <option value={240}>4 hours (extended observation)</option>
                      <option value={1440}>24 hours (hospital stay)</option>
                      <option value={10080}>7 days (care coordination)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    className="primary-button compact-button"
                    style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}
                    disabled={actingId === req.id}
                    onClick={() => approve(req.id)}
                  >
                    <Check size={16} /> Approve access
                  </button>
                  <button
                    type="button"
                    className="quiet-button danger-button"
                    style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}
                    disabled={actingId === req.id}
                    onClick={() => deny(req.id)}
                  >
                    <X size={16} /> Deny
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No pending requests</h3>
            <p>When a healthcare provider scans your QR code or enters your reference ID, their request will appear here for your review.</p>
          </div>
        )}
      </section>

      {/* ACTIVE ACCESS GRANTS */}
      <section className="timeline-section" aria-labelledby="active-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CURRENTLY AUTHORIZED</p>
            <h2 id="active-heading">Active access grants ({active.length})</h2>
          </div>
        </div>

        {active.length ? (
          <div className="timeline-list">
            {active.map((grant) => {
              const expiresDate = grant.expires_at ? new Date(grant.expires_at) : null;
              const minsLeft = expiresDate ? Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 60000)) : null;

              return (
                <article key={grant.id} className="content-card" style={{ borderLeft: "4px solid var(--accent)" }}>
                  <div className="card-heading">
                    <div>
                      <span className="category-label">{purposeLabels[grant.purpose] || grant.purpose}</span>
                      <h3 style={{ margin: "4px 0 0", fontSize: "16px" }}>{grant.provider_name}</h3>
                      <p className="muted-copy">
                        {grant.provider_specialty} · {grant.provider_facility}
                      </p>
                    </div>
                    <span className="status-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <ShieldCheck size={14} /> Active access
                    </span>
                  </div>

                  <div style={{ margin: "14px 0", padding: "10px 14px", background: "#f2f7f4", borderRadius: "6px", fontSize: "12px", color: "var(--foreground)" }}>
                    <p style={{ margin: 0 }}>
                      <b>Expires:</b> {expiresDate?.toLocaleTimeString()} ({minsLeft !== null ? `${minsLeft} min remaining` : "active"})
                    </p>
                    <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                      Granted on {grant.granted_at ? new Date(grant.granted_at).toLocaleDateString() : ""} for {grant.duration_minutes} minutes.
                    </p>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="quiet-button danger-button"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                      disabled={actingId === grant.id}
                      onClick={() => revoke(grant.id)}
                    >
                      <ShieldAlert size={16} /> Revoke access immediately
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No providers currently have access</h3>
            <p>Your records are completely private to you. Any temporary grants you approve will be listed here.</p>
          </div>
        )}
      </section>

      {/* PAST / REVOKED / EXPIRED HISTORY */}
      {history.length > 0 && (
        <section className="timeline-section" aria-labelledby="history-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PAST ACCESS</p>
              <h2 id="history-heading">Consent history ({history.length})</h2>
            </div>
          </div>
          <div className="timeline-list">
            {history.slice(0, 10).map((item) => (
              <article key={item.id} className="content-card" style={{ opacity: 0.85 }}>
                <div className="card-heading">
                  <div>
                    <span className="category-label" style={{ color: "var(--muted)" }}>
                      {purposeLabels[item.purpose] || item.purpose}
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: "14px" }}>{item.provider_name}</h3>
                    <p className="muted-copy">{item.provider_facility}</p>
                  </div>
                  <span
                    className="muted-copy"
                    style={{
                      textTransform: "capitalize",
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: item.status === "revoked" ? "#fae8e8" : "#f1f3f1",
                      color: item.status === "revoked" ? "#9b3834" : "var(--muted)",
                    }}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="muted-copy" style={{ fontSize: "11px", marginTop: "6px" }}>
                  {item.status === "revoked" && item.revoked_at ? `Revoked on ${new Date(item.revoked_at).toLocaleString()}` : `Created on ${new Date(item.created_at).toLocaleDateString()}`}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="phase-disclaimer">
        Revocation takes effect immediately in the database and clears active caching. Subsequent provider read attempts are instantly blocked.
      </p>
    </AccountShell>
  );
}
