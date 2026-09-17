"use client";

import { getMessages } from "@/lib/i18n";
import { useLocalProgress, type PracticeProgress } from "./progress";

const masteryWidths: Record<PracticeProgress["mastery"], string> = {
  not_started: "0%",
  familiar: "33%",
  skilled: "66%",
  needs_practice: "45%",
};

export function DashboardModuleStatus() {
  const messages = getMessages();
  const progress = useLocalProgress();

  return <span>{progress.courierSmsCompleted ? messages.dashboard.progressCompleted : messages.dashboard.progressValue}</span>;
}

export function DashboardProgress() {
  const messages = getMessages();
  const progressCopy = messages.progress;
  const dashboard = messages.dashboard;
  const progress = useLocalProgress();
  const masteryLabel = progressCopy.masteryStates[progress.mastery];

  return (
    <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
      <section className="border border-white/[0.08] bg-navy-900/70 p-6">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{dashboard.skillSummary}</p>
        <div className="mt-8 flex items-end justify-between gap-4">
          <p className="max-w-[15rem] text-lg font-medium leading-7 text-ice">{progressCopy.skillName}</p>
          <span className="shrink-0 font-mono text-[10px] text-warning">{masteryLabel}</span>
        </div>
        <div className="mt-5 h-1 bg-navy-700">
          <div className="h-full bg-signal" style={{ width: masteryWidths[progress.mastery] }} />
        </div>
      </section>

      <section className="border border-white/[0.08] bg-navy-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{dashboard.streak}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-ice">{formatStreak(progress.currentStreak, progressCopy)}</p>
          </div>
          <span aria-hidden="true" className="text-2xl text-signal">◌</span>
        </div>
        <p className="mt-5 font-mono text-[11px] text-muted">{formatFreeze(progress.freezesRemaining, progressCopy)}</p>
        <p className="mt-3 text-xs leading-5 text-muted">{dashboard.masteryNote}</p>
      </section>
    </aside>
  );
}

export function ProfileProgress() {
  const messages = getMessages();
  const profile = messages.profile;
  const progressCopy = messages.progress;
  const progress = useLocalProgress();
  const masteryLabel = progressCopy.masteryStates[progress.mastery];

  return (
    <>
      <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
        <section className="border border-white/[0.08] bg-navy-900/70 p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{profile.mastery}</p>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <p className="text-xl font-medium text-ice">{progressCopy.skillName}</p>
            <span className="font-mono text-[10px] tracking-[0.08em] text-warning">{masteryLabel}</span>
          </div>
          <div className="mt-6 h-1 bg-navy-700">
            <div className="h-full bg-signal" style={{ width: masteryWidths[progress.mastery] }} />
          </div>
        </section>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <ProfileStat label={profile.streak} value={formatStreak(progress.currentStreak, progressCopy)} />
          <ProfileStat label={profile.freeze} value={formatFreeze(progress.freezesRemaining, progressCopy)} />
        </div>
      </div>

      <section className="mt-5 border border-white/[0.08] bg-navy-900/50 p-6 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{profile.badges}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <span className={`border px-3 py-2 font-mono text-xs ${progress.badges.includes("first_practice") ? "border-signal/50 text-signal" : "border-navy-700 text-muted"}`}>
            {progressCopy.firstBadge}
          </span>
          <p className="text-sm leading-6 text-muted">
            {progress.badges.includes("first_practice") ? profile.badgeEarned : profile.badgeValue}
          </p>
        </div>
      </section>
    </>
  );
}

export function InsightsProgress() {
  const messages = getMessages();
  const insights = messages.insights;
  const progressCopy = messages.progress;
  const progress = useLocalProgress();
  const retryResultKey = progress.lastRetryResult ?? "none";
  const habitItems = [
    { key: "inspect", label: progressCopy.habits.inspect },
    { key: "verify", label: progressCopy.habits.verify },
    { key: "report", label: progressCopy.habits.report },
  ] as const;
  const practisedHabits = habitItems.filter((habit) => progress.habits[habit.key]);

  return (
    <>
      <div className="mt-12 grid gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 xl:grid-cols-4">
        <InsightMetric label={insights.modulesCompleted} value={String(progress.modulesCompleted)} />
        <InsightMetric label={insights.habitsPractised} value={practisedHabits.length ? String(practisedHabits.length) : progressCopy.noHabits} />
        <InsightMetric label={insights.currentMastery} value={progressCopy.masteryStates[progress.mastery]} />
        <InsightMetric label={insights.lastRetry} value={progressCopy.retryResults[retryResultKey]} />
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.65fr)]">
        <div className="border border-white/[0.08] bg-navy-900/70 p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{insights.habitsLabel}</p>
          {practisedHabits.length ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {practisedHabits.map((habit) => (
                <span key={habit.key} className="border border-signal/40 bg-signal/[0.05] px-3 py-2 font-mono text-xs text-signal">
                  <span aria-hidden="true">✓ </span>{habit.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-2xl font-medium text-muted">{progressCopy.noHabits}</p>
          )}
        </div>
        <p className="border border-signal/20 bg-signal/[0.04] p-6 text-sm leading-7 text-muted sm:p-8">{insights.support}</p>
      </section>
    </>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <section className="border border-white/[0.08] bg-navy-900/70 p-6">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-6 text-2xl font-semibold tracking-tight text-ice">{value}</p>
    </section>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-36 bg-navy-900/80 p-6 sm:min-h-44 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-8 text-2xl font-semibold tracking-tight text-ice">{value}</p>
    </div>
  );
}

function formatStreak(value: number, copy: typeof import("@/messages/id.json")["progress"]): string {
  return `${value} ${value === 1 ? copy.day : copy.days}`;
}

function formatFreeze(value: number, copy: typeof import("@/messages/id.json")["progress"]): string {
  return `${value} ${copy.freezeRemaining}`;
}

