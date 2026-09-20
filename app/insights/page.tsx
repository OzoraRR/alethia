import { AppShell } from "@/components/layout/app-shell";
import { InsightsProgress } from "@/features/progress/progress-views";
import { getMessages } from "@/lib/i18n";

export default function InsightsPage() {
  const { insights } = getMessages();
  return <AppShell activeRoute="insights"><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"><h1 className="text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{insights.title}</h1><InsightsProgress /></div></AppShell>;
}
