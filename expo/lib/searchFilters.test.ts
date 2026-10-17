import { expect, test } from "bun:test";
import { MEDIA } from "./data";
import { applySearchFilters, EMPTY_SEARCH_FILTERS, MIN_RELEASE_YEAR, MAX_RELEASE_YEAR, moveYearHandle, formatYearRange } from "./searchFilters";

test("release range starts at 1940 and ends at 2027", () => {
  expect([MIN_RELEASE_YEAR, MAX_RELEASE_YEAR]).toEqual([1940, 2027]);
  expect(moveYearHandle([1940, 2027], 0, 1900)).toEqual([1940, 2027]);
  expect(moveYearHandle([1940, 2027], 1, 2030)).toEqual([1940, 2027]);
});
for (const category of ["film", "anime", "tv", "manga", "book"] as const) {
  test(`${category} category includes only that media type`, () => {
    const result = applySearchFilters(MEDIA, { ...EMPTY_SEARCH_FILTERS, category });
    expect(result.map((item) => item.id)).toEqual(MEDIA.filter((item) => item.category === category).map((item) => item.id));
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(MEDIA.length);
  });
}
test("every integer from 1940 through 2026 is selectable", () => {
  for (let year = 1940; year <= 2026; year++) {
    expect(moveYearHandle([1940, 2027], 0, year)).toEqual([year, 2027]);
    expect(moveYearHandle([1940, 2027], 1, year)).toEqual([1940, year]);
  }
  expect(moveYearHandle([1940, 2027], 0, 2000.6)).toEqual([2001, 2027]);
});
test("neither dot can cross the other", () => {
  expect(moveYearHandle([1990, 2000], 0, 2027)).toEqual([2000, 2000]);
  expect(moveYearHandle([1990, 2000], 1, 1940)).toEqual([1990, 1990]);
});
test("meeting dots produce a single year and can separate again", () => {
  expect(formatYearRange([2000, 2000])).toBe("2000");
  expect(moveYearHandle([2000, 2000], 0, 1999)).toEqual([1999, 2000]);
  expect(moveYearHandle([2000, 2000], 1, 2001)).toEqual([2000, 2001]);
});
test("specific release year excludes other and unknown years", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [1940, 1949, 1950, 0].map((year) => ({ ...base, id: String(year), year }));
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, yearRange: [1949, 1949] }).map((m) => m.year)).toEqual([1949]);
});
test("range filtering includes both endpoint years", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [0, 1940, 1999, 2000, 2001, 2026, 2027].map((year) => ({ ...base, id: String(year), year }));
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, yearRange: [1999, 2001] }).map((m) => m.year)).toEqual([1999, 2000, 2001]);
});
test("genre selection filters matching film genres", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [{ ...base, id: "action", genres: ["action"] }, { ...base, id: "drama", genres: ["drama"] }];
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, genre: "Action" }).map((m) => m.id)).toEqual(["action"]);
});
test("best to worst orders ratings descending", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [2, 5, 3].map((rating) => ({ ...base, rating }));
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, ratingOrder: "best" }).map((m) => m.rating)).toEqual([5, 3, 2]);
});
test("worst to best orders ratings ascending", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [2, 5, 3].map((rating) => ({ ...base, rating }));
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, ratingOrder: "worst" }).map((m) => m.rating)).toEqual([2, 3, 5]);
});
test("unknown ratings remain last rather than pretending to be poor ratings", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [0, 4, 2].map((rating) => ({ ...base, rating }));
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, ratingOrder: "worst" }).map((m) => m.rating)).toEqual([2, 4, 0]);
});