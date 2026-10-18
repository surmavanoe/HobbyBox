import { expect, test } from "bun:test";
import { getAchievements, MCU_FILMS, MIDDLE_EARTH_FILMS } from "./achievements";
import type { Log, Media } from "./data";

const media = (id: string, title: string, category: Media["category"] = "film"): Media => ({ id, title, category, cover: "poster", year: 2020, creator: "", rating: 4, genres: [], synopsis: "", logs: 0 });
const log = (id: string, review = ""): Log => ({ id: `log-${id}`, mediaId: id, userId: "me", rating: 4, review, rewatch: false, createdAt: 0, likes: 0 });

test("Marvel completion requires the complete 37-film collection and does not count rewatches twice", () => {
  const catalog = MCU_FILMS.map((title, i) => media(`mcu-${i}`, title));
  expect(getAchievements([log("mcu-0"), log("mcu-0")], catalog)[0].completed).toBe(1);
  expect(getAchievements(catalog.map((item) => log(item.id)), catalog)[0].percent).toBe(100);
  expect(getAchievements([], catalog)[0].total).toBe(37);
});
test("Tolkien requires all six saga films, not a book with the same title", () => {
  const catalog = MIDDLE_EARTH_FILMS.map((title, i) => media(`lotr-${i}`, title));
  expect(getAchievements(catalog.map((item) => log(item.id)), catalog)[1].percent).toBe(100);
  expect(getAchievements([log("book")], [media("book", MIDDLE_EARTH_FILMS[0], "book")])[1].completed).toBe(0);
});
test("first review unlocks only for written review text", () => {
  expect(getAchievements([log("x", "   ")], [media("x", "Title")])[2].percent).toBe(0);
  expect(getAchievements([log("x", "Loved it")], [media("x", "Title")])[2].percent).toBe(100);
});
test("explorer requires all five distinct categories", () => {
  const catalog = (["film", "tv", "anime", "manga", "book"] as const).map((category) => media(category, category, category));
  expect(getAchievements(catalog.map((item) => log(item.id)), catalog)[3].percent).toBe(100);
  expect(getAchievements([log("film"), log("film")], catalog)[3].completed).toBe(1);
});
test("a legacy cover substitution cannot unlock an unrelated achievement", () => {
  expect(getAchievements([log("f8")], [media("replacement", "Iron Man")])[0].completed).toBe(0);
});