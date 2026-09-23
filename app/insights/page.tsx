import { AppShell } from "@/components/layout/app-shell";
import { InsightsProgress } from "@/features/progress/progress-views";
import { getMessages } from "@/lib/i18n";

export default function InsightsPage() {
  const { insights } = getMessages();
  return (
    <AppShell activeRoute="insights">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-xs">
            <span className="text-signal font-bold tracking-widest uppercase">
              04 / {insights.eyebrow}
            </span>
            <span className="text-muted">{insights.masteryMap}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">
            {insights.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {insights.description}
          </p>
        </div>
        <InsightsProgress />
      </div>
    </AppShell>
  );
}
