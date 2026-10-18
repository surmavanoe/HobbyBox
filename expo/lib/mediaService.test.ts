import { afterEach, expect, spyOn, test } from "bun:test";
import { aiDiscover } from "./mediaService";

afterEach(() => { globalThis.fetch = originalFetch; });
const originalFetch = globalThis.fetch;

const result = {
  id: "f76948c0-8883-4bcc-b811-d4ce1bf3e601", title: "Death Note", format: "manga",
  release_year: 2003, poster_url: "https://example.com/poster.jpg", average_rating: 4.6,
  genres: ["Mystery", "Thriller"], synopsis: "A notebook that kills people.", similarity: 0.76,
};

test("public search posts only prompt using the existing publishable key in both headers", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "Matches", results: [] }));
  await aiDiscover("A dark manga about a notebook that kills people", "all", []);
  const [url, options] = request.mock.calls[0];
  expect(url).toBe("https://smeucssdhwbfoiaethcm.supabase.co/functions/v1/omni-search");
  expect(options?.method).toBe("POST");
  expect(JSON.parse(String(options?.body))).toEqual({ prompt: "A dark manga about a notebook that kills people" });
  const headers = new Headers(options?.headers);
  expect(headers.get("apikey")?.startsWith("sb_publishable_")).toBe(true);
  expect(headers.get("Authorization")).toBe(`Bearer ${headers.get("apikey")}`);
  expect(headers.get("Content-Type")).toBe("application/json");
});

test("maps backend media fields and message without local ranking or match badges", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "Matches", results: [result] }));
  expect(await aiDiscover("notebook", "all", [])).toEqual({ intro: "Matches", results: [{
    id: result.id, title: "Death Note", category: "manga", year: 2003,
    cover: result.poster_url, rating: 4.6, genres: ["Mystery", "Thriller"],
    synopsis: result.synopsis, creator: "", logs: 0,
  }] });
});

test("results without a poster are hidden", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "Matches", results: [{
    ...result, release_year: null, poster_url: null, average_rating: null, genres: null, synopsis: null,
  }] }));
  expect((await aiDiscover("notebook")).results).toEqual([]);
});

test("signed-in token is sent and friend context is mapped", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "M", results: [{ ...result, friend_name: "Maya", friend_rating: 5 }] }));
  const out = await aiDiscover("drama my friends rated 5 stars", "all", [], "user-token");
  expect(new Headers(request.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer user-token");
  expect(out.results[0].friendNote).toBe("Maya gave this 5 stars");
});

test("unauthenticated friend search failure propagates instead of generating local matches", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }));
  await expect(aiDiscover("books my friends rated 4+")).rejects.toThrow("AI search unavailable");
});

test("invalid responses propagate to the existing retry flow", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Unavailable" }));
  await expect(aiDiscover("notebook")).rejects.toThrow("Invalid AI search response");
});