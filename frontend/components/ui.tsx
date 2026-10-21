import Link from "next/link";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { STATUS_LABEL, STATUS_TONE, SEVERITY_LABEL, categoryColor, categoryLabel } from "@/lib/labels";
import type { Category, Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(category) }} aria-hidden="true" />
      {categoryLabel(category)}
    </span>
  );
}

export function SeverityPill({ value, suggested }: { value: number | null; suggested?: boolean }) {
  if (!value) return <span className="chip bg-[#ececec] text-ink-mute">Severity not set</span>;
  const tone = value >= 4 ? "bg-[#f6dfdc] text-[#8a2a1e]" : value === 3 ? "bg-signal-light text-[#7a4a0c]" : "bg-civic-light text-civic-dark";
  return (
    <span className={`chip ${tone}`}>
      {suggested ? "Suggested: " : ""}
      {value} · {SEVERITY_LABEL[value]}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-ink-mute">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#e5b7b0] bg-[#fbeceb] p-4 text-[#7c2a1f]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">Something needs attention</p>
        <p className="text-sm">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary mt-2">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 p-8 text-center">
      <Inbox className="mx-auto h-8 w-8 text-ink-mute" aria-hidden="true" />
      <p className="mt-2 font-display text-lg">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-civic">{eyebrow}</p>}
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-ink-soft">{children}</p>}
    </header>
  );
}

export function NeedSignIn({ next }: { next: string }) {
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <h2 className="text-xl">Sign in to continue</h2>
      <p className="mt-1 text-sm text-ink-soft">We ask residents to sign in so reports can be tracked and abuse can be limited.</p>
      <div className="mt-4 flex justify-center gap-3">
        <Link className="btn-primary" href={`/login?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
        <Link className="btn-secondary" href={`/register?next=${encodeURIComponent(next)}`}>
          Create account
        </Link>
      </div>
    </div>
  );
}

export function IssueCard({ issue, href }: { issue: import("@/lib/types").IssueSummary; href: string }) {
  return (
    <Link href={href} className="card flex min-w-0 gap-3 p-3 transition-shadow hover:shadow-lg">
      {issue.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- photos come from our API and are already resized
        <img src={issue.thumbnail} alt="" className="h-20 w-24 shrink-0 rounded-lg object-cover" loading="lazy" />
      ) : (
        <div className="h-20 w-24 shrink-0 rounded-lg bg-paper" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{issue.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <CategoryTag category={issue.category} />
          <StatusBadge status={issue.status} />
        </div>
        <p className="mt-1 text-xs text-ink-mute">
          {issue.tracking_code}
          {issue.flag_count > 0 && <span className="ml-2 font-semibold text-[#8a2a1e]">{issue.flag_count} flag{issue.flag_count > 1 ? "s" : ""}</span>}
        </p>
      </div>
    </Link>
  );
}
