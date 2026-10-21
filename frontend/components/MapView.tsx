"use client";

import dynamic from "next/dynamic";
import { Spinner } from "./ui";

// Leaflet touches `window`, so the map is loaded only in the browser.
export const MapView = dynamic(() => import("./IssueMap"), { ssr: false, loading: () => <Spinner label="Loading map" /> });
