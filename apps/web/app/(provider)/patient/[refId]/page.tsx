"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Download,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AccountShell } from "@/app/components/account-shell";
import {
  apiFetch,
  type ConsentStatusView,
  type DocumentDownloadView,
  type HealthRecord,
  type PatientDocument,
} from "@/app/lib/api-client";

type PatientSummary = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  reference_id: string;
  consent_id: string;
  consent_purpose: string;
  consent_expires_at: string;
};

export default function ProviderPatientPage() {
  const params = useParams();
  const router = useRouter();
  const refId = typeof params.refId === "string" ? params.refId.toUpperCase() : "";

  const [statusCheck, setStatusCheck] = useState<ConsentStatusView | null>(null);
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!refId) return;
    setLoading(true);
    setError("");

    try {
      // 1. Check live consent status
      const statusRes = await apiFetch<ConsentStatusView>(`/consents/provider/status/${refId}`);
      setStatusCheck(statusRes);

      if (statusRes.has_active_consent) {
        // 2. Load consented data
        const [sum, recs, docs] = await Promise.all([
          apiFetch<PatientSummary>(`/consents/patients/${refId}/summary`),
          apiFetch<HealthRecord[]>(`/consents/patients/${refId}/records`),
          apiFetch<PatientDocument[]>(`/consents/patients/${refId}/documents`),
        ]);
        setPatient(sum);
        setRecords(recs);
        setDocuments(docs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load patient record.");
    } finally {
      setLoading(false);
    }
  }, [refId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function downloadDocument(docId: string) {
    setDownloadingId(docId);
    try {
      const res = await apiFetch<DocumentDownloadView>(
        `/consents/patients/${refId}/documents/${docId}/download`
      );
      window.open(res.url, "_blank");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not open document.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <AccountShell role="provider">
      <div style={{ marginBottom: "18px" }}>
        <Link
          href="/request-access"
          className="back-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}
        >
          <ArrowLeft size={14} /> Back to access requests
        </Link>
      </div>

      {loading ? (
        <main className="account-loading">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </main>
      ) : statusCheck?.has_active_consent && patient ? (
        /* AUTHORIZED CONSENT VIEW */
        <div>
          <div className="page-heading">
            <p className="eyebrow">CONSENTED PATIENT RECORD</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h1>{patient.full_name}</h1>
                <p style={{ margin: "4px 0 0", fontFamily: "monospace", color: "var(--muted)" }}>
                  Reference ID: <b>{patient.reference_id}</b>
                  {patient.date_of_birth && ` · DOB: ${patient.date_of_birth}`}
                </p>
              </div>
              <button
                type="button"
                className="quiet-button"
                onClick={loadData}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <RefreshCw size={13} /> Refresh data
              </button>
            </div>
          </div>

          {/* ACTIVE CONSENT BANNER */}
          <div
            style={{
              padding: "14px 18px",
              background: "#eef7f3",
              border: "1px solid #c2e2d5",
              borderRadius: "8px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={22} color="var(--accent)" />
              <div>
                <b style={{ fontSize: "13px" }}>Authorized for: {patient.consent_purpose.replace("_", " ").toUpperCase()}</b>
                <p className="muted-copy" style={{ margin: "2px 0 0", fontSize: "11px" }}>
                  Every view and document download is recorded in the patient&apos;s immutable audit trail.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--accent)" }}>
              <Clock size={14} />
              <span>
                Expires at {new Date(patient.consent_expires_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* TIMELINE SECTION */}
          <section className="timeline-section" aria-labelledby="records-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">MEDICAL HISTORY</p>
                <h2 id="records-heading">Timeline entries ({records.length})</h2>
              </div>
            </div>

            {records.length ? (
              <div className="timeline-list">
                {records.map((r) => (
                  <article key={r.id} className="content-card timeline-item">
                    <div className="timeline-date">
                      {new Date(`${r.occurred_on}T12:00:00`).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="timeline-body">
                      <div className="card-heading">
                        <div>
                          <span className="category-label">{r.category}</span>
                          <h3>{r.title}</h3>
                        </div>
                      </div>
                      {r.details && <p className="muted-copy record-details" style={{ marginTop: "8px" }}>{r.details}</p>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No entries recorded</h3>
                <p>The patient has not added any timeline events yet.</p>
              </div>
            )}
          </section>

          {/* DOCUMENTS SECTION */}
          <section className="timeline-section" aria-labelledby="docs-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">REPORTS &amp; PRESCRIPTIONS</p>
                <h2 id="docs-heading">Uploaded documents ({documents.length})</h2>
              </div>
            </div>

            {documents.length ? (
              <div className="document-list">
                {documents.map((doc) => (
                  <article key={doc.id} className="content-card document-item">
                    <div className="file-icon" aria-hidden="true">
                      <FileText size={18} />
                    </div>
                    <div className="document-info">
                      <h3>{doc.original_filename}</h3>
                      <p className="muted-copy">
                        {new Date(doc.created_at).toLocaleDateString()} · {(doc.size_bytes / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      className="quiet-button"
                      disabled={downloadingId === doc.id}
                      onClick={() => downloadDocument(doc.id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <Download size={13} /> {downloadingId === doc.id ? "Opening..." : "Open"}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No documents attached</h3>
                <p>No lab reports or prescription files uploaded for this patient.</p>
              </div>
            )}
          </section>
        </div>
      ) : statusCheck?.status === "pending" ? (
        /* PENDING APPROVAL VIEW */
        <section className="content-card" style={{ maxWidth: "560px", margin: "40px auto", textAlign: "center", padding: "32px 24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#fbf2e3", color: "#8a5800", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Clock size={24} />
          </div>
          <p className="eyebrow" style={{ color: "#8a5800" }}>APPROVAL PENDING</p>
          <h2 style={{ fontSize: "22px", margin: "0 0 10px" }}>Request awaiting patient consent</h2>
          <p className="muted-copy" style={{ fontSize: "14px", lineHeight: "1.6" }}>
            You have requested access to record <b>{refId}</b>. The patient has not yet approved your request.
          </p>
          <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "10px" }}>
            <button type="button" className="primary-button compact-button" onClick={loadData}>
              <RefreshCw size={14} /> Check status again
            </button>
            <Link href="/request-access" className="quiet-button" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Back
            </Link>
          </div>
        </section>
      ) : (
        /* BLOCKED / NO ACCESS VIEW */
        <section className="content-card" style={{ maxWidth: "560px", margin: "40px auto", textAlign: "center", padding: "32px 24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#fdeeed", color: "#9b3834", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Lock size={24} />
          </div>
          <p className="eyebrow" style={{ color: "#9b3834" }}>ACCESS RESTRICTED</p>
          <h2 style={{ fontSize: "22px", margin: "0 0 10px" }}>No active consent for this record</h2>
          <p className="muted-copy" style={{ fontSize: "14px", lineHeight: "1.6" }}>
            You do not currently have authorization to view patient <b>{refId}</b>. The patient must explicitly approve a time-limited access request.
          </p>
          {error && <p className="form-message" role="alert" style={{ marginTop: "16px", borderColor: "#9b3834" }}>{error}</p>}
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "center", gap: "10px" }}>
            <Link
              href={`/request-access?refId=${refId}`}
              className="primary-button compact-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
            >
              Request access now <ArrowRight size={14} />
            </Link>
            <button type="button" className="quiet-button" onClick={() => router.push("/provider/dashboard")}>
              Return to dashboard
            </button>
          </div>
        </section>
      )}
    </AccountShell>
  );
}
