"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { achievementDefinitions } from "@/features/daily/achievement-panel";
import { useDailyActivity as useDailyState } from "@/features/daily/daily-activity-provider";
import { useAuthProfile } from "@/features/profile/auth-profile";
import { useProfileAvatar } from "@/features/profile/avatar-persistence";
import { saveCallsign } from "@/lib/session/session";
import {
  changePassword,
  changeUsername,
  loadProfileBadgeSelections,
  setProfileBadge,
  type ProfileBadgeSelection,
} from "./edit-profile-backend";

export function EditProfilePanel() {
  const { profile, isAuthenticated, refresh } = useAuthProfile();
  const { achievements } = useDailyState();
  const { avatarUrl, error: avatarError, isSaving: avatarSaving, save } = useProfileAvatar();
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<{ busy: boolean; message: string | null; error: boolean }>({ busy: false, message: null, error: false });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordState, setPasswordState] = useState<{ busy: boolean; message: string | null; error: boolean }>({ busy: false, message: null, error: false });
  const [selections, setSelections] = useState<ProfileBadgeSelection[]>([]);
  const [badgeBusy, setBadgeBusy] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setUsername(profile.username);
  }, [profile]);

  useEffect(() => {
    void loadProfileBadgeSelections().then(setSelections);
  }, []);

  const selectedCodes = useMemo(() => new Set(selections.filter((badge) => badge.selected).map((badge) => badge.code)), [selections]);

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameState({ busy: true, message: null, error: false });
    const result = await changeUsername(username);
    if (result.error || !result.username) {
      setUsernameState({ busy: false, message: result.error, error: true });
      return;
    }
    setUsername(result.username);
    saveCallsign(result.username);
    await refresh();
    setUsernameState({ busy: false, message: "Username tersinkron ke database.", error: false });
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setPasswordState({ busy: false, message: "Konfirmasi password tidak sama.", error: true });
      return;
    }
    setPasswordState({ busy: true, message: null, error: false });
    const result = await changePassword(passwords.current, passwords.next);
    if (result.error) {
      setPasswordState({ busy: false, message: result.error, error: true });
      return;
    }
    setPasswords({ current: "", next: "", confirm: "" });
    setPasswordState({ busy: false, message: "Password berhasil diubah.", error: false });
  }

  async function toggleBadge(code: string) {
    setBadgeBusy(code);
    const next = !selectedCodes.has(code);
    if (await setProfileBadge(code, next)) {
      setSelections((current) => [...current.filter((item) => item.code !== code), { code, selected: next }]);
    }
    setBadgeBusy(null);
  }

  if (!isAuthenticated || !profile) {
    return <section className="pf-card"><p className="text-sm text-muted">Login diperlukan untuk mengedit profil.</p></section>;
  }

  return (
    <div className="grid gap-6">
      <section className="pf-card">
        <EditHeading code="01" title="Foto Profil" description="Upload akan mengganti avatar lama secara atomik." />
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <div className="pf-avatar pf-avatar--round overflow-hidden">
            {avatarUrl ? <img alt="Profile avatar" src={avatarUrl} /> : <span className="grid h-full w-full place-items-center text-2xl text-signal">A_</span>}
          </div>
          <div>
            <input
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={avatarSaving}
              id="edit-avatar-file"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) await save(file);
                event.target.value = "";
              }}
              type="file"
            />
            <label className="btn-tactile cursor-pointer" htmlFor="edit-avatar-file">{avatarSaving ? "UPLOADING…" : "UPLOAD PHOTO"}</label>
            {avatarError ? <p className="mt-2 font-mono text-xs text-warning">Upload gagal atau file tidak valid.</p> : null}
          </div>
        </div>
      </section>

      <section className="pf-card">
        <EditHeading code="02" title="Username" description="Dipakai untuk login dan identitas publik operator." />
        <form className="mt-5 max-w-lg" onSubmit={(event) => void saveUsername(event)}>
          <label className="pf-field">Username<input className="pf-input" maxLength={24} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9_]{3,24}" value={username} /></label>
          <button className="btn-tactile btn-tactile-primary mt-4" disabled={usernameState.busy} type="submit">{usernameState.busy ? "SAVING…" : "SAVE USERNAME"}</button>
          {usernameState.message ? <p className={`mt-3 font-mono text-xs ${usernameState.error ? "text-warning" : "text-signal"}`}>{usernameState.message}</p> : null}
        </form>
      </section>

      <section className="pf-card">
        <EditHeading code="03" title="Password" description="Memerlukan password akun saat ini." />
        <form className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-3" onSubmit={(event) => void savePassword(event)}>
          <label className="pf-field">Current<input className="pf-input" minLength={8} onChange={(event) => setPasswords((value) => ({ ...value, current: event.target.value }))} type="password" value={passwords.current} /></label>
          <label className="pf-field">New password<input className="pf-input" minLength={8} onChange={(event) => setPasswords((value) => ({ ...value, next: event.target.value }))} type="password" value={passwords.next} /></label>
          <label className="pf-field">Confirm<input className="pf-input" minLength={8} onChange={(event) => setPasswords((value) => ({ ...value, confirm: event.target.value }))} type="password" value={passwords.confirm} /></label>
          <div className="sm:col-span-3">
            <button className="btn-tactile btn-tactile-primary" disabled={passwordState.busy} type="submit">{passwordState.busy ? "UPDATING…" : "CHANGE PASSWORD"}</button>
            {passwordState.message ? <p className={`mt-3 font-mono text-xs ${passwordState.error ? "text-warning" : "text-signal"}`}>{passwordState.message}</p> : null}
          </div>
        </form>
      </section>

      <section className="pf-card">
        <EditHeading code="04" title="Badge Profile" description="Pilih achievement yang sudah dimiliki untuk ditampilkan di profil." />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievementDefinitions.map((definition) => {
            const selected = selectedCodes.has(definition.code);
            const earned = achievements.some((achievement) => achievement.code === definition.code);
            return (
              <button className={`border p-4 text-left ${selected ? "border-signal bg-signal/[.05]" : "border-navy-700"} disabled:cursor-not-allowed disabled:opacity-45`} disabled={!earned || badgeBusy === definition.code} key={definition.code} onClick={() => void toggleBadge(definition.code)} type="button">
                <span className={`font-mono text-[9px] uppercase ${selected ? "text-signal" : "text-muted"}`}>{selected ? "Displayed" : earned ? "Available" : "Locked"}</span>
                <span className="mt-2 block text-sm font-semibold text-ice">{definition.title}</span>
                <span className="mt-1 block text-xs text-muted">{definition.description}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EditHeading({ code, title, description }: { code: string; title: string; description: string }) {
  return <div className="border-b border-navy-700 pb-4"><p className="font-mono text-[10px] font-bold text-signal">{code} / PROFILE SETTINGS</p><h2 className="mt-1 text-xl font-bold text-ice">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div>;
}
