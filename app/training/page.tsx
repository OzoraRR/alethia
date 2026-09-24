import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function TrainingPage() {
  const { training } = getMessages();

  return (
    <AppShell activeRoute="training">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Level 0 — Open Title & Description */}
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex items-center gap-3 font-mono text-xs text-signal font-bold uppercase tracking-widest">
            <span>02 / EXERCISE INDEX</span>
            <span className="text-navy-700">·</span>
            <span className="text-muted">3 ACTIVE PRACTICE SCENARIOS</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">
            {training.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Structured forensic analysis modules designed to build critical threat recognition and verification habits.
          </p>
        </div>

        {/* Exercise Grid — 3×3, background-art cells */}
        <section aria-label={training.title} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Cell 01 — Courier SMS (live) */}
          <article className="container-level-2 exercise-card group relative min-h-[22rem] overflow-hidden">
            <Image alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-right" fill sizes="(min-width: 1024px) 30vw, 100vw" src="/media/sms-phishing.webp" unoptimized />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-transparent" />
            <div className="relative flex min-h-[22rem] flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span className="font-bold text-signal">EXERCISE 01</span>
                  <span>SMISHING</span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-ice transition-colors group-hover:text-signal">
                  {training.courierTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {training.courierDescription}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
                <span className="font-bold text-signal">READY</span>
                <Link
                  aria-label={`${training.courierTitle}. ${training.openModule}`}
                  className="btn-tactile btn-tactile-primary px-4 py-1.5"
                  href="/simulation/courier-sms"
                >
                  OPEN <span aria-hidden="true" className="ml-1">→</span>
                </Link>
              </div>
            </div>
          </article>

          {/* Cell 02 — Social Engineering (live) */}
          <article className="container-level-2 exercise-card group relative min-h-[22rem] overflow-hidden">
            <Image alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-right" fill sizes="(min-width: 1024px) 30vw, 100vw" src="/media/social-engineering.webp" unoptimized />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-transparent" />
            <div className="relative flex min-h-[22rem] flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span className="font-bold text-signal">EXERCISE 02</span>
                  <span>MARKETPLACE FRAUD</span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-ice transition-colors group-hover:text-signal">
                  {training.socialTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {training.socialDescription}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
                <span className="font-bold text-signal">READY</span>
                <Link
                  aria-label={`${training.socialTitle}. ${training.openModule}`}
                  className="btn-tactile btn-tactile-primary px-4 py-1.5"
                  href="/simulation/social-engineering"
                >
                  OPEN <span aria-hidden="true" className="ml-1">→</span>
                </Link>
              </div>
            </div>
          </article>

          {/* Cell 03 — Malicious Document (live) */}
          <article className="container-level-2 exercise-card group relative min-h-[22rem] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-950 to-[#162b2a]" />
            <div className="relative flex min-h-[22rem] flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span className="font-bold text-signal">EXERCISE 03</span>
                  <span>DOCUMENT ANALYSIS</span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-ice transition-colors group-hover:text-signal">
                  {training.fileTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {training.fileDescription}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
                <span className="font-bold text-signal">READY</span>
                <Link
                  aria-label={`${training.fileTitle}. ${training.openModule}`}
                  className="btn-tactile btn-tactile-primary px-4 py-1.5"
                  href="/simulation/executable-file"
                >
                  OPEN <span aria-hidden="true" className="ml-1">→</span>
                </Link>
              </div>
            </div>
          </article>

          {/* Cells 03–09 — locked future slots */}
          {Array.from({ length: 6 }, (_, i) => (
            <article className="container-level-2 relative min-h-[22rem] p-6 opacity-70" key={`locked-${i}`} aria-label={`${training.futureSmsTitle} ${training.soon}`}>
              <div className="flex min-h-[19rem] flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                    <span className="font-bold">EXERCISE {String(i + 4).padStart(2, "0")}</span>
                    <span>CLASSIFIED</span>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-ice">
                    {training.futureSmsTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {training.futureSmsDescription}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
                  <span className="text-muted">{training.soon}</span>
                  <span aria-hidden="true" className="border border-navy-700 px-4 py-1.5 text-muted">○</span>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Future Modules Telemetry Note */}
        <section className="container-level-1 mt-10 py-4 font-mono text-xs text-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-signal font-bold uppercase">PLANNED EXERCISE: </span>
              <span>{training.futureSmsTitle}</span>
            </div>
            <span className="border border-navy-700 px-2 py-0.5 text-[10px] uppercase">
              {training.soon}
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
