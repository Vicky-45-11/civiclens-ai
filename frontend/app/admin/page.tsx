"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api";
import { CATEGORIES } from "@/lib/labels";
import type { IssueSummary, Page } from "@/lib/types";
import { Empty, ErrorBox, IssueCard, PageTitle, Spinner } from "@/components/ui";
import { StaffGuard } from "@/components/StaffGuard";

const QUEUES = [
  ["moderation", "Needs review"],
  ["triage", "To triage"],
  ["active", "Assigned and in progress"],
  ["resolved", "Resolved"],
  ["closed", "Rejected and duplicates"],
] as const;

export default function Admin() {
  return (
    <StaffGuard next="/admin">
      <Dashboard />
    </StaffGuard>
  );
}

function Dashboard() {
  const [name, setName] = useState<(typeof QUEUES)[number][0]>("moderation");
  const [category, setCategory] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<IssueSummary> | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.get<Page<IssueSummary>>(`/admin/queue${qs({ name, category, flagged, mine, sort, page })}`), api.get<Record<string, number>>("/admin/queue-counts")])
      .then(([d, c]) => {
        setData(d);
        setCounts(c);
      })
      .catch((e: Error) => setError(e.message));
  }, [name, category, flagged, mine, sort, page]);
  useEffect(load, [load]);

  return (
    <div>
      <PageTitle eyebrow="Staff" title="Case queue">
        Review new reports, confirm severity, assign crews and close cases with evidence. The AI only suggests; nothing changes until you decide.
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Queues">
        {QUEUES.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={name === id} className={name === id ? "btn-primary" : "btn-secondary"} onClick={() => (setName(id), setPage(1))}>
            {label}
            <span className="chip bg-white/80 text-ink">{counts?.[id] ?? "–"}</span>
          </button>
        ))}
        <Link href="/admin/analytics" className="btn-secondary ml-auto">
          Analytics
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="c">
            Category
          </label>
          <select id="c" className="field" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))}>
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="s">
            Sort
          </label>
          <select id="s" className="field" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="priority">Priority (flags, severity, age)</option>
            <option value="oldest">Oldest first</option>
            <option value="new">Newest first</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={flagged} onChange={(e) => (setFlagged(e.target.checked), setPage(1))} className="h-4 w-4 accent-[#0f6e68]" /> Flagged only {counts && `(${counts.flagged})`}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={mine} onChange={(e) => (setMine(e.target.checked), setPage(1))} className="h-4 w-4 accent-[#0f6e68]" /> Assigned to me
        </label>
      </div>
      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty title="Nothing in this queue">New work will appear here.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {data.items.map((i) => (
              <IssueCard key={i.id} issue={i} href={`/admin/issues/${i.id}`} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span className="text-sm text-ink-mute">
              {data.total} cases · page {data.page}
            </span>
            <button className="btn-secondary" disabled={page * data.page_size >= data.total} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
