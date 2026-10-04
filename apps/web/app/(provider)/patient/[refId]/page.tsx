import Link from "next/link";
export default async function ProviderPatientPage({ params }: { params: Promise<{ refId: string }> }) { const { refId } = await params; return <main className="placeholder-page"><p className="eyebrow">PROVIDER</p><h1>Patient {refId}</h1><p>No patient information is available in Phase 0.</p><Link href="/">Return to account access</Link></main>; }
