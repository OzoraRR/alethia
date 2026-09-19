"use client";

import Image from "next/image";
import { getMessages } from "@/lib/i18n";
import { useLocalProgress, type PracticeProgress } from "./progress";

const masteryWidths: Record<PracticeProgress["mastery"], string> = {
  not_started: "0%",
  familiar: "33%",
  skilled: "66%",
  needs_practice: "45%",
};

const achievementVisuals = ["/media/levelone.webp", "/media/leveltwo.webp", "/media/levelthree.webp"];

export function DashboardModuleStatus() {
  const messages = getMessages();
  const progress = useLocalProgress();
  return <span>{progress.courierSmsCompleted ? messages.dashboard.progressCompleted : messages.dashboard.progressValue}</span>;
}

export function DashboardStreak() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const activeDays = Math.min(progress.currentStreak, 7);

  return (
    <section className="dashboard-streak" aria-label={formatStreak(progress.currentStreak, messages.progress)}>
      <div className="dashboard-streak__value">{formatStreak(progress.currentStreak, messages.progress)}</div>
      <div className="dashboard-streak__line" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => {
          const complete = index < activeDays;
          const current = activeDays === 0 ? index === 0 : index === activeDays - 1;
          return <span className={`dashboard-streak-node ${complete ? "dashboard-streak-node--complete" : ""} ${current ? "dashboard-streak-node--current" : ""}`} key={index} />;
        })}
      </div>
      <p>{formatFreeze(progress.freezesRemaining, messages.progress)}</p>
    </section>
  );
}

export function DashboardOperatorProfile() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const operator = getOperatorLevel(progress, messages.profile);

  return (
    <section className="dashboard-profile">
      <div className="dashboard-profile__image"><Image alt="Animated operator level" height={192} priority src={getOperatorAsset(progress)} unoptimized width={192} /></div>
      <div>
        <p className="font-mono text-2xl font-bold tracking-[-0.05em] text-ice">{operator.label}</p>
        <h2 className="mt-1 text-base text-muted">{operator.title}</h2>
      </div>
    </section>
  );
}

export function ProfileProgress() {
  const messages = getMessages();
  const { profile, progress: progressCopy } = messages;
  const progress = useLocalProgress();
  const operator = getOperatorLevel(progress, profile);
  const achievement = progress.badges.includes("first_practice");

  return (
    <>
      <section className="profile-steam-hero">
        <div className="profile-steam-hero__avatar" aria-hidden="true"><Image alt="" height={192} priority src="/media/operator-pixel.svg" width={192} /></div>
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tight text-ice sm:text-6xl">{profile.anonymousOperator}</h1>
        </div>
        <div className="profile-steam-hero__level">
          <div><p>{operator.label}</p><h2>{operator.title}</h2></div>
          <Image alt="Animated operator level" height={112} priority src={getOperatorAsset(progress)} unoptimized width={112} />
        </div>
      </section>

      <section className="profile-progress-line">
        <div><p className="text-lg font-medium text-ice">{progressCopy.skillName}</p><p className="mt-1 font-mono text-[11px] text-muted">{progressCopy.masteryStates[progress.mastery]}</p></div>
        <div className="profile-progress-line__track"><div style={{ width: masteryWidths[progress.mastery] }} /></div>
      </section>

      <section className="profile-achievement-collection">
        <div className="achievement-row">
          <AchievementItem compact index={0} locked={!achievement} title="Signal reader" />
          <AchievementItem compact index={1} locked={!progress.habits.verify} title="Independent route" />
          <AchievementItem compact index={2} locked={!progress.habits.report} title="Safe interruption" />
        </div>
      </section>

      <section className="profile-footer-data">
        <div aria-label={profile.streak}><p className="font-mono text-2xl text-ice">{formatStreak(progress.currentStreak, progressCopy)}</p></div>
        <div><p className="font-mono text-2xl text-ice">{formatFreeze(progress.freezesRemaining, progressCopy)}</p><p>{profile.freeze}</p></div>
        <div><p className="font-mono text-ice">{profile.indonesian}</p><p>{profile.language}</p></div>
      </section>
    </>
  );
}

export function InsightsProgress() {
  const progress = useLocalProgress();
  const achievements = [
    { title: "Pressure recognized", description: "Pause before urgency takes over.", unlocked: progress.courierSmsCompleted },
    { title: "Sender checked", description: "Inspect the channel before acting.", unlocked: progress.habits.inspect },
    { title: "Link inspected", description: "Read the route, not only the message.", unlocked: progress.habits.inspect },
    { title: "Independent route", description: "Open the official channel yourself.", unlocked: progress.habits.verify },
    { title: "Safe interruption", description: "Stop the route before it expands.", unlocked: progress.habits.report },
  ];
  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const locked = achievements.filter((achievement) => !achievement.unlocked);

  return (
    <div className="achievement-page mt-10">
      <section className="achievement-progress">
        <p>{unlocked.length} / {achievements.length}</p>
        <div><span style={{ width: `${(unlocked.length / achievements.length) * 100}%` }} /></div>
      </section>

      <AchievementSection heading="Unlocked" items={unlocked} />
      <AchievementSection heading="Locked" items={locked} locked />
    </div>
  );
}

function AchievementSection({ heading, items, locked = false }: { heading: string; items: Array<{ title: string; description: string; unlocked: boolean }>; locked?: boolean }) {
  return (
    <section className="achievement-section">
      <h2>{heading}</h2>
      {items.length ? <div className="achievement-grid">{items.map((achievement, index) => <AchievementItem description={achievement.description} index={index % achievementVisuals.length} key={achievement.title} locked={locked} title={achievement.title} />)}</div> : <p className="achievement-empty">Your first completed module will appear here.</p>}
    </section>
  );
}

function AchievementItem({ compact = false, description, index, locked, title }: { compact?: boolean; description?: string; index: number; locked: boolean; title: string }) {
  return (
    <article className={`achievement-item ${compact ? "achievement-item--compact" : ""} ${locked ? "achievement-item--locked" : ""}`}>
      <div className="achievement-item__image"><Image alt="" fill sizes={compact ? "96px" : "(min-width: 1024px) 180px, 35vw"} src={achievementVisuals[index]} unoptimized /></div>
      <div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div>
    </article>
  );
}

function formatStreak(value: number, copy: typeof import("@/messages/id.json")["progress"]): string {
  return `${value} ${value === 1 ? copy.day : copy.days}`;
}

function formatFreeze(value: number, copy: typeof import("@/messages/id.json")["progress"]): string {
  return `${value} ${copy.freezeRemaining}`;
}

function getOperatorLevel(progress: PracticeProgress, profile: typeof import("@/messages/id.json")["profile"]) {
  const level = Math.max(1, progress.modulesCompleted + 1);
  const titleKey = progress.mastery === "skilled" ? "analyst" : progress.mastery === "familiar" ? "scout" : "cadet";
  return { label: `${profile.level} ${String(level).padStart(2, "0")}`, title: profile.operatorTitles[titleKey] };
}

function getOperatorAsset(progress: PracticeProgress): string {
  const level = Math.max(1, Math.min(3, progress.modulesCompleted + 1));
  return `/media/level${level === 1 ? "one" : level === 2 ? "two" : "three"}.webp`;
}
