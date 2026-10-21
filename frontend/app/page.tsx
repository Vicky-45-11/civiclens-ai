"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Camera, CheckCircle2, ClipboardCheck, MapPin, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/labels";
import type { IssueSummary, Page, Stats } from "@/lib/types";
import { MapView } from "@/components/MapView";
import { CategoryBars, ResolutionRing, StatusStrip } from "@/components/StatsCharts";
import { VIEWS, VIEW_IDS } from "@/lib/mapViews";
import { Empty, ErrorBox, IssueCard, Spinner } from "@/components/ui";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<IssueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.get<Stats>("/stats"), api.get<Page<IssueSummary>>("/issues?page_size=4&sort=updated")])
      .then(([s, p]) => {
        setStats(s);
        setRecent(p.items);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-civic">Civic issue reporting</p>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">See a problem on your street? Report it and follow it to the fix.</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">
            Add a photo and a pin. A person reviews every report before it is published, assigns it to a crew, and posts photo evidence when the work is done.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/report" className="btn-primary">
              <Camera className="h-4 w-4" aria-hidden="true" /> Report an issue
            </Link>
            <Link href="/map" className="btn-secondary">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Explore the map
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="What you can report">
            {CATEGORIES.map((c) => (
              <li key={c.id} className="chip bg-white text-ink-soft ring-1 ring-line">
                <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                {c.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-hidden p-2">
          <MapView height="360px" onOpenIssue={(id) => router.push(`/issues/${id}`)} />
        </div>
      </section>

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="mb-4 text-2xl">
          Published reports right now
        </h2>
        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !stats ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat label="Public reports" value={String(stats.total)} />
              <Stat label="Resolved with evidence" value={String(stats.resolved)} />
              <Stat label="Median days to resolve" value={stats.median_days_to_resolve === null ? "Not enough data yet" : String(stats.median_days_to_resolve)} />
            </dl>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
                <ResolutionRing stats={stats} />
                <StatusStrip stats={stats} />
              </div>
              <CategoryBars stats={stats} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="regions-h">
        <h2 id="regions-h" className="mb-4 text-2xl">
          Explore by region
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
          {VIEW_IDS.map((id) => (
            <Link key={id} href={`/map?view=${id}`} className="card block p-5 hover:ring-2 hover:ring-civic">
              <MapPin className="h-5 w-5 text-civic" aria-hidden="true" />
              <p className="mt-2 font-display text-xl">{VIEWS[id].label}</p>
              <p className="text-sm text-ink-soft">{id === "home" ? "Centred on 11.33° N, 79.73° E" : id === "india" ? "Zoomed out to all of India" : "The whole world at once"}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-4 text-2xl">
          Recent activity
        </h2>
        {!recent ? (
          error ? null : <Spinner />
        ) : recent.length === 0 ? (
          <Empty title="No published reports yet">Be the first to report something in your area.</Empty>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {recent.map((i) => (
              <IssueCard key={i.id} issue={i} href={`/issues/${i.id}`} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="how-h" className="grid gap-4 md:grid-cols-4">
        <h2 id="how-h" className="sr-only">
          How it works
        </h2>
        {[
          [Camera, "Report", "Photo, pin and a short description. The AI suggests a category and severity."],
          [ShieldCheck, "Human review", "A moderator approves every report before it is public."],
          [ClipboardCheck, "Triage and assign", "Staff confirm the severity and assign a crew."],
          [CheckCircle2, "Resolved with proof", "A case closes only with a photo of the finished work."],
        ].map(([Icon, title, text], idx) => {
          const I = Icon as typeof Camera;
          return (
            <div key={String(title)} className="card p-5">
              <I className="h-6 w-6 text-civic" aria-hidden="true" />
              <h3 className="mt-3 text-lg">
                {idx + 1}. {String(title)}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{String(text)}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <dt className="text-sm font-semibold text-ink-mute">{label}</dt>
      <dd className="mt-1 font-display text-3xl">{value}</dd>
    </div>
  );
}
