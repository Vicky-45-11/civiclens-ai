import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, qs } from "./api";
import { NEXT_STATUS, STATUS_LABEL, timeAgo } from "./labels";

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("qs", () => {
  it("drops empty values and encodes the rest", () => {
    expect(qs({ a: "x y", b: "", c: undefined, d: null, e: false, f: 0, g: true })).toBe("?a=x+y&f=0&g=true");
    expect(qs({})).toBe("");
  });
});

describe("api", () => {
  it("sends the CSRF header and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api.post("/x", { a: 1 })).toEqual({ ok: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Requested-With"]).toBe("civiclens");
  });

  it("turns API errors into readable messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(422, { detail: "Add a short title." })));
    await expect(api.get("/x")).rejects.toMatchObject({ status: 422, message: "Add a short title." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(422, { detail: [{ msg: "Value is not a valid email" }] })));
    await expect(api.get("/x")).rejects.toMatchObject({ message: "Value is not a valid email" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(429, {})));
    await expect(api.get("/x")).rejects.toThrow(/Too many requests/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500, undefined)));
    await expect(api.get("/x")).rejects.toThrow(/our side/);
  });

  it("reports a network failure clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    const err = (await api.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });

  it("handles 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api.post("/auth/logout")).toBeUndefined();
  });
});

describe("workflow labels", () => {
  it("only offers moves to known statuses and never leaves moderation", () => {
    for (const [from, tos] of Object.entries(NEXT_STATUS)) {
      expect(from in STATUS_LABEL).toBe(true);
      for (const to of tos!) expect(to in STATUS_LABEL).toBe(true);
    }
    expect(NEXT_STATUS.pending_review).toBeUndefined();
    expect(NEXT_STATUS.rejected).toBeUndefined();
  });

  it("formats relative time", () => {
    expect(timeAgo(new Date(Date.now() - 3 * 3600 * 1000).toISOString())).toBe("3 hours ago");
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });
});
