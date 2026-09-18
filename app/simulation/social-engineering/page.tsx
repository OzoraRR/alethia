import { AppShell } from "@/components/layout/app-shell";
import { SocialEngineeringSimulation } from "@/features/social-engineering/components/social-engineering-simulation";

export default function SocialEngineeringPage() {
  return (
    <AppShell activeRoute="simulation">
      <SocialEngineeringSimulation />
    </AppShell>
  );
}
