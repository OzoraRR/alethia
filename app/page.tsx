import Link from "next/link";
import { LandingJourney } from "@/components/landing/landing-journey";
import { getMessages } from "@/lib/i18n";

export default function LandingPage() {
  const { brand, landing } = getMessages();
  return (
    <div className="min-h-screen bg-navy-950 text-ice">
      <header className="border-b border-navy-700">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="brand-mark">A_</span>
            <span className="font-mono text-sm font-bold tracking-[0.2em]">{brand.name}</span>
          </span>
          <Link className="btn-tactile" href="/login">{landing.enter} →</Link>
        </div>
      </header>

      <LandingJourney landing={landing} />
      <footer className="border-t border-navy-700 px-5 py-4 sm:px-8">
        <p className="mx-auto max-w-7xl font-mono text-[11px] text-muted">ALETHIA · HUMAN-CENTRED SECURITY PRACTICE</p>
      </footer>
    </div>
  );
}
