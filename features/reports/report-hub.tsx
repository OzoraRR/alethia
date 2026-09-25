"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { useLocalProgress } from "@/features/progress/progress";
import {
  MAX_SCREENSHOT_BYTES,
  REPORT_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_PATTERNS,
  addNote,
  defang,
  deleteUserReport,
  fileToDataUrl,
  getRole,
  isCompactSort,
  loadNotes,
  loadReports,
  saveUserReport,
  toggleReportSignal,
  updateUserReport,
  type InvestigationNote,
  type LaporanReport,
  type ReportScope,
  type ReportSort,
  type Role,
} from "./reports";

const reportSortOptions: Array<{ value: ReportSort; label: string }> = [
  { value: "top", label: "Top signals" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function ReportHub() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const role: Role = getRole(progress);
  const [sort, setSort] = useState<ReportSort>("top");
  const [scope, setScope] = useState<ReportScope>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<LaporanReport | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reports, setReports] = useState<LaporanReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    void loadReports(sort, scope)
      .then((nextReports) => {
        if (active) setReports(nextReports);
      })
      .catch((error: unknown) => {
        if (active) {
          setReports([]);
          setLoadError(error instanceof Error ? error.message : "Laporan gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sort, scope, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const compact = isCompactSort(sort);
  const [featured, ...rest] = reports;
  const cards = rest.slice(0, 4);
  const rows = rest.slice(4);

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function openCreateForm() {
    setEditingReport(null);
    setFormOpen(true);
  }

  function openEditForm(report: LaporanReport) {
    setEditingReport(report);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingReport(null);
  }

  function handleSaved(wasEdit: boolean) {
    closeForm();
    refresh();
    if (!wasEdit) setSort("newest");
  }

  function handleDeleted(reportId: string) {
    if (expandedId === reportId) setExpandedId(null);
    refresh();
  }

  return (
    <div className="lp-wrap">
      <section className="lp-card" aria-label={messages.nav.reports}>
        <div className="lp-head">
          <div>
            <p className="lp-eyebrow">{messages.nav.reports}</p>
            <h1 className="lp-title">Report Page</h1>
            <p className="lp-desc">Community reports. Students file with evidence, investigators confirm signals, developers approve the queue.</p>
            <p className={`lp-role ${role === "investigator" ? "lp-role--inv" : ""}`}>
              {role === "investigator"
                ? "INVESTIGATOR · you can investigate and confirm signals"
                : "STUDENT · complete 1 module with a safe response to become Investigator"}
            </p>
          </div>
          <button className="lp-add" onClick={formOpen ? closeForm : openCreateForm} type="button">
            {formOpen ? "Close" : "Add Report"}
          </button>
        </div>

        {formOpen ? (
          <ReportForm
            key={editingReport?.id ?? "new-report"}
            onCancel={closeForm}
            onSaved={() => handleSaved(Boolean(editingReport))}
            report={editingReport ?? undefined}
          />
        ) : null}

        <div className="lp-filter" role="group" aria-label="Report ownership and sorting">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-muted uppercase">Show</span>
            <div className="lp-tabs" role="group" aria-label="Report ownership">
              <button
                aria-pressed={scope === "all"}
                className={`lp-tab ${scope === "all" ? "lp-tab--on" : ""}`}
                onClick={() => setScope("all")}
                type="button"
              >
                All reports
              </button>
              <button
                aria-pressed={scope === "mine"}
                className={`lp-tab ${scope === "mine" ? "lp-tab--on" : ""}`}
                onClick={() => setScope("mine")}
                type="button"
              >
                My reports
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-muted uppercase">Sort</span>
            <div className="lp-tabs" role="group" aria-label="Sort reports">
              {reportSortOptions.map((option) => (
                <button
                  aria-pressed={sort === option.value}
                  className={`lp-tab ${sort === option.value ? "lp-tab--on" : ""}`}
                  key={option.value}
                  onClick={() => setSort(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? <p className="lp-empty">Loading reports from the database…</p> : null}
        {!loading && loadError ? <p className="lp-error">{loadError}</p> : null}
        {!loading && !loadError && !reports.length ? (
          <p className="lp-empty">
            {scope === "mine"
              ? "You have not created any reports yet."
              : "No reports are available yet."}
          </p>
        ) : null}

        {!loading && !loadError && compact ? (
          <ol className="lp-rows lp-rows--all">
            {reports.map((report, index) => (
              <li key={report.id}>
                <button className="lp-row" onClick={() => toggleExpand(report.id)} type="button" aria-expanded={expandedId === report.id}>
                  <span className="lp-row__no">{String(index + 1).padStart(2, "0")}</span>
                  <span className="lp-row__title">{report.title}</span>
                  <span className="lp-row__signals">▲ {report.signalScore}</span>
                  <span className={report.isOwner ? "font-bold text-signal" : "lp-row__user"}>
                    {report.isOwner ? "YOUR REPORT" : report.author}
                  </span>
                </button>
                {expandedId === report.id ? (
                  <ReportDetail
                    onChange={refresh}
                    onDeleted={() => handleDeleted(report.id)}
                    onEdit={() => openEditForm(report)}
                    report={report}
                    role={role}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        {!loading && !loadError && !compact ? (
          <>
            {featured ? (
              <div>
                <button className="lp-featured lp-featured--btn" onClick={() => toggleExpand(featured.id)} type="button" aria-expanded={expandedId === featured.id}>
                  <div className="min-w-0">
                    <p className="lp-featured__no">1. Title</p>
                    <h2 className="lp-featured__title">{featured.title}</h2>
                    <p className="lp-featured__meta">
                      {featured.channel} · <span>{featured.pattern}</span>
                      {featured.url ? ` · ${featured.url}` : ""}
                    </p>
                    <p className="lp-featured__user">
                      {featured.isOwner ? "YOUR REPORT" : featured.author} · {featured.status} · ▲ {featured.signalScore} signals
                    </p>
                  </div>
                  <span aria-hidden="true" className="lp-featured__orb">
                    {featured.title.slice(0, 1).toUpperCase()}
                  </span>
                </button>
                {expandedId === featured.id ? (
                  <ReportDetail
                    onChange={refresh}
                    onDeleted={() => handleDeleted(featured.id)}
                    onEdit={() => openEditForm(featured)}
                    report={featured}
                    role={role}
                  />
                ) : null}
              </div>
            ) : null}

            {cards.length ? (
              <div className="lp-grid">
                {cards.map((report, index) => (
                  <div key={report.id}>
                    <button className="lp-card-item lp-card-item--btn" onClick={() => toggleExpand(report.id)} type="button" aria-expanded={expandedId === report.id}>
                      <h3>
                        {index + 2}. <span>{report.title}</span>
                      </h3>
                      <p className="lp-card-item__meta">{report.channel} · ▲ {report.signalScore}</p>
                      <div className="lp-card-item__foot">
                        <span aria-hidden="true" className="lp-card-item__dot" />
                        <span className={report.isOwner ? "font-bold text-signal" : undefined}>
                          {report.isOwner ? "YOUR REPORT" : report.author}
                        </span>
                      </div>
                    </button>
                    {expandedId === report.id ? (
                      <ReportDetail
                        onChange={refresh}
                        onDeleted={() => handleDeleted(report.id)}
                        onEdit={() => openEditForm(report)}
                        report={report}
                        role={role}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {rows.length ? (
              <ol className="lp-rows">
                {rows.map((report, index) => (
                  <li key={report.id}>
                    <button className="lp-row" onClick={() => toggleExpand(report.id)} type="button" aria-expanded={expandedId === report.id}>
                      <span className="lp-row__no">{String(index + 6).padStart(2, "0")}</span>
                      <span className="lp-row__title">{report.title}</span>
                      <span className={report.isOwner ? "font-bold text-signal" : "lp-row__user"}>
                        {report.isOwner ? "YOUR REPORT" : report.author}
                      </span>
                    </button>
                    {expandedId === report.id ? (
                      <ReportDetail
                        onChange={refresh}
                        onDeleted={() => handleDeleted(report.id)}
                        onEdit={() => openEditForm(report)}
                        report={report}
                        role={role}
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : null}
      </section>

      <p className="lp-note">Reports are for education and triage only. New reports enter the queue; a developer approves them. Do not include credentials, OTPs, personal messages, or live links.</p>
    </div>
  );
}

function ReportDetail({
  report,
  role,
  onChange,
  onEdit,
  onDeleted,
}: {
  report: LaporanReport;
  role: Role;
  onChange: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [signaled, setSignaled] = useState(report.hasSignaled);
  const [signalScore, setSignalScore] = useState(report.signalScore);
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInvestigator = role === "investigator";

  useEffect(() => {
    let active = true;
    void loadNotes(report.id)
      .then((nextNotes) => {
        if (active) setNotes(nextNotes);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Catatan gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [report.id]);

  async function flipSignal() {
    if (!isInvestigator || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await toggleReportSignal(report.id);
      setSignaled(result.active);
      setSignalScore(result.signalScore);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Signal gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  async function removeReport() {
    if (!report.isOwner || deleting) return;
    const confirmed = window.confirm(
      `Delete "${report.title}"? Its report signals and investigation notes will also be removed.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteUserReport(report.id);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Laporan tidak dapat dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isInvestigator || draft.trim().length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const note = await addNote(report.id, role, draft);
      setNotes((current) => [...current, note]);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catatan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lp-detail">
      {report.isOwner ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-signal/30 bg-signal/[.04] p-3">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-signal uppercase">Your report</p>
            <p className="mt-1 text-xs text-muted">Edit all report content or permanently delete this report.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="border border-signal px-3 py-2 font-mono text-[11px] font-bold text-signal hover:bg-signal hover:text-navy-950"
              onClick={onEdit}
              type="button"
            >
              EDIT
            </button>
            <button
              className="border border-warning/60 px-3 py-2 font-mono text-[11px] font-bold text-warning hover:bg-warning hover:text-navy-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={deleting}
              onClick={() => void removeReport()}
              type="button"
            >
              {deleting ? "DELETING…" : "DELETE"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="lp-detail__grid">
        <div>
          <p className="lp-detail__label">EVIDENCE</p>
          <p className="lp-detail__text">{report.evidence || "—"}</p>
        </div>
        <div>
          <p className="lp-detail__label">WHY IT IS RISKY</p>
          <p className="lp-detail__text">{report.whyRisky || "—"}</p>
        </div>
      </div>
      {report.screenshot ? (
        <img alt={`Evidence screenshot for ${report.title}`} className="lp-detail__shot" src={report.screenshot} />
      ) : null}
      <p className="lp-detail__meta">
        {report.category} · {report.channel} · {report.pattern}
        {report.url ? ` · ${report.url}` : ""} · {report.review === "queued" ? "QUEUED FOR DEVELOPER REVIEW" : report.status.toUpperCase()}
      </p>

      <div className="lp-signal-row">
        <button
          className={`lp-signal ${signaled ? "lp-signal--on" : ""}`}
          disabled={!isInvestigator || busy}
          onClick={() => void flipSignal()}
          title={isInvestigator ? "Confirm this report carries a real signal" : "Investigators only"}
          type="button"
        >
          ▲ Signal · {signalScore}
        </button>
        {!isInvestigator ? <span className="lp-signal__hint">Signals unlock with the Investigator role.</span> : null}
      </div>

      <div className="lp-notes">
        <p className="lp-detail__label">INVESTIGATION ({notes.length})</p>
        {notes.length ? (
          <ul>
            {notes.map((note) => (
              <li key={note.id}>
                <span className="lp-notes__role">{note.authorRole}</span> {note.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="lp-detail__text">No investigation notes yet.</p>
        )}
        {isInvestigator ? (
          <form onSubmit={(event) => void submitNote(event)}>
            <label className="lp-field">
              Add investigation note
              <textarea
                className="report-input"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What did you check, and what confirms it?"
                rows={3}
                value={draft}
              />
            </label>
            <button className="lp-submit" disabled={busy} type="submit">Investigate</button>
          </form>
        ) : null}
        {error ? <p className="lp-error">{error}</p> : null}
      </div>
    </div>
  );
}

function ReportForm({
  report,
  onSaved,
  onCancel,
}: {
  report?: LaporanReport;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(report?.title ?? "");
  const [category, setCategory] = useState<string>(report?.category ?? REPORT_CATEGORIES[0]);
  const [channel, setChannel] = useState<string>(report?.channel ?? REPORT_CHANNELS[0]);
  const [pattern, setPattern] = useState<string>(report?.pattern ?? REPORT_PATTERNS[0]);
  const [evidence, setEvidence] = useState(report?.evidence ?? "");
  const [whyRisky, setWhyRisky] = useState(report?.whyRisky ?? "");
  const [url, setUrl] = useState(report?.url ?? "");
  const [screenshot, setScreenshot] = useState<string | undefined>(report?.screenshot);
  const [removeScreenshot, setRemoveScreenshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEditing = Boolean(report);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError("Screenshot must be under 500 KB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    if (!dataUrl) {
      setError("Could not read that image.");
      return;
    }
    setError(null);
    setRemoveScreenshot(false);
    setScreenshot(dataUrl);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (title.trim().length < 4) {
      setError("Give the report a short title (min 4 characters).");
      return;
    }
    if (evidence.trim().length < 10) {
      setError("Add evidence: what did you receive or observe? (min 10 characters).");
      return;
    }
    if (whyRisky.trim().length < 10) {
      setError("Explain why it is risky (min 10 characters).");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input = { title, category, channel, pattern, evidence, whyRisky, url, screenshot };
      if (report) {
        await updateUserReport(report.id, { ...input, removeScreenshot });
      } else {
        await saveUserReport(input);
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Laporan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="lp-form" onSubmit={(event) => void submit(event)}>
      <p className="lp-form__title">{isEditing ? "EDIT YOUR REPORT" : "ADD A PRACTICE REPORT"}</p>
      <p className="lp-form__hint">
        {isEditing
          ? "Update every user-authored field. Review status, author identity, and signal score remain database-managed."
          : "Queued for developer review and stored in Supabase under your authenticated account."}
      </p>
      <label className="lp-field">
        Title
        <input className="report-input" maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Parcel SMS with fee link" value={title} />
      </label>
      <div className="lp-field-row">
        <ReportSelect label="Attack category" onChange={setCategory} options={[...REPORT_CATEGORIES]} value={category} />
        <ReportSelect label="Delivery channel" onChange={setChannel} options={[...REPORT_CHANNELS]} value={channel} />
        <ReportSelect label="Manipulation pattern" onChange={setPattern} options={[...REPORT_PATTERNS]} value={pattern} />
      </div>
      <label className="lp-field">
        Evidence — what did you receive or observe?
        <textarea className="report-input" maxLength={5000} onChange={(event) => setEvidence(event.target.value)} placeholder="Sender, message wording, link shape…" rows={3} value={evidence} />
      </label>
      <label className="lp-field">
        Why is it risky?
        <textarea className="report-input" maxLength={5000} onChange={(event) => setWhyRisky(event.target.value)} placeholder="Pressure, trust transfer, off-channel route…" rows={3} value={whyRisky} />
      </label>
      <label className="lp-field">
        Optional URL · defanged
        <input aria-label="Optional defanged URL" className="report-input" maxLength={2048} onChange={(event) => setUrl(event.target.value)} placeholder="example[.]invalid" value={url} />
      </label>
      {url ? <p className="lp-defang">Display: {defang(url)}</p> : null}
      <label className="lp-field">
        Evidence screenshot (optional, under 500 KB)
        <input
          accept="image/png,image/jpeg,image/webp"
          className="report-input"
          onChange={(event) => void onFile(event.target.files?.[0])}
          type="file"
        />
      </label>
      {screenshot && !removeScreenshot ? (
        <div>
          <img alt="Screenshot preview" className="lp-detail__shot" src={screenshot} />
          <button
            className="mt-2 border border-warning/50 px-3 py-2 font-mono text-[11px] text-warning"
            onClick={() => {
              setRemoveScreenshot(true);
              setScreenshot(undefined);
            }}
            type="button"
          >
            REMOVE SCREENSHOT
          </button>
        </div>
      ) : null}
      {removeScreenshot ? <p className="font-mono text-[11px] text-warning">Existing screenshot will be removed when you save.</p> : null}
      {error ? <p className="lp-error">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button className="lp-submit" disabled={busy} type="submit">
          {busy ? "Saving…" : isEditing ? "Save changes" : "Queue report"}
        </button>
        <button className="border border-navy-700 px-4 py-2 font-mono text-xs text-muted" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReportSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="lp-field">
      {label}
      <select className="report-input" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
