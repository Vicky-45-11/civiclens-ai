"use client";

import dynamic from "next/dynamic";
import { MAP_PROVIDER } from "@/lib/mapViews";
import { Spinner } from "./ui";

const Loading = () => <Spinner label="Loading map" />;

// Both map libraries touch `window`, so they load only in the browser.
// Google Maps is used when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; otherwise OpenStreetMap via Leaflet.
export const MapView = dynamic(() => (MAP_PROVIDER === "google" ? import("./GoogleIssueMap") : import("./IssueMap")), { ssr: false, loading: Loading });
