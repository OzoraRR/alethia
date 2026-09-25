"use client";

import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useState } from "react";
import { useAuthProfile } from "@/features/profile/auth-profile";
import {
  DashboardModuleStatus,
  DashboardOperatorProfile,
  DashboardStreak,
} from "@/features/progress/progress-views";
import { getMessages } from "@/lib/i18n";

export default function DashboardPage() {
  const { dashboard } = getMessages();
  const { state, profile, isLoading, isAuthenticated, error: profileError, signOut } = useAuthProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  return (
    <AppShell activeRoute="dashboard">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Level 0 — Open Title & System Heading */}
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-xs">
            <span className="text-signal font-bold tracking-widest uppercase">
              01 / WORKSTATION
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">
            {profile?.username
              ? `${dashboard.greeting}${profile.username}`
              : dashboard.greeting.trim().replace(/,$/, "")}
          </h1>
        </div>

        {/* 12-Column Editorial Grid: Operator Anchor + Progress Telemetry */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Operator Identity Hero Anchor (5 cols) */}
          <div className="lg:col-span-5">
            <DashboardOperatorProfile />
          </div>

          {/* Progress Telemetry & Active Objective (7 cols) */}
          <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
            {/* Streak Telemetry Instrument */}
            <div className="container-level-2 p-6">
              <DashboardStreak />
            </div>

            {/* Quick Status Notice */}
            <div className="container-level-1 py-3 font-mono text-xs text-muted">
              <span>ACTIVE SYSTEM ADVISORY: </span>
              <span className="text-ice">2 practice scenarios available for forensic evaluation.</span>
            </div>
          </div>
        </div>

        {/* Training Modules Section */}
        <section aria-label={dashboard.moduleTitle} className="mt-12">
          <div className="flex items-center justify-between border-b border-navy-700 pb-3 font-mono text-xs">
            <span className="text-signal font-bold tracking-widest uppercase">
              02 / TRAINING EXERCISES
            </span>
            <span className="text-muted">READY FOR SIMULATION</span>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Exercise 01: Courier SMS */}
            <article className="container-level-2 exercise-card group flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span className="text-signal font-bold">EXERCISE 01</span>
                  <span>SMISHING / SMS PHISHING</span>
                </div>
                <div className="module-thumb" aria-hidden="true">
                  <Image alt="" className="module-thumb__img" height={400} src="/media/sms-phishing.webp" unoptimized width={640} />
                </div>
                <h2 className="mt-3 text-2xl font-bold text-ice group-hover:text-signal transition-colors">
                  {dashboard.moduleTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {dashboard.moduleDescription}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-muted uppercase block">DIFFICULTY</span>
                  <span className="text-signal font-bold tracking-wider">███░░</span>
                </div>
                <Link
                  aria-label={`${dashboard.moduleTitle}. ${dashboard.startPractice}`}
                  className="btn-tactile btn-tactile-primary"
                  href="/simulation/courier-sms"
                >
                  INITIALIZE <span aria-hidden="true" className="ml-1">→</span>
                </Link>
              </div>
            </article>

            {/* Exercise 02: Social Engineering */}
            <article className="container-level-2 exercise-card group flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span className="text-signal font-bold">EXERCISE 02</span>
                  <span>MARKETPLACE FRAUD</span>
                </div>
                <div className="module-thumb" aria-hidden="true">
                  <Image alt="" className="module-thumb__img" height={400} src="/media/social-engineering.webp" unoptimized width={640} />
                </div>
                <h2 className="mt-3 text-2xl font-bold text-ice group-hover:text-signal transition-colors">
                  {dashboard.socialTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {dashboard.socialDescription}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-muted uppercase block">DIFFICULTY</span>
                  <span className="text-warning font-bold tracking-wider">████░</span>
                </div>
                <Link
                  aria-label={`${dashboard.socialTitle}. ${dashboard.openModule}`}
                  className="btn-tactile btn-tactile-primary"
                  href="/simulation/social-engineering"
                >
                  INITIALIZE <span aria-hidden="true" className="ml-1">→</span>
                </Link>
              </div>
            </article>
          </div>
        </section>

        <p className="sr-only">
          <DashboardModuleStatus />
        </p>
      </div>
    </AppShell>
  );
}
