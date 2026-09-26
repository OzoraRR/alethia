import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { EditProfilePanel } from "@/features/profile/edit-profile-panel";

export default function EditProfilePage() {
  return (
    <AppShell activeRoute="profile">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <span className="font-bold tracking-widest text-signal">PROFILE / EDIT</span>
            <Link className="text-muted hover:text-signal" href="/dashboard">← KEMBALI KE DASHBOARD</Link>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">Edit Profil</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Foto, password, username, dan badge pilihan disimpan melalui Supabase.</p>
        </div>
        <div className="mt-8"><EditProfilePanel /></div>
      </div>
    </AppShell>
  );
}
