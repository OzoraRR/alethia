import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function ProfilePage() {
  const messages = getMessages();
  const { profile } = messages;

  return (
    <AppShell activeRoute="profile">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{profile.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{profile.title}</h1>
          <p className="mt-4 leading-7 text-muted">{profile.description}</p>
        </section>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
          <section className="border border-white/[0.08] bg-navy-900/70 p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{profile.mastery}</p>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <p className="text-xl font-medium text-ice">{profile.skillName}</p>
              <span className="font-mono text-[10px] tracking-[0.08em] text-warning">{profile.masteryStatus}</span>
            </div>
            <div className="mt-6 h-1 bg-navy-700">
              <div className="h-full w-0 bg-signal" />
            </div>
          </section>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <ProfileStat label={profile.streak} value={profile.streakValue} />
            <ProfileStat label={profile.freeze} value={profile.freezeValue} />
          </div>
        </div>

        <section className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="border border-white/[0.08] bg-navy-900/50 p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{profile.badges}</p>
            <p className="mt-8 max-w-xs leading-7 text-muted">{profile.badgeValue}</p>
          </div>
          <div className="border border-white/[0.08] bg-navy-900/50 p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{profile.language}</p>
            <p className="mt-8 font-mono text-sm text-ice">{profile.indonesian}</p>
            <p className="mt-2 font-mono text-sm text-muted">{profile.english}</p>
            <p className="mt-6 text-xs leading-5 text-muted">{profile.languageNote}</p>
          </div>
        </section>
      </div>
    </AppShell>
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

