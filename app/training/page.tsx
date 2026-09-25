import { AppShell } from "@/components/layout/app-shell";
import { ModuleCatalog } from "@/features/modules/catalog";
import { getMessages } from "@/lib/i18n";

export default function TrainingPage() {
  const { training } = getMessages();

  return (
    <AppShell activeRoute="training">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="container-level-0 border-b border-navy-700 pb-6">
          <div className="flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-widest text-signal">
            <span>02 / EXERCISE INDEX</span>
            <span className="text-navy-700">·</span>
            <span>DATABASE-BACKED CATALOG</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ice sm:text-5xl">
            {training.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Hanya modul aktif, terbit, dan terhubung ke konten nyata yang ditampilkan. Slot kosong atau modul yang belum selesai dikecualikan oleh query.
          </p>
        </div>

        {/* Responsive 3-by-2 maximum. The six future placeholder cards were removed. */}
        <section aria-label={training.title} className="mt-8">
          <ModuleCatalog limit={6} />
        </section>
      </div>
    </AppShell>
  );
}
