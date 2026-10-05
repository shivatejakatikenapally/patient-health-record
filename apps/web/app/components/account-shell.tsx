"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch, type AccountRole } from "@/app/lib/api-client";
import { clearAccessToken } from "@/app/lib/auth";

const links = {
  patient: [
    { href: "/patient/dashboard", label: "Overview" },
    { href: "/timeline", label: "Timeline" },
    { href: "/documents", label: "Documents" },
    { href: "/consents", label: "Consent requests" },
  ],
  provider: [
    { href: "/provider/dashboard", label: "Profile" },
    { href: "/request-access", label: "Request access" },
  ],
};

export function AccountShell({ role, children }: { role: "patient" | "provider"; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const token = window.sessionStorage.getItem("ps3-access-token");
    if (!token) {
      router.replace("/");
      return;
    }
    apiFetch<{ id: string; email: string; role: AccountRole }>("/auth/me").then((user) => {
      if (user.role !== role) {
        router.replace(user.role === "provider" ? "/provider/dashboard" : user.role === "patient" ? "/patient/dashboard" : "/");
        return;
      }
      if (active) setReady(true);
    }).catch(() => {
      clearAccessToken();
      router.replace("/");
    });
    return () => { active = false; };
  }, [role, router]);

  function signOut() {
    clearAccessToken();
    router.replace("/");
  }

  if (!ready) return <main className="account-loading" aria-label="Loading account"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></main>;

  const roleLinks = links[role];
  return <div className="account-shell">
    <header className="account-header">
      <Link className="wordmark" href={role === "patient" ? "/patient/dashboard" : "/provider/dashboard"}><span className="mark">P</span><span>Patient-held record<small>PRIVATE HEALTH RECORD</small></span></Link>
      <button type="button" className="quiet-button sign-out" onClick={signOut}>Sign out</button>
    </header>
    <nav className="account-nav" aria-label={`${role} navigation`}>
      {roleLinks.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>{link.label}</Link>)}
    </nav>
    <main className="account-content">{children}</main>
  </div>;
}
