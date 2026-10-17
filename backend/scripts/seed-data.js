#!/usr/bin/env node
/**
 * HOBBYBOX catalog seed
 * =====================
 *
 * Pulls top titles from TMDB (movies + series), Jikan (anime), Google Books
 * (books) and MangaDex (manga), normalizes them into public.media_items, embeds
 * each synopsis at 1536 dimensions (Gemini by default; OpenAI/OpenRouter
 * optional), and upserts both the rows and their vectors into Supabase.
 *
 * Live schema targeted:
 *   media_items       (id uuid, title text, format text, synopsis text,
 *                      external_id text, created_at timestamptz)
 *   media_embeddings  (id uuid, media_item_id uuid, embedding vector(1536))
 *
 * Usage:
 *   node scripts/seed-data.js                  # full run
 *   node scripts/seed-data.js --dry-run        # fetch + format, no writes
 *   node scripts/seed-data.js --dry-run --with-embeddings
 *   node scripts/seed-data.js --check-schema   # verify the live tables
 *   node scripts/seed-data.js --skip-embeddings
 *   node scripts/seed-data.js --limit=10 --sources=tmdb,mangadex
 *   node scripts/seed-data.js --strict         # fail if any source is down
 *
 * Environment (.env by default, hobbybox.env as a fallback):
 *   SUPABASE_URL                https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   service role key (bypasses RLS; never expose)
 *   EMBEDDING_PROVIDER          gemini (default), openai, or openrouter
 *   GEMINI_API_KEY              free Google AI Studio key (default provider)
 *   OPENAI_API_KEY              optional; paid OpenAI key
 *   OPENROUTER_API_KEY          optional; paid OpenRouter key
 *   GEMINI_EMBEDDING_MODEL      optional; default gemini-embedding-001
 *   OPENAI_EMBEDDING_MODEL      optional; default text-embedding-3-small
 *   OPENROUTER_EMBEDDING_MODEL  optional; default qwen/qwen3-embedding-8b
 *   TMDB_API_KEY                v3 API key
 *   GOOGLE_BOOKS_API_KEY        optional; without it Google's shared quota is used
 *   JIKAN_BASE_URL              optional override (e.g. a proxy)
 *   MANGADEX_BASE_URL           optional override
 *   SEED_LIMIT_PER_SOURCE       optional default limit (default 20)
 *   SEED_FORMAT_FILM            optional format value for TMDB movies (default "film")
 *   SEED_FORMAT_TV              optional format value for TMDB series (default "tv")
 *   SEED_FORMAT_ANIME           optional format value for Jikan (default "anime")
 *   SEED_FORMAT_BOOK            optional format value for Google Books (default "book")
 *   SEED_FORMAT_MANGA           optional format value for MangaDex (default "manga")
 *
 * Idempotent: media_items use a deterministic UUID derived from external_id
 * (and reuse any existing row id), while media_embeddings use a deterministic
 * UUID derived from media_item_id (and reuse any existing row id). Reruns
 * update in place instead of creating duplicates.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSIONS = 1536;
const MAX_EMBEDDING_CHARS = 6000;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const USER_AGENT = "HobbyboxSeed/1.0 (+https://hobbybox-fe-delight.lovable.app)";
const UUID_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const SOURCE_LABELS = {
  tmdb: "TMDB",
  anilist: "AniList",
  jikan: "Jikan",
  openlibrary: "OpenLibrary",
  google_books: "Google Books",
  mangadex: "MangaDex",
  curated: "Curated demo",
};
const ALL_SOURCES = Object.keys(SOURCE_LABELS);
// Default to the sources that work without extra keys and return all five
// formats: film, TV, anime, books and manga.
const DEFAULT_SOURCES = ["tmdb", "anilist", "openlibrary", "mangadex", "curated"];
const ALLOWED_TYPES = new Set(["film", "tv", "anime", "book", "manga"]);

const MEDIA_REQUIRED_COLUMNS = [
  "id",
  "title",
  "format",
  "synopsis",
  "external_id",
  "poster_url",
  "release_year",
  "genres",
  "external_source",
  "metadata",
];
const EMBEDDING_REQUIRED_COLUMNS = ["id", "media_item_id", "embedding"];
const SCHEMA_HINT =
  "Expected tables: media_items(id, title, format, synopsis, external_id) and " +
  "media_embeddings(id, media_item_id, embedding).";

const log = {
  step: (message) => console.log(`\n> ${message}`),
  info: (message) => console.log(`  ${message}`),
  ok: (message) => console.log(`  OK  ${message}`),
  warn: (message) => console.warn(`  !   ${message}`),
  error: (message) => console.error(`  x   ${message}`),
};

/** Resolve the first existing env file: explicit ENV_FILE, .env, then hobbybox.env. */
function resolveEnvFile() {
  const candidates = [process.env.ENV_FILE, ".env", "hobbybox.env"].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return path.resolve(process.cwd(), ".env");
}

const ENV_FILE = resolveEnvFile();
dotenv.config({ path: ENV_FILE, quiet: true });

const DEFAULT_LIMIT = (() => {
  const raw = Number(process.env.SEED_LIMIT_PER_SOURCE || 20);
  return Number.isInteger(raw) && raw > 0 && raw <= 100 ? raw : 20;
})();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing ${name}. Add it to ${ENV_FILE} (see the header of scripts/seed-data.js).`,
    );
  }
  return value.trim();
}

function getEmbeddingConfig() {
  const provider = (process.env.EMBEDDING_PROVIDER || "gemini").trim().toLowerCase();

  if (provider === "gemini") {
    return {
      provider,
      label: "Gemini",
      model: (process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001").trim(),
      apiKeyEnv: "GEMINI_API_KEY",
    };
  }
  if (provider === "openai") {
    return {
      provider,
      label: "OpenAI",
      model: (process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small").trim(),
      apiKeyEnv: "OPENAI_API_KEY",
    };
  }
  if (provider === "openrouter") {
    return {
      provider,
      label: "OpenRouter",
      model: (process.env.OPENROUTER_EMBEDDING_MODEL || "qwen/qwen3-embedding-8b").trim(),
      apiKeyEnv: "OPENROUTER_API_KEY",
    };
  }

  throw new Error(`Unknown EMBEDDING_PROVIDER "${provider}". Use gemini, openai, or openrouter.`);
}

function requireEmbeddingConfig() {
  const config = getEmbeddingConfig();
  requireEnv(config.apiKeyEnv);
  return config;
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    withEmbeddings: false,
    skipEmbeddings: false,
    checkSchema: false,
    strict: false,
    limit: DEFAULT_LIMIT,
    sources: [...DEFAULT_SOURCES],
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--with-embeddings") opts.withEmbeddings = true;
    else if (arg === "--skip-embeddings") opts.skipEmbeddings = true;
    else if (arg === "--check-schema") opts.checkSchema = true;
    else if (arg === "--strict") opts.strict = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new Error("--limit must be an integer between 1 and 100.");
      }
      opts.limit = value;
    } else if (arg.startsWith("--sources=")) {
      const raw = arg.slice("--sources=".length).trim();
      const sources =
        raw === "all"
          ? [...ALL_SOURCES]
          : raw
              .split(",")
              .map((source) => source.trim())
              .filter(Boolean);
      const unknown = sources.filter((source) => !ALL_SOURCES.includes(source));
      if (!sources.length || unknown.length) {
        throw new Error(
          `--sources must be "all" or a comma-separated subset of: ${ALL_SOURCES.join(", ")}` +
            (unknown.length ? ` (unknown: ${unknown.join(", ")})` : ""),
        );
      }
      opts.sources = [...new Set(sources)];
    } else {
      throw new Error(`Unknown argument: ${arg}. Use --help for options.`);
    }
  }

  if (opts.skipEmbeddings && opts.withEmbeddings) {
    throw new Error("--skip-embeddings and --with-embeddings are mutually exclusive.");
  }

  return opts;
}

function printHelp() {
  console.log(`HOBBYBOX catalog seed

Usage:
  node scripts/seed-data.js [options]

Options:
  --dry-run              Fetch + normalize only. No embeddings, no DB writes.
  --with-embeddings      In a dry run, also generate embeddings (uses the configured provider).
  --skip-embeddings      Insert media rows only. Useful for schema debugging.
  --check-schema         Verify media_items/media_embeddings exist, then exit.
  --limit=N              Max items per endpoint (1-100, default ${DEFAULT_LIMIT}).
  --sources=a,b          Subset of: ${ALL_SOURCES.join(", ")}.
  --strict               Exit non-zero if any requested source fails.
  --help                 Show this help.

Examples:
  node scripts/seed-data.js --dry-run --limit=5
  node scripts/seed-data.js --sources=tmdb,mangadex
  node scripts/seed-data.js --check-schema
`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function truncate(value, maxLength) {
  if (!value) return "";
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, (date - Date.now()) / 1000);
  return null;
}

function isNetworkError(error) {
  if (!error) return false;
  if (error.name === "AbortError" || error.name === "APIConnectionError") return true;
  const code = error.code || error.cause?.code;
  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "EPIPE",
    "UND_ERR_CONNECT_TIMEOUT",
  ].includes(code);
}

/** node-fetch often leaves the useful part in error.cause (e.g. timeouts). */
function describeError(error) {
  const message = String(error?.message || error || "unknown error").trim();
  const cause = error?.cause?.message || error?.cause?.code || error?.code;
  if (!cause || message.includes(String(cause))) return message;
  return `${message} (${cause})`;
}

/**
 * Fetch JSON with timeouts + bounded exponential backoff.
 * Retries only transient failures (408/425/429/5xx/network), never 4xx auth
 * or validation errors.
 */
async function fetchJson(url, options = {}) {
  const {
    label = url,
    headers = {},
    timeoutMs = 20000,
    retries = 3,
    method = "GET",
    body,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();

      if (!response.ok) {
        const error = new Error(
          `${label} returned HTTP ${response.status}: ${raw.slice(0, 250).replace(/\s+/g, " ")}`,
        );
        error.status = response.status;
        error.retryable =
          response.status === 408 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500;
        error.retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        throw error;
      }

      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`${label} returned invalid JSON: ${raw.slice(0, 200)}`);
      }
    } catch (error) {
      lastError = error;
      const retryable = error.retryable ?? isNetworkError(error);
      if (attempt >= retries || !retryable) break;

      const delay = error.retryAfter
        ? error.retryAfter * 1000
        : Math.min(750 * 2 ** attempt, 6000) + Math.floor(Math.random() * 250);
      log.warn(
        `${label} failed (${describeError(error)}); retry ${attempt + 1}/${retries} in ${Math.round(
          delay,
        )}ms`,
      );
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    try {
      if (key.startsWith("#x")) {
        return String.fromCodePoint(parseInt(key.slice(2), 16));
      }
      if (key.startsWith("#")) {
        return String.fromCodePoint(parseInt(key.slice(1), 10));
      }
      return named[key] ?? match;
    } catch {
      return match;
    }
  });
}

function stripHtml(value) {
  if (!value) return "";
  return decodeEntities(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return stripHtml(typeof value === "string" ? value : "");
}

function parseYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/\b(1[0-9]{3}|20[0-9]{2}|2100)\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1000 && year <= 2100 ? year : null;
}

function normalizeRating(value) {
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return null;
  return round1(Math.min(5, Math.max(0, rating)));
}

/** Jikan/MangaDex often return localized maps or arrays of localized maps. */
function pickLocalized(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickLocalized(entry);
      if (picked) return picked;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of ["en", "ja-ro", "ja", "romaji", "native"]) {
      const picked = pickLocalized(value[key]);
      if (picked) return picked;
    }
    for (const entry of Object.values(value)) {
      const picked = pickLocalized(entry);
      if (picked) return picked;
    }
  }
  return "";
}

/** Prefer MangaDex's English alt title when the primary title has no `en` key. */
function pickMangaTitle(attributes) {
  const titles = attributes?.title || {};
  if (typeof titles.en === "string" && titles.en.trim()) return titles.en;
  const altEnglish = (attributes?.altTitles || [])
    .map((altTitle) => altTitle?.en)
    .find((title) => typeof title === "string" && title.trim());
  if (altEnglish) return altEnglish;
  return pickLocalized(titles);
}

function fallbackSynopsis(item) {
  const typeLabel =
    { film: "film", tv: "TV series", anime: "anime", book: "book", manga: "manga" }[item.type] ||
    item.type;
  const year = item.year ? ` (${item.year})` : "";
  const genre = item.genre ? ` in the ${item.genre} genre` : "";
  return `${item.title}${year} is a ${typeLabel}${genre}.`;
}

/** Enforce the canonical media_items shape and fill a searchable synopsis. */
function normalizeItem(item) {
  if (!ALLOWED_TYPES.has(item.type)) {
    throw new Error(
      `Unsupported media type "${item.type}" for ${item.source}/${item.external_id}.`,
    );
  }

  const title = cleanText(item.title);
  const externalId = cleanText(item.external_id);
  if (!title) {
    throw new Error(`Item from ${item.source} has no title (${item.external_id}).`);
  }
  if (!externalId) {
    throw new Error(`Item "${title}" from ${item.source} has no external_id.`);
  }

  const synopsis = cleanText(item.synopsis);
  const normalized = {
    source: item.source,
    external_id: externalId,
    type: item.type,
    title,
    year: parseYear(item.year),
    genre: cleanText(item.genre) || null,
    rating: normalizeRating(item.rating),
    poster: item.poster ? String(item.poster).trim() || null : null,
    synopsis: synopsis || null,
    metadata: { ...(item.metadata || {}) },
  };

  if (!normalized.synopsis) {
    normalized.synopsis = fallbackSynopsis(normalized);
    normalized.metadata.synopsis_generated = true;
  }

  return normalized;
}

const itemKey = (item) => item.external_id;
const formatFor = (item) => process.env[`SEED_FORMAT_${item.type.toUpperCase()}`] || item.type;

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function genresFor(item) {
  if (!item.genre) return null;
  const genres = item.genre
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
  return genres.length ? genres : null;
}

function externalUrlFor(item) {
  const metadata = item.metadata || {};
  return (
    metadata.tmdb_url ||
    metadata.anilist_url ||
    metadata.jikan_url ||
    metadata.openlibrary_url ||
    metadata.external_url ||
    metadata.info_link ||
    metadata.preview_link ||
    metadata.mangadex_url ||
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Deterministic UUIDs (idempotent upserts without relying on unique indexes)  */
/* -------------------------------------------------------------------------- */

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  return Buffer.from(hex, "hex");
}

function bytesToUuid(bytes) {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

function deterministicUuid(name) {
  const hash = crypto
    .createHash("sha1")
    .update(uuidToBytes(UUID_NAMESPACE))
    .update(name, "utf8")
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  return bytesToUuid(bytes);
}

const mediaIdFor = (externalId) => deterministicUuid(`hobbybox:media:${externalId}`);
const embeddingIdFor = (mediaItemId) => deterministicUuid(`hobbybox:embedding:${mediaItemId}`);

/* -------------------------------------------------------------------------- */
/* Source adapters                                                            */
/* -------------------------------------------------------------------------- */

async function fetchTmdb(limit) {
  const apiKey = requireEnv("TMDB_API_KEY");
  const base = "https://api.themoviedb.org/3";
  const common = `api_key=${encodeURIComponent(apiKey)}&language=en-US`;

  const [movieGenres, tvGenres, movies, series] = await Promise.all([
    fetchJson(`${base}/genre/movie/list?${common}`, { label: "TMDB movie genres" }),
    fetchJson(`${base}/genre/tv/list?${common}`, { label: "TMDB TV genres" }),
    fetchJson(`${base}/movie/popular?${common}&page=1`, {
      label: "TMDB popular movies",
    }),
    fetchJson(`${base}/tv/popular?${common}&page=1`, {
      label: "TMDB popular series",
    }),
  ]);

  const movieGenreMap = new Map((movieGenres.genres || []).map((g) => [g.id, g.name]));
  const tvGenreMap = new Map((tvGenres.genres || []).map((g) => [g.id, g.name]));

  const items = [];

  for (const movie of (movies.results || []).slice(0, limit)) {
    const genres = (movie.genre_ids || []).map((id) => movieGenreMap.get(id)).filter(Boolean);
    items.push(
      normalizeItem({
        source: "tmdb",
        external_id: `tmdb:movie/${movie.id}`,
        type: "film",
        title: movie.title || movie.original_title,
        year: movie.release_date,
        genre: genres.join(", "),
        rating: movie.vote_average ? round1(movie.vote_average / 2) : null,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        synopsis: movie.overview,
        metadata: {
          tmdb_id: movie.id,
          media_kind: "movie",
          original_title: movie.original_title,
          original_language: movie.original_language,
          popularity: movie.popularity,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count,
          adult: movie.adult,
          tmdb_url: `https://www.themoviedb.org/movie/${movie.id}`,
        },
      }),
    );
  }

  for (const show of (series.results || []).slice(0, limit)) {
    const genres = (show.genre_ids || []).map((id) => tvGenreMap.get(id)).filter(Boolean);
    items.push(
      normalizeItem({
        source: "tmdb",
        external_id: `tmdb:tv/${show.id}`,
        type: "tv",
        title: show.name || show.original_name,
        year: show.first_air_date,
        genre: genres.join(", "),
        rating: show.vote_average ? round1(show.vote_average / 2) : null,
        poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
        synopsis: show.overview,
        metadata: {
          tmdb_id: show.id,
          media_kind: "tv",
          original_name: show.original_name,
          original_language: show.original_language,
          popularity: show.popularity,
          vote_average: show.vote_average,
          vote_count: show.vote_count,
          origin_country: show.origin_country,
          tmdb_url: `https://www.themoviedb.org/tv/${show.id}`,
        },
      }),
    );
  }

  return items;
}

async function fetchJikan(limit) {
  const base = (process.env.JIKAN_BASE_URL || "https://api.jikan.moe/v4").replace(/\/+$/, "");
  // Jikan caps `limit` at 25 for /top/anime.
  const url = `${base}/top/anime?filter=bypopularity&limit=${Math.min(limit, 25)}`;
  const payload = await fetchJson(url, {
    label: "Jikan top anime",
    timeoutMs: 12000,
    retries: 1,
  });

  return (payload.data || []).slice(0, limit).map((anime) =>
    normalizeItem({
      source: "jikan",
      external_id: `jikan:anime/${anime.mal_id}`,
      type: "anime",
      title: anime.title_english || anime.title,
      year: anime.year || anime.aired?.prop?.from?.year,
      genre: (anime.genres || []).map((genre) => genre.name).join(", "),
      rating: anime.score ? round1(anime.score / 2) : null,
      poster: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || null,
      synopsis: anime.synopsis,
      metadata: {
        mal_id: anime.mal_id,
        jikan_url: anime.url,
        episodes: anime.episodes,
        status: anime.status,
        aired: anime.aired,
        studios: (anime.studios || []).map((studio) => studio.name),
        source: anime.source,
        rank: anime.rank,
        popularity: anime.popularity,
        members: anime.members,
        favorites: anime.favorites,
        score: anime.score,
      },
    }),
  );
}

async function fetchGoogleBooks(limit) {
  const params = new URLSearchParams({
    q: process.env.GOOGLE_BOOKS_QUERY || "subject:fiction",
    orderBy: "relevance",
    printType: "books",
    maxResults: String(Math.min(limit, 40)),
  });
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const payload = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    { label: "Google Books", retries: 1 },
  );

  return (payload.items || []).slice(0, limit).map(({ id, volumeInfo = {} }) => {
    const title = [volumeInfo.title, volumeInfo.subtitle].filter(Boolean).join(": ");
    const categories = volumeInfo.categories || [];
    const identifiers = volumeInfo.industryIdentifiers || [];
    const isbn =
      identifiers.find((identifier) => identifier.type === "ISBN_13")?.identifier ||
      identifiers[0]?.identifier ||
      null;
    const thumbnail =
      volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null;

    return normalizeItem({
      source: "google_books",
      external_id: `google_books:volume/${id}`,
      type: "book",
      title,
      year: volumeInfo.publishedDate,
      genre: categories.join(", "),
      rating: volumeInfo.averageRating,
      poster: thumbnail ? thumbnail.replace(/^http:/, "https:") : null,
      synopsis: volumeInfo.description,
      metadata: {
        google_books_id: id,
        authors: volumeInfo.authors || [],
        publisher: volumeInfo.publisher,
        published_date: volumeInfo.publishedDate,
        page_count: volumeInfo.pageCount,
        language: volumeInfo.language,
        isbn,
        categories,
        average_rating: volumeInfo.averageRating,
        ratings_count: volumeInfo.ratingsCount,
        preview_link: volumeInfo.previewLink,
        info_link: volumeInfo.infoLink,
      },
    });
  });
}

async function fetchMangaDex(limit) {
  const base = (process.env.MANGADEX_BASE_URL || "https://api.mangadex.org").replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(limit, 100)));
  params.set("offset", "0");
  params.set("order[followedCount]", "desc");
  params.set("hasAvailableChapters", "true");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  params.append("includes[]", "cover_art");
  params.append("includes[]", "author");
  params.append("includes[]", "artist");
  params.append("availableTranslatedLanguage[]", "en");

  const payload = await fetchJson(`${base}/manga?${params.toString()}`, {
    label: "MangaDex top manga",
  });

  return (payload.data || []).slice(0, limit).map((manga) => {
    const attributes = manga.attributes || {};
    const relationships = manga.relationships || [];
    const cover = relationships.find((relationship) => relationship.type === "cover_art");
    const coverFile = cover?.attributes?.fileName;
    const authors = relationships
      .filter((relationship) => relationship.type === "author")
      .map((relationship) => relationship.attributes?.name)
      .filter(Boolean);
    const artists = relationships
      .filter((relationship) => relationship.type === "artist")
      .map((relationship) => relationship.attributes?.name)
      .filter(Boolean);
    const tags = (attributes.tags || [])
      .map((tag) => pickLocalized(tag.attributes?.name))
      .filter(Boolean);

    return normalizeItem({
      source: "mangadex",
      external_id: `mangadex:manga/${manga.id}`,
      type: "manga",
      title: pickMangaTitle(attributes),
      year: attributes.year,
      genre: tags.join(", "),
      rating: null, // MangaDex does not expose a community score in this endpoint.
      poster: coverFile
        ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFile}.512.jpg`
        : null,
      synopsis: pickLocalized(attributes.description),
      metadata: {
        mangadex_id: manga.id,
        original_language: attributes.originalLanguage,
        status: attributes.status,
        content_rating: attributes.contentRating,
        publication_demographic: attributes.publicationDemographic,
        tags,
        authors,
        artists,
        alt_titles: attributes.altTitles,
        links: attributes.links,
        latest_uploaded_chapter: attributes.latestUploadedChapter,
        available_translated_languages: attributes.availableTranslatedLanguages,
        mangadex_url: `https://mangadex.org/title/${manga.id}`,
      },
    });
  });
}

async function fetchAniList(limit) {
  const query = `
    query PopularAnime($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          description(asHtml: false)
          coverImage { extraLarge large }
          startDate { year }
          genres
          episodes
          averageScore
          siteUrl
          format
          status
        }
      }
    }
  `;

  const payload = await fetchJson("https://graphql.anilist.co", {
    label: "AniList popular anime",
    method: "POST",
    body: {
      query,
      variables: { page: 1, perPage: Math.min(limit, 50) },
    },
    timeoutMs: 30000,
    retries: 2,
  });

  if (Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error(`AniList: ${payload.errors[0]?.message || "unknown GraphQL error"}`);
  }

  return (payload.data?.Page?.media || []).slice(0, limit).map((anime) =>
    normalizeItem({
      source: "anilist",
      external_id: `anilist:anime/${anime.id}`,
      type: "anime",
      title: anime.title?.english || anime.title?.romaji || anime.title?.native,
      year: anime.startDate?.year,
      genre: (anime.genres || []).join(", "),
      rating: anime.averageScore ? round1(anime.averageScore / 20) : null,
      poster: anime.coverImage?.extraLarge || anime.coverImage?.large || null,
      synopsis: anime.description,
      metadata: {
        anilist_id: anime.id,
        anilist_url: anime.siteUrl,
        episodes: anime.episodes,
        format: anime.format,
        status: anime.status,
        average_score: anime.averageScore,
      },
    }),
  );
}

async function fetchOpenLibrary(limit) {
  const params = new URLSearchParams({
    q: process.env.OPENLIBRARY_QUERY || "subject:fantasy",
    sort: "rating",
    limit: String(Math.min(limit, 50)),
    fields: [
      "key",
      "title",
      "author_name",
      "first_publish_year",
      "cover_i",
      "subject",
      "ratings_average",
      "ratings_count",
      "number_of_pages_median",
      "edition_key",
    ].join(","),
  });

  const payload = await fetchJson(`https://openlibrary.org/search.json?${params.toString()}`, {
    label: "OpenLibrary books",
  });

  return (payload.docs || [])
    .filter((book) => Boolean(book.title))
    .slice(0, limit)
    .map((book) => {
      const authors = book.author_name || [];
      const subjects = (book.subject || []).slice(0, 8);
      return normalizeItem({
        source: "openlibrary",
        external_id: `openlibrary:${book.key}`,
        type: "book",
        title: book.title,
        year: book.first_publish_year,
        genre: subjects.join(", "),
        rating: book.ratings_average,
        poster: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : null,
        synopsis: null,
        metadata: {
          openlibrary_key: book.key,
          openlibrary_url: `https://openlibrary.org${book.key}`,
          authors,
          subjects,
          page_count: book.number_of_pages_median,
          ratings_count: book.ratings_count,
          edition_key: book.edition_key,
        },
      });
    });
}

const CURATED_ITEMS = [
  {
    slug: "death-note",
    type: "manga",
    title: "Death Note",
    year: 2003,
    genre: "Mystery, Thriller, Supernatural",
    rating: 4.6,
    synopsis:
      "A brilliant high school student finds a supernatural notebook that kills anyone whose name is written inside it. He decides to use it to punish criminals, while a mysterious detective tries to unmask him.",
    url: "https://en.wikipedia.org/wiki/Death_Note",
  },
  {
    slug: "paprika-novel",
    type: "book",
    title: "Paprika",
    year: 1993,
    genre: "Science Fiction, Psychological, Thriller",
    rating: 4.4,
    synopsis:
      "A dream detective enters her patients' dreams to treat their anxieties. When a stolen experimental device lets nightmares leak into waking Tokyo, reality begins to melt into a surreal hallucination.",
    url: "https://en.wikipedia.org/wiki/Paprika_(novel)",
  },
  {
    slug: "paprika-film",
    type: "film",
    title: "Paprika",
    year: 2006,
    genre: "Animation, Science Fiction, Thriller",
    rating: 4.5,
    synopsis:
      "A therapist uses a device to enter dreams and investigate a stolen machine that lets nightmares invade the waking world. Tokyo dissolves into a surreal parade of dream imagery.",
    url: "https://en.wikipedia.org/wiki/Paprika_(2006_film)",
  },
  {
    slug: "cast-away",
    type: "film",
    title: "Cast Away",
    year: 2000,
    genre: "Drama, Adventure",
    rating: 4.4,
    synopsis:
      "A FedEx executive is stranded alone on a remote island after a plane crash. He talks to a volleyball he names Wilson while fighting to survive and find a way home.",
    url: "https://en.wikipedia.org/wiki/Cast_Away",
  },
  {
    slug: "perfect-blue",
    type: "film",
    title: "Perfect Blue",
    year: 1997,
    genre: "Animation, Thriller, Psychological",
    rating: 4.5,
    synopsis:
      "A pop idol leaves her group to become an actress, but her identity begins to fracture as a stalker and a series of disturbing events blur the line between performance and reality.",
    url: "https://en.wikipedia.org/wiki/Perfect_Blue",
  },
];

async function fetchCurated(limit) {
  return CURATED_ITEMS.slice(0, limit).map((item) =>
    normalizeItem({
      source: "curated",
      external_id: `curated:${item.slug}`,
      type: item.type,
      title: item.title,
      year: item.year,
      genre: item.genre,
      rating: item.rating,
      poster: null,
      synopsis: item.synopsis,
      metadata: {
        curated: true,
        curated_slug: item.slug,
        external_url: item.url,
      },
    }),
  );
}

const ADAPTERS = {
  tmdb: fetchTmdb,
  anilist: fetchAniList,
  jikan: fetchJikan,
  openlibrary: fetchOpenLibrary,
  google_books: fetchGoogleBooks,
  mangadex: fetchMangaDex,
  curated: fetchCurated,
};

/**
 * Fetch each requested source independently. One dead upstream must not stop
 * the rest of the catalog from seeding. Failures are returned for the summary
 * and for --strict.
 */
async function collectItems(opts) {
  const bySource = new Map();
  const failures = [];

  for (const source of opts.sources) {
    log.step(`Fetching ${SOURCE_LABELS[source]} (limit ${opts.limit})`);
    try {
      const items = await ADAPTERS[source](opts.limit);
      bySource.set(source, items);
      log.ok(`${items.length} item(s)`);
    } catch (error) {
      failures.push({ source, error });
      log.warn(`${SOURCE_LABELS[source]} skipped: ${describeError(error)}`);
    }
  }

  const seen = new Set();
  const items = [];
  for (const sourceItems of bySource.values()) {
    for (const item of sourceItems) {
      const key = itemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  return { items, failures, bySource };
}

/* -------------------------------------------------------------------------- */
/* Embeddings                                                                 */
/* -------------------------------------------------------------------------- */

function normalizeEmbedding(values, targetDimensions) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Embedding response did not contain a vector.");
  }
  if (!values.every((value) => Number.isFinite(value))) {
    throw new Error("Embedding response contained non-numeric values.");
  }

  if (values.length === targetDimensions) return values;

  if (values.length > targetDimensions) {
    // MRL models (Gemini, Qwen) support truncating to a prefix. Renormalize so
    // cosine similarity stays well-behaved.
    const truncated = values.slice(0, targetDimensions);
    const norm = Math.sqrt(truncated.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? truncated.map((value) => value / norm) : truncated;
  }

  throw new Error(
    `Embedding has ${values.length} dimensions; expected ${targetDimensions}. ` +
      "Choose a model that supports 1536 dimensions.",
  );
}

async function embedBatch(inputs, config, apiKey) {
  if (config.provider === "gemini") {
    const payload = await fetchJson(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(config.model)}:batchEmbedContents`,
      {
        label: `${config.label} embeddings (${config.model})`,
        method: "POST",
        headers: { "x-goog-api-key": apiKey },
        body: {
          requests: inputs.map((text) => ({
            model: `models/${config.model}`,
            content: { parts: [{ text }] },
            // gemini-embedding-2 does not accept taskType; 001 does.
            ...(config.model.includes("gemini-embedding-2")
              ? {}
              : { taskType: "RETRIEVAL_DOCUMENT" }),
            output_dimensionality: EMBEDDING_DIMENSIONS,
          })),
        },
        timeoutMs: 60000,
        retries: 2,
      },
    );

    if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== inputs.length) {
      throw new Error(
        `${config.label} returned ${payload.embeddings?.length ?? 0} embeddings for ${inputs.length} inputs.`,
      );
    }

    return payload.embeddings.map((entry, index) => {
      try {
        return normalizeEmbedding(entry.values, EMBEDDING_DIMENSIONS);
      } catch (error) {
        throw new Error(`${config.label} embedding ${index}: ${error.message}`);
      }
    });
  }

  if (config.provider === "openai" || config.provider === "openrouter") {
    const url =
      config.provider === "openai"
        ? `${OPENAI_BASE_URL}/embeddings`
        : `${OPENROUTER_BASE_URL}/embeddings`;
    const headers = { Authorization: `Bearer ${apiKey}` };
    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://hobbybox-fe-delight.lovable.app";
      headers["X-Title"] = "Hobbybox Seed";
    }

    const payload = await fetchJson(url, {
      label: `${config.label} embeddings (${config.model})`,
      method: "POST",
      headers,
      body: {
        model: config.model,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: "float",
      },
      timeoutMs: 60000,
      retries: 2,
    });

    if (!Array.isArray(payload.data) || payload.data.length !== inputs.length) {
      throw new Error(
        `${config.label} returned ${payload.data?.length ?? 0} embeddings for ${inputs.length} inputs.`,
      );
    }

    const vectors = new Array(inputs.length);
    payload.data.forEach((entry, fallbackIndex) => {
      const index = Number.isInteger(entry.index) ? entry.index : fallbackIndex;
      try {
        vectors[index] = normalizeEmbedding(entry.embedding, EMBEDDING_DIMENSIONS);
      } catch (error) {
        throw new Error(`${config.label} embedding ${index}: ${error.message}`);
      }
    });
    return vectors;
  }

  throw new Error(`Unsupported embedding provider: ${config.provider}`);
}

async function embedItems(items) {
  if (!items.length) return new Map();

  const config = requireEmbeddingConfig();
  const apiKey = requireEnv(config.apiKeyEnv);
  const vectors = new Map();
  let embedded = 0;

  log.step(
    `Embedding ${items.length} synopsis/synopses with ${config.label} ${config.model} (${EMBEDDING_DIMENSIONS}d)`,
  );

  for (const batch of chunk(items, 32)) {
    const inputs = batch.map((item) =>
      truncate(item.synopsis || fallbackSynopsis(item), MAX_EMBEDDING_CHARS),
    );
    const batchVectors = await embedBatch(inputs, config, apiKey);

    batch.forEach((item, index) => {
      const vector = batchVectors[index];
      if (!vector) {
        throw new Error(`Missing embedding for ${itemKey(item)}.`);
      }
      vectors.set(itemKey(item), vector);
    });

    embedded += batch.length;
    log.info(`Embedded ${embedded}/${items.length}`);
  }

  return vectors;
}

/* -------------------------------------------------------------------------- */
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

function findDefinition(definitions, table) {
  if (definitions?.[table]) return definitions[table];
  if (!definitions) return null;
  const suffix = `.${table}`;
  const match = Object.entries(definitions).find(
    ([name]) => name === table || name.endsWith(suffix),
  );
  return match?.[1] || null;
}

function assertSchema(definitions) {
  const missingTables = ["media_items", "media_embeddings"].filter(
    (table) => !findDefinition(definitions, table)?.properties,
  );
  if (missingTables.length) {
    throw new Error(`Supabase is missing: ${missingTables.join(", ")}.\n${SCHEMA_HINT}`);
  }

  const mediaProperties = findDefinition(definitions, "media_items").properties;
  const embeddingProperties = findDefinition(definitions, "media_embeddings").properties;
  const missingMedia = MEDIA_REQUIRED_COLUMNS.filter((column) => !mediaProperties[column]);
  const missingEmbeddings = EMBEDDING_REQUIRED_COLUMNS.filter(
    (column) => !embeddingProperties[column],
  );

  if (missingMedia.length || missingEmbeddings.length) {
    const details = [
      missingMedia.length ? `media_items: ${missingMedia.join(", ")}` : null,
      missingEmbeddings.length ? `media_embeddings: ${missingEmbeddings.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(
      `Supabase tables exist but are missing required columns (${details}).\n${SCHEMA_HINT}`,
    );
  }

  return { mediaProperties, embeddingProperties };
}

async function fetchRestSchema() {
  const url = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const spec = await fetchJson(`${url}/rest/v1/`, {
    label: "Supabase schema",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json",
    },
    retries: 1,
    timeoutMs: 15000,
  });

  const definitions = spec.definitions || spec.components?.schemas || {};
  assertSchema(definitions);
  return definitions;
}

function supabaseError(context, error) {
  const parts = [
    error.message,
    error.details,
    error.hint,
    error.code ? `code=${error.code}` : null,
  ].filter(Boolean);
  let message = `${context} failed: ${parts.join(" | ")}`;

  if (error.code === "42P01" || error.code === "PGRST205") {
    message += `\n${SCHEMA_HINT}`;
  } else if (error.code === "PGRST204") {
    message += "\nA column in the payload does not exist in the live table.";
  } else if (error.code === "23514") {
    message += "\nA CHECK constraint rejected a value. Check the format value (SEED_FORMAT_*).";
  } else if (error.code === "23505") {
    message +=
      "\nA unique constraint was violated. The seeder reuses existing ids; rerun to retry.";
  } else if (error.code === "22P02") {
    message +=
      "\nA value could not be cast. Check that ids are UUIDs and embeddings are 1536 floats.";
  }
  return new Error(message);
}

async function findExistingMediaIds(supabase, externalIds) {
  const existing = new Map();
  for (const batch of chunk([...new Set(externalIds)], 50)) {
    const { data, error } = await supabase
      .from("media_items")
      .select("id, external_id")
      .in("external_id", batch);
    if (error) throw supabaseError("media_items lookup", error);
    for (const row of data || []) {
      if (row.external_id && row.id && !existing.has(row.external_id)) {
        existing.set(row.external_id, row.id);
      }
    }
  }
  return existing;
}

async function findExistingEmbeddingIds(supabase, mediaItemIds) {
  const existing = new Map();
  for (const batch of chunk([...new Set(mediaItemIds)], 50)) {
    const { data, error } = await supabase
      .from("media_embeddings")
      .select("id, media_item_id")
      .in("media_item_id", batch);
    if (error) throw supabaseError("media_embeddings lookup", error);
    for (const row of data || []) {
      if (row.media_item_id && row.id && !existing.has(row.media_item_id)) {
        existing.set(row.media_item_id, row.id);
      }
    }
  }
  return existing;
}

async function writeToSupabase(items, vectors, opts) {
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  await fetchRestSchema();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "hobbybox-seed" } },
  });

  const existingMediaIds = await findExistingMediaIds(
    supabase,
    items.map((item) => item.external_id),
  );
  const mediaRows = items.map((item) => ({
    // Reuse an existing row id when one exists; otherwise derive a stable UUID.
    id: existingMediaIds.get(item.external_id) || mediaIdFor(item.external_id),
    title: item.title,
    format: formatFor(item),
    synopsis: item.synopsis,
    external_id: item.external_id,
    poster_url: item.poster,
    release_year: item.year,
    genres: genresFor(item),
    external_source: item.source,
    external_url: externalUrlFor(item),
    average_rating: item.rating,
    runtime_minutes: numberOrNull(item.metadata?.runtime_minutes),
    episode_count: numberOrNull(item.metadata?.episodes),
    page_count: numberOrNull(item.metadata?.page_count),
    issue_count: numberOrNull(item.metadata?.issue_count),
    metadata: item.metadata ?? {},
  }));

  log.step(`Upserting ${mediaRows.length} media item(s) into media_items`);
  const idByExternalId = new Map();

  for (const batch of chunk(mediaRows, 50)) {
    const { data, error } = await supabase
      .from("media_items")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: false })
      .select("id, external_id");

    if (error) throw supabaseError("media_items upsert", error);

    for (const row of data || []) {
      idByExternalId.set(row.external_id, row.id);
    }
  }

  // Defensive: if a PostgREST/proxy layer omits the representation, we still
  // know the ids we just sent.
  for (const row of mediaRows) {
    if (!idByExternalId.has(row.external_id)) {
      idByExternalId.set(row.external_id, row.id);
    }
  }

  const missingIds = items
    .map((item) => item.external_id)
    .filter((externalId) => !idByExternalId.has(externalId));
  if (missingIds.length) {
    throw new Error(
      `No media id available for ${missingIds.length} item(s): ${missingIds
        .slice(0, 5)
        .join(", ")}${missingIds.length > 5 ? ", ..." : ""}`,
    );
  }
  log.ok(`${idByExternalId.size} media row(s) upserted`);

  if (opts.skipEmbeddings) {
    log.warn(
      "Embeddings skipped (--skip-embeddings). match_media will not return these rows until they are embedded.",
    );
    return { mediaCount: idByExternalId.size, embeddingCount: 0 };
  }

  const mediaItemIds = [...new Set(idByExternalId.values())];
  const existingEmbeddingIds = await findExistingEmbeddingIds(supabase, mediaItemIds);
  const embeddingRows = [];

  for (const item of items) {
    const key = itemKey(item);
    const vector = vectors.get(key);
    if (!vector) {
      throw new Error(
        `No embedding generated for ${key}; no rows were written to media_embeddings.`,
      );
    }
    const mediaItemId = idByExternalId.get(item.external_id);
    if (!mediaItemId) {
      throw new Error(`No media_items.id for ${item.external_id}.`);
    }
    embeddingRows.push({
      id: existingEmbeddingIds.get(mediaItemId) || embeddingIdFor(mediaItemId),
      media_item_id: mediaItemId,
      embedding: vector,
    });
  }

  log.step(`Upserting ${embeddingRows.length} embedding(s) into media_embeddings`);
  for (const batch of chunk(embeddingRows, 20)) {
    const { error } = await supabase
      .from("media_embeddings")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

    if (error) throw supabaseError("media_embeddings upsert", error);
  }
  log.ok(`${embeddingRows.length} embedding(s) upserted`);

  return { mediaCount: idByExternalId.size, embeddingCount: embeddingRows.length };
}

/* -------------------------------------------------------------------------- */
/* Modes                                                                      */
/* -------------------------------------------------------------------------- */

function printCounts(bySource, items, opts) {
  log.step("Summary");
  for (const source of opts.sources) {
    log.info(`${SOURCE_LABELS[source]}: ${(bySource.get(source) || []).length}`);
  }
  const generated = items.filter((item) => item.metadata.synopsis_generated).length;
  log.info(`Total unique items: ${items.length}`);
  log.info(`Generated fallback synopses: ${generated}`);

  for (const source of opts.sources) {
    const sourceItems = bySource.get(source) || [];
    if (!sourceItems.length) continue;
    log.info(`${SOURCE_LABELS[source]} sample:`);
    for (const item of sourceItems.slice(0, 2)) {
      const synopsis = item.synopsis ? `${item.synopsis.slice(0, 72)}...` : "-";
      console.log(
        `    [${formatFor(item)}] ${item.title} (${item.year ?? "n/a"}) ` +
          `rating=${item.rating ?? "n/a"} :: ${synopsis}`,
      );
    }
  }
}

async function runDryRun(items, failures, bySource, opts) {
  printCounts(bySource, items, opts);

  if (opts.withEmbeddings) {
    const vectors = await embedItems(items);
    log.ok(`Generated ${vectors.size} vector(s) at ${EMBEDDING_DIMENSIONS} dimensions`);
  } else {
    log.info(
      "Embeddings not generated (dry run). Add --with-embeddings to test the configured provider.",
    );
  }

  if (failures.length) {
    log.warn(
      `Skipped source(s): ${failures.map((failure) => SOURCE_LABELS[failure.source]).join(", ")}`,
    );
  }
  log.info("No database writes performed (dry run).");
}

async function runCheckSchema() {
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  log.step("Checking Supabase schema");
  const definitions = await fetchRestSchema();
  const media = findDefinition(definitions, "media_items").properties;
  const embeddings = findDefinition(definitions, "media_embeddings").properties;
  log.ok(`media_items (${Object.keys(media).length} columns)`);
  log.ok(`media_embeddings (${Object.keys(embeddings).length} columns)`);
  log.ok("Schema matches scripts/seed-data.js.");
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  console.log("HOBBYBOX catalog seed");
  console.log(`  env:     ${ENV_FILE}`);
  console.log(`  sources: ${opts.sources.join(", ")}`);
  console.log(`  limit:   ${opts.limit} per endpoint`);
  console.log(
    `  mode:    ${
      opts.checkSchema
        ? "schema-check"
        : opts.dryRun
          ? "dry-run"
          : opts.skipEmbeddings
            ? "media-only"
            : "full"
    }`,
  );

  if (opts.checkSchema) {
    await runCheckSchema();
    return;
  }

  if (opts.sources.includes("tmdb")) requireEnv("TMDB_API_KEY");
  if (!opts.dryRun) {
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!opts.skipEmbeddings) requireEmbeddingConfig();
  }
  if (opts.dryRun && opts.withEmbeddings) requireEmbeddingConfig();

  const { items, failures, bySource } = await collectItems(opts);

  if (opts.strict && failures.length) {
    throw new Error(
      `Strict mode: ${failures.map((failure) => SOURCE_LABELS[failure.source]).join(", ")} failed.`,
    );
  }

  if (!items.length) {
    throw new Error(
      "No items were fetched from any requested source. Check connectivity/keys and retry.",
    );
  }

  if (opts.dryRun) {
    await runDryRun(items, failures, bySource, opts);
    return;
  }

  const vectors = opts.skipEmbeddings ? new Map() : await embedItems(items);
  const result = await writeToSupabase(items, vectors, opts);

  log.step("Done");
  log.ok(`Media rows upserted: ${result.mediaCount}`);
  if (!opts.skipEmbeddings) {
    log.ok(`Embeddings upserted: ${result.embeddingCount}`);
  }
  if (failures.length) {
    log.warn(
      `Source(s) skipped this run: ${failures
        .map((failure) => SOURCE_LABELS[failure.source])
        .join(", ")}. Rerun later to fill them in.`,
    );
  }
}

main().catch((error) => {
  log.error(`Seed failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = 1;
});
