"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (response.ok) {
      router.replace("/admin/dashboard");
      router.refresh();
      return;
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "Login admin gagal.");
    setBusy(false);
  }

  return <main className="admin-login-stage"><Link className="admin-back" href="/login">← USER LOGIN</Link><section className="admin-login-card"><p className="font-mono text-xs font-bold tracking-[.2em] text-signal">ALETHIA // SECURE</p><h1 className="mt-2 text-3xl font-bold text-ice">Admin Console</h1><p className="mt-2 text-sm text-muted">Akses administrator terpisah. Tidak ada registrasi publik.</p><form className="mt-6" onSubmit={(event) => void submit(event)}><label className="admin-field">Username<input autoComplete="username" className="admin-input" onChange={(event) => setUsername(event.target.value)} required value={username} /></label><label className="admin-field">Password<input autoComplete="current-password" className="admin-input" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>{error ? <p className="admin-error">{error}</p> : null}<button className="admin-submit" disabled={busy} type="submit">{busy ? "VERIFYING…" : "ENTER ADMIN CONSOLE"}</button></form></section></main>;
}
