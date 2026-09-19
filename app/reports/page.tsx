import { AppShell } from "@/components/layout/app-shell";
import { ReportHub } from "@/features/reports/report-hub";

export default function ReportsPage() {
  return (
    <AppShell activeRoute="reports">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-mono text-[11px] tracking-[0.2em] text-signal">REPORTS</p>
        <div className="mt-3 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-ice sm:text-5xl">Recognise the pattern. Interrupt the route.</h1>
          <p className="mt-4 leading-7 text-muted">A small, fictional report desk for naming common delivery channels and manipulation patterns.</p>
        </div>
        <ReportHub />
      </div>
    </AppShell>
  );
}
