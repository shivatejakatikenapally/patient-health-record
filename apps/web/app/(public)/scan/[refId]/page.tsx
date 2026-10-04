import Link from "next/link";
import { ArrowLeft, Building2, Fingerprint, ShieldCheck } from "lucide-react";

export default async function ScanLanding({ params }: { params: Promise<{ refId: string }> }) {
  const { refId } = await params;
  const masked = refId.length > 6 ? `${refId.slice(0, 3)}•••${refId.slice(-2)}` : refId;
  return <main className="scan-shell"><Link className="back-link" href="/"><ArrowLeft size={16} /> Back</Link><div className="scan-card"><span className="scan-icon"><Fingerprint size={25} /></span><p className="eyebrow">PATIENT REFERENCE</p><h1>Record identified</h1><p className="scan-copy">Reference <b>{masked}</b> points to a patient-held record. No health information has been opened.</p><div className="scan-rule"><ShieldCheck size={20} /><span><b>Identification is not authorization.</b><small>A provider must sign in and request access. The patient decides whether to approve it.</small></span></div><Link className="primary-link" href="/?role=provider"><Building2 size={17} /> Continue as a healthcare provider</Link><p className="phase-note">Phase 0: reference lookup is a safe demonstration and does not query patient data.</p></div></main>;
}
