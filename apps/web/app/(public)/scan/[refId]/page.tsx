import Link from "next/link";
import { ArrowLeft, Building2, Fingerprint, ShieldCheck, User } from "lucide-react";

export default async function ScanLanding({ params }: { params: Promise<{ refId: string }> }) {
  const { refId } = await params;
  const upperRef = refId.toUpperCase();
  const masked = upperRef.length > 6 ? `${upperRef.slice(0, 4)}••••${upperRef.slice(-2)}` : upperRef;

  return (
    <main className="scan-shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} /> Back to home
      </Link>
      <div className="scan-card">
        <span className="scan-icon">
          <Fingerprint size={25} />
        </span>
        <p className="eyebrow">PATIENT IDENTIFIER</p>
        <h1>Record identified</h1>
        <p className="scan-copy">
          Reference <b>{masked}</b> points to a patient-held record. No health information has been opened.
        </p>

        <div className="scan-rule">
          <ShieldCheck size={20} />
          <span>
            <b>Identification is not authorization.</b>
            <small>A provider must sign in and request access. The patient decides whether to approve it.</small>
          </span>
        </div>

        <Link className="primary-link" href={`/request-access?refId=${encodeURIComponent(upperRef)}`}>
          <Building2 size={17} /> Continue as a healthcare provider
        </Link>

        <Link
          className="quiet-button"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            width: "100%",
            marginTop: "10px",
            textDecoration: "none",
          }}
          href="/"
        >
          <User size={15} /> Sign in as the patient
        </Link>

        <p className="phase-note">
          Phase 2: QR code scanning identifies the record reference. Explicit patient approval is required for provider access.
        </p>
      </div>
    </main>
  );
}
