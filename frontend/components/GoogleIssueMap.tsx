"use client";

import { useEffect, useRef, useState } from "react";
import { api, qs } from "@/lib/api";
import { categoryColor } from "@/lib/labels";
import { GOOGLE_KEY, VIEWS, type ViewId } from "@/lib/mapViews";
import type { Cluster } from "@/lib/types";
import type { MapProps } from "./IssueMap";
import { ErrorBox, Spinner } from "./ui";

let loader: Promise<void> | null = null;

/** Loads the Maps JavaScript API once. The key is a browser key: restrict it by HTTP referrer in Google Cloud. */
function loadGoogle(): Promise<void> {
  if (typeof google !== "undefined" && google.maps) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const cb = "__civiclensGoogleReady";
    (window as unknown as Record<string, unknown>)[cb] = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&callback=${cb}`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error("Google Maps could not be loaded. Check the API key and your connection."));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export default function GoogleIssueMap({ className = "", category, status, height = "420px", picker, view, focus, onOpenIssue, onError }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const pin = useRef<google.maps.Marker | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [failure, setFailure] = useState("");
  const filters = useRef({ category, status });
  const handlers = useRef({ onOpenIssue, onError, picker });
  filters.current = { category, status };
  handlers.current = { onOpenIssue, onError, picker };

  const load = useRef(async () => {});
  load.current = async () => {
    const m = map.current;
    const b = m?.getBounds();
    if (!m || !b) return;
    const w = b.getSouthWest();
    const n = b.getNorthEast();
    // A map wider than the world reports a wrapped box; clamp to valid longitudes.
    const west = n.lng() < w.lng() ? -180 : w.lng();
    const east = n.lng() < w.lng() ? 180 : n.lng();
    const bbox = [west, Math.max(-90, w.lat()), east, Math.min(90, n.lat())].join(",");
    try {
      const data = await api.get<Cluster[]>(`/issues/clusters${qs({ bbox, zoom: Math.round(m.getZoom() ?? 5), ...filters.current })}`);
      markers.current.forEach((x) => x.setMap(null));
      markers.current = data.map((c) => {
        const single = c.count === 1;
        const mk = new google.maps.Marker({
          map: m,
          position: { lat: c.lat, lng: c.lon },
          title: single ? "Open report" : `${c.count} reports, zoom in`,
          label: single ? undefined : { text: String(c.count), color: "#fff", fontWeight: "700" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: single ? 9 : Math.min(27, 13 + Math.log2(c.count) * 4),
            fillColor: single && c.category ? categoryColor(c.category) : "#0f6e68",
            fillOpacity: 0.95,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        mk.addListener("click", () => {
          if (single && c.issue_id) handlers.current.onOpenIssue?.(c.issue_id);
          else {
            m.panTo({ lat: c.lat, lng: c.lon });
            m.setZoom(Math.min((m.getZoom() ?? 5) + 2, 18));
          }
        });
        return mk;
      });
      handlers.current.onError?.(null);
    } catch (e) {
      handlers.current.onError?.(e instanceof Error ? e.message : "Could not load the map.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !el.current) return;
        const v = VIEWS[view ?? "home"];
        const start = picker?.value ? { lat: picker.value[0], lng: picker.value[1] } : { lat: v.center[0], lng: v.center[1] };
        const m = new google.maps.Map(el.current, {
          center: start,
          zoom: picker ? 16 : v.zoom,
          minZoom: 2,
          streetViewControl: false,
          fullscreenControl: !picker,
          mapTypeControl: true,
          gestureHandling: picker ? "cooperative" : "auto",
        });
        map.current = m;
        m.addListener("idle", () => void load.current());
        if (handlers.current.picker) {
          m.addListener("click", (ev: google.maps.MapMouseEvent) => {
            if (ev.latLng) handlers.current.picker?.onChange([ev.latLng.lat(), ev.latLng.lng()]);
          });
        }
        setState("ready");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setFailure(e.message);
        setState("failed");
      });
    return () => {
      cancelled = true;
      markers.current.forEach((x) => x.setMap(null));
      markers.current = [];
      pin.current?.setMap(null);
      pin.current = null;
      map.current = null;
    };
    // Created once; props are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load.current();
  }, [category, status]);

  useEffect(() => {
    if (!view || !map.current) return;
    const v = VIEWS[view as ViewId];
    map.current.panTo({ lat: v.center[0], lng: v.center[1] });
    map.current.setZoom(v.zoom);
  }, [view, state]);

  useEffect(() => {
    if (!focus || !map.current) return;
    map.current.panTo({ lat: focus[0], lng: focus[1] });
    map.current.setZoom(14);
  }, [focus, state]);

  useEffect(() => {
    const m = map.current;
    const v = picker?.value;
    if (!m || !v) return;
    const pos = { lat: v[0], lng: v[1] };
    if (!pin.current) {
      pin.current = new google.maps.Marker({ map: m, position: pos, draggable: true });
      pin.current.addListener("dragend", () => {
        const p = pin.current?.getPosition();
        if (p) handlers.current.picker?.onChange([p.lat(), p.lng()]);
      });
    } else pin.current.setPosition(pos);
    if (!m.getBounds()?.contains(pos)) m.panTo(pos);
  }, [picker?.value, state]);

  if (state === "failed") return <ErrorBox message={failure} />;
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div ref={el} className="h-full w-full" role="application" aria-label="Map of reported issues" />
      {state === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-paper/70">
          <Spinner label="Loading Google Maps" />
        </div>
      )}
    </div>
  );
}
