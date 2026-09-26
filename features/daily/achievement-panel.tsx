"use client";

import { useDailyActivity } from "./daily-activity-provider";

export const achievementDefinitions = [
  { code: "first_module", title: "Module First", description: "Selesaikan modul latihan pertamamu." },
  { code: "all_modules", title: "Catalog Master", description: "Selesaikan seluruh modul aktif yang tersedia." },
  { code: "streak_7", title: "Seven-Day Signal", description: "Aktif selama tujuh hari berturut-turut." },
  { code: "first_report", title: "First Report", description: "Simpan laporan praktik pertamamu." },
  { code: "report_contributor", title: "Active Contributor", description: "Simpan tiga laporan praktik." },
  { code: "first_practice", title: "Practice Initiated", description: "Mulai dan selesaikan latihan pertama di Alethia." },
] as const;

export function AchievementPanel() {
  const { achievements, loading } = useDailyActivity();
  const awarded = new Map(achievements.map((achievement) => [achievement.code, achievement.awardedAt]));

  return (
    <section className="pf-card" aria-label="Database achievements">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-700 pb-4">
        <div>
          <p className="pf-eyebrow">Database Achievements</p>
          <h2 className="mt-1 text-xl font-bold text-ice">Achievement & badge</h2>
          <p className="mt-1 text-sm text-muted">Sumber utama: user_achievements. Status di bawah selalu hasil query database.</p>
        </div>
        <span className="border border-signal/40 px-2.5 py-1 font-mono text-[10px] text-signal">
          {achievements.length} UNLOCKED
        </span>
      </div>

      {loading && !achievements.length ? (
        <p className="mt-5 font-mono text-xs text-muted">Memuat achievement…</p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievementDefinitions.map((definition) => {
            const awardedAt = awarded.get(definition.code);
            const unlocked = Boolean(awardedAt);
            return (
              <article className={`border p-4 ${unlocked ? "border-signal/45 bg-signal/[.04]" : "border-navy-700 bg-navy-950/45 opacity-60"}`} key={definition.code}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-8 w-8 place-items-center border font-mono text-sm ${unlocked ? "border-signal text-signal" : "border-navy-700 text-muted"}`}>
                    {unlocked ? "★" : "○"}
                  </span>
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${unlocked ? "text-signal" : "text-muted"}`}>
                    {unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ice">{definition.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted">{definition.description}</p>
                <p className="mt-3 font-mono text-[9px] text-muted">
                  {awardedAt ? `Awarded ${formatDate(awardedAt)}` : definition.code}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
