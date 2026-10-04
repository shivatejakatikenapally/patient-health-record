"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authenticate, type AccountRole } from "@/app/lib/api-client";
import { saveAccessToken } from "@/app/lib/auth";

const roles: { value: AccountRole; label: string; detail: string }[] = [
  { value: "patient", label: "Patient", detail: "Manage your health record and consent." },
  { value: "provider", label: "Healthcare provider", detail: "Create a provider account." },
  { value: "caregiver", label: "Caregiver", detail: "Assist with a patient’s digital tasks." },
];

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [role, setRole] = useState<AccountRole>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authenticate(mode, { email, password, ...(mode === "register" ? { role } : {}) });
      saveAccessToken(result.access_token);
      if (result.user.role === "patient") router.replace("/patient/dashboard");
      else if (result.user.role === "provider") router.replace("/provider/dashboard");
      else setMessage("Your caregiver account is ready. Caregiver tools are not included in this phase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="mode-switch" role="tablist" aria-label="Account action">
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => { setMode("register"); setMessage(""); }}>Create account</button>
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setMessage(""); }}>Sign in</button>
      </div>
      <form onSubmit={submit}>
        {mode === "register" && <fieldset className="role-list"><legend>Choose an account type</legend>{roles.map((item) => <label className={`role-option ${role === item.value ? "selected" : ""}`} key={item.value}><input type="radio" name="role" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)} /><span><b>{item.label}</b><small>{item.detail}</small></span></label>)}</fieldset>}
        <label className="field-label" htmlFor="email">Email address</label>
        <input id="email" className="text-field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        <label className="field-label" htmlFor="password">Password</label>
        <div className="password-wrap"><input id="password" className="text-field" type={visible ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : 1} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"} /><button type="button" className="visibility-button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Connecting</> : mode === "register" ? "Create account" : "Sign in"}</button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
      <p className="security-note">Patient records are available only to the signed-in patient in this phase. Provider access to patient records is not enabled.</p>
    </section>
  );
}
