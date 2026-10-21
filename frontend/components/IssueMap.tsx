"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { api, qs } from "@/lib/api";
import { categoryColor } from "@/lib/labels";
import type { Cluster } from "@/lib/types";

import { VIEWS, type ViewId } from "@/lib/mapViews";

export interface MapProps {
  className?: string;
  category?: string;
  status?: string;
  height?: string;
  /** Preset viewport: the owner's home area, all of India, or the whole world. Defaults to "home". */
  view?: ViewId;
  /** Recentre on a point (for example the visitor's location). */
  focus?: [number, number] | null;
  /** When set the map lets the user drop a pin and reports its position. */
  picker?: { value: [number, number] | null; onChange: (p: [number, number]) => void };
  onOpenIssue?: (id: string) => void;
  onError?: (message: string | null) => void;
}

/** OpenStreetMap tiles with clusters computed in PostGIS: each pan or zoom asks the API for the visible area. */
export default function IssueMap({ className = "", category, status, height = "420px", picker, view, focus, onOpenIssue, onError }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const filters = useRef({ category, status });
  const handlers = useRef({ onOpenIssue, onError, picker });
  filters.current = { category, status };
  handlers.current = { onOpenIssue, onError, picker };

  const load = useRef(async () => {});
  load.current = async () => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    const b = m.getBounds();
    const wide = b.getEast() - b.getWest() >= 360; // zoomed out past one copy of the world
    const bbox = [wide ? -180 : Math.max(-180, b.getWest()), Math.max(-90, b.getSouth()), wide ? 180 : Math.min(180, b.getEast()), Math.min(90, b.getNorth())].join(",");
    try {
      const data = await api.get<Cluster[]>(`/issues/clusters${qs({ bbox, zoom: Math.round(m.getZoom()), ...filters.current })}`);
      g.clearLayers();
      for (const c of data) {
        const single = c.count === 1;
        const size = single ? 22 : Math.min(54, 26 + Math.log2(c.count) * 8);
        const bg = single && c.category ? categoryColor(c.category) : "#0f6e68";
        const marker = L.marker([c.lat, c.lon], {
          icon: L.divIcon({
            className: "",
            iconSize: [size, size],
            html: `<div class="cluster-dot" style="width:${size}px;height:${size}px;background:${bg};font-size:${size > 30 ? 14 : 11}px">${single ? "" : c.count}</div>`,
          }),
          keyboard: true,
          title: single ? "Open report" : `${c.count} reports, zoom in`,
        });
        marker.on("click", () => {
          if (single && c.issue_id) handlers.current.onOpenIssue?.(c.issue_id);
          else m.setView([c.lat, c.lon], Math.min(m.getZoom() + 2, 18));
        });
        marker.addTo(g);
      }
      handlers.current.onError?.(null);
    } catch (e) {
      handlers.current.onError?.(e instanceof Error ? e.message : "Could not load the map.");
    }
  };

  useEffect(() => {
    if (!el.current || map.current) return;
    const v = VIEWS[view ?? "home"];
    const m = L.map(el.current, { center: picker?.value ?? v.center, zoom: picker ? 16 : v.zoom, minZoom: 2, worldCopyJump: true, scrollWheelZoom: !picker });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on("moveend", () => void load.current());
    if (handlers.current.picker) {
      m.on("click", (ev: L.LeafletMouseEvent) => handlers.current.picker?.onChange([ev.latlng.lat, ev.latlng.lng]));
    }
    void load.current();
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once; props are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load.current();
  }, [category, status]);

  useEffect(() => {
    if (!view || !map.current) return;
    const v = VIEWS[view];
    map.current.setView(v.center, v.zoom);
  }, [view]);

  useEffect(() => {
    if (focus && map.current) map.current.setView(focus, 14);
  }, [focus]);

  // Keep the picker pin in sync with the chosen point.
  useEffect(() => {
    const m = map.current;
    const v = picker?.value;
    if (!m || !v) return;
    if (!pin.current) {
      pin.current = L.marker(v, { draggable: true }).addTo(m);
      pin.current.on("dragend", () => {
        const p = pin.current!.getLatLng();
        handlers.current.picker?.onChange([p.lat, p.lng]);
      });
    } else {
      pin.current.setLatLng(v);
    }
    if (!m.getBounds().contains(v)) m.setView(v, Math.max(m.getZoom(), 16));
  }, [picker?.value]);

  return <div ref={el} className={className} style={{ height }} role="application" aria-label="Map of reported issues" />;
}

// Leaflet's default marker images are not bundled by Next; use CDN-free inline SVG instead.
const pinSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 40 14 40s14-16 14-26.2C28 6.2 21.7 0 14 0z" fill="#e8892b"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>');
L.Marker.prototype.options.icon = L.icon({ iconUrl: `data:image/svg+xml;charset=UTF-8,${pinSvg}`, iconSize: [28, 40], iconAnchor: [14, 40] });
