export type Category = "pothole" | "streetlight" | "overflowing_bin" | "water_leak" | "damaged_infrastructure";
export type Status = "pending_review" | "open" | "triaged" | "assigned" | "in_progress" | "resolved" | "rejected" | "duplicate";
export type Role = "resident" | "staff" | "admin";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  department: string | null;
}

export interface Staff {
  id: string;
  display_name: string;
  department: string | null;
}

export interface Media {
  id: string;
  kind: "report" | "resolution";
  url: string;
  width: number;
  height: number;
}

export interface IssueEvent {
  id: string;
  type: string;
  from_status: Status | null;
  to_status: Status | null;
  note: string | null;
  is_public: boolean;
  actor: string | null;
  created_at: string;
}

export interface Ai {
  category: Category | null;
  confidence: number | null;
  severity: number;
  model: string;
  is_demo: boolean;
  note: string;
}

export interface IssueSummary {
  id: string;
  tracking_code: string;
  category: Category;
  title: string;
  status: Status;
  severity: number | null;
  lat: number;
  lon: number;
  created_at: string;
  updated_at: string;
  thumbnail: string | null;
  flag_count: number;
}

export interface IssueDetail extends IssueSummary {
  description: string;
  address_hint: string | null;
  media: Media[];
  events: IssueEvent[];
  resolved_at: string | null;
  mine: boolean;
  reporter: string | null;
  assigned_to: Staff | null;
  duplicate_of: string | null;
  ai: Ai | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Duplicate {
  id: string;
  tracking_code: string;
  title: string;
  category: Category;
  status: Status;
  distance_m: number;
  photo_distance: number | null;
  likely: boolean;
}

export interface Preview {
  ai: Ai;
  duplicates: Duplicate[];
}

export interface Cluster {
  lat: number;
  lon: number;
  count: number;
  issue_id: string | null;
  category: Category | null;
  max_severity: number | null;
}

export interface Stats {
  total: number;
  resolved: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  median_days_to_resolve: number | null;
}

export interface Analytics {
  generated_at: string;
  by_status: Record<string, number>;
  daily_last_30_days: { date: string; count: number }[];
  open_by_severity: Record<string, number>;
  by_category: { category: Category; total: number; open: number; median_days_to_resolve: number | null }[];
  median_days_to_resolve: number | null;
  oldest_open_days: number | null;
  flagged: number;
  ai_agreement: { judged: number; matched: number };
  hotspots: { lat: number; lon: number; count: number }[];
}
