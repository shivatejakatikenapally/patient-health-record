"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type PatientDocument } from "@/app/lib/api-client";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() { setDocuments(await apiFetch<PatientDocument[]>("/documents")); }
  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load your documents.")).finally(() => setLoading(false)); }, []);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!allowed.includes(file.type)) throw new Error("Choose a PDF, JPEG, PNG, or WebP file.");
      if (file.size > MAX_FILE_BYTES) throw new Error("The selected file is larger than 8 MB.");
      await apiFetch<PatientDocument>("/documents", { method: "POST", headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) }, body: file });
      setFile(null);
      const input = document.getElementById("document-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await refresh();
      setMessage("Document uploaded to your private health record.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload this document.");
    } finally { setBusy(false); }
  }

  async function download(id: string) {
    try {
      const result = await apiFetch<{ url: string; expires_in: number }>(`/documents/${id}/download`);
      window.location.assign(result.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not open this document."); }
  }

  async function remove(id: string) {
    if (!window.confirm("Permanently delete this file from your private storage?")) return;
    try {
      await apiFetch<void>(`/documents/${id}`, { method: "DELETE" });
      setDocuments((items) => items.filter((item) => item.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this document."); }
  }

  return <AccountShell role="patient">
    <div className="page-heading"><p className="eyebrow">PATIENT RECORD</p><h1>Documents</h1><p>Store health documents in your private cloud record. Files are not stored on this device by the app.</p></div>
    <section className="content-card" aria-labelledby="upload-heading"><div className="card-heading"><h2 id="upload-heading">Upload a document</h2></div><form className="stack-form" onSubmit={upload}><label className="field-label" htmlFor="document-file">Select a PDF or image</label><input className="file-field" id="document-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><p className="muted-copy">PDF, JPEG, PNG, or WebP. Maximum file size: 8 MB.</p><button className="primary-button compact-button" type="submit" disabled={!file || busy}>{busy ? "Uploading securely" : "Upload to private storage"}</button>{error && <p className="form-message" role="alert">{error}</p>}{message && <p className="form-message success-message" role="status">{message}</p>}</form></section>
    <section className="timeline-section" aria-labelledby="documents-list-title"><div className="section-heading"><div><p className="eyebrow">PRIVATE FILES</p><h2 id="documents-list-title">Your documents</h2></div></div>
      {loading ? <><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></> : documents.length ? <div className="document-list">{documents.map((item) => <article className="content-card document-item" key={item.id}><div className="file-icon" aria-hidden="true">PDF</div><div className="document-info"><h3>{item.original_filename}</h3><p className="muted-copy">{new Date(item.created_at).toLocaleDateString()} · {(item.size_bytes / 1024).toFixed(0)} KB</p></div><button className="quiet-button" type="button" onClick={() => void download(item.id)}>Open</button><button className="quiet-button danger-button" type="button" onClick={() => void remove(item.id)}>Delete</button></article>)}</div> : <div className="empty-state"><h3>No documents yet</h3><p>Upload a report, prescription, or other health document.</p></div>}
    </section>
    <p className="phase-disclaimer">Only you can access documents in this phase. Providers do not have access to this storage.</p>
  </AccountShell>;
}
