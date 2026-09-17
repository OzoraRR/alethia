import { AppShell } from "@/components/layout/app-shell";
import { InsightsProgress } from "@/features/progress/progress-views";
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

        <InsightsProgress />
      </div>
    </AppShell>
  );
}
