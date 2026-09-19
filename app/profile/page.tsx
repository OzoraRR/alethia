import { AppShell } from "@/components/layout/app-shell";
import { ProfileProgress } from "@/features/progress/progress-views";

export default function ProfilePage() {
  return (
    <AppShell activeRoute="profile">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <ProfileProgress />
      </div>
    </AppShell>
  );
}
