import { STATUS_LABEL, formatDate } from "@/lib/labels";
import type { IssueEvent, Status } from "@/lib/types";

const TITLES: Record<string, string> = {
  submitted: "Report received",
  moderation: "Reviewed by a moderator",
  status: "Status updated",
  triage: "Triage update",
  note: "Note",
  evidence: "Resolution evidence added",
  duplicate: "Possible duplicate flagged",
  flag: "Reader flagged this report",
};

export function Timeline({ events, staff = false }: { events: IssueEvent[]; staff?: boolean }) {
  if (events.length === 0) return <p className="text-sm text-ink-mute">No updates yet.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ${e.is_public ? "bg-civic" : "bg-signal"}`} aria-hidden="true" />
          <p className="text-sm font-semibold">
            {TITLES[e.type] ?? e.type}
            {e.to_status && <span className="font-normal text-ink-soft"> → {STATUS_LABEL[e.to_status as Status] ?? e.to_status}</span>}
            {staff && !e.is_public && <span className="chip ml-2 bg-signal-light text-[#7a4a0c]">Internal</span>}
          </p>
          {e.note && <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{e.note}</p>}
          <p className="text-xs text-ink-mute">
            {formatDate(e.created_at)}
            {e.actor ? ` · ${e.actor}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
