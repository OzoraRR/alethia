"use client";

import { useEffect, useState } from "react";
import { achievementDefinitions } from "@/features/daily/achievement-panel";
import { loadProfileBadgeSelections } from "./edit-profile-backend";

export function SelectedBadges() {
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => {
    void loadProfileBadgeSelections().then((rows) => setCodes(rows.filter((row) => row.selected).map((row) => row.code)));
  }, []);

  return (
    <section className="pf-card">
      <p className="pf-eyebrow">Displayed Badges</p>
      <h2 className="mt-1 text-xl font-bold text-ice">Badge profil</h2>
      {codes.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {codes.map((code) => {
            const definition = achievementDefinitions.find((item) => item.code === code);
            return <li className="border border-signal/40 bg-signal/[.05] px-3 py-1.5 font-mono text-[10px] text-signal" key={code}>{definition?.title ?? code}</li>;
          })}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">Belum ada badge yang dipilih.</p>}
    </section>
  );
}
