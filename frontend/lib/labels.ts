import type { Category, Status } from "./types";

export const CATEGORIES: { id: Category; label: string; blurb: string; color: string }[] = [
  { id: "pothole", label: "Pothole", blurb: "Holes and cracks in the road", color: "#b4561f" },
  { id: "streetlight", label: "Broken streetlight", blurb: "Lamps that are out or flickering", color: "#c79a00" },
  { id: "overflowing_bin", label: "Overflowing bin", blurb: "Bins or rubbish not collected", color: "#4a7c3a" },
  { id: "water_leak", label: "Water leak", blurb: "Leaking pipes, flooding", color: "#1f6fb4" },
  { id: "damaged_infrastructure", label: "Damaged infrastructure", blurb: "Pavements, rails, drains, signs", color: "#7a4aa6" },
];

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
export const categoryColor = (c: string) => CATEGORIES.find((x) => x.id === c)?.color ?? "#555";

export const STATUS_LABEL: Record<Status, string> = {
  pending_review: "Awaiting review",
  open: "Received",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Not published",
  duplicate: "Duplicate",
};

export const STATUS_TONE: Record<Status, string> = {
  pending_review: "bg-signal-light text-[#7a4a0c]",
  open: "bg-[#e6eef9] text-[#1d4f91]",
  triaged: "bg-[#e6eef9] text-[#1d4f91]",
  assigned: "bg-[#efe8f8] text-[#5b3a8a]",
  in_progress: "bg-[#efe8f8] text-[#5b3a8a]",
  resolved: "bg-civic-light text-civic-dark",
  rejected: "bg-[#f6dfdc] text-[#8a2a1e]",
  duplicate: "bg-[#ececec] text-[#4a4a4a]",
};

export const SEVERITY_LABEL = ["", "Minor", "Low", "Moderate", "High", "Critical"];

/** Mirrors the transition table in the API (backend/app/services.py). The API is the authority. */
export const NEXT_STATUS: Partial<Record<Status, Status[]>> = {
  open: ["triaged", "assigned", "in_progress", "duplicate"],
  triaged: ["open", "assigned", "in_progress", "duplicate"],
  assigned: ["triaged", "in_progress", "resolved", "duplicate"],
  in_progress: ["assigned", "resolved"],
  resolved: ["in_progress"],
  duplicate: ["open"],
};

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const units: [number, string][] = [[86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [n, u] of units) if (s >= n) return `${Math.floor(s / n)} ${u}${Math.floor(s / n) > 1 ? "s" : ""} ago`;
  return "just now";
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
