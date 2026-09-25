"use client";

import Link from "next/link";
import { useState } from "react";
import { useDailyActivity } from "./daily-activity-provider";
import type { DailyQuestAssignment, DailyQuestStatus } from "./daily-backend";

export function DailyQuestPanel() {
  const { activity, quests, loading, claimingQuestId, error, refresh, claimQuest } = useDailyActivity();
  const [actionError, setActionError] = useState<string | null>(null);

  async function claim(quest: DailyQuestAssignment) {
    setActionError(null);
    const result = await claimQuest(quest.id, quest.questDate);
    if (!result) setActionError("Reward belum dapat diklaim. Coba lagi.");
  }

  return (
    <section aria-label="Daily Quest" className="container-level-2 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-signal uppercase">Daily Quest // Local Date</p>
          <h2 className="mt-1 text-xl font-bold text-ice">Misi hari ini</h2>
          <p className="mt-1 text-sm text-muted">Quest, streak, dan reward mengikuti tanggal lokal akunmu.</p>
        </div>
        {activity ? (
          <div className="grid grid-cols-3 gap-px border border-navy-700 bg-navy-700 font-mono">
            <QuestMetric label="Points" value={activity.points} />
            <QuestMetric label="Streak" value={`${activity.currentStreak}d`} />
            <QuestMetric label="Best" value={`${activity.longestStreak}d`} />
          </div>
        ) : null}
      </div>

      {activity ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          <span>Quest date · {formatQuestDate(activity.questDate)}</span>
          <button className="text-signal hover:underline" onClick={() => void refresh()} type="button">
            Refresh
          </button>
        </div>
      ) : null}

      {loading && !quests.length ? (
        <p className="mt-5 border border-navy-700 p-4 font-mono text-xs text-muted">Memuat quest dari database…</p>
      ) : null}

      {!loading && !quests.length ? (
        <p className="mt-5 border border-navy-700 p-4 text-sm text-muted">Belum ada assignment quest. Muat ulang setelah sesi Supabase siap.</p>
      ) : null}

      {quests.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {quests.map((quest) => (
            <QuestCard
              busy={claimingQuestId === quest.id}
              key={quest.id}
              onClaim={() => void claim(quest)}
              quest={quest}
            />
          ))}
        </div>
      ) : null}

      {error || actionError ? <p className="mt-4 font-mono text-xs text-warning">{error ?? actionError}</p> : null}
      <p className="mt-4 font-mono text-[10px] text-muted">Reset otomatis pukul 00:00 waktu lokal. Aktifitas ganda pada hari yang sama tidak menambah streak lagi.</p>
    </section>
  );
}

function QuestCard({ quest, busy, onClaim }: { quest: DailyQuestAssignment; busy: boolean; onClaim: () => void }) {
  const percentage = Math.min(100, Math.round((quest.progressValue / Math.max(quest.targetValue, 1)) * 100));
  const status = statusCopy(quest.status);

  return (
    <article className={`flex min-h-[15rem] flex-col justify-between border p-4 transition ${quest.status === "claimed" ? "border-signal/50 bg-signal/[.05]" : "border-navy-700 bg-navy-950/45"}`}>
      <div>
        <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wider">
          <span className="text-signal">Quest {String(quest.position).padStart(2, "0")}</span>
          <span className={status.className}>{status.label}</span>
        </div>
        <h3 className="mt-3 text-base font-semibold text-ice">{quest.title}</h3>
        <p className="mt-2 text-xs leading-5 text-muted">{quest.description}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between font-mono text-[9px] text-muted">
            <span>Progress</span>
            <span>{quest.progressValue}/{quest.targetValue}</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-navy-800">
            <div className="h-full bg-signal transition-all" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-navy-700 pt-3">
        <span className="font-mono text-[10px] text-warning">+{quest.rewardPoints} pts</span>
        {quest.status === "completed" ? (
          <button className="btn-tactile btn-tactile-primary px-3 py-1.5 text-[10px]" disabled={busy} onClick={onClaim} type="button">
            {busy ? "CLAIMING…" : "CLAIM"}
          </button>
        ) : quest.status === "claimed" ? (
          <span className="font-mono text-[10px] font-bold text-signal">CLAIMED ✓</span>
        ) : questLink(quest) ? (
          <Link className="font-mono text-[10px] text-signal hover:underline" href={questLink(quest)!}>
            OPEN TASK →
          </Link>
        ) : (
          <span className="font-mono text-[10px] text-muted">AUTO COMPLETE</span>
        )}
      </div>
    </article>
  );
}

function QuestMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-navy-950 px-3 py-2 text-center">
      <span className="block text-[9px] uppercase tracking-wider text-muted">{label}</span>
      <span className="mt-1 block text-sm font-bold text-signal">{value}</span>
    </div>
  );
}

function statusCopy(status: DailyQuestStatus): { label: string; className: string } {
  if (status === "claimed") return { label: "Claimed", className: "font-bold text-signal" };
  if (status === "completed") return { label: "Ready to claim", className: "font-bold text-warning" };
  if (status === "in_progress") return { label: "In progress", className: "text-ice" };
  return { label: "Not started", className: "text-muted" };
}

function questLink(quest: DailyQuestAssignment): string | null {
  if (quest.questType === "complete_module") return "/training";
  if (quest.questType === "create_report") return "/reports";
  return null;
}

function formatQuestDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(date);
}
