"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "./AuthProvider";

const LINKS = [
  { href: "/map", label: "Map" },
  { href: "/report", label: "Report an issue" },
  { href: "/game", label: "Play" },
  { href: "/my", label: "My reports" },
  { href: "/about", label: "About & privacy" },
];

export function Header() {
  const { user, logout, loading } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const staff = user && user.role !== "resident";

  const links = [...LINKS, ...(staff ? [{ href: "/admin", label: "Staff dashboard" }] : [])];

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-civic text-white" aria-hidden="true">
            ◎
          </span>
          CivicLens
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white ${path.startsWith(l.href) ? "bg-white text-civic" : "text-ink-soft"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {loading ? null : user ? (
            <>
              <span className="text-sm text-ink-soft">{user.display_name}</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Create account
              </Link>
            </>
          )}
        </div>
        <button type="button" className="btn-secondary md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper px-4 pb-4 md:hidden">
          <ul className="flex flex-col gap-1 py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 font-semibold hover:bg-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {user ? (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={async () => {
                await logout();
                setOpen(false);
                router.push("/");
              }}
            >
              Sign out ({user.display_name})
            </button>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link href="/register" className="btn-primary flex-1" onClick={() => setOpen(false)}>
                Create account
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
