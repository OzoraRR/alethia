import { AppShell } from "@/components/layout/app-shell";
import { ProfileProgress } from "@/features/progress/progress-views";
import { ProfileAccountPanel } from "@/features/profile/profile-account";
import { getMessages } from "@/lib/i18n";

export default function ProfilePage() {
  const { profile } = getMessages();
  return (
    <AppShell activeRoute="profile">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-xs">
            <span className="text-signal font-bold tracking-widest uppercase">
              05 / OPERATOR DOSSIER
            </span>
            <span className="text-muted">{profile.operatorStatus}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">
            {profile.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {profile.description}
          </p>
        </div>
        <div className="mt-8">
          <ProfileAccountPanel />
          <ProfileProgress />
        </div>
      </div>
    </AppShell>
  );
}
