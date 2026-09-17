import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function TrainingPage() {
  const messages = getMessages();
  const { training } = messages;

  return (
    <AppShell activeRoute="training">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{training.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{training.title}</h1>
          <p className="mt-4 leading-7 text-muted">{training.description}</p>
        </section>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="border border-signal/40 bg-navy-900 p-6 shadow-signal sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] tracking-[0.16em] text-signal">{training.available}</span>
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted">{training.moduleNumber}</span>
            </div>
            <h2 className="mt-12 text-2xl font-semibold tracking-tight text-ice">{training.courierTitle}</h2>
            <p className="mt-3 min-h-14 leading-7 text-muted">{training.courierDescription}</p>
            <Link className="mt-8 inline-flex min-h-11 items-center border border-signal px-4 font-mono text-xs tracking-[0.08em] text-signal hover:bg-signal hover:text-navy-950" href="/simulation/courier-sms">
              {training.openModule} <span aria-hidden="true" className="ml-4">→</span>
            </Link>
          </article>

          <article className="border border-white/[0.08] bg-navy-900/50 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] tracking-[0.16em] text-warning">{training.soon}</span>
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted">{training.futureModuleNumber}</span>
            </div>
            <h2 className="mt-12 text-2xl font-semibold tracking-tight text-ice">{training.futureSmsTitle}</h2>
            <p className="mt-3 min-h-14 leading-7 text-muted">{training.futureSmsDescription}</p>
            <span className="mt-8 inline-flex min-h-11 items-center border border-navy-700 px-4 font-mono text-xs tracking-[0.08em] text-muted">
              {training.soon}
            </span>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
