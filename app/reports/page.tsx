import { AppShell } from "@/components/layout/app-shell";
import { ReportHub } from "@/features/reports/report-hub";

export default function ReportsPage() {
  return (
    <AppShell activeRoute="reports">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <ReportHub />
      </div>
    </AppShell>
  );
}
