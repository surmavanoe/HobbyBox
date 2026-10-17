// Public catalog reads use the connected project's read-only Data API.
// No session or secret credentials are required to browse media.
import { MEDIA, type Category, type Media } from "./data";
import { filterCatalog, mapCatalogRow, type CatalogRow } from "./catalog";

const CATALOG_URL = "https://smeucssdhwbfoiaethcm.supabase.co/rest/v1/media_items";
const PUBLISHABLE_KEY = "sb_publishable_wJWtDTdhQaepebA_4SBC3Q_NEzL0wwV";

export async function fetchCatalog(): Promise<Media[]> {
  const items: Media[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${CATALOG_URL}?select=id,title,format,synopsis,external_id&order=title.asc,id.asc&offset=${offset}&limit=${pageSize}`, {
      headers: { apikey: PUBLISHABLE_KEY },
    });
    if (!response.ok) throw new Error("Catalog unavailable");
    const rows: CatalogRow[] = await response.json();
    items.push(...rows.map(mapCatalogRow));
    if (rows.length < pageSize) return items;
  }
}

export function searchLocal(query: string, category: Category | "all" = "all", catalog: Media[] = MEDIA): Media[] {
  return filterCatalog(catalog, query, category);
}

export async function searchJikan(query: string, kind: "anime" | "manga"): Promise<Media[]> {
  const res = await fetch(`https://api.jikan.moe/v4/${kind}?q=${encodeURIComponent(query)}&limit=8&sfw=true`);
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const json = await res.json();
  return (json.data ?? []).map((d: any) => ({
    id: `jikan-${kind}-${d.mal_id}`,
    title: d.title_english || d.title,
    category: kind,
    year: d.year ?? (d.published?.prop?.from?.year || 0),
    creator: (d.studios?.[0]?.name || d.authors?.[0]?.name || "") as string,
    cover: d.images?.jpg?.large_image_url ?? "",
    rating: d.score ? Math.round((d.score / 2) * 10) / 10 : 0,
    genres: (d.genres ?? []).map((g: any) => String(g.name).toLowerCase()),
    synopsis: (d.synopsis ?? "").slice(0, 220),
    logs: d.members ?? 0,
  }));
}

export async function searchOpenLibrary(query: string): Promise<Media[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,subject`,
  );
  if (!res.ok) throw new Error(`OpenLibrary ${res.status}`);
  const json = await res.json();
  return (json.docs ?? []).map((d: any) => ({
    id: `ol-${d.key}`,
    title: d.title,
    category: "book" as const,
    year: d.first_publish_year ?? 0,
    creator: d.author_name?.[0] ?? "",
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : "",
    rating: 0,
    genres: (d.subject ?? []).slice(0, 4).map((s: string) => s.toLowerCase()),
    synopsis: "",
    logs: 0,
  }));
}

// ---- AI discovery assistant (on-device intent matching over the catalog) ----
const KEYWORDS: Record<string, string[]> = {
  "sci-fi": ["sci-fi", "scifi", "science fiction", "space", "future", "alien", "robot", "time travel"],
  fantasy: ["fantasy", "magic", "dragon", "wizard", "elf", "myth"],
  dark: ["dark", "grim", "bleak", "disturbing", "violent"],
  cozy: ["cozy", "comfort", "wholesome", "chill", "relaxing", "light"],
  emotional: ["emotional", "cry", "sad", "touching", "heartfelt", "tearjerker"],
  comedy: ["funny", "comedy", "laugh", "hilarious", "funny"],
  romance: ["romance", "love", "romantic"],
  thriller: ["thriller", "tense", "suspense", "twist"],
  mystery: ["mystery", "puzzle", "mind-bending", "mindbending", "detective"],
  action: ["action", "fight", "battle"],
  history: ["history", "historical", "samurai", "viking", "war"],
  family: ["family", "siblings", "sister", "brother"],
  short: ["short", "quick", "weekend"],
  epic: ["epic", "long", "saga", "huge"],
};

const CAT_WORDS: Record<Category, string[]> = {
  film: ["movie", "movies", "film", "films"],
  tv: ["show", "shows", "series", "tv"],
  anime: ["anime"],
  manga: ["manga", "comic", "comics", "graphic novel"],
  book: ["book", "books", "novel", "novels", "read"],
};

export interface AiResult {
  intro: string;
  results: Media[];
}

export async function aiDiscover(prompt: string, category: Category | "all" = "all", catalog: Media[] = MEDIA): Promise<AiResult> {
  const p = prompt.toLowerCase();
  const wantedCats = (Object.keys(CAT_WORDS) as Category[]).filter((c) => CAT_WORDS[c].some((w) => p.includes(w)));
  const tags = Object.entries(KEYWORDS)
    .filter(([, words]) => words.some((w) => p.includes(w)))
    .map(([t]) => t);
  const like = catalog.find((m) => p.includes(m.title.toLowerCase().split(":")[0]));
  const likeTags = like ? like.genres : [];
  const allTags = [...new Set([...tags, ...likeTags])];

  const scored = catalog.filter((m) => m.id !== like?.id)
    .filter((m) => (category !== "all" ? m.category === category : wantedCats.length ? wantedCats.includes(m.category) : true))
    .map((m) => {
      const overlap = m.genres.filter((g) => allTags.includes(g)).length;
      const text = `${m.title} ${m.synopsis} ${m.creator}`.toLowerCase();
      const words = p.split(/\W+/).filter((w) => w.length > 3);
      const textHits = words.filter((w) => text.includes(w)).length;
      return { m, s: overlap * 3 + textHits + m.rating / 5 };
    })
    .filter((x) => x.s > 1 || allTags.length === 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 9)
    .map((x) => x.m);

  // small delay to feel like the assistant is thinking
  await new Promise((r) => setTimeout(r, 700));
  return {
    intro: "Here are some movies/series/books/comics you could be looking for:",
    results: scored,
  };
}
