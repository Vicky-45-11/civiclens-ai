"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Flag, MapPin } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import type { IssueDetail } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Photos } from "@/components/Photos";
import { Timeline } from "@/components/Timeline";
import { CategoryTag, ErrorBox, SeverityPill, Spinner, StatusBadge } from "@/components/ui";

export default function IssuePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [flagMsg, setFlagMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .get<IssueDetail>(`/issues/${encodeURIComponent(id)}`)
      .then(setIssue)
      .catch((e: ApiError) => setError({ status: e.status, message: e.message }));
  }, [id]);
  useEffect(load, [load]);

  async function flag(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/issues/${issue!.id}/flag`, { reason });
      setFlagMsg("Thank you. A moderator will take a look.");
      setFlagOpen(false);
    } catch (err) {
      setFlagMsg(err instanceof Error ? err.message : "Could not send the flag.");
    }
  }

  if (error) {
    if (error.status === 404)
      return (
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-3xl">Report not found</h1>
          <p className="mt-2 text-ink-soft">It may not exist, or it is still waiting for review and only its owner can see it.{!user && " If it is yours, sign in."}</p>
          {!user && (
            <Link className="btn-primary mt-4" href={`/login?next=${encodeURIComponent(`/issues/${id}`)}`}>
              Sign in
            </Link>
          )}
        </div>
      );
    return <ErrorBox message={error.message} onRetry={load} />;
  }
  if (!issue) return <Spinner />;

  const isPublic = !["pending_review", "rejected"].includes(issue.status);

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <CategoryTag category={issue.category} />
          {issue.severity && <SeverityPill value={issue.severity} />}
        </div>
        <h1 className="mt-2 text-3xl sm:text-4xl">{issue.title}</h1>
        <p className="mt-1 text-sm text-ink-mute">
          {issue.tracking_code} · reported {formatDate(issue.created_at)} · updated {formatDate(issue.updated_at)}
        </p>
        {issue.status === "pending_review" && issue.mine && <p className="mt-3 rounded-lg bg-signal-light p-3 text-sm">Only you can see this report until a moderator approves it.</p>}
        {issue.status === "rejected" && issue.mine && <p className="mt-3 rounded-lg bg-[#fbeceb] p-3 text-sm text-[#7c2a1f]">This report was not published. See the timeline for details.</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {issue.description && <p className="whitespace-pre-wrap text-lg">{issue.description}</p>}
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {issue.address_hint ? `${issue.address_hint} · ` : ""}
            {issue.lat.toFixed(5)}, {issue.lon.toFixed(5)}
          </p>
          <Photos media={issue.media} kind="report" label="Reported photos" />
          <Photos media={issue.media} kind="resolution" label="Resolution evidence" />
        </div>
        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 text-xl">Progress</h2>
            <Timeline events={issue.events} />
          </div>
          {issue.mine && issue.ai && (
            <div className="card p-4 text-sm">
              <h2 className="text-lg">AI suggestion on your report</h2>
              <p className="mt-1 text-ink-soft">{issue.ai.is_demo ? "Demo mode: no trained classifier was used. " : ""}Severity suggestion: {issue.ai.severity}/5. A person decides the real severity.</p>
            </div>
          )}
          {isPublic && user && !issue.mine && (
            <div>
              {flagMsg ? (
                <p role="status" className="text-sm text-ink-soft">
                  {flagMsg}
                </p>
              ) : flagOpen ? (
                <form onSubmit={flag} className="card space-y-2 p-4">
                  <label className="label" htmlFor="why">
                    What is wrong with this report?
                  </label>
                  <input id="why" className="field" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required placeholder="Shows a person's face, wrong place, abusive…" />
                  <div className="flex gap-2">
                    <button className="btn-primary">Send flag</button>
                    <button type="button" className="btn-secondary" onClick={() => setFlagOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="btn-secondary" onClick={() => setFlagOpen(true)}>
                  <Flag className="h-4 w-4" aria-hidden="true" /> Flag this report
                </button>
              )}
            </div>
          )}
          {user && user.role !== "resident" && (
            <Link className="btn-primary w-full" href={`/admin/issues/${issue.id}`}>
              Open in staff dashboard
            </Link>
          )}
        </aside>
      </div>
    </article>
  );
}
