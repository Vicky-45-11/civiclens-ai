import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: { default: "CivicLens AI", template: "%s · CivicLens AI" },
  description: "Report potholes, broken streetlights, overflowing bins, water leaks and damaged infrastructure, and follow each case until it is fixed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f6e68" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <AuthProvider>
          <Header />
          <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-line bg-white/60">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-soft">
              <p>
                CivicLens AI is an independent open-source project. It is <strong>not</strong> connected to any government system, and reports are not sent to
                any authority unless a deployment arranges that separately.
              </p>
              <Link href="/about" className="font-semibold text-civic underline">
                Privacy, AI and limits
              </Link>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
