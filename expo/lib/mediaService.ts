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
    const response = await fetch(`${CATALOG_URL}?select=id,title,format,synopsis,external_id,poster_url,release_year,genres,average_rating&order=title.asc,id.asc&offset=${offset}&limit=${pageSize}`, {
      headers: { apikey: PUBLISHABLE_KEY },
    });
    if (!response.ok) throw new Error("Catalog unavailable");
    const rows: CatalogRow[] = await response.json();
    items.push(...rows.map(mapCatalogRow).filter((m) => m.cover));
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

// Public semantic search runs on the existing backend, not on-device.
const OMNI_SEARCH_URL = "https://smeucssdhwbfoiaethcm.supabase.co/functions/v1/omni-search";

interface OmniSearchItem {
  id: string;
  title: string;
  format: Category;
  release_year: number | null;
  poster_url: string | null;
  average_rating: number | null;
  genres: string[] | null;
  synopsis: string | null;
  friend_name?: string | null;
  friend_rating?: number | null;
}

export interface AiResult {
  intro: string;
  results: Media[];
}

// Retain the existing call signature; the local catalog no longer drives AI results.
export async function aiDiscover(prompt: string, category: Category | "all" = "all", _catalog: Media[] = MEDIA, accessToken?: string): Promise<AiResult> {
  const response = await fetch(OMNI_SEARCH_URL, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken ?? PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error("AI search unavailable");
  const data: { message: string; results: OmniSearchItem[] } = await response.json();
  if (typeof data.message !== "string" || !Array.isArray(data.results)) {
    throw new Error("Invalid AI search response");
  }
  const results: Media[] = data.results.filter((item) => item.poster_url).map((item) => ({
    id: item.id,
    title: item.title,
    category: item.format,
    year: item.release_year ?? 0,
    cover: item.poster_url ?? "",
    rating: item.average_rating ?? 0,
    genres: item.genres ?? [],
    synopsis: item.synopsis ?? "",
    creator: "",
    logs: 0,
    ...(item.friend_name && item.friend_rating ? { friendNote: `${item.friend_name} gave this ${item.friend_rating} star${item.friend_rating === 1 ? "" : "s"}` } : {}),
  }));
  return {
    intro: data.message,
    results: category === "all" ? results : results.filter((item) => item.category === category),
  };
}

const AUTH_URL = "https://smeucssdhwbfoiaethcm.supabase.co/auth/v1";

// Real account sign-in; the access token is kept in memory only.
export async function signInAccount(email: string, password: string, signUp = false): Promise<string | null> {
  const response = await fetch(signUp ? `${AUTH_URL}/signup` : `${AUTH_URL}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json().catch(() => ({}))) ?? {};
  if (!response.ok) {
    if (response.status === 429) throw new Error("Too many attempts. Please wait a moment and try again.");
    if (!signUp && (response.status === 400 || response.status === 401)) {
      throw new Error("Check your email and password, and confirm your email before signing in.");
    }
    throw new Error(signUp ? "Couldn't create the account. Please try again or sign in." : "Sign in is unavailable right now. Please try again.");
  }
  if (typeof data.access_token === "string" && data.access_token) return data.access_token;
  // Email confirmation can create a user successfully without opening a session.
  if (signUp && typeof data.id === "string" && data.id) return null;
  throw new Error("The sign-in response was incomplete. Please try again.");
}
