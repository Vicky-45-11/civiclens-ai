"use client";

import { useState } from "react";
import { Crosshair, Globe2, Landmark, MapPinned } from "lucide-react";
import { MAP_PROVIDER, VIEW_IDS, VIEWS, type ViewId } from "@/lib/mapViews";
import { CATEGORIES } from "@/lib/labels";

const ICON: Record<ViewId, typeof Globe2> = { home: MapPinned, india: Landmark, world: Globe2 };

/** Jump between the Tamil Nadu, India and world viewports. */
export function ViewSwitch({ value, onChange }: { value: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <div role="group" aria-label="Map area" className="inline-flex overflow-hidden rounded-lg ring-1 ring-line">
      {VIEW_IDS.map((id) => {
        const I = ICON[id];
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${on ? "bg-civic text-white" : "bg-white text-ink-soft hover:bg-paper"}`}
          >
            <I className="h-4 w-4" aria-hidden="true" /> {VIEWS[id].label}
          </button>
        );
      })}
    </div>
  );
}

/** Which map provider is actually in use; never implies Google Maps when it is not configured. */
export function ProviderNote() {
  return (
    <p className="text-xs text-ink-mute">
      {MAP_PROVIDER === "google" ? "Map data: Google Maps." : "Map data: OpenStreetMap contributors. Google Maps turns on when a browser API key is configured (see the README)."}
    </p>
  );
}

/** Category filter chips that double as the map legend. */
export function CategoryChips({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={value === ""} onClick={() => onChange("")} className={`chip ring-1 ring-line ${value === "" ? "bg-ink text-white" : "bg-white text-ink-soft"}`}>
        All
      </button>
      {CATEGORIES.map((c) => (
        <button key={c.id} type="button" aria-pressed={value === c.id} onClick={() => onChange(value === c.id ? "" : c.id)} className={`chip ring-1 ring-line ${value === c.id ? "bg-ink text-white" : "bg-white text-ink-soft"}`}>
          <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Asks the browser for the visitor's position. Nothing is sent anywhere; the map just recentres. */
export function LocateButton({ onLocate }: { onLocate: (p: [number, number]) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = () => {
    if (!navigator.geolocation) return setMsg("Your browser does not support location.");
    setBusy(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        onLocate([p.coords.latitude, p.coords.longitude]);
      },
      () => {
        setBusy(false);
        setMsg("Location was not shared.");
      },
      { timeout: 10000 },
    );
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-secondary" onClick={go} disabled={busy}>
        <Crosshair className="h-4 w-4" aria-hidden="true" /> {busy ? "Locating…" : "Near me"}
      </button>
      {msg && <span className="text-sm text-ink-mute" role="status">{msg}</span>}
    </span>
  );
}
