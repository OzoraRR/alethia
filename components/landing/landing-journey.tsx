"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Messages } from "@/lib/i18n";

type LandingCopy = Messages["landing"];

const splashArt = ["/media/rig-server.svg", "/media/rig-computer.svg", "/media/rig-lens.svg"];
// splash island -> world index (server->Progress, computer->Simulasi, lens->Report Hub)
const splashWorld = [1, 0, 2];
// dive origin per splash island (screen % of its center)
const splashDive = ["14% 23%", "87% 25%", "16% 81%"];
// worlds[0] Simulasi Serangan Siber -> computer, worlds[1] Progress & Streak -> server, worlds[2] Report Hub -> lens
const worldArt = ["/media/rig-computer.svg", "/media/rig-server.svg", "/media/rig-lens.svg"];

function useCamera(active: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, -r.top / (r.height || 1)));
        el.style.setProperty("--cam", p.toFixed(3));
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [active]);
  return ref;
}

export function LandingJourney({ landing }: { landing: LandingCopy }) {
  const [started, setStarted] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [swap, setSwap] = useState(false);
  const [dive, setDive] = useState(splashDive[1]);
  const [index, setIndex] = useState(0);
  const total = landing.worlds.length;
  const vistaRef = useCamera(true);

  // zoom whoosh: splash dives into the first island, then the worlds section lands
  useEffect(() => {
    if (!departing || started) return;
    const t = window.setTimeout(() => setStarted(true), 450);
    return () => window.clearTimeout(t);
  }, [departing, started]);

  const go = useCallback(
    (dir: 1 | -1) => {
      setSwap(true);
      setIndex((i) => (i + dir + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (!started) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, go]);

  if (!started) {
    return (
      <section aria-label={landing.title} className={`landing-vista${departing ? " landing-vista--out" : ""} font-tactical`} ref={vistaRef} style={{ transformOrigin: dive }}>
        <div className="landing-stars" aria-hidden="true" />
        <div className="landing-gridfloor" aria-hidden="true" />
        {splashArt.map((src, i) => (
          <button
            aria-label={landing.worlds[splashWorld[i]].title}
            className={`landing-isle landing-isle--${i} landing-isle-btn`}
            disabled={departing}
            key={src}
            onClick={() => {
              setDive(splashDive[i]);
              setIndex(splashWorld[i]);
              setDeparting(true);
            }}
            type="button"
          >
            <Image alt="" aria-hidden="true" className="landing-isle__img" height={260} src={src} unoptimized width={320} />
          </button>
        ))}
        <div className="landing-splash">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-signal">{landing.eyebrow}</p>
          <h1 className="font-pixel mt-4 text-5xl font-bold leading-tight sm:text-7xl">ALETHIA</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">{landing.title}</p>
          <button
            className="btn-tactile btn-tactile-primary btn-mechanical mt-8 px-10 py-4 text-base"
            disabled={departing}
            onClick={() => setDeparting(true)}
            type="button"
          >
            {landing.start}!
          </button>
          <p className="mt-5 font-mono text-[11px] text-muted">{landing.safe}</p>
        </div>
      </section>
    );
  }

  const world = landing.worlds[index];
  return (
    <section className="landing-vista landing-vista--world font-tactical" ref={vistaRef} aria-label={landing.chooseWorld}>
      <div className="landing-stars" aria-hidden="true" />
      <div className="landing-gridfloor" aria-hidden="true" />
      <p className="landing-brand font-pixel" aria-hidden="true">ALETHIA</p>
      <button aria-label={landing.prevWorld} className="landing-arrow landing-arrow--left" onClick={() => go(-1)} type="button">
        <span aria-hidden="true">‹</span>
      </button>
      <div className={`landing-world${swap ? " landing-world--swap" : ""}`} key={world.title}>
        <span className="glitch-host">
          <Image
            alt=""
            aria-hidden="true"
            className="landing-world__isle"
            height={520}
            priority
            src={worldArt[index % worldArt.length]}
            unoptimized
            width={640}
          />
        </span>
        <div className="landing-world__copy">
          <p className="font-mono text-[11px] tracking-[0.14em] text-signal">{world.meta}</p>
          <h2 className="font-pixel mt-3 text-2xl font-bold tracking-tight sm:text-4xl">{world.title}</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">{world.desc}</p>
          <Link className="btn-tactile btn-tactile-primary btn-mechanical mt-7 px-8 py-3 text-sm" href="/login">
            {landing.start}! <span aria-hidden="true" className="ml-2">→</span>
          </Link>
          <div className="landing-dots" role="tablist" aria-label={landing.chooseWorld}>
            {landing.worlds.map((w, i) => (
              <button
                aria-label={w.title}
                aria-selected={i === index}
                className={`landing-dot ${i === index ? "landing-dot--on" : ""}`}
                key={w.title}
                onClick={() => {
                  if (i === index) return;
                  setSwap(true);
                  setIndex(i);
                }}
                role="tab"
                type="button"
              />
            ))}
          </div>
        </div>
      </div>
      <button aria-label={landing.nextWorld} className="landing-arrow landing-arrow--right" onClick={() => go(1)} type="button">
        <span aria-hidden="true">›</span>
      </button>
    </section>
  );
}
