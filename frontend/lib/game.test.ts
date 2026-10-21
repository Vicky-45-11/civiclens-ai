import { describe, expect, it } from "vitest";
import { CELLS, CREW_COOLDOWN, createGame, dispatch, FIX_SECONDS, issueLife, spawnEvery, step, WRONG_LOCKOUT, type Issue } from "./game";

const issue = (over: Partial<Issue> = {}): Issue => ({ category: "pothole", life: 10, maxLife: 10, reports: 1, repairing: null, ...over });
const calm = () => 0.99; // never spawns a duplicate

describe("crew dispatch", () => {
  it("fixes an issue when the matching crew is sent, then the crew rests", () => {
    const s = createGame();
    s.nextSpawn = 99;
    s.tiles[3] = issue();
    expect(dispatch(s, 3, "pothole")).toBe(true);
    expect(s.crews.pothole.busy).toBe(CREW_COOLDOWN);
    step(s, FIX_SECONDS + 0.01, calm);
    expect(s.tiles[3]).toBeNull();
    expect(s.fixed).toBe(1);
    expect(s.score).toBe(10);
    expect(dispatch(s, 3, "pothole")).toBe(false);
  });

  it("punishes the wrong crew: lockout, combo reset and lost trust", () => {
    const s = createGame();
    s.nextSpawn = 99;
    s.combo = 5;
    s.tiles[0] = issue({ category: "water_leak" });
    expect(dispatch(s, 0, "pothole")).toBe(true);
    expect(s.combo).toBe(0);
    expect(s.trust).toBe(96);
    expect(s.crews.pothole.blocked).toBe(WRONG_LOCKOUT);
    expect(s.tiles[0]?.repairing).toBeNull();
    expect(dispatch(s, 0, "pothole")).toBe(false); // still locked out
  });

  it("loses trust when a report expires and ends the game at zero", () => {
    const s = createGame();
    s.nextSpawn = 99;
    s.trust = 8;
    s.tiles[1] = issue({ life: 0.5 });
    step(s, 1, calm);
    expect(s.tiles[1]).toBeNull();
    expect(s.trust).toBe(0);
    expect(s.over).toBe(true);
    const clock = s.clock;
    step(s, 5, calm);
    expect(s.clock).toBe(clock); // frozen once over
  });

  it("pays more for a case with duplicate reports and rewards combos", () => {
    const s = createGame();
    s.nextSpawn = 99;
    s.tiles[2] = issue({ reports: 3 });
    dispatch(s, 2, "pothole");
    step(s, FIX_SECONDS + 0.01, calm);
    expect(s.score).toBe(18); // 10 + 4 * 2
    s.tiles[4] = issue({ category: "streetlight" });
    dispatch(s, 4, "streetlight");
    step(s, FIX_SECONDS + 0.01, calm);
    expect(s.score).toBe(18 + 11); // combo of 1 adds 10%
  });

  it("merges a repeat report into an existing case instead of using a new tile", () => {
    const s = createGame();
    for (let i = 0; i < CELLS; i++) s.tiles[i] = issue({ category: "pothole", life: 5 });
    s.nextSpawn = 0;
    step(s, 0.001, () => 0); // rng 0 picks "pothole"
    expect(s.tiles.some((t) => t && t.reports === 2)).toBe(true);
  });

  it("gets harder with each level but stays bounded", () => {
    expect(spawnEvery(2)).toBeLessThan(spawnEvery(1));
    expect(issueLife(2)).toBeLessThan(issueLife(1));
    expect(spawnEvery(50)).toBe(1.1);
    expect(issueLife(50)).toBe(6);
    const s = createGame();
    s.nextSpawn = 99;
    s.fixed = 7;
    s.tiles[0] = issue();
    dispatch(s, 0, "pothole");
    step(s, FIX_SECONDS + 0.01, calm);
    expect(s.level).toBe(2);
  });
});
