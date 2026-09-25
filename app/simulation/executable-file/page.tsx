import { AppShell } from "@/components/layout/app-shell";
import { ExecutableFileSimulation } from "@/features/executable-file/components/executable-file-simulation";

export default function ExecutableFileSimulationPage() {
  return <AppShell activeRoute="simulation"><ExecutableFileSimulation /></AppShell>;
}
