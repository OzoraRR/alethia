import { AppShell } from "@/components/layout/app-shell";
import { DailyQuestPanel } from "@/features/daily/daily-quest-panel";
import { ModuleCatalog, PublishedModuleCount } from "@/features/modules/catalog";
import {
  DashboardModuleStatus,
  DashboardOperatorProfile,
  DashboardStreak,
} from "@/features/progress/progress-views";
import { getMessages } from "@/lib/i18n";

export default function DashboardPage() {
  const { dashboard } = getMessages();

  return (
    <AppShell activeRoute="dashboard">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Level 0 — Open Title & System Heading */}
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-xs">
            <span className="font-bold tracking-widest text-signal uppercase">
              01 / OPERATOR WORKSTATION
            </span>
            <span className="text-muted">SESSION 04 · PRACTICE MODE</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">
            {dashboard.greeting}
          </h1>
        </div>

        {/* 12-Column Editorial Grid: Operator Anchor + Progress Telemetry */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-5">
            <DashboardOperatorProfile />
          </div>

          <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
            <div className="container-level-2 p-6">
              <DashboardStreak />
            </div>

            <div className="container-level-1 py-3 font-mono text-xs text-muted">
              <span>ACTIVE SYSTEM ADVISORY: </span>
              <span className="text-ice">
                <PublishedModuleCount />
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <DailyQuestPanel />
        </div>

        <section aria-label={dashboard.moduleTitle} className="mt-12">
          <div className="flex items-center justify-between border-b border-navy-700 pb-3 font-mono text-xs">
            <span className="font-bold tracking-widest text-signal uppercase">
              03 / TRAINING EXERCISES
            </span>
            <span className="text-muted">PUBLISHED CONTENT ONLY</span>
          </div>
          <div className="mt-6">
            <ModuleCatalog compact limit={3} />
          </div>
        </section>

        <p className="sr-only">
          <DashboardModuleStatus />
        </p>
      </div>
    </AppShell>
  );
}
