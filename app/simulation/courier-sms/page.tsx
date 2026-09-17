import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function CourierSimulationPage() {
  const messages = getMessages();
  const { simulation } = messages;

  return (
    <AppShell activeRoute="simulation">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <section className="max-w-2xl">
            <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{simulation.eyebrow}</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{simulation.title}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">{simulation.description}</p>
            <p className="mt-5 font-mono text-[11px] tracking-[0.08em] text-muted">{simulation.checkpointCount}</p>
          </section>
          <p className="border border-signal/30 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-signal">
            {simulation.safeNote}
          </p>
        </div>

        <section className="mt-12 grid gap-5 lg:grid-cols-[minmax(230px,0.7fr)_minmax(0,1.3fr)]">
          <div className="flex min-h-[25rem] items-center justify-center border border-navy-700 bg-navy-900 p-8">
            <div className="w-full max-w-[15rem] rounded-[2rem] border-[7px] border-navy-700 bg-navy-950 p-3 shadow-panel">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-2 pb-3 font-mono text-[9px] text-muted">
                <span>{simulation.phoneTime}</span>
                <span className="text-signal">{simulation.phoneLabel}</span>
              </div>
              <div className="mt-5 space-y-3">
                <div className="ml-auto h-2 w-16 rounded-full bg-navy-800" />
                <div className="h-16 rounded-2xl rounded-tl-sm bg-navy-850 p-3">
                  <div className="h-2 w-24 rounded-full bg-navy-700" />
                  <div className="mt-2 h-2 w-32 rounded-full bg-navy-700" />
                  <div className="mt-2 h-2 w-20 rounded-full bg-signal/50" />
                </div>
                <div className="ml-auto h-8 w-28 rounded-2xl rounded-tr-sm bg-signal/20" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[25rem] flex-col justify-between border border-white/[0.08] bg-navy-900/70 p-6 sm:p-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{simulation.foundationLabel}</p>
              <h2 className="mt-8 max-w-xl text-2xl font-semibold tracking-tight text-ice sm:text-3xl">{simulation.foundationTitle}</h2>
              <p className="mt-4 max-w-xl leading-7 text-muted">{simulation.foundationDescription}</p>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
              <span className="font-mono text-[11px] tracking-[0.08em] text-warning">{simulation.nextPhase}</span>
              <Link className="font-mono text-[11px] tracking-[0.08em] text-signal hover:text-ice" href="/">
                {simulation.returnDashboard} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
