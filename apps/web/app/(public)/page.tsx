import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AuthForm } from "@/app/components/auth-form";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <header className="site-header"><Link className="wordmark" href="/" aria-label="PS3 Health Record home"><span className="mark"><Activity size={19} strokeWidth={2.2} /></span><span>PS3 <small>HEALTH RECORD</small></span></Link><div className="header-status"><ShieldCheck size={16} /> Patient-held access</div></header>
      <div className="landing-grid">
        <section className="intro-panel"><p className="eyebrow">PATIENT-HELD · CONSENT-DRIVEN</p><h1>Your records.<br />Your permission.</h1><p className="intro-copy">A longitudinal health record where care providers request access and you decide what they can see, why, and for how long.</p><div className="principle"><span className="principle-icon"><ShieldCheck size={19} /></span><div><b>A QR code identifies you.</b><p>It never gives a provider access to your health information. You approve each request.</p></div></div><Link className="learn-link" href="/scan/demo-ref"><span>See how patient identification works</span><ArrowRight size={16} /></Link></section>
        <AuthForm />
      </div>
      <footer className="site-footer"><span>Phase 0 foundation · No clinical data is stored yet</span><Link href="/scan/demo-ref">Provider or patient? Start with a reference ID <ArrowRight size={13} /></Link></footer>
    </main>
  );
}
