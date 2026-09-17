import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardModuleStatus, DashboardProgress } from "@/features/progress/progress-views";
import { getMessages } from "@/lib/i18n";

export default function DashboardPage() {
  const messages = getMessages();
  const { dashboard } = messages;

  return (
    <AppShell activeRoute="dashboard">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{dashboard.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-5xl">
            {dashboard.greeting}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">{dashboard.summary}</p>
        </section>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
          <section className="relative overflow-hidden border border-navy-700 bg-navy-900 p-6 shadow-panel sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-signal/10 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] tracking-[0.18em] text-signal">{dashboard.currentChallenge}</p>
                <span className="font-mono text-[11px] tracking-[0.14em] text-muted">{dashboard.moduleNumber}</span>
              </div>
              <h2 className="mt-12 max-w-lg text-2xl font-semibold tracking-tight text-ice sm:text-3xl">
                {dashboard.moduleTitle}
              </h2>
              <p className="mt-3 max-w-lg leading-7 text-muted">{dashboard.moduleDescription}</p>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-[11px] tracking-[0.08em] text-muted">
                <span>{dashboard.checkpointCount}</span>
                <span className="h-1 w-1 rounded-full bg-signal" />
                <DashboardModuleStatus />
              </div>

              <Link
                className="mt-8 inline-flex min-h-11 items-center justify-center border border-signal bg-signal px-5 font-mono text-xs font-bold tracking-[0.1em] text-navy-950 transition hover:bg-signal/90"
                href="/simulation/courier-sms"
              >
                {dashboard.startPractice}
                <span aria-hidden="true" className="ml-4 text-base">→</span>
              </Link>
            </div>
          </section>

          <DashboardProgress />
        </div>
      </div>
    </AppShell>
  );
}
