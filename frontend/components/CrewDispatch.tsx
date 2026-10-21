"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Building2, Construction, Droplets, Lightbulb, Pause, Play, RotateCcw, Trash2, type LucideIcon } from "lucide-react";
import { CELLS, CREWS, createGame, dispatch, FIX_SECONDS, GRID, step, type GameState } from "@/lib/game";
import { categoryColor, categoryLabel } from "@/lib/labels";
import type { Category } from "@/lib/types";

const ICON: Record<Category, LucideIcon> = {
  pothole: Construction,
  streetlight: Lightbulb,
  overflowing_bin: Trash2,
  water_leak: Droplets,
  damaged_infrastructure: Building2,
};
const BEST_KEY = "civiclens.crew-dispatch.best";

type Phase = "idle" | "playing" | "paused" | "over";

export default function CrewDispatch() {
  const game = useRef<GameState>(createGame());
  const [phase, setPhase] = useState<Phase>("idle");
  const [crew, setCrew] = useState<Category>("pothole");
  const [best, setBest] = useState(0);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* storage can be blocked; the game works without it */
    }
  }, []);

  // Game loop: simulate every frame, repaint about 12 times a second.
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let paint = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); // a background tab must not dump seconds of time on the player
      last = now;
      step(game.current, dt);
      paint += dt;
      if (paint >= 0.08 || game.current.over) {
        paint = 0;
        redraw();
      }
      if (game.current.over) {
        setPhase("over");
        const score = game.current.score;
        setBest((b) => {
          if (score <= b) return b;
          try {
            localStorage.setItem(BEST_KEY, String(score));
          } catch {
            /* ignore */
          }
          return score;
        });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const start = useCallback(() => {
    game.current = createGame();
    setPhase("playing");
  }, []);

  const send = (i: number) => {
    if (phaseRef.current !== "playing") return;
    dispatch(game.current, i, crew);
    redraw();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const c = CREWS.find((x) => x.key === e.key);
      if (c) setCrew(c.id);
      if (e.key === "p" || e.key === "P") {
        setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const g = game.current;
  const playing = phase === "playing";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[1fr_17rem]">
      <div>
        <div className="mb-3 grid grid-cols-4 gap-2 text-center" aria-label="Scoreboard">
          <Stat label="Score" value={g.score} />
          <Stat label="Level" value={g.level} />
          <Stat label="Combo" value={`x${g.combo}`} />
          <Stat label="Best" value={Math.max(best, phase === "over" ? g.score : 0)} />
        </div>

        <div className="mb-3">
          <div className="mb-1 flex justify-between text-sm font-semibold text-ink-soft">
            <span id="trust-l">City trust</span>
            <span>{Math.round(g.trust)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-line/60" role="progressbar" aria-labelledby="trust-l" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(g.trust)}>
            <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${g.trust}%`, background: g.trust > 50 ? "#0f6e68" : g.trust > 25 ? "#e8892b" : "#a3331f" }} />
          </div>
        </div>

        <div className="relative">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}>
            {Array.from({ length: CELLS }, (_, i) => {
              const t = g.tiles[i];
              if (!t) return <div key={i} className="aspect-square rounded-xl border border-dashed border-line bg-white/50" aria-hidden="true" />;
              const Icon = ICON[t.category];
              const color = categoryColor(t.category);
              const frac = t.repairing !== null ? 1 - t.repairing / FIX_SECONDS : t.life / t.maxLife;
              const urgent = t.repairing === null && frac < 0.3;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => send(i)}
                  disabled={!playing}
                  aria-label={`${categoryLabel(t.category)}${t.reports > 1 ? `, ${t.reports} reports` : ""}${t.repairing !== null ? ", being repaired" : ""}`}
                  className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border-2 bg-white transition-transform active:scale-95 ${urgent ? "animate-pulse" : ""}`}
                  style={{ borderColor: color }}
                >
                  <Icon className="h-1/2 w-1/2" style={{ color }} aria-hidden="true" />
                  {t.reports > 1 && <span className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-[10px] font-bold text-white">{t.reports}</span>}
                  <span className="absolute inset-x-0 bottom-0 h-1.5 bg-line/60" aria-hidden="true">
                    <span className="block h-full" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: t.repairing !== null ? "#0f6e68" : urgent ? "#a3331f" : color }} />
                  </span>
                </button>
              );
            })}
          </div>

          {phase !== "playing" && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-paper/90 p-4 text-center">
              <div>
                <p className="font-display text-2xl">{phase === "idle" ? "Crew Dispatch" : phase === "paused" ? "Paused" : "Shift over"}</p>
                {phase === "over" && (
                  <p className="mt-1 text-ink-soft">
                    You fixed {g.fixed} cases and scored {g.score}.
                  </p>
                )}
                {phase === "idle" && <p className="mt-1 max-w-xs text-ink-soft">Reports pop up around the city. Send the right crew before residents lose patience.</p>}
                <button type="button" className="btn-primary mt-4" onClick={phase === "paused" ? () => setPhase("playing") : start}>
                  {phase === "paused" ? <Play className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                  {phase === "paused" ? "Resume" : phase === "over" ? "Play again" : "Start shift"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 min-h-6 text-sm text-ink-soft" role="status" aria-live="polite">
          {g.log}
        </p>
      </div>

      <aside aria-label="Crews" className="space-y-3">
        <h2 className="text-xl">Crews</h2>
        <ul className="space-y-2">
          {CREWS.map((c) => {
            const st = g.crews[c.id];
            const Icon = ICON[c.id];
            const wait = Math.max(st.busy, st.blocked);
            const on = crew === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCrew(c.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white px-3 py-2 text-left ${on ? "ring-2 ring-ink" : ""}`}
                  style={{ borderColor: categoryColor(c.id) }}
                >
                  <Icon className="h-5 w-5 shrink-0" style={{ color: categoryColor(c.id) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="block text-xs text-ink-mute">{st.blocked > 0 ? "Lost time" : st.busy > 0 ? "Returning" : "Ready"}</span>
                  </span>
                  {wait > 0 ? <span className="text-xs tabular-nums text-ink-mute">{wait.toFixed(1)}s</span> : <kbd className="rounded border border-line px-1.5 text-xs text-ink-mute">{c.key}</kbd>}
                </button>
              </li>
            );
          })}
        </ul>
        {playing && (
          <button type="button" className="btn-secondary w-full" onClick={() => setPhase("paused")}>
            <Pause className="h-4 w-4" aria-hidden="true" /> Pause (P)
          </button>
        )}
        <div className="card p-4 text-sm text-ink-soft">
          <p className="font-semibold text-ink">How to play</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Pick a crew (keys 1 to 5), then tap an issue of the same type.</li>
            <li>A wrong crew loses time and resets your combo.</li>
            <li>Repeat reports merge into one case worth more points.</li>
            <li>Every 8 fixes the city speeds up. Trust at zero ends the shift.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card px-2 py-2">
      <p className="text-xs font-semibold text-ink-mute">{label}</p>
      <p className="font-display text-xl tabular-nums">{value}</p>
    </div>
  );
}
