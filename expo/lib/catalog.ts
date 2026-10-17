import { MEDIA, type Category, type Media } from "./data";

export interface CatalogRow {
  id: string;
  title: string;
  format: string;
  synopsis: string | null;
  external_id: string | null;
}

const categories: Record<string, Category> = {
  film: "film", movie: "film", films: "film", tv: "tv", series: "tv",
  anime: "anime", manga: "manga", comic: "manga", comics: "manga", book: "book", books: "book",
};

export function mapCatalogRow(row: CatalogRow): Media {
  const category = categories[row.format.toLowerCase().trim()];
  if (!category) throw new Error("Unsupported catalog format");
  const matching = MEDIA.find((m) => m.category === category && m.title.toLowerCase() === row.title.toLowerCase());
  return {
    id: row.id,
    title: row.title,
    category,
    synopsis: row.synopsis ?? "",
    cover: matching?.cover ?? "",
    creator: matching?.creator ?? "",
    year: matching?.year ?? 0,
    genres: matching?.genres ?? [],
    // Demo community statistics are not database ratings.
    rating: 0,
    logs: 0,
  };
}

export function filterCatalog(catalog: Media[], query: string, category: Category | "all" = "all") {
  const q = query.trim().toLocaleLowerCase();
  return catalog.filter((m) =>
    (category === "all" || m.category === category) &&
    (!q || `${m.title} ${m.creator} ${m.synopsis} ${m.genres.join(" ")}`.toLocaleLowerCase().includes(q)),
  );
}