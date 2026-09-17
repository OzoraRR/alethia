import { AppShell } from "@/components/layout/app-shell";
import { ProfileProgress } from "@/features/progress/progress-views";
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

        <ProfileProgress />

        <section className="mt-5 border border-white/[0.08] bg-navy-900/50 p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{profile.language}</p>
          <p className="mt-8 font-mono text-sm text-ice">{profile.indonesian}</p>
          <p className="mt-2 font-mono text-sm text-muted">{profile.english}</p>
          <p className="mt-6 text-xs leading-5 text-muted">{profile.languageNote}</p>
        </section>
      </div>
    </AppShell>
  );
}
