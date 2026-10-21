"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, NEXT_STATUS, SEVERITY_LABEL, STATUS_LABEL, categoryLabel } from "@/lib/labels";
import type { IssueDetail, Staff, Status } from "@/lib/types";
import { Photos } from "@/components/Photos";
import { StaffGuard } from "@/components/StaffGuard";
import { Timeline } from "@/components/Timeline";
import { CategoryTag, ErrorBox, SeverityPill, Spinner, StatusBadge } from "@/components/ui";

export default function AdminIssue() {
  const { id } = useParams<{ id: string }>();
  return (
    <StaffGuard next={`/admin/issues/${id}`}>
      <Case id={id} />
    </StaffGuard>
  );
}

function Case({ id }: { id: string }) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [dupCode, setDupCode] = useState("");
  const [note, setNote] = useState("");
  const [notePublic, setNotePublic] = useState(false);
  const [modNote, setModNote] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [evNote, setEvNote] = useState("");

  const apply = (i: IssueDetail) => {
    setIssue(i);
    setCategory(i.category);
    setSeverity(i.severity ? String(i.severity) : "");
    setAssignee(i.assigned_to?.id ?? "");
    setStatus("");
  };

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.get<IssueDetail>(`/issues/${encodeURIComponent(id)}`), api.get<Staff[]>("/admin/staff")])
      .then(([i, s]) => {
        apply(i);
        setStaff(s);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function run(fn: () => Promise<IssueDetail>, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      apply(await fn());
      setNotice(ok);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!issue) return;
    const body: Record<string, unknown> = { note: note || undefined, note_is_public: notePublic };
    if (category !== issue.category) body.category = category;
    if (severity && Number(severity) !== issue.severity) body.severity = Number(severity);
    if (assignee && assignee !== issue.assigned_to?.id) body.assigned_to_id = assignee;
    if (status) body.status = status;
    if (status === "duplicate") {
      try {
        const orig = await api.get<IssueDetail>(`/issues/${encodeURIComponent(dupCode.trim())}`);
        body.duplicate_of_id = orig.id;
      } catch {
        setError("Could not find the original report from that code.");
        return;
      }
    }
    await run(() => api.patch<IssueDetail>(`/admin/issues/${issue.id}`, body), "Saved.");
  }

  async function moderate(decision: "approve" | "reject") {
    await run(() => api.post<IssueDetail>(`/admin/issues/${issue!.id}/moderate`, { decision, note: modNote || undefined }), decision === "approve" ? "Approved and published." : "Rejected.");
    setModNote("");
  }

  async function evidence(e: React.FormEvent) {
    e.preventDefault();
    if (!files?.length) return setError("Choose at least one photo of the finished work.");
    const f = new FormData();
    Array.from(files).forEach((file) => f.append("photos", file));
    if (evNote) f.set("note", evNote);
    await run(() => api.upload<IssueDetail>(`/admin/issues/${issue!.id}/evidence`, f), "Evidence added.");
    setFiles(null);
    setEvNote("");
  }

  if (error && !issue) return <ErrorBox message={error} onRetry={load} />;
  if (!issue) return <Spinner />;

  const moves = NEXT_STATUS[issue.status] ?? [];
  const pending = issue.status === "pending_review";
  const closed = issue.status === "rejected";

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-semibold text-civic underline">
        ← Back to the queue
      </Link>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <CategoryTag category={issue.category} />
          <SeverityPill value={issue.severity} />
          {issue.flag_count > 0 && <span className="chip bg-[#f6dfdc] text-[#8a2a1e]">{issue.flag_count} flag(s)</span>}
        </div>
        <h1 className="mt-2 text-3xl">{issue.title}</h1>
        <p className="text-sm text-ink-mute">
          {issue.tracking_code} · by {issue.reporter} · {issue.lat.toFixed(5)}, {issue.lon.toFixed(5)}
          {issue.assigned_to && ` · assigned to ${issue.assigned_to.display_name}`}
        </p>
      </header>
      {error && <ErrorBox message={error} />}
      {notice && (
        <p role="status" className="rounded-lg bg-civic-light p-3 text-sm font-semibold text-civic-dark">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {issue.description && <p className="whitespace-pre-wrap">{issue.description}</p>}
          <Photos media={issue.media} kind="report" label="Reported photos" />
          <Photos media={issue.media} kind="resolution" label="Resolution evidence" />
          {issue.ai && (
            <section className="card p-4" aria-label="AI suggestion">
              <h2 className="text-xl">AI suggestion {issue.ai.is_demo && <span className="chip ml-1 bg-signal-light text-[#7a4a0c]">Demo, not a trained model</span>}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Category: {issue.ai.category ? categoryLabel(issue.ai.category) : "not detected"}
                {issue.ai.confidence !== null && ` (${Math.round(issue.ai.confidence * 100)}%)`} · Severity suggestion: {issue.ai.severity} ({SEVERITY_LABEL[issue.ai.severity]}) · Source: {issue.ai.model}
              </p>
              {!severity && (
                <button type="button" className="btn-secondary mt-2" onClick={() => setSeverity(String(issue.ai!.severity))}>
                  Use suggested severity as my starting point
                </button>
              )}
            </section>
          )}
        </div>

        <div className="space-y-4">
          {pending && (
            <section className="card space-y-3 p-4" aria-label="Moderation">
              <h2 className="text-xl">Moderation</h2>
              <p className="text-sm text-ink-soft">Check the photo and text. Reject anything that shows identifiable people, number plates, private property or abuse.</p>
              <label className="label" htmlFor="mn">
                Reason (required to reject)
              </label>
              <input id="mn" className="field" value={modNote} onChange={(e) => setModNote(e.target.value)} maxLength={500} />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={busy} onClick={() => moderate("approve")}>
                  Approve and publish
                </button>
                <button className="btn-danger flex-1" disabled={busy || !modNote.trim()} onClick={() => moderate("reject")}>
                  Reject
                </button>
              </div>
            </section>
          )}

          {!pending && !closed && (
            <form onSubmit={save} className="card space-y-3 p-4">
              <h2 className="text-xl">Triage</h2>
              <div>
                <label className="label" htmlFor="cat">
                  Category
                </label>
                <select id="cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sev">
                  Severity (you confirm it)
                </label>
                <select id="sev" className="field" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="">Not set</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {SEVERITY_LABEL[n]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="as">
                  Assign to
                </label>
                <select id="as" className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                      {s.department ? ` (${s.department})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="st">
                  Move to
                </label>
                <select id="st" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Keep as {STATUS_LABEL[issue.status]}</option>
                  {moves.map((m: Status) => (
                    <option key={m} value={m}>
                      {STATUS_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
              {status === "duplicate" && (
                <div>
                  <label className="label" htmlFor="dup">
                    Tracking code of the original
                  </label>
                  <input id="dup" className="field" value={dupCode} onChange={(e) => setDupCode(e.target.value)} placeholder="CL-XXXXXX" required />
                </div>
              )}
              <div>
                <label className="label" htmlFor="note">
                  Note
                </label>
                <textarea id="note" className="field min-h-20" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={notePublic} onChange={(e) => setNotePublic(e.target.checked)} className="h-4 w-4 accent-[#0f6e68]" /> Show this note to the resident and the public
                </label>
              </div>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>
          )}

          {!pending && !closed && (
            <form onSubmit={evidence} className="card space-y-3 p-4">
              <h2 className="text-xl">Resolution evidence</h2>
              <p className="text-sm text-ink-soft">A case can be marked resolved only after at least one photo of the finished work is uploaded.</p>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Resolution photos" onChange={(e) => setFiles(e.target.files)} />
              <input className="field" placeholder="What was done? (optional)" value={evNote} maxLength={500} onChange={(e) => setEvNote(e.target.value)} />
              <button className="btn-secondary w-full" disabled={busy}>
                Upload evidence
              </button>
            </form>
          )}

          <div className="card p-4">
            <h2 className="mb-3 text-xl">History</h2>
            <Timeline events={issue.events} staff />
          </div>
        </div>
      </div>
    </div>
  );
}
