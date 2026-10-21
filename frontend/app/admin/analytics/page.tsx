"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { STATUS_LABEL, categoryLabel } from "@/lib/labels";
import type { Analytics, Status } from "@/lib/types";
import { ErrorBox, PageTitle, Spinner } from "@/components/ui";
import { StaffGuard } from "@/components/StaffGuard";

export default function AnalyticsPage() {
  return (
    <StaffGuard next="/admin/analytics">
      <View />
    </StaffGuard>
  );
}

function View() {
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api
      .get<Analytics>("/admin/analytics")
      .then(setA)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!a) return <Spinner />;

  const max = Math.max(1, ...a.daily_last_30_days.map((d) => d.count));
  const sevMax = Math.max(1, ...Object.values(a.open_by_severity));
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-semibold text-civic underline">
        ← Back to the queue
      </Link>
      <PageTitle eyebrow="Staff" title="Analytics">
        Computed from the database when you opened this page ({new Date(a.generated_at).toLocaleString()}).
      </PageTitle>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Median days to resolve" value={a.median_days_to_resolve === null ? "No resolved cases yet" : String(a.median_days_to_resolve)} />
        <Kpi label="Oldest open case (days)" value={a.oldest_open_days === null ? "None open" : String(a.oldest_open_days)} />
        <Kpi label="Flagged reports" value={String(a.flagged)} />
        <Kpi label="AI category matched staff" value={a.ai_agreement.judged === 0 ? "No model predictions yet" : `${a.ai_agreement.matched} of ${a.ai_agreement.judged}`} />
      </dl>

      <section className="card p-5" aria-labelledby="d-h">
        <h2 id="d-h" className="text-xl">
          New reports per day, last 30 days
        </h2>
        {a.daily_last_30_days.length === 0 ? (
          <p className="mt-2 text-sm text-ink-mute">No reports in this period.</p>
        ) : (
          <ul className="mt-4 flex h-40 items-end gap-1" aria-label="Daily report counts">
            {a.daily_last_30_days.map((d) => (
              <li key={d.date} className="flex-1" title={`${d.date}: ${d.count}`}>
                <div className="rounded-t bg-civic" style={{ height: `${(d.count / max) * 100}%`, minHeight: 4 }} />
                <span className="sr-only">
                  {d.date}: {d.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="s-h">
          <h2 id="s-h" className="text-xl">
            Open cases by confirmed severity
          </h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(a.open_by_severity).length === 0 && <li className="text-sm text-ink-mute">No open cases.</li>}
            {Object.entries(a.open_by_severity).map(([k, v]) => (
              <li key={k} className="flex items-center gap-3 text-sm">
                <span className="w-24">{k === "0" ? "Not yet set" : `Severity ${k}`}</span>
                <span className="h-3 rounded bg-signal" style={{ width: `${(v / sevMax) * 60}%` }} />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5" aria-labelledby="st-h">
          <h2 id="st-h" className="text-xl">
            Cases by status
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(a.by_status).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{STATUS_LABEL[k as Status] ?? k}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card overflow-x-auto p-5" aria-labelledby="c-h">
        <h2 id="c-h" className="text-xl">
          By category
        </h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-mute">
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Open</th>
              <th className="py-2">Median days to resolve</th>
            </tr>
          </thead>
          <tbody>
            {a.by_category.map((c) => (
              <tr key={c.category} className="border-b border-line/60">
                <td className="py-2 pr-4">{categoryLabel(c.category)}</td>
                <td className="py-2 pr-4">{c.total}</td>
                <td className="py-2 pr-4">{c.open}</td>
                <td className="py-2">{c.median_days_to_resolve ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-5" aria-labelledby="h-h">
        <h2 id="h-h" className="text-xl">
          Hotspots (open cases within about 500 m)
        </h2>
        {a.hotspots.length === 0 ? (
          <p className="mt-2 text-sm text-ink-mute">No open cases.</p>
        ) : (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {a.hotspots.map((h, i) => (
              <li key={i}>
                {h.count} open · around {h.lat.toFixed(4)}, {h.lon.toFixed(4)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <dt className="text-sm font-semibold text-ink-mute">{label}</dt>
      <dd className="mt-1 font-display text-2xl">{value}</dd>
    </div>
  );
}
