"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useMemo, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { useLocalProgress } from "@/features/progress/progress";
import {
  MAX_SCREENSHOT_BYTES,
  REPORT_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_PATTERNS,
  addNote,
  defang,
  fileToDataUrl,
  filterReports,
  getRole,
  hasSignaled,
  isCompactSort,
  loadAllReports,
  loadNotes,
  saveUserReport,
  signalCount,
  sortReports,
  toggleSignal,
  type InvestigationNote,
  type LaporanReport,
  type ReportRange,
  type ReportSort,
  type Role,
} from "./reports";

export function ReportHub() {
  const messages = getMessages();
  const progress = useLocalProgress();
  const role: Role = getRole(progress);
  const [range, setRange] = useState<ReportRange>("monthly");
  const [sort, setSort] = useState<ReportSort>("top");
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    void refreshKey;
    return sortReports(filterReports(loadAllReports(), range), sort);
  }, [range, sort, refreshKey]);

  const compact = isCompactSort(sort);
  const [featured, ...rest] = visible;
  const cards = rest.slice(0, 4);
  const rows = rest.slice(4);

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
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
          <button className="lp-add" onClick={() => setFormOpen((v) => !v)} type="button">
            {formOpen ? "Close" : "Add Report"}
          </button>
        </div>

        {formOpen ? (
          <ReportForm
            onSaved={() => {
              refresh();
              setFormOpen(false);
              setRange("all");
              setSort("newest");
            }}
          />
        ) : null}

        <div className="lp-filter" role="group" aria-label="Report filters">
          <div className="lp-tabs" role="tablist" aria-label="Time range">
            {(["monthly", "all"] as const).map((r) => (
              <button
                aria-selected={range === r}
                className={`lp-tab ${range === r ? "lp-tab--on" : ""}`}
                key={r}
                onClick={() => setRange(r)}
                role="tab"
                type="button"
              >
                {r === "monthly" ? "monthly" : "all the time"}
              </button>
            ))}
          </div>
          <label className="lp-sort">
            <span className="sr-only">Sort reports</span>
            <select aria-label="Sort reports" onChange={(e) => setSort(e.target.value as ReportSort)} value={sort}>
              <option value="newest">Sort · Newest</option>
              <option value="top">Sort · Top signals</option>
              <option value="review">Sort · Needs review</option>
              <option value="oldest">Sort · Oldest</option>
              <option value="title">Sort · Title A–Z</option>
            </select>
          </label>
        </div>

        {!visible.length ? (
          <p className="lp-empty">No reports in this range yet. Switch to “all the time” or add the first practice report.</p>
        ) : null}

        {compact ? (
          <ol className="lp-rows lp-rows--all">
            {visible.map((report, i) => (
              <li key={report.id}>
                <button className="lp-row" onClick={() => toggleExpand(report.id)} type="button" aria-expanded={expandedId === report.id}>
                  <span className="lp-row__no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="lp-row__title">{report.title}</span>
                  <span className="lp-row__signals">▲ {signalCount(report.id)}</span>
                  <span className="lp-row__user">{report.author}</span>
                </button>
                {expandedId === report.id ? (
                  <ReportDetail onChange={refresh} report={report} role={role} />
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
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
                    <p className="lp-featured__user">{featured.author} · {featured.status} · ▲ {signalCount(featured.id)} signals</p>
                  </div>
                  <span aria-hidden="true" className="lp-featured__orb">
                    {featured.title.slice(0, 1).toUpperCase()}
                  </span>
                </button>
                {expandedId === featured.id ? (
                  <ReportDetail onChange={refresh} report={featured} role={role} />
                ) : null}
              </div>
            ) : null}

            {cards.length ? (
              <div className="lp-grid">
                {cards.map((report, i) => (
                  <div key={report.id}>
                    <button className="lp-card-item lp-card-item--btn" onClick={() => toggleExpand(report.id)} type="button" aria-expanded={expandedId === report.id}>
                      <h3>
                        {i + 2}. <span>{report.title}</span>
                      </h3>
                      <p className="lp-card-item__meta">{report.channel} · ▲ {signalCount(report.id)}</p>
                      <div className="lp-card-item__foot">
                        <span aria-hidden="true" className="lp-card-item__dot" />
                        <span>{report.author}</span>
                      </div>
                    </button>
                    {expandedId === report.id ? (
                      <ReportDetail onChange={refresh} report={report} role={role} />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {rows.length ? (
              <ol className="lp-rows">
                {rows.map((report, i) => (
                  <li key={report.id}>
                    <button className="lp-row" onClick={() => toggleExpand(report.id)} type="button" aria-expanded={expandedId === report.id}>
                      <span className="lp-row__no">{String(i + 6).padStart(2, "0")}</span>
                      <span className="lp-row__title">{report.title}</span>
                      <span className="lp-row__user">{report.author}</span>
                    </button>
                    {expandedId === report.id ? (
                      <ReportDetail onChange={refresh} report={report} role={role} />
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        )}
      </section>

      <p className="lp-note">Reports are for education and triage only. New reports enter the queue; a developer approves them. Do not include credentials, OTPs, personal messages, or live links.</p>
    </div>
  );
}

function ReportDetail({
  report,
  role,
  onChange,
}: {
  report: LaporanReport;
  role: Role;
  onChange: () => void;
}) {
  const [signaled, setSignaled] = useState(() => hasSignaled(report.id));
  const [notes, setNotes] = useState<InvestigationNote[]>(() => loadNotes(report.id));
  const [draft, setDraft] = useState("");
  const isInvestigator = role === "investigator";

  function flipSignal() {
    if (!isInvestigator) return;
    toggleSignal(report.id);
    setSignaled(hasSignaled(report.id));
    onChange();
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isInvestigator || draft.trim().length < 4) return;
    setNotes(addNote(report.id, role, draft));
    setDraft("");
  }

  return (
    <div className="lp-detail">
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
          disabled={!isInvestigator}
          onClick={flipSignal}
          title={isInvestigator ? "Confirm this report carries a real signal" : "Investigators only"}
          type="button"
        >
          ▲ Signal · {signalCount(report.id)}
        </button>
        {!isInvestigator ? (
          <span className="lp-signal__hint">Students read along — signals unlock with the Investigator role.</span>
        ) : null}
      </div>

      <div className="lp-notes">
        <p className="lp-detail__label">INVESTIGATION ({notes.length})</p>
        {notes.length ? (
          <ul>
            {notes.map((n) => (
              <li key={n.id}>
                <span className="lp-notes__role">{n.authorRole}</span> {n.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="lp-detail__text">No investigation notes yet.</p>
        )}
        {isInvestigator ? (
          <form onSubmit={submitNote}>
            <label className="lp-field">
              Add investigation note
              <textarea
                className="report-input"
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What did you check, and what confirms it?"
                rows={3}
                value={draft}
              />
            </label>
            <button className="lp-submit" type="submit">Investigate</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ReportForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [channel, setChannel] = useState<string>(REPORT_CHANNELS[0]);
  const [pattern, setPattern] = useState<string>(REPORT_PATTERNS[0]);
  const [evidence, setEvidence] = useState("");
  const [whyRisky, setWhyRisky] = useState("");
  const [url, setUrl] = useState("");
  const [screenshot, setScreenshot] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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
    setScreenshot(dataUrl);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    saveUserReport({ title, category, channel, pattern, evidence, whyRisky, url, screenshot });
    onSaved();
  }

  return (
    <form className="lp-form" onSubmit={submit}>
      <p className="lp-form__title">ADD A PRACTICE REPORT</p>
      <p className="lp-form__hint">Queued for developer review. Stored in your browser, never sent anywhere.</p>
      <label className="lp-field">
        Title
        <input className="report-input" onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Parcel SMS with fee link" value={title} />
      </label>
      <div className="lp-field-row">
        <ReportSelect label="Attack category" onChange={setCategory} options={[...REPORT_CATEGORIES]} value={category} />
        <ReportSelect label="Delivery channel" onChange={setChannel} options={[...REPORT_CHANNELS]} value={channel} />
        <ReportSelect label="Manipulation pattern" onChange={setPattern} options={[...REPORT_PATTERNS]} value={pattern} />
      </div>
      <label className="lp-field">
        Evidence — what did you receive or observe?
        <textarea className="report-input" onChange={(e) => setEvidence(e.target.value)} placeholder="Sender, message wording, link shape…" rows={3} value={evidence} />
      </label>
      <label className="lp-field">
        Why is it risky?
        <textarea className="report-input" onChange={(e) => setWhyRisky(e.target.value)} placeholder="Pressure, trust transfer, off-channel route…" rows={3} value={whyRisky} />
      </label>
      <label className="lp-field">
        Optional URL · defanged
        <input aria-label="Optional defanged URL" className="report-input" onChange={(e) => setUrl(e.target.value)} placeholder="example[.]invalid" value={url} />
      </label>
      {url ? <p className="lp-defang">Display: {defang(url)}</p> : null}
      <label className="lp-field">
        Evidence screenshot (optional, under 500 KB)
        <input
          accept="image/png,image/jpeg,image/webp"
          className="report-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
          type="file"
        />
      </label>
      {screenshot ? <img alt="Screenshot preview" className="lp-detail__shot" src={screenshot} /> : null}
      {error ? <p className="lp-error">{error}</p> : null}
      <button className="lp-submit" type="submit">Queue report</button>
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
  onChange: (v: string) => void;
}) {
  return (
    <label className="lp-field">
      {label}
      <select className="report-input" onChange={(e) => onChange(e.target.value)} value={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
