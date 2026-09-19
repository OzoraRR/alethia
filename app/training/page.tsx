import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function TrainingPage() {
  const { training } = getMessages();

  return (
    <AppShell activeRoute="training">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{training.title}</h1>
          <p className="mt-4 font-mono text-sm text-muted">{training.motivation}</p>
        </section>

        <section className="module-collection mt-10" aria-label={training.title}>
          <Link aria-label={`${training.courierTitle}. ${training.openModule}`} className="module-frame module-frame--equal" href="/simulation/courier-sms">
            <Image alt="" className="module-frame__media" fill priority sizes="(min-width: 1024px) 50vw, 100vw" src="/media/sms-phishing.webp" />
            <div className="module-frame__copy">
              <h2>{training.courierTitle}</h2>
              <p>{training.courierDescription}</p>
            </div>
          </Link>

          <Link aria-label={`${training.socialTitle}. ${training.openModule}`} className="module-frame module-frame--equal" href="/simulation/social-engineering">
            <Image alt="" className="module-frame__media" fill sizes="(min-width: 1024px) 50vw, 100vw" src="/media/social-engineering.webp" />
            <div className="module-frame__copy">
              <h2>{training.socialTitle}</h2>
              <p>{training.socialDescription}</p>
            </div>
          </Link>
        </section>

        <section className="mt-8 border-t border-white/[0.08] py-5">
          <p className="font-mono text-[11px] tracking-[0.14em] text-muted">{training.futureModuleNumber} · {training.soon}</p>
          <p className="mt-1 text-sm text-muted">{training.futureSmsTitle}</p>
        </section>
      </div>
    </AppShell>
  );
}
