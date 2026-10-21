"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { IssueSummary, Page } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Empty, ErrorBox, IssueCard, NeedSignIn, PageTitle, Spinner } from "@/components/ui";

export default function MyReports() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<Page<IssueSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setError(null);
    api
      .get<Page<IssueSummary>>(`/issues?mine=true&page=${page}&page_size=10`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [page]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <Spinner />;
  if (!user) return <NeedSignIn next="/my" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Your account" title="My reports">
        Follow each report from review to resolution. Reports waiting for review are visible only to you.
      </PageTitle>
      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty title="You have not reported anything yet">
          <Link href="/report" className="font-semibold text-civic underline">
            Report your first issue
          </Link>
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((i) => (
              <IssueCard key={i.id} issue={i} href={`/issues/${i.id}`} />
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button className="btn-secondary" disabled={page * data.page_size >= data.total} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
