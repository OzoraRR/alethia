import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardModuleStatus, DashboardOperatorProfile, DashboardStreak } from "@/features/progress/progress-views";
import { getMessages } from "@/lib/i18n";

export default function DashboardPage() {
  const { dashboard } = getMessages();

  return (
    <AppShell activeRoute="dashboard">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-ice sm:text-4xl">{dashboard.greeting}</h1>
        <DashboardStreak />
        <div className="home-layout mt-10">
          <section className="module-collection home-layout__modules" aria-label={dashboard.moduleTitle}>
            <Link aria-label={`${dashboard.moduleTitle}. ${dashboard.startPractice}`} className="module-frame module-frame--equal" href="/simulation/courier-sms">
              <Image alt="" className="module-frame__media" fill priority sizes="(min-width: 1024px) 55vw, 100vw" src="/media/sms-phishing.webp" />
              <div className="module-frame__copy"><h2>{dashboard.moduleTitle}</h2><p>{dashboard.moduleDescription}</p></div>
            </Link>
            <Link aria-label={`${dashboard.socialTitle}. ${dashboard.openModule}`} className="module-frame module-frame--equal" href="/simulation/social-engineering">
              <Image alt="" className="module-frame__media" fill sizes="(min-width: 1024px) 55vw, 100vw" src="/media/social-engineering.webp" />
              <div className="module-frame__copy"><h2>{dashboard.socialTitle}</h2><p>{dashboard.socialDescription}</p></div>
            </Link>
          </section>
          <DashboardOperatorProfile />
        </div>
        <p className="sr-only"><DashboardModuleStatus /></p>
      </div>
    </AppShell>
  );
}
