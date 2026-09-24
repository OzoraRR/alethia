import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";

export default function TrainingPage() {
  const { training } = getMessages();
  return (
    <AppShell activeRoute="training">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{training.title}</h1>
        <section className="module-collection mt-10" aria-label={training.title}>
          <Link aria-label={`${training.courierTitle}. ${training.openModule}`} className="module-frame module-frame--equal" href="/simulation/courier-sms">
            <Image alt="" className="module-frame__media" fill priority sizes="(min-width: 1024px) 50vw, 100vw" src="/media/sms-phishing.webp" />
            <div className="module-frame__copy"><h2>{training.courierTitle}</h2><p>{training.courierDescription}</p></div>
          </Link>
          <Link aria-label={`${training.socialTitle}. ${training.openModule}`} className="module-frame module-frame--equal" href="/simulation/social-engineering">
            <Image alt="" className="module-frame__media" fill sizes="(min-width: 1024px) 50vw, 100vw" src="/media/social-engineering.webp" />
            <div className="module-frame__copy"><h2>{training.socialTitle}</h2><p>{training.socialDescription}</p></div>
          </Link>
          <Link aria-label={`${training.fileTitle}. ${training.openModule}`} className="module-frame module-frame--equal bg-navy-850" href="/simulation/executable-file">
            <div className="module-frame__copy"><h2>{training.fileModuleNumber} · {training.fileTitle}</h2><p>{training.fileDescription}</p></div>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
