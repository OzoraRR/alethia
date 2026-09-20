"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useState } from "react";
import { getMessages } from "@/lib/i18n";
import { useProfileAvatar } from "@/features/profile/avatar-persistence";
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
      <Image alt="" aria-hidden="true" className="dashboard-streak__visual" height={144} src="/media/streak.webp" unoptimized width={144} />
      <div className="dashboard-streak__content">
        <p className="dashboard-streak__label">{messages.dashboard.streak}</p>
        <div className="dashboard-streak__value">{formatStreak(progress.currentStreak, messages.progress)}</div>
        <div className="dashboard-streak__line" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => {
            const complete = index < activeDays;
            const current = activeDays === 0 ? index === 0 : index === activeDays - 1;
            return <span className={`dashboard-streak-node ${complete ? "dashboard-streak-node--complete" : ""} ${current ? "dashboard-streak-node--current" : ""}`} key={index} />;
          })}
        </div>
      </div>
    </section>
  );
}

export function DashboardOperatorProfile() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const operator = getOperatorLevel(progress, messages.profile);
  const { avatarUrl } = useProfileAvatar();

  return (
    <section className="dashboard-profile" aria-label={messages.profile.anonymousOperator}>
      <AvatarVisual avatarUrl={avatarUrl} className="dashboard-profile__avatar" />
      <div className="min-w-0">
        <p className="dashboard-profile__name">{messages.profile.username}</p>
        <p className="dashboard-profile__bio">{messages.dashboard.profilePreviewBio}</p>
        <p className="dashboard-profile__level">{operator.label} · {operator.title}</p>
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
  const { avatarUrl, error, isSaving, save } = useProfileAvatar();
  const [saveSucceeded, setSaveSucceeded] = useState(false);

  const avatarMessage = error === "no_session" ? profile.avatarNoSession : error === "invalid_file" ? profile.avatarInvalid : error === "upload_failed" ? profile.avatarFailed : saveSucceeded ? profile.avatarSaved : null;

  return (
    <>
      <section className="profile-steam-hero">
        <div className="profile-steam-hero__identity">
          <AvatarVisual avatarUrl={avatarUrl} className="profile-steam-hero__avatar" />
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-tight text-ice sm:text-6xl">{profile.username}</h1>
            <p className="profile-steam-hero__bio">{profile.identityNote}</p>
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
        <div className="profile-steam-hero__level">
          <Image alt="" aria-hidden="true" height={96} priority src={getOperatorAsset(progress)} unoptimized width={96} />
          <div><p>{operator.label}</p><h2>{operator.title}</h2></div>
        </div>
      </section>

      <div className="profile-collection-layout">
        <section className="profile-achievement-collection" aria-label={profile.badges}>
          <div className="achievement-row">
            <AchievementItem compact description={messages.insights.achievementDetails[0].description} index={0} locked={!achievement} title={messages.insights.achievementDetails[0].title} />
            <AchievementItem compact description={messages.insights.achievementDetails[3].description} index={1} locked={!progress.habits.verify} title={messages.insights.achievementDetails[3].title} />
            <AchievementItem compact description={messages.insights.achievementDetails[4].description} index={2} locked={!progress.habits.report} title={messages.insights.achievementDetails[4].title} />
          </div>
        </section>
        <aside className="profile-side-progress">
          <section className="profile-progress-line">
            <div><p className="text-lg font-medium text-ice">{progressCopy.skillName}</p><p className="mt-1 font-mono text-[11px] text-muted">{progressCopy.masteryStates[progress.mastery]}</p></div>
            <div className="profile-progress-line__track"><div style={{ width: masteryWidths[progress.mastery] }} /></div>
          </section>
          <section className="profile-footer-data">
            <div aria-label={profile.streak} className="profile-streak-summary"><Image alt="" aria-hidden="true" height={96} src="/media/streak.webp" unoptimized width={96} /><div><p className="font-mono text-2xl text-ice">{formatStreak(progress.currentStreak, progressCopy)}</p><p>{profile.streak}</p></div></div>
            <div><p className="font-mono text-ice">{profile.indonesian}</p><p>{profile.language}</p></div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function InsightsProgress() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const achievementDetails = messages.insights.achievementDetails;
  const achievements = [
    { ...achievementDetails[0], unlocked: progress.courierSmsCompleted },
    { ...achievementDetails[1], unlocked: progress.habits.inspect },
    { ...achievementDetails[2], unlocked: progress.habits.inspect },
    { ...achievementDetails[3], unlocked: progress.habits.verify },
    { ...achievementDetails[4], unlocked: progress.habits.report },
  ];
  const unlocked = achievements.filter((item) => item.unlocked);
  const locked = achievements.filter((item) => !item.unlocked);

  return (
    <div className="achievement-page mt-10">
      <section className="achievement-progress" aria-label={`${unlocked.length} / ${achievements.length}`}>
        <p>{unlocked.length} / {achievements.length}</p>
        <div><span style={{ width: `${(unlocked.length / achievements.length) * 100}%` }} /></div>
      </section>
      <AchievementSection heading={messages.insights.unlocked} items={unlocked} />
      <AchievementSection emptyCopy={messages.insights.achievementEmpty} heading={messages.insights.locked} items={locked} locked />
    </div>
  );
}

function AchievementSection({ emptyCopy, heading, items, locked = false }: { emptyCopy?: string; heading: string; items: Array<{ title: string; description: string; unlocked: boolean }>; locked?: boolean }) {
  return (
    <section className="achievement-section">
      <h2>{heading}</h2>
      {items.length ? <div className="achievement-grid">{items.map((item, index) => <AchievementItem description={item.description} index={index % achievementVisuals.length} key={item.title} locked={locked} title={item.title} />)}</div> : <p className="achievement-empty">{emptyCopy}</p>}
    </section>
  );
}

function AchievementItem({ compact = false, description, index, locked, title }: { compact?: boolean; description?: string; index: number; locked: boolean; title: string }) {
  return (
    <article className={`achievement-item ${compact ? "achievement-item--compact" : ""} ${locked ? "achievement-item--locked" : ""}`}>
      <div className="achievement-item__image"><Image alt="" fill sizes={compact ? "64px" : "(min-width: 1024px) 180px, 35vw"} src={achievementVisuals[index]} unoptimized /></div>
      <div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div>
    </article>
  );
}

function AvatarVisual({ avatarUrl, className }: { avatarUrl: string | null; className: string }) {
  if (avatarUrl) return <div className={className}><img alt="" src={avatarUrl} /></div>;
  return <div className={className}><Image alt="" height={192} src="/media/operator-pixel.svg" width={192} /></div>;
}

function formatStreak(value: number, copy: typeof import("@/messages/id.json")["progress"]): string {
  return `${value} ${value === 1 ? copy.day : copy.days}`;
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
