import type { Category } from "./types";

// Crew Dispatch: a small arcade game. It is fiction: nothing here touches the real reports or the API.

export const GRID = 5;
export const CELLS = GRID * GRID;

/** Which crew fixes which kind of issue. */
export const CREWS: { id: Category; name: string; key: string }[] = [
  { id: "pothole", name: "Road crew", key: "1" },
  { id: "streetlight", name: "Electricians", key: "2" },
  { id: "overflowing_bin", name: "Sanitation", key: "3" },
  { id: "water_leak", name: "Plumbers", key: "4" },
  { id: "damaged_infrastructure", name: "Engineers", key: "5" },
];

export interface Issue {
  category: Category;
  /** Seconds left before the issue is given up on. */
  life: number;
  maxLife: number;
  /** How many residents reported it. Duplicate reports merge into one case and raise the payout. */
  reports: number;
  /** Seconds of repair work remaining once a crew is on site, or null when untouched. */
  repairing: number | null;
}

export interface Crew {
  busy: number; // seconds until free again
  blocked: number; // seconds locked out after a wrong dispatch
}

export interface GameState {
  tiles: (Issue | null)[];
  crews: Record<Category, Crew>;
  trust: number; // 0..100, the game ends at 0
  score: number;
  fixed: number;
  combo: number;
  level: number;
  clock: number;
  nextSpawn: number;
  over: boolean;
  log: string;
}

export type Rng = () => number;

export const FIX_SECONDS = 1.2;
export const CREW_COOLDOWN = 2.5;
export const WRONG_LOCKOUT = 2.5;
export const FIXES_PER_LEVEL = 8;

/** Medium difficulty: spawns speed up and patience shrinks, but never below a floor. */
export const spawnEvery = (level: number) => Math.max(1.1, 3 - (level - 1) * 0.28);
export const issueLife = (level: number) => Math.max(6, 13 - (level - 1) * 0.9);

export function createGame(): GameState {
  const crews = {} as Record<Category, Crew>;
  for (const c of CREWS) crews[c.id] = { busy: 0, blocked: 0 };
  return {
    tiles: Array<Issue | null>(CELLS).fill(null),
    crews,
    trust: 100,
    score: 0,
    fixed: 0,
    combo: 0,
    level: 1,
    clock: 0,
    nextSpawn: 0.8,
    over: false,
    log: "Pick a crew, then tap the matching problem.",
  };
}

const pick = <T,>(arr: T[], rng: Rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

function spawn(s: GameState, rng: Rng) {
  const category = pick(CREWS, rng).id;
  const free = s.tiles.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
  // Sometimes the same problem is reported again instead of a new one appearing.
  const same = s.tiles.map((t, i) => (t && t.category === category && t.repairing === null ? i : -1)).filter((i) => i >= 0);
  if (same.length && (free.length === 0 || rng() < 0.2)) {
    const t = s.tiles[pick(same, rng)]!;
    t.reports += 1;
    t.life = Math.min(t.maxLife, t.life + 1.5);
    return;
  }
  if (!free.length) return;
  const life = issueLife(s.level);
  s.tiles[pick(free, rng)] = { category, life, maxLife: life, reports: 1, repairing: null };
}

/** Advances the game by dt seconds. Mutates and returns the same state object. */
export function step(s: GameState, dt: number, rng: Rng = Math.random): GameState {
  if (s.over) return s;
  s.clock += dt;
  for (const c of Object.values(s.crews)) {
    c.busy = Math.max(0, c.busy - dt);
    c.blocked = Math.max(0, c.blocked - dt);
  }
  for (let i = 0; i < CELLS; i++) {
    const t = s.tiles[i];
    if (!t) continue;
    if (t.repairing !== null) {
      t.repairing -= dt;
      if (t.repairing <= 0) {
        const gain = Math.round((10 + 4 * (t.reports - 1)) * (1 + Math.min(s.combo, 10) * 0.1));
        s.score += gain;
        s.combo += 1;
        s.fixed += 1;
        s.trust = Math.min(100, s.trust + 2);
        s.tiles[i] = null;
        s.log = t.reports > 1 ? `Fixed one case covering ${t.reports} reports. +${gain}` : `Fixed. +${gain}`;
        const level = 1 + Math.floor(s.fixed / FIXES_PER_LEVEL);
        if (level > s.level) {
          s.level = level;
          s.log = `Level ${level}: reports arrive faster.`;
        }
      }
      continue;
    }
    t.life -= dt;
    if (t.life <= 0) {
      s.tiles[i] = null;
      s.combo = 0;
      s.trust = Math.max(0, s.trust - (6 + 2 * t.reports));
      s.log = "A report went unanswered. Residents lose trust.";
    }
  }
  s.nextSpawn -= dt;
  while (s.nextSpawn <= 0) {
    spawn(s, rng);
    s.nextSpawn += spawnEvery(s.level);
  }
  if (s.trust <= 0) {
    s.over = true;
    s.log = "Game over: residents have lost trust in the city.";
  }
  return s;
}

/** Sends a crew to a tile. Returns false if nothing happened. */
export function dispatch(s: GameState, index: number, crew: Category): boolean {
  if (s.over) return false;
  const t = s.tiles[index];
  const c = s.crews[crew];
  if (!t || t.repairing !== null) return false;
  if (c.busy > 0 || c.blocked > 0) {
    s.log = "That crew is not ready yet.";
    return false;
  }
  if (t.category !== crew) {
    c.blocked = WRONG_LOCKOUT;
    s.combo = 0;
    s.trust = Math.max(0, s.trust - 4);
    s.log = "Wrong crew sent. They lose time and the combo resets.";
    if (s.trust <= 0) s.over = true;
    return true;
  }
  t.repairing = FIX_SECONDS;
  c.busy = CREW_COOLDOWN;
  return true;
}
