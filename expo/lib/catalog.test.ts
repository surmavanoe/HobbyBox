import { expect, test } from "bun:test";
import { filterCatalog, mapCatalogRow } from "./catalog";

test("every one of 60 database media IDs is available to search", () => {
  const media = Array.from({ length: 60 }, (_, i) => mapCatalogRow({
    id: `database-${i}`, title: `Catalog title ${i}`, format: ["film", "tv", "manga"][i % 3],
    synopsis: `Description ${i}`, external_id: null,
  }));
  expect(filterCatalog(media, "")).toHaveLength(60);
  for (const item of media) {
    expect(filterCatalog(media, item.title).some((result) => result.id === item.id)).toBe(true);
  }
});

test("database category and synopsis remain authoritative", () => {
  const item = mapCatalogRow({ id: "uuid", title: "Chainsaw Man", format: "manga", synopsis: "Database description", external_id: null });
  expect(item.category).toBe("manga");
  expect(item.id).toBe("uuid");
  expect(item.synopsis).toBe("Database description");
  expect(filterCatalog([item], "CHAINSAW", "manga")).toHaveLength(1);
  expect(filterCatalog([item], "CHAINSAW", "anime")).toHaveLength(0);
});
test("database poster, year and genres override demo values", () => {
  const item = mapCatalogRow({ id: "u", title: "X", format: "film", synopsis: null, external_id: null, poster_url: "https://p/x.jpg", release_year: 1999, genres: ["Drama"], average_rating: 4.2 });
  expect(item).toMatchObject({ cover: "https://p/x.jpg", year: 1999, genres: ["Drama"], rating: 4.2 });
});
