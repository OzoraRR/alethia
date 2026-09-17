import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function InsightsPage() {
  const messages = getMessages();
  const { insights } = messages;

  return (
    <AppShell activeRoute="insights">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{insights.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{insights.title}</h1>
          <p className="mt-4 leading-7 text-muted">{insights.description}</p>
        </section>

        <div className="mt-12 grid gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3">
          <InsightMetric label={insights.modulesCompleted} value={insights.modulesCompletedValue} />
          <InsightMetric label={insights.habitsPractised} value={insights.habitsPractisedValue} />
          <InsightMetric label={insights.transferCheck} value={insights.transferCheckValue} />
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.65fr)]">
          <div className="border border-white/[0.08] bg-navy-900/70 p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{insights.habitsLabel}</p>
            <p className="mt-6 text-2xl font-medium text-ice">{insights.habitsDescription}</p>
            <div className="mt-8 h-1 bg-navy-700">
              <div className="h-full w-0 bg-signal" />
            </div>
          </div>
          <p className="border border-signal/20 bg-signal/[0.04] p-6 text-sm leading-7 text-muted sm:p-8">{insights.support}</p>
        </section>
      </div>
    </AppShell>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-36 bg-navy-900/80 p-6 sm:min-h-44 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-8 text-2xl font-semibold tracking-tight text-ice">{value}</p>
    </div>
  );
}

