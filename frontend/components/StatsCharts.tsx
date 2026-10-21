import { CATEGORIES, STATUS_LABEL } from "@/lib/labels";
import type { Stats, Status } from "@/lib/types";

/** Share of public reports that are resolved. All numbers come from /api/stats. */
export function ResolutionRing({ stats }: { stats: Stats }) {
  const pct = stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <figure className="card flex items-center gap-5 p-5">
      <svg viewBox="0 0 140 140" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label={`${pct}% of public reports are resolved`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e7e2d6" strokeWidth="14" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#0f6e68" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" transform="rotate(90 70 70)" className="fill-ink font-display text-3xl">
          {pct}%
        </text>
      </svg>
      <figcaption>
        <p className="font-display text-xl">Resolved</p>
        <p className="text-sm text-ink-soft">
          {stats.resolved} of {stats.total} public reports are closed with photo evidence.
        </p>
      </figcaption>
    </figure>
  );
}

/** Public reports per category, as horizontal bars. */
export function CategoryBars({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...CATEGORIES.map((c) => stats.by_category[c.id] ?? 0));
  return (
    <div className="card p-5">
      <p className="font-display text-xl">By category</p>
      <ul className="mt-3 space-y-2">
        {CATEGORIES.map((c) => {
          const n = stats.by_category[c.id] ?? 0;
          return (
            <li key={c.id} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm">
              <span className="truncate text-ink-soft">{c.label}</span>
              <span className="h-2.5 rounded-full bg-line/60">
                <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: c.color }} />
              </span>
              <span className="text-right tabular-nums">{n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One segmented bar showing where public reports sit in the workflow. */
export function StatusStrip({ stats }: { stats: Stats }) {
  const order: Status[] = ["open", "triaged", "assigned", "in_progress", "resolved"];
  const tone = ["#6e8fc4", "#4f78b8", "#8a6bb5", "#b5651d", "#0f6e68"];
  const total = order.reduce((s, k) => s + (stats.by_status[k] ?? 0), 0);
  return (
    <div className="card p-5">
      <p className="font-display text-xl">Where reports are in the process</p>
      {total === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">No published reports yet.</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-line/60" role="img" aria-label="Report status breakdown">
            {order.map((k, i) => (stats.by_status[k] ? <span key={k} style={{ width: `${(stats.by_status[k] / total) * 100}%`, background: tone[i] }} /> : null))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {order.map((k, i) => (
              <li key={k} className="inline-flex items-center">
                <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: tone[i] }} aria-hidden="true" />
                {STATUS_LABEL[k]} {stats.by_status[k] ?? 0}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
