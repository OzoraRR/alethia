"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import {
  clearUserScopedState,
  getActiveAccountId,
  saveCallsign,
  setActiveAccountId,
} from "@/lib/session/session";
import { mergeLocalProgressIntoAccount } from "@/features/progress/progress";
import { login as loginAccount, register as registerAccount, type Account, type AuthError } from "@/lib/auth/accounts";

const GLYPHS = "!<>-_/[]{}=+*^?#01";

function useScramble(text: string, play: boolean): string {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!play || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = 14;
    const id = setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / total) * text.length);
      let next = text.slice(0, reveal);
      for (let i = reveal; i < text.length; i += 1) {
        next += text[i] === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(next);
      if (frame >= total) {
        clearInterval(id);
        setOut(text);
      }
    }, 36);
    return () => clearInterval(id);
  }, [text, play]);
  return out;
}

export default function LoginPage() {
  const { brand, login } = getMessages();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);

  const welcome = useScramble(login.overlayWelcome, mode === "register");
  const hello = useScramble(login.overlayHello, mode === "login");

  const errorText: Record<AuthError, string> = {
    username_invalid: login.usernameInvalid,
    email_invalid: login.emailInvalid,
    password_short: login.passwordShort,
    password_mismatch: login.passwordMismatch,
    username_taken: login.usernameTaken,
    email_taken: login.emailTaken,
    invalid_credentials: login.invalidCredentials,
    email_confirmation_required: login.emailConfirmationRequired,
    rate_limited: login.rateLimited,
    unavailable: login.unavailable,
  };

  async function enter(account: Account) {
    const accountId = account.id ?? account.username;
    const previousAccountId = getActiveAccountId();

    // Never upload a previous account's local snapshot to a different account.
    // A missing marker means the snapshot is anonymous and eligible for merge.
    if (previousAccountId && previousAccountId !== accountId) {
      clearUserScopedState();
    } else {
      // Merge the anonymous/account snapshot before entering the authenticated
      // workspace. The merge is resilient and keeps local data if the network
      // is temporarily unavailable.
      await mergeLocalProgressIntoAccount();
    }

    setActiveAccountId(accountId);
    saveCallsign(account.username);
    router.replace("/dashboard");
    router.refresh();
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginAccount({ identifier, password });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      await enter(result.account);
    } catch {
      setError("unavailable");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await registerAccount({ username, email, password, confirm });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      await enter(result.account);
    } catch {
      setError("unavailable");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="neuro-stage">
      <div className="landing-stars" aria-hidden="true" />
      <div className="landing-gridfloor" aria-hidden="true" />
      <div className="neuro-top">
        <span className="neuro-brand">
          <span aria-hidden="true" className="brand-mark">A_</span>
          {brand.name}
        </span>
        <Link className="neuro-back" href="/">{login.back}</Link>
      </div>
      <div className="neuro-center">
        <div className={`neuro-gateway ${mode === "register" ? "neuro--register" : ""}`}>
          <div className="neuro-tabs" role="tablist" aria-label={login.eyebrow}>
            {(["login", "register"] as const).map((m) => (
              <button
                aria-selected={mode === m}
                className={`neuro-tab ${mode === m ? "neuro-tab--on" : ""}`}
                key={m}
                onClick={() => switchMode(m)}
                role="tab"
                type="button"
              >
                {m === "login" ? login.tabLogin : login.tabRegister}
              </button>
            ))}
          </div>

          <form className="neuro-form neuro-form--login" onSubmit={submitLogin}>
            <h1 className="neuro-title">{login.tabLogin}</h1>
            <label className="neuro-label">
              {login.identifierLabel}
              <input autoComplete="username" className="neuro-input" name="identifier" onChange={(e) => setIdentifier(e.target.value)} placeholder={login.identifierPlaceholder} required value={identifier} />
            </label>
            <label className="neuro-label">
              {login.passLabel}
              <input autoComplete="current-password" className="neuro-input" minLength={8} name="password" onChange={(e) => setPassword(e.target.value)} placeholder={login.passPlaceholder} required type="password" value={password} />
            </label>
            {mode === "login" && error ? <p className="neuro-error" role="alert">{errorText[error]}</p> : null}
            <button className="neuro-submit" disabled={busy} type="submit">
              {busy && mode === "login" ? "…" : `> ${login.loginSubmit.toUpperCase()}`}
            </button>
            <button className="neuro-switch" onClick={() => switchMode("register")} type="button">{login.switchToRegister}</button>
          </form>

          <form className="neuro-form neuro-form--register" onSubmit={submitRegister}>
            <h1 className="neuro-title">{login.tabRegister}</h1>
            <label className="neuro-label">
              {login.usernameLabel}
              <input autoComplete="username" className="neuro-input" maxLength={24} minLength={3} name="username" onChange={(e) => setUsername(e.target.value)} pattern="[A-Za-z0-9_]{3,24}" placeholder={login.usernamePlaceholder} required value={username} />
            </label>
            <label className="neuro-label">
              {login.emailLabel}
              <input autoComplete="email" className="neuro-input" name="email" onChange={(e) => setEmail(e.target.value)} placeholder={login.emailPlaceholder} required type="email" value={email} />
            </label>
            <label className="neuro-label">
              {login.passLabel}
              <input autoComplete="new-password" className="neuro-input" minLength={8} name="password" onChange={(e) => setPassword(e.target.value)} placeholder={login.passPlaceholder} required type="password" value={password} />
            </label>
            <label className="neuro-label">
              {login.confirmLabel}
              <input autoComplete="new-password" className="neuro-input" minLength={8} name="confirmPassword" onChange={(e) => setConfirm(e.target.value)} placeholder={login.passPlaceholder} required type="password" value={confirm} />
            </label>
            {mode === "register" && error ? <p className="neuro-error" role="alert">{errorText[error]}</p> : null}
            <button className="neuro-submit" disabled={busy} type="submit">
              {busy && mode === "register" ? "…" : `> ${login.registerSubmit.toUpperCase()}`}
            </button>
            <button className="neuro-switch" onClick={() => switchMode("login")} type="button">{login.switchToLogin}</button>
          </form>

          <div className="neuro-overlay-wrap">
            <div className="neuro-overlay">
              <Image alt="" aria-hidden="true" className="neuro-voxel neuro-voxel--a" height={130} src="/media/island-server.svg" unoptimized width={176} />
              <Image alt="" aria-hidden="true" className="neuro-voxel neuro-voxel--b" height={130} src="/media/island-investigation.svg" unoptimized width={176} />
              <div className="neuro-panel neuro-panel--login" aria-hidden={mode !== "register"}>
                <h2>{welcome}</h2>
                <button className="neuro-ghost" onClick={() => switchMode("login")} tabIndex={mode === "register" ? 0 : -1} type="button">
                  {`> ${login.overlayGoLogin.toUpperCase()}`}
                </button>
              </div>
              <div className="neuro-panel neuro-panel--register" aria-hidden={mode !== "login"}>
                <h2>{hello}</h2>
                <button className="neuro-ghost" onClick={() => switchMode("register")} tabIndex={mode === "login" ? 0 : -1} type="button">
                  {`> ${login.overlayGoRegister.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
