import { AppShell } from "@/components/layout/app-shell";
import { CourierSmsSimulation } from "@/features/simulation/components/courier-sms-simulation";

export default function CourierSimulationPage() {
  return (
    <AppShell activeRoute="simulation">
      <CourierSmsSimulation />
    </AppShell>
  );
}
