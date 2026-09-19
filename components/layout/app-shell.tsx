import Link from "next/link";
import { getMessages } from "@/lib/i18n";

type NavKey = "dashboard" | "simulation" | "reports" | "training" | "insights" | "profile";
type VisibleNavKey = Exclude<NavKey, "simulation">;

const navItems: ReadonlyArray<{ key: VisibleNavKey; href: string }> = [
  { key: "dashboard", href: "/" },
  { key: "reports", href: "/reports" },
  { key: "training", href: "/training" },
  { key: "insights", href: "/insights" },
  { key: "profile", href: "/profile" },
];

type AppShellProps = {
  activeRoute: NavKey;
  children: React.ReactNode;
};

export function AppShell({ activeRoute, children }: AppShellProps) {
  const messages = getMessages();

  return (
    <div className="min-h-screen bg-navy-950 text-ice">
      <header className="border-b border-white/[0.08] bg-navy-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link className="group flex min-w-0 items-center gap-3" href="/">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-signal/60 font-mono text-sm font-bold text-signal shadow-signal"
            >
              A
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-sm font-bold tracking-[0.18em] text-ice">
                {messages.brand.name}
              </span>
              <span className="hidden truncate text-xs text-muted sm:block">
                {messages.brand.descriptor}
              </span>
            </span>
          </Link>

          <span className="hidden shrink-0 font-mono text-[10px] tracking-[0.18em] text-muted sm:block">
            {messages.common.foundation}
          </span>
        </div>

        <nav
          aria-label={messages.common.primaryNavigation}
          className="mx-auto max-w-7xl overflow-x-auto px-5 sm:px-8"
        >
          <ul className="flex min-w-max gap-1">
            {navItems.map((item) => {
              const isActive = activeRoute === item.key;

              return (
                <li key={item.key}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`block border-b-2 px-3 py-3 font-mono text-[11px] tracking-[0.08em] transition-colors sm:px-4 ${
                      isActive
                        ? "border-signal text-signal"
                        : "border-transparent text-muted hover:border-navy-700 hover:text-ice"
                    }`}
                    href={item.href}
                  >
                    {messages.nav[item.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main-content">{children}</main>

      <footer className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-8 font-mono text-[10px] tracking-[0.12em] text-muted sm:px-8">
        <span>{messages.brand.name}</span>
        <span>{messages.common.simulationOnly}</span>
      </footer>
    </div>
  );
}
