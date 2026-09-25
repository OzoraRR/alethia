"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getMessages } from "@/lib/i18n";
import { useAuthProfile } from "./auth-profile";

export function ProfileAccountPanel() {
  const messages = getMessages();
  const router = useRouter();
  const { state, profile, isLoading, isAuthenticated, error: profileError, signOut } = useAuthProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setLogoutError(null);
    const result = await signOut();
    if (result.error) setLogoutError(result.error);
    // Supabase sign-out has completed (or the local projection was cleared in
    // the hook); always return to the public landing page.
    router.replace("/");
    router.refresh();
    setIsSigningOut(false);
  }

  return (
    <section className="container-level-2 p-6 sm:p-7" aria-labelledby="profile-account-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-widest text-signal uppercase">
            SUPABASE IDENTITY
          </p>
          <h2 className="mt-1 text-xl font-bold text-ice" id="profile-account-heading">
            {messages.profile.accountTitle}
          </h2>
        </div>
        {isAuthenticated ? (
          <span className="font-mono text-[10px] font-bold tracking-widest text-signal uppercase">
            ● AUTHENTICATED
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-5 font-mono text-sm text-muted" aria-live="polite">
          {messages.profile.loadingAccount}
        </p>
      ) : isAuthenticated && profile ? (
        <>
          {profileError ? (
            <p className="mt-4 font-mono text-xs text-warning" role="status">
              {profileError}
            </p>
          ) : null}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ProfileStat label={messages.profile.username} value={profile.username} />
            <ProfileStat label={messages.profile.email} value={profile.email || "—"} />
            <ProfileStat
              label={messages.profile.mastery}
              value={messages.progress.masteryStates[profile.mastery]}
            />
            <ProfileStat
              label={messages.profile.streak}
              value={`${profile.currentStreak} ${messages.progress.days}`}
            />
          </dl>

          <div className="mt-5 border-t border-navy-700 pt-4">
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              {messages.profile.badges}
            </p>
            {profile.badges.length ? (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label={messages.profile.badges}>
                {profile.badges.map((badge) => (
                  <li className="border border-signal/40 px-2.5 py-1 font-mono text-[11px] text-signal" key={badge}>
                    {badge.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{messages.profile.badgeValue}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-navy-700 pt-4">
            <button
              className="btn-tactile"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              {isSigningOut ? messages.profile.loggingOut : `> ${messages.profile.logout.toUpperCase()}`}
            </button>
            {logoutError ? (
              <p className="font-mono text-xs text-warning" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-muted">
            {state.status === "unavailable"
              ? messages.profile.accountUnavailable
              : messages.profile.loginRequired}
          </p>
          <Link className="btn-tactile" href="/login">
            {messages.profile.openLogin} →
          </Link>
        </div>
      )}
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-signal/50 pl-3">
      <dt className="font-mono text-[10px] tracking-widest text-muted uppercase">{label}</dt>
      <dd className="mt-1 truncate font-mono text-sm font-bold text-ice" title={value}>
        {value}
      </dd>
    </div>
  );
}
