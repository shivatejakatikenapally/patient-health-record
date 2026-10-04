"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "@/app/components/account-shell";
import { apiFetch, type HealthRecord } from "@/app/lib/api-client";

const categories = ["visit", "diagnosis", "medication", "lab", "vaccination", "other"];
const blank = { category: "visit", title: "", details: "", occurred_on: new Date().toISOString().slice(0, 10) };

export default function TimelinePage() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const items = await apiFetch<HealthRecord[]>("/records");
    setRecords(items);
  }

  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load your records.")).finally(() => setLoading(false)); }, []);

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch<HealthRecord>(editing ? `/records/${editing}` : "/records", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      setForm(blank);
      setEditing(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this record.");
    } finally {
      setSaving(false);
    }
  }

  function editRecord(record: HealthRecord) {
    setEditing(record.id);
    setForm({ category: record.category, title: record.title, details: record.details, occurred_on: record.occurred_on });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeRecord(id: string) {
    if (!window.confirm("Delete this timeline entry?")) return;
    try {
      await apiFetch<void>(`/records/${id}`, { method: "DELETE" });
      setRecords((current) => current.filter((item) => item.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this record.");
    }
  }

  return <AccountShell role="patient">
    <div className="page-heading"><p className="eyebrow">PATIENT RECORD</p><h1>Health timeline</h1><p>Record visits, diagnoses, medications, lab results, and other health events.</p></div>
    <section className="content-card" aria-labelledby="record-form-title"><div className="card-heading"><h2 id="record-form-title">{editing ? "Edit entry" : "Add a timeline entry"}</h2>{editing && <button className="quiet-button" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}</div>
      <form onSubmit={saveRecord} className="stack-form">
        <label className="field-label" htmlFor="record-title">Title</label><input className="text-field" id="record-title" required minLength={2} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="For example, annual check-up" />
        <div className="form-row"><div><label className="field-label" htmlFor="record-category">Type</label><select className="text-field" id="record-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</select></div><div><label className="field-label" htmlFor="record-date">Date</label><input className="text-field" type="date" id="record-date" required value={form.occurred_on} onChange={(event) => setForm({ ...form, occurred_on: event.target.value })} /></div></div>
        <label className="field-label" htmlFor="record-details">Details <span className="optional-label">Optional</span></label><textarea className="text-field text-area" id="record-details" maxLength={8000} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Add notes that will help you remember this event" />
        <button className="primary-button compact-button" type="submit" disabled={saving}>{saving ? "Saving entry" : editing ? "Save entry" : "Add to timeline"}</button>
        {error && <p className="form-message" role="alert">{error}</p>}
      </form>
    </section>
    <section className="timeline-section" aria-labelledby="timeline-list-title"><div className="section-heading"><div><p className="eyebrow">YOUR HISTORY</p><h2 id="timeline-list-title">Entries</h2></div><span className="muted-copy">{records.length} {records.length === 1 ? "entry" : "entries"}</span></div>
      {loading ? <><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></> : records.length ? <div className="timeline-list">{records.map((record) => <article className="content-card timeline-item" key={record.id}><div className="timeline-date">{new Date(`${record.occurred_on}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div><div className="timeline-body"><div className="card-heading"><div><span className="category-label">{record.category}</span><h3>{record.title}</h3></div><div className="item-actions"><button className="quiet-button" type="button" onClick={() => editRecord(record)}>Edit</button><button className="quiet-button danger-button" type="button" onClick={() => void removeRecord(record.id)}>Delete</button></div></div>{record.details && <p className="muted-copy record-details">{record.details}</p>}</div></article>)}</div> : <div className="empty-state"><h3>No timeline entries yet</h3><p>Add a visit or health event to start building your history.</p></div>}
    </section>
  </AccountShell>;
}
