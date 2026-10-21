"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Small original animation helpers, in the spirit of animated-component libraries. No dependencies.
// Everything here is decorative: content is always in the DOM and fully visible when
// the visitor prefers reduced motion or JavaScript has not run yet.

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True once the element has scrolled into view (or immediately when motion is reduced). */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || reduced() || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Fades and lifts its children into place when scrolled into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`fx-reveal ${seen ? "is-in" : ""} ${className}`} style={{ "--fx-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Heading whose words rise and un-blur one after another. Screen readers get the plain sentence. */
export function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.3);
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden="true" className={`fx-word ${seen ? "is-in" : ""}`} style={{ "--fx-delay": `${i * 70}ms` } as CSSProperties}>
          {w}&nbsp;
        </span>
      ))}
    </span>
  );
}

/** Counts up to a number when it scrolls into view. Shows the final value straight away if motion is reduced. */
export function CountUp({ to, duration = 1200, className = "" }: { to: number; duration?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [n, setN] = useState(to);
  useEffect(() => {
    if (!seen || reduced()) return setN(to);
    let raf = 0;
    const start = performance.now();
    setN(0);
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {n}
    </span>
  );
}

/** A card with a soft light that follows the pointer. */
export function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`fx-spot card ${className}`}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        ref.current?.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current?.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/** Text with a slow highlight sweeping across it. */
export function ShinyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`fx-shiny ${className}`}>{children}</span>;
}

/** Endless horizontally scrolling row; pauses on hover and stops entirely for reduced motion. */
export function Marquee({ items }: { items: { label: string; color: string }[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map((c) => (
        <li key={c.label} className="chip whitespace-nowrap bg-white py-1.5 text-sm text-ink-soft ring-1 ring-line">
          <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden="true" />
          {c.label}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="fx-marquee overflow-hidden" aria-label="What you can report">
      <div className="fx-marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
