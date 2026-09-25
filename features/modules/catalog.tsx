"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  moduleIds,
  useLocalProgress,
  type ModuleId,
  type ModuleProgressMap,
  type ModuleProgressSnapshot,
} from "@/features/progress/progress";

type CatalogRow = {
  id?: unknown;
  title_id?: unknown;
  title_en?: unknown;
  description_id?: unknown;
  description_en?: unknown;
  category?: unknown;
  route?: unknown;
  image_path?: unknown;
  difficulty?: unknown;
  position?: unknown;
  content_key?: unknown;
};

type CatalogModule = {
  id: string;
  title: string;
  description: string;
  category: string;
  route: string;
  imagePath: string | null;
  difficulty: number;
  position: number;
};

type CatalogState =
  | { status: "loading"; modules: CatalogModule[] }
  | { status: "ready"; modules: CatalogModule[] }
  | { status: "error"; modules: []; message: string };

const moduleSelect =
  "id, title_id, title_en, description_id, description_en, category, route, image_path, difficulty, position, content_key";

export function ModuleCatalog({
  limit = 6,
  compact = false,
}: {
  limit?: number;
  compact?: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading", modules: [] });
  const progress = useLocalProgress();

  useEffect(() => {
    let active = true;
    const client = getClient();
    if (!client) {
      setCatalog({ status: "error", modules: [], message: "Database modul belum dikonfigurasi." });
      return () => {
        active = false;
      };
    }

    void client
      .from("modules")
      .select(moduleSelect)
      .eq("is_active", true)
      .eq("is_published", true)
      .not("content_key", "is", null)
      .order("position", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit)
      .then((result: unknown) => {
        const { data, error } = result as { data: CatalogRow[] | null; error: unknown };
        if (!active) return;
        if (error) {
          setCatalog({ status: "error", modules: [], message: "Modul belum dapat dimuat dari database." });
          return;
        }
        const modules = (data ?? [])
          .map(normalizeCatalogRow)
          .filter((module): module is CatalogModule => module !== null);
        setCatalog({ status: "ready", modules });
      })
      .catch(() => {
        if (active) {
          setCatalog({ status: "error", modules: [], message: "Modul belum dapat dimuat dari database." });
        }
      });

    return () => {
      active = false;
    };
  }, [limit]);

  if (catalog.status === "loading") {
    return <p className="border border-navy-700 p-5 font-mono text-xs text-muted">Memuat modul dari database…</p>;
  }

  if (catalog.status === "error") {
    return <p className="border border-warning/30 p-5 font-mono text-xs text-warning">{catalog.message}</p>;
  }

  if (!catalog.modules.length) {
    return <p className="border border-navy-700 p-5 font-mono text-xs text-muted">Belum ada modul terbit yang memiliki konten.</p>;
  }

  return (
    <div className={`grid gap-4 ${compact ? "md:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {catalog.modules.map((module, index) => {
        const moduleProgress = getModuleProgress(module.id, progress.moduleProgress);
        return (
          <ModuleCard
            compact={compact}
            index={index}
            key={module.id}
            module={module}
            progress={moduleProgress}
          />
        );
      })}
    </div>
  );
}

export function PublishedModuleCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const client = getClient();
    if (!client) return () => {
      active = false;
    };

    void client
      .from("modules")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_published", true)
      .not("content_key", "is", null)
      .then((result: unknown) => {
        const { count: publishedCount, error } = result as { count: number | null; error: unknown };
        if (active) setCount(error ? null : publishedCount);
      });

    return () => {
      active = false;
    };
  }, []);

  if (count === null) return null;
  return <>{count} published practice module{count === 1 ? "" : "s"} available.</>;
}

function ModuleCard({
  compact,
  index,
  module,
  progress,
}: {
  compact: boolean;
  index: number;
  module: CatalogModule;
  progress: ModuleProgressSnapshot;
}) {
  const status = getStatusCopy(progress.status);

  return (
    <article className={`container-level-2 exercise-card group relative overflow-hidden ${compact ? "min-h-[18rem]" : "min-h-[22rem]"}`}>
      {module.imagePath ? (
        <>
          <Image
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-right"
            fill
            sizes="(min-width: 1024px) 30vw, 100vw"
            src={module.imagePath}
            unoptimized
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-transparent" />
        </>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-950 to-[#162b2a]" />
      )}

      <div className={`relative flex h-full flex-col justify-between ${compact ? "p-5" : "p-6"}`}>
        <div>
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-muted">
            <span className="font-bold text-signal">EXERCISE {String(index + 1).padStart(2, "0")}</span>
            <span>{module.category.toUpperCase()}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-ice transition-colors group-hover:text-signal">
            {module.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{module.description}</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-navy-700 pt-4 font-mono text-xs">
          <div>
            <span className="block text-[10px] uppercase text-muted">STATUS</span>
            <span className={progress.status === "completed" ? "font-bold text-signal" : "font-bold text-ice"}>
              {status.label}
            </span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] uppercase text-muted">DIFFICULTY</span>
            <span aria-label={`Difficulty ${module.difficulty} of 5`} className="font-bold tracking-wider text-signal">
              {"█".repeat(module.difficulty)}{"░".repeat(5 - module.difficulty)}
            </span>
          </div>
        </div>

        {compact ? (
          <Link className="btn-tactile btn-tactile-primary mt-4 w-full justify-center text-center" href={module.route}>
            OPEN <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <div className="mt-6 flex items-center justify-between border-t border-navy-700 pt-4 font-mono text-xs">
            <span className="font-bold text-signal">{status.shortLabel}</span>
            <Link
              aria-label={`${module.title}. Open module`}
              className="btn-tactile btn-tactile-primary px-4 py-1.5"
              href={module.route}
            >
              OPEN <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function getClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function normalizeCatalogRow(value: CatalogRow | null): CatalogModule | null {
  if (!value) return null;
  const id = nonEmptyString(value.id);
  const title = nonEmptyString(value.title_id) ?? nonEmptyString(value.title_en);
  const description = nonEmptyString(value.description_id) ?? nonEmptyString(value.description_en);
  const category = nonEmptyString(value.category);
  const route = nonEmptyString(value.route);
  const contentKey = nonEmptyString(value.content_key);
  if (!id || !title || !description || !category || !route || !contentKey) return null;
  if (!route.startsWith("/simulation/")) return null;

  const imagePath = nonEmptyString(value.image_path);
  return {
    id,
    title,
    description,
    category,
    route,
    imagePath: imagePath?.startsWith("/media/") ? imagePath : null,
    difficulty:
      typeof value.difficulty === "number" && Number.isInteger(value.difficulty)
        ? Math.min(Math.max(value.difficulty, 1), 5)
        : 1,
    position: typeof value.position === "number" ? value.position : 0,
  };
}

function getModuleProgress(
  moduleId: string,
  progress: ModuleProgressMap,
): ModuleProgressSnapshot {
  if (isModuleId(moduleId)) return progress[moduleId];
  return {
    status: "not_started",
    score: null,
    progressPercentage: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
  };
}

function getStatusCopy(status: ModuleProgressSnapshot["status"]) {
  if (status === "completed") return { label: "COMPLETED", shortLabel: "COMPLETE" };
  if (status === "in_progress") return { label: "IN PROGRESS", shortLabel: "RESUME" };
  return { label: "READY", shortLabel: "READY" };
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isModuleId(value: string): value is ModuleId {
  return moduleIds.includes(value as ModuleId);
}
