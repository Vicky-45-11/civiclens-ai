"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, qs } from "@/lib/api";
import { CATEGORIES } from "@/lib/labels";
import type { IssueSummary, Page } from "@/lib/types";
import { MapView } from "@/components/MapView";
import { Empty, ErrorBox, IssueCard, PageTitle, Spinner } from "@/components/ui";

export default function MapPage() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<IssueSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .get<Page<IssueSummary>>(`/issues${qs({ category, status, q, page, page_size: 10 })}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [category, status, q, page]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // wait for the visitor to stop typing
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div>
      <PageTitle eyebrow="Public map" title="Reports near you">
        Only reports a moderator has approved are shown. Groups are computed on the server for the area you are viewing; zoom in to separate them.
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="cat">
            Category
          </label>
          <select id="cat" className="field" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="st">
            Status
          </label>
          <select id="st" className="field" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">Any status</option>
            <option value="open">Received</option>
            <option value="triaged">Triaged</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input id="q" className="field" placeholder="Title, description or code" value={q} maxLength={80} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-2">
          <div className="card overflow-hidden p-2">
            <MapView height="520px" category={category} status={status} onOpenIssue={(id) => router.push(`/issues/${id}`)} onError={setMapError} />
          </div>
          {mapError && <ErrorBox message={mapError} />}
        </div>
        <div>
          {error ? (
            <ErrorBox message={error} onRetry={load} />
          ) : !data ? (
            <Spinner />
          ) : data.items.length === 0 ? (
            <Empty title="No reports match">Try another category or clear the search.</Empty>
          ) : (
            <>
              <p className="mb-2 text-sm text-ink-mute">{data.total} public reports</p>
              <div className="space-y-3">
                {data.items.map((i) => (
                  <IssueCard key={i.id} issue={i} href={`/issues/${i.id}`} />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="text-sm text-ink-mute">
                  Page {data.page} of {Math.max(1, Math.ceil(data.total / data.page_size))}
                </span>
                <button type="button" className="btn-secondary" disabled={page * data.page_size >= data.total} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
