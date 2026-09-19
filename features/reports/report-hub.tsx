"use client";

import { FormEvent, useState } from "react";

const examples = [
  { category: "SMS phishing", channel: "Text message", pattern: "Urgency + fake delivery", status: "Triaged", url: "parcel-track[.]example" },
  { category: "Marketplace scam", channel: "Marketplace chat", pattern: "Trust transfer + fee", status: "Learning note", url: "safe-pay[.]example" },
  { category: "Account impersonation", channel: "Direct message", pattern: "Authority + channel shift", status: "Queued", url: "support-check[.]example" },
];

function defang(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replaceAll(".", "[.]");
}

export function ReportHub() {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section>
        <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
          <p className="font-mono text-[11px] tracking-[0.16em] text-signal">COMMUNITY EXAMPLES</p>
          <p className="font-mono text-[10px] text-muted">MOCK REPORTS · EDUCATION ONLY</p>
        </div>
        <div className="divide-y divide-white/[0.08]">
          {examples.map((report, index) => (
            <article className="grid gap-4 py-6 sm:grid-cols-[2.1rem_1fr_auto] sm:items-start" key={report.category}>
              <span className="font-mono text-xs text-signal">0{index + 1}</span>
              <div>
                <h2 className="text-lg font-medium text-ice">{report.category}</h2>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] text-muted"><span>{report.channel}</span><span className="text-signal/70">{report.pattern}</span><span>{report.url}</span></div>
              </div>
              <span className="w-fit border border-navy-700 px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-muted">{report.status}</span>
            </article>
          ))}
        </div>
      </section>

      <aside className="border-l border-signal/30 pl-5 sm:pl-7">
        <p className="font-mono text-[11px] tracking-[0.16em] text-signal">ADD A PRACTICE REPORT</p>
        <p className="mt-3 text-sm leading-6 text-muted">Use broad patterns only. This form stays in your browser and is discarded when you leave.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <ReportSelect label="Attack category" options={["SMS phishing", "Marketplace scam", "Account impersonation"]} />
          <ReportSelect label="Delivery channel" options={["Text message", "Marketplace chat", "Direct message"]} />
          <ReportSelect label="Manipulation pattern" options={["Urgency", "Trust transfer", "Channel shift", "Unusual payment request"]} />
          <label className="block font-mono text-[10px] tracking-[0.1em] text-muted">OPTIONAL URL · DEFANGED
            <input aria-label="Optional defanged URL" className="report-input mt-2" value={url} placeholder="example[.]invalid" onChange={(event) => { setUrl(event.target.value); setSubmitted(false); }} />
          </label>
          {url ? <p className="font-mono text-[11px] text-signal">Display: {defang(url)}</p> : null}
          <button className="min-h-10 bg-signal px-4 font-mono text-[11px] font-bold tracking-[0.08em] text-navy-950 transition hover:bg-[#c1f18f]" type="submit">Add practice note</button>
          {submitted ? <p className="text-xs leading-5 text-signal">Practice note acknowledged. Nothing was sent, saved, or scanned.</p> : null}
        </form>
        <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-5 text-muted">Reports are for education and triage only. Do not include credentials, OTPs, personal messages, or live links.</p>
      </aside>
    </div>
  );
}

function ReportSelect({ label, options }: { label: string; options: string[] }) {
  return <label className="block font-mono text-[10px] tracking-[0.1em] text-muted">{label.toUpperCase()}<select className="report-input mt-2">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
