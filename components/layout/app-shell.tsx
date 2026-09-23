import Link from "next/link";
import { HeaderAvatar } from "./header-avatar";
import { getMessages } from "@/lib/i18n";

type NavKey = "dashboard" | "simulation" | "reports" | "training" | "insights" | "profile";
type VisibleNavKey = Exclude<NavKey, "simulation">;

const navItems: ReadonlyArray<{ key: VisibleNavKey; href: string }> = [
  { key: "dashboard", href: "/dashboard" },
  { key: "training", href: "/training" },
  { key: "reports", href: "/reports" },
  { key: "insights", href: "/insights" },
  { key: "profile", href: "/profile" },
];

type AppShellProps = { activeRoute: NavKey; children: React.ReactNode };

export function AppShell({ activeRoute, children }: AppShellProps) {
  const messages = getMessages();

  return (
    <div className="flex min-h-screen flex-col bg-navy-950 text-ice font-sans">
      {/* Quiet Command Header Strip */}
      <header className="border-b border-navy-700 bg-navy-950/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          {/* Brand & Section Indicator */}
          <div className="flex items-center gap-6">
            <Link className="group flex items-center gap-3" href="/dashboard">
              <span aria-hidden="true" className="brand-mark">
                A_
              </span>
              <span className="font-mono text-sm font-bold tracking-[0.2em] text-ice group-hover:text-signal transition-colors">
                {messages.brand.name}
              </span>
            </Link>

            <span className="hidden text-navy-700 md:inline">|</span>

            <span className="hidden font-mono text-[11px] tracking-widest text-muted uppercase md:inline">
              [ {messages.nav[activeRoute === "simulation" ? "dashboard" : activeRoute]} ]
            </span>
          </div>

          {/* Navigation Links */}
          <nav aria-label={messages.common.primaryNavigation} className="overflow-x-auto">
            <ul className="flex min-w-max gap-1 sm:gap-2">
              {navItems.map((item) => {
                const isActive = activeRoute === item.key;
                return (
                  <li key={item.key}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={`relative block px-3 py-2 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors sm:px-4 ${
                        isActive
                          ? "text-signal font-bold"
                          : "text-muted hover:text-ice"
                      }`}
                      href={item.href}
                    >
                      {messages.nav[item.key]}
                      {isActive ? (
                        <span className="absolute inset-x-3 -bottom-[15px] h-[2px] bg-signal shadow-[0_0_8px_var(--signal-dim)]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Status Metadata Indicator */}
          <div className="hidden items-center gap-3 font-mono text-[11px] text-muted lg:flex">
            <span className="flex items-center gap-1.5 text-signal">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
              SYSTEM ONLINE
            </span>
            <HeaderAvatar />
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1" id="main-content">
        {children}
      </main>

      {/* Subtle Status Footer Rule */}
      <footer className="border-t border-navy-700/60 bg-navy-950 px-5 py-3 font-mono text-[11px] text-muted sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span>ALETHIA · HUMAN-CENTRED SECURITY PRACTICE</span>
          <span className="flex items-center gap-1.5 text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            OPERATOR ACTIVE
          </span>
        </div>
      </footer>
    </div>
  );
}
