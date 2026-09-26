"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Dict = Record<string, unknown>;
const text = (row: Dict, key: string, fallback = "") => typeof row[key] === "string" ? String(row[key]) : fallback;
const bool = (row: Dict, key: string) => row[key] === true;
const num = (row: Dict, key: string, fallback = 0) => typeof row[key] === "number" ? Number(row[key]) : fallback;

export function AdminDashboard({ username, initialReports, initialModules, initialQuests }: { username: string; initialReports: Dict[]; initialModules: Dict[]; initialQuests: Dict[] }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [modules, setModules] = useState(initialModules);
  const [quests, setQuests] = useState(initialQuests);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Dict | null>(null);

  async function action(kind: string, payload: Dict) {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/admin/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload }) });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) { setMessage(body?.error ?? "Action failed."); setBusy(false); return false; }
    setBusy(false); return true;
  }

  async function updateReport(row: Dict, status: string, review: string) {
    if (await action("report", { requested_report_id: row.id, requested_status: status, requested_review_status: review })) {
      setReports((current) => current.map((item) => item.id === row.id ? { ...item, status, review_status: review } : item));
      setMessage("Report status updated.");
    }
  }

  async function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const payload = { module_id: form.get("id"), module_content_key: form.get("content_key"), module_title_id: form.get("title"), module_description_id: form.get("description"), module_category: form.get("category"), module_route: form.get("route"), module_image_path: form.get("image"), module_difficulty: Number(form.get("difficulty")), module_position: Number(form.get("position")), module_is_active: form.get("active") === "on", module_is_published: form.get("published") === "on" };
    if (await action("module", payload)) { setModules((current) => [payload as Dict, ...current.filter((item) => text(item, "id") !== String(payload.module_id))]); setMessage("Module catalog saved."); event.currentTarget.reset(); }
  }

  async function saveQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const payload = { quest_id: form.get("id"), quest_title: form.get("title"), quest_description: form.get("description"), quest_type: form.get("type"), target_value: Number(form.get("target")), reward_points: Number(form.get("reward")), quest_position: Number(form.get("position")), quest_is_active: form.get("active") === "on" };
    if (await action("quest", payload)) { setQuests((current) => [payload as Dict, ...current.filter((item) => text(item, "id") !== String(payload.quest_id))]); setMessage("Daily quest saved."); setEditingQuest(null); }
  }

  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); router.replace("/admin"); router.refresh(); }

  return <main className="admin-dashboard"><header className="admin-dashboard__head"><div><p className="font-mono text-xs font-bold tracking-[.18em] text-signal">ALETHIA // ADMIN CONSOLE</p><h1 className="mt-2 text-3xl font-bold text-ice">Operations Dashboard</h1></div><div className="flex items-center gap-3 font-mono text-xs"><span className="text-muted">SIGNED IN AS {username}</span><button className="admin-submit admin-submit--small" onClick={() => void logout()} type="button">LOGOUT</button></div></header>{message ? <p className="admin-message">{message}</p> : null}<div className="admin-grid"><section className="admin-card"><h2>1. Investigation Reports</h2><p className="admin-muted">Semua laporan user dan status review.</p><div className="admin-report-list">{reports.length ? reports.map((report) => <article className="admin-report" key={String(report.id)}><div><strong>{text(report, "title")}</strong><span>{text(report, "author_username")} · {text(report, "category")} · ▲{num(report, "signal_score")}</span><p>{text(report, "evidence")}</p></div><div className="admin-report__actions"><select defaultValue={text(report, "review_status", "queued")} id={`review-${String(report.id)}`} onChange={(event) => void updateReport(report, event.target.value === "approved" ? "Triaged" : "Queued for developer review", event.target.value)}><option value="queued">Queued</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><small>{text(report, "status")}</small></div></article>) : <p className="admin-muted">Belum ada laporan.</p>}</div></section><section className="admin-card"><h2>2. Module Catalog Upload</h2><p className="admin-muted">Metadata modul tersimpan sebagai draft; published memerlukan content_key.</p><form className="admin-form" onSubmit={(event) => void saveModule(event)}><div className="admin-form__grid"><AdminInput label="ID" name="id" required /><AdminInput label="Content key" name="content_key" /><AdminInput label="Title" name="title" required /><AdminInput label="Category" name="category" required /><AdminInput label="Route" name="route" required placeholder="/simulation/module-id" /><AdminInput label="Image path" name="image" placeholder="/media/module.webp" /><label className="admin-field">Description<textarea className="admin-input" name="description" required rows={3} /></label><AdminInput label="Difficulty" name="difficulty" type="number" /><AdminInput label="Position" name="position" type="number" /></div><label className="admin-check"><input name="active" type="checkbox" defaultChecked /> active</label><label className="admin-check"><input name="published" type="checkbox" /> published</label><button className="admin-submit" disabled={busy} type="submit">SAVE MODULE</button></form><ul className="admin-chip-list">{modules.map((module) => <li className={bool(module, "is_published") ? "admin-chip admin-chip--on" : "admin-chip"} key={text(module, "id")}>{text(module, "id")} · {bool(module, "is_published") ? "PUBLISHED" : "DRAFT"}</li>)}</ul></section><section className="admin-card"><h2>3. Daily Quest Control</h2><p className="admin-muted">Tentukan quest aktif, target, dan reward.</p><form className="admin-form" key={editingQuest ? text(editingQuest, "id") : "new-quest"} onSubmit={(event) => void saveQuest(event)}><div className="admin-form__grid"><AdminInput defaultValue={editingQuest ? text(editingQuest, "id") : ""} label="ID" name="id" required /><AdminInput defaultValue={editingQuest ? text(editingQuest, "title") : ""} label="Title" name="title" required /><label className="admin-field">Type<select className="admin-input" defaultValue={editingQuest ? text(editingQuest, "quest_type") : "daily_login"} name="type"><option value="daily_login">daily_login</option><option value="complete_module">complete_module</option><option value="create_report">create_report</option></select></label><AdminInput defaultValue={editingQuest ? String(num(editingQuest, "target_value", 1)) : "1"} label="Target" name="target" type="number" /><AdminInput defaultValue={editingQuest ? String(num(editingQuest, "reward_points")) : "10"} label="Reward" name="reward" type="number" /><AdminInput defaultValue={editingQuest ? String(num(editingQuest, "position")) : "1"} label="Position" name="position" type="number" /><label className="admin-field">Description<textarea className="admin-input" defaultValue={editingQuest ? text(editingQuest, "description") : ""} name="description" required rows={3} /></label></div><label className="admin-check"><input defaultChecked={editingQuest ? bool(editingQuest, "is_active") : true} name="active" type="checkbox" /> active</label><button className="admin-submit" disabled={busy} type="submit">{editingQuest ? "UPDATE QUEST" : "CREATE QUEST"}</button>{editingQuest ? <button className="admin-cancel" onClick={() => setEditingQuest(null)} type="button">CANCEL</button> : null}</form><ul className="admin-chip-list">{quests.map((quest) => <li key={text(quest, "id")}><button className="admin-chip" onClick={() => setEditingQuest(quest)} type="button">{text(quest, "id")} · {num(quest, "reward_points")} pts · {bool(quest, "is_active") ? "ACTIVE" : "OFF"}</button></li>)}</ul></section></div></main>;
}

function AdminInput({ label, name, type = "text", required, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) { return <label className="admin-field">{label}<input className="admin-input" defaultValue={defaultValue} name={name} placeholder={placeholder} required={required} type={type} /></label>; }
