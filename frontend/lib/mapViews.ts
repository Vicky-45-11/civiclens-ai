export type ViewId = "home" | "india" | "world";

export interface MapViewSpec {
  id: ViewId;
  label: string;
  center: [number, number]; // [lat, lon]
  zoom: number;
}

// "home" is the starting point the project owner chose: 11.333747, 79.7287696 (Tamil Nadu, India).
export const VIEWS: Record<ViewId, MapViewSpec> = {
  home: { id: "home", label: "Tamil Nadu", center: [11.333747, 79.7287696], zoom: 12 },
  india: { id: "india", label: "India", center: [22.8, 79.5], zoom: 5 },
  world: { id: "world", label: "World", center: [20, 10], zoom: 2 },
};

export const VIEW_IDS = Object.keys(VIEWS) as ViewId[];

export const isViewId = (v: string | null | undefined): v is ViewId => !!v && v in VIEWS;

/** Google Maps is used only when a browser key is configured; otherwise OpenStreetMap is used. */
export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const MAP_PROVIDER: "google" | "osm" = GOOGLE_KEY ? "google" : "osm";
