import { expect, test } from "bun:test";
import { MEDIA } from "./data";
import { applySearchFilters, EMPTY_SEARCH_FILTERS, RELEASE_DECADES, yearsInDecade } from "./searchFilters";

test("release decades cover 1940s through 2020s", () => {
  expect(RELEASE_DECADES).toEqual([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]);
});
test("1940s contains each numeral year from 1940 to 1949", () => {
  expect(yearsInDecade(1940)).toEqual([1940, 1941, 1942, 1943, 1944, 1945, 1946, 1947, 1948, 1949]);
});
test("specific release year excludes other and unknown years", () => {
  const base = MEDIA[0];
  if (!base) throw new Error("Missing test fixture");
  const items = [1940, 1949, 1950, 0].map((year) => ({ ...base, id: String(year), year }));
  expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, year: 1949 }).map((m) => m.year)).toEqual([1949]);
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