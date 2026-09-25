"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { useProfileAvatar } from "@/features/profile/avatar-persistence";
import { getCallsign } from "@/lib/session/session";
import { buildActivityGrid, getReportActivity } from "@/features/profile/activity";
import { moduleIds, useLocalProgress, type PracticeProgress } from "./progress";

export function DashboardModuleStatus() {
  const messages = getMessages();
  const progress = useLocalProgress();
  return <span>{progress.courierSmsCompleted ? messages.dashboard.progressCompleted : messages.dashboard.progressValue}</span>;
}

export function DashboardStreak() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const { avatarUrl } = useProfileAvatar();
  const activeDays = Math.min(progress.currentStreak, 7);
  const week = getLastWeek(messages.insights.daysShort);

  return (
    <section className="dashboard-streak" aria-label={formatStreak(progress.currentStreak, messages.progress)}>
      <div className="dashboard-streak__head">
        <span className="dashboard-streak__title">DAILY STREAK</span>
      </div>
      <div className="dashboard-streak__body">
        <Image alt="" aria-hidden="true" className="dashboard-streak__visual" height={144} src="/media/streak.webp" unoptimized width={144} />
        <div className="dashboard-streak__content">
          <p className="dashboard-streak__label">{messages.dashboard.streak}</p>
          <div className="dashboard-streak__value">{formatStreak(progress.currentStreak, messages.progress)}</div>
          <div className="dashboard-streak__line" aria-hidden="true">
            {week.map((day, index) => {
              const complete = activeDays > 0 && index >= 7 - activeDays;
              return <span title={day.full} className={`dashboard-streak-node ${complete ? "dashboard-streak-node--complete" : ""} ${index === 6 ? "dashboard-streak-node--current" : ""}`} key={day.full} />;
            })}
          </div>
          <div className="dashboard-streak__days" aria-hidden="true">
            {week.map((day) => <span key={day.full}>{day.short}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function getLastWeek(daysShort: readonly string[]): Array<{ short: string; full: string }> {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return {
      short: daysShort[(d.getDay() + 6) % 7] ?? "",
      full: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    };
  });
}

export function DashboardOperatorProfile() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const operator = getOperatorLevel(progress, messages.profile);
  const { avatarUrl } = useProfileAvatar();
  const [callsign] = useState(() => getCallsign());

  return (
    <section className="container-level-3 identity-plate flex flex-col justify-between p-6 sm:p-8" aria-label={messages.profile.anonymousOperator}>
      <div>
        <div className="flex items-center justify-between border-b border-navy-700 pb-3 font-mono text-xs">
          <span className="text-signal font-bold tracking-widest uppercase">OPERATOR IDENTITY</span>
          <span className="text-signal flex items-center gap-1.5 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
            ONLINE
          </span>
        </div>

        <div className="mt-6 flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-start gap-5">
          <div className="relative w-24 h-24 avatar-well sm:w-28 sm:h-28 shrink-0 overflow-hidden border border-signal/40 bg-navy-950">
            <AvatarVisual avatarUrl={avatarUrl} className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <h2 className="font-mono text-xl font-bold text-ice">{callsign ?? messages.profile.username}</h2>
            <p className="mt-1 font-mono text-xs text-signal">{operator.label} · {operator.title}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted">{messages.dashboard.profilePreviewBio}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Image alt="" className="level-plate" height={72} src={getOperatorAsset(progress)} unoptimized width={72} />
          <div>
            <p className="m-0 font-mono text-xs font-bold text-signal">{operator.label}</p>
            <p className="mt-1 text-sm text-ice">{operator.title}</p>
          </div>
        </div>

        <div className="mt-8 space-y-3 font-mono text-xs border-t border-navy-700/80 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[10px] uppercase">MASTERY LEVEL</span>
            <span className="text-ice font-bold uppercase">{messages.progress.masteryStates[progress.mastery]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted text-[10px] uppercase">EXERCISES COMPLETED</span>
            <span className="text-signal font-bold">{progress.modulesCompleted} COMPLETED</span>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-navy-700 pt-4">
        <Link className="btn-tactile w-full justify-center text-center font-mono text-xs" href="/profile">
          OPERATOR CONSOLE →
        </Link>
      </div>
    </section>
  );
}

export function ProfileProgress() {
  const messages = getMessages();
  const { profile, progress: progressCopy, training } = messages;
  const progress = useLocalProgress();
  const operator = getOperatorLevel(progress, profile);
  const { avatarUrl, error, isSaving, save } = useProfileAvatar();
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [callsign] = useState(() => getCallsign());

  const avatarMessage = error === "no_session" ? profile.avatarNoSession : error === "invalid_file" ? profile.avatarInvalid : error === "upload_failed" ? profile.avatarFailed : saveSucceeded ? profile.avatarSaved : null;

  const activity = useMemo(() => buildActivityGrid(progress), [progress]);
  const reports = useMemo(
    () =>
      getReportActivity(progress, {
        courierTitle: training.courierTitle,
        socialTitle: training.socialTitle,
        completed: profile.completed,
        pending: profile.pending,
        reportHabit: profile.emptyReports,
      }),
    [progress, training, profile],
  );

  const badgeDefs = useMemo(
    () => [
      { ...messages.insights.achievementDetails[0], unlocked: progress.courierSmsCompleted },
      { ...messages.insights.achievementDetails[1], unlocked: progress.habits.inspect },
      { ...messages.insights.achievementDetails[3], unlocked: progress.habits.verify },
      { ...messages.insights.achievementDetails[4], unlocked: progress.habits.report },
    ],
    [messages, progress],
  );
  const unlockedBadges = badgeDefs.filter((b) => b.unlocked).length;

  const statPills = [
    operator.label,
    progressCopy.masteryStates[progress.mastery],
    `${progress.modulesCompleted} ${profile.statModules}`,
    `${formatStreak(progress.currentStreak, progressCopy)} ${profile.statStreak}`,
  ];

  return (
    <div className="pf-wrap">
      <section className="pf-card" aria-label={profile.title}>
        <div className="pf-top">
          <div className="pf-identity">
            <AvatarVisual avatarUrl={avatarUrl} className="pf-avatar" round />
            <div className="min-w-0">
              <p className="pf-eyebrow">{profile.eyebrow}</p>
              <h1 className="pf-name">{callsign ?? profile.username}</h1>
              <p className="pf-sub">{profile.operatorStatus} · {operator.title}</p>
              <ul className="pf-pills" aria-label={profile.mastery}>
                {statPills.map((pill) => (
                  <li key={pill}>{pill}</li>
                ))}
              </ul>
              <div className="profile-avatar-control">
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={isSaving}
                  id="avatar-file"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const result = await save(file);
                    setSaveSucceeded(!result.error && Boolean(result.avatarUrl));
                    event.target.value = "";
                  }}
                  type="file"
                />
                <label className="profile-avatar-control__label" htmlFor="avatar-file">{isSaving ? "…" : profile.avatarUpload}</label>
                <span>{profile.avatarHelp}</span>
              </div>
              {avatarMessage ? <p aria-live="polite" className="profile-avatar-control__message">{avatarMessage}</p> : null}
            </div>
          </div>
          <div className="pf-badges">
            <p className="pf-badges__label">{profile.badges} · {unlockedBadges}/{badgeDefs.length}</p>
            <ul className="pf-badges__grid">
              {badgeDefs.map((badge) => (
                <li key={badge.title} className={`pf-badge ${badge.unlocked ? "pf-badge--on" : ""}`} title={badge.description}>
                  <span aria-hidden="true" className="pf-badge__dot" />
                  <span className="pf-badge__title">{badge.title}</span>
                  <span className="pf-badge__state">{badge.unlocked ? messages.insights.unlocked : messages.insights.locked}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pf-activity">
          <div className="pf-activity__head">
            <div>
              <h2>{profile.activityTitle}</h2>
            </div>
            <p className="pf-activity__total">{activity.total} · {activity.activeDays}d</p>
          </div>
          <div className="pf-grid-scroll">
            <div className="pf-grid" role="img" aria-label={`${profile.activityTitle}: ${activity.total}`}>
              {activity.weeks.map((week, wi) => (
                <div className="pf-week" key={wi}>
                  {week.map((day) => (
                    <span key={day.dateKey} className={`pf-cell pf-cell--${day.level}`} title={`${day.dateKey}: ${day.count}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="pf-legend">
            <span>Less</span>
            <span className="pf-cell pf-cell--0" aria-hidden="true" />
            <span className="pf-cell pf-cell--1" aria-hidden="true" />
            <span className="pf-cell pf-cell--2" aria-hidden="true" />
            <span className="pf-cell pf-cell--3" aria-hidden="true" />
            <span>More</span>
          </div>
        </div>
      </section>

      <section className="pf-card" aria-label={profile.reportActivity}>
        <div className="pf-reports__head">
          <div>
            <h2>{profile.reportActivity}</h2>
            <p>{profile.reportActivityHint}</p>
          </div>
          <Link className="pf-reports__link" href="/reports">{profile.viewReports} →</Link>
        </div>
        <ol className="pf-reports__list">
          {reports.map((report, index) => (
            <li key={report.id} className={`pf-report ${report.done ? "pf-report--done" : ""}`}>
              <span className="pf-report__num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="pf-report__meta">{report.meta}</p>
                <h3 className="pf-report__title">{report.title}</h3>
                <p className="pf-report__detail">{report.detail}</p>
              </div>
              <span className="pf-report__status">{report.status}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const masteryRailWidths: Record<PracticeProgress["mastery"], string> = {
  not_started: "0%",
  familiar: "38%",
  needs_practice: "55%",
  skilled: "100%",
};

export function InsightsProgress() {
  const messages = getMessages();
  const { insights, progress: progressCopy } = messages;
  const progress = useLocalProgress();
  const achievementDetails = insights.achievementDetails;
  const achievements = [
    { ...achievementDetails[0], unlocked: progress.courierSmsCompleted },
    { ...achievementDetails[1], unlocked: progress.habits.inspect },
    { ...achievementDetails[2], unlocked: progress.habits.inspect },
    { ...achievementDetails[3], unlocked: progress.habits.verify },
    { ...achievementDetails[4], unlocked: progress.habits.report },
  ];
  const unlocked = achievements.filter((item) => item.unlocked);
  const locked = achievements.filter((item) => !item.unlocked);
  const habits = [
    { key: progressCopy.habits.inspect, done: progress.habits.inspect },
    { key: progressCopy.habits.verify, done: progress.habits.verify },
    { key: progressCopy.habits.report, done: progress.habits.report },
  ];

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="container-level-2 p-6">
          <div className="flex items-center justify-between border-b border-navy-700 pb-3 font-mono text-xs">
            <span className="text-muted tracking-wider uppercase">{insights.progressionLabel}</span>
            <span className="text-signal font-bold">{unlocked.length} / {achievements.length}</span>
          </div>
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg font-medium text-ice">{progressCopy.skillName}</p>
              <p className="font-mono text-[11px] text-muted">{progressCopy.masteryStates[progress.mastery]}</p>
            </div>
            <div className="mt-3 h-1.5 bg-navy-700" role="progressbar" aria-valuenow={unlocked.length} aria-valuemin={0} aria-valuemax={achievements.length} aria-label={insights.currentMastery}>
              <div className="h-full bg-signal transition-all" style={{ width: masteryRailWidths[progress.mastery] }} />
            </div>
          </div>
          <dl className="mt-6 space-y-0 font-mono text-xs">
            <div className="flex items-center justify-between border-t border-navy-700/80 py-3">
              <dt className="text-muted text-[10px] uppercase">{insights.modulesCompleted}</dt>
              <dd className="m-0 text-ice font-bold">{progress.modulesCompleted} / {moduleIds.length}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-navy-700/80 py-3">
              <dt className="text-muted text-[10px] uppercase">{insights.streakTimeline}</dt>
              <dd className="m-0 text-ice font-bold">{formatStreak(progress.currentStreak, progressCopy)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-b border-navy-700/80 py-3">
              <dt className="text-muted text-[10px] uppercase">{insights.habitsLabel}</dt>
              <dd className="m-0 text-signal font-bold">
                {habits.filter((h) => h.done).map((h) => h.key).join(" · ") || progressCopy.noHabits}
              </dd>
            </div>
          </dl>
        </div>

        <section className="mt-10" aria-label={insights.achievements}>
          <div className="flex items-center justify-between border-b border-navy-700 pb-3 font-mono text-xs">
            <span className="text-signal font-bold tracking-widest uppercase">{insights.achievements}</span>
            <span className="text-muted">{insights.unlocked} {unlocked.length} · {insights.locked} {locked.length}</span>
          </div>
          <ol className="m-0 list-none p-0">
            {achievements.map((item, index) => (
              <li key={item.title} className="flex items-baseline gap-4 border-b border-navy-700/60 py-4">
                <span className={`font-mono text-xs ${item.unlocked ? "text-signal" : "text-muted"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-[0.95rem] font-medium text-ice">{item.title}</h3>
                  <p className="m-1 text-[0.8rem] leading-relaxed text-muted">{item.description}</p>
                </div>
                <span className={`shrink-0 font-mono text-[10px] tracking-[0.08em] uppercase ${item.unlocked ? "text-signal" : "text-muted"}`}>
                  {item.unlocked ? `● ${insights.unlocked}` : `○ ${insights.locked}`}
                </span>
              </li>
            ))}
          </ol>
          {!unlocked.length ? <p className="mt-4 text-sm text-muted">{insights.achievementEmpty}</p> : null}
        </section>
      </div>

      <aside className="lg:col-span-5">
        <div className="container-level-2 p-6">
          <div className="flex items-center gap-4 border-b border-navy-700/80 pb-5">
            <Image alt="" className="level-plate" height={72} src={getOperatorAsset(progress)} unoptimized width={72} />
            <div>
              <p className="m-0 font-mono text-[10px] tracking-wider text-muted uppercase">{insights.currentMastery}</p>
              <p className="mt-1 text-lg font-medium text-ice">{progressCopy.masteryStates[progress.mastery]}</p>
            </div>
          </div>
          <p className="m-0 mt-5 font-mono text-xs tracking-wider text-muted uppercase">{insights.transferCheck}</p>
          <p className="mt-2 text-lg font-medium text-ice">
            {progress.lastRetryResult ? progressCopy.retryResults[progress.lastRetryResult] : progressCopy.retryResults.none}
          </p>
          <p className="mt-3 border-t border-navy-700/80 pt-4 text-sm leading-relaxed text-muted">{insights.support}</p>
        </div>
        <p className="container-level-1 mt-6 py-3 font-mono text-xs leading-relaxed text-muted">
          {progress.modulesCompleted === 0 ? insights.emptyState : insights.streakActive}
        </p>
      </aside>
    </div>
  );
}

function AvatarVisual({ avatarUrl, className, round = false }: { avatarUrl: string | null; className: string; round?: boolean }) {
  if (avatarUrl) return <div className={`${className}${round ? " pf-avatar--round" : ""}`}><img alt="" src={avatarUrl} /></div>;
  return <div className={`${className}${round ? " pf-avatar--round" : ""}`}><Image alt="" height={192} src="/media/operator-pixel.svg" width={192} /></div>;
}

function getOperatorAsset(progress: PracticeProgress): string {
  // Level 0 lifecycle: caterpillar -> chrysalis -> butterfly.
  const stage = Math.max(0, Math.min(2, progress.modulesCompleted));
  return `/media/level${stage === 0 ? "one" : stage === 1 ? "two" : "three"}.webp`;
}

function formatStreak(value: number, copy: typeof import("@/messages/id.json")["progress"]): string {
  return `${value} ${value === 1 ? copy.day : copy.days}`;
}

function getOperatorLevel(progress: PracticeProgress, profile: typeof import("@/messages/id.json")["profile"]) {
  const level = Math.max(0, Math.min(2, progress.modulesCompleted));
  const titleKey = progress.mastery === "skilled" ? "analyst" : progress.mastery === "familiar" ? "scout" : "cadet";
  return { label: `${profile.level} ${String(level).padStart(2, "0")}`, title: profile.operatorTitles[titleKey] };
}
