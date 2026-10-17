// Supabase Edge Function: omni-search
//
// POST { prompt: string }
//   -> { message: string, results: SearchResultRow[] }
//
// Flow:
//   1. Parse the prompt into a small, deterministic search plan (formats,
//      genres, years, friend ratings, personal history, length).
//   2. Embed the prompt at 1536 dimensions. Gemini is the default; OpenAI and
//      OpenRouter are optional.
//   3. Use match_media for semantic candidates, then apply the plan against
//      media_items, reviews, friendships and library_entries.
//   4. Return cards enriched with poster/year/genres/friend context.
//
// The user is derived from the verified JWT. The body user_id is ignored.
//
// Deploy (Gemini default):
//   supabase secrets set GEMINI_API_KEY=...
//   supabase functions deploy omni-search
//
// Optional providers:
//   supabase secrets set EMBEDDING_PROVIDER=openai OPENAI_API_KEY=...
//   supabase secrets set EMBEDDING_PROVIDER=openrouter OPENROUTER_API_KEY=...

import { createClient } from "jsr:@supabase/supabase-js@2";

const EMBEDDING_DIMENSIONS = 1536;
const MATCH_THRESHOLD = 0.3;
const MATCH_COUNT = 100;
const MAX_PROMPT_LENGTH = 6000;
const RESULT_LIMIT = 10;
const EMBEDDING_TIMEOUT_MS = 30_000;

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const MESSAGE = "Here are some movies, series, books, or comics you could be looking for:";
const RELAXED_MESSAGE = "No exact matches for every filter, but here are close matches:";
const EMPTY_MESSAGE =
  "I couldn't find a match in the catalog yet. Try a broader description or a different format.";

type EmbeddingProvider = "gemini" | "openai" | "openrouter";

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  label: string;
  model: string;
  apiKeyEnv: string;
}

interface MediaRow {
  id: string;
  title: string;
  format: string;
  synopsis: string | null;
  poster_url: string | null;
  release_year: number | null;
  genres: string[] | null;
  average_rating: number | null;
  runtime_minutes: number | null;
  episode_count: number | null;
  page_count: number | null;
  issue_count: number | null;
}

interface SearchResultRow extends MediaRow {
  similarity: number | null;
  friend_rating: number | null;
  friend_review: string | null;
  friend_name: string | null;
  match_reason: string | null;
}

interface SemanticRow {
  id: string;
  similarity: number;
}

interface FriendReviewRow {
  media_item_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
}

interface LibraryRow {
  media_item_id: string;
}

interface FriendAggregate {
  maxRating: number;
  latest: FriendReviewRow | null;
  name: string | null;
}

interface SearchPlan {
  formats: string[];
  genreAliases: string[];
  yearMin?: number;
  yearMax?: number;
  minFriendRating?: number;
  friendReviewedSince?: string;
  excludeUserLibrary: boolean;
  maxRuntimeMinutes?: number;
  maxEpisodes?: number;
  maxPages?: number;
  maxIssues?: number;
  needsFriends: boolean;
  needsHistory: boolean;
  hardFormats: boolean;
  hardGenres: boolean;
  hasFilters: boolean;
}

interface GeminiEmbeddingResponse {
  embedding?: { values?: number[] };
}

interface OpenAICompatibleEmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
}

/** An upstream failure whose details belong in logs, not in the API response. */
class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MEDIA_FIELDS =
  "id,title,format,synopsis,poster_url,release_year,genres,average_rating,runtime_minutes,episode_count,page_count,issue_count";

const GENRE_ALIASES: Record<string, string[]> = {
  "sci-fi": ["sci-fi", "science fiction", "scifi"],
  "science fiction": ["science fiction", "sci-fi"],
  fantasy: ["fantasy"],
  romance: ["romance"],
  thriller: ["thriller"],
  mystery: ["mystery"],
  horror: ["horror"],
  comedy: ["comedy"],
  drama: ["drama"],
  action: ["action"],
  adventure: ["adventure"],
  crime: ["crime"],
  documentary: ["documentary"],
  animation: ["animation"],
  supernatural: ["supernatural"],
  historical: ["historical"],
  "slice of life": ["slice of life"],
  psychological: ["psychological"],
  cyberpunk: ["cyberpunk"],
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }
  return value.trim();
}

function getEmbeddingConfig(): EmbeddingConfig {
  const provider = (Deno.env.get("EMBEDDING_PROVIDER") || "gemini").trim().toLowerCase();

  if (provider === "gemini") {
    return {
      provider,
      label: "Gemini",
      model: (Deno.env.get("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-001").trim(),
      apiKeyEnv: "GEMINI_API_KEY",
    };
  }
  if (provider === "openai") {
    return {
      provider,
      label: "OpenAI",
      model: (Deno.env.get("OPENAI_EMBEDDING_MODEL") || "text-embedding-3-small").trim(),
      apiKeyEnv: "OPENAI_API_KEY",
    };
  }
  if (provider === "openrouter") {
    return {
      provider,
      label: "OpenRouter",
      model: (Deno.env.get("OPENROUTER_EMBEDDING_MODEL") || "qwen/qwen3-embedding-8b").trim(),
      apiKeyEnv: "OPENROUTER_API_KEY",
    };
  }

  throw new Error(`Unknown EMBEDDING_PROVIDER "${provider}". Use gemini, openai, or openrouter.`);
}

/** Enforce the database's 1536-dimension contract. Supports MRL truncation. */
function normalizeEmbedding(values: unknown): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Embedding response did not contain a vector.");
  }

  const numbers = values.map((value) => Number(value));
  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding response contained non-numeric values.");
  }

  if (numbers.length === EMBEDDING_DIMENSIONS) return numbers;

  if (numbers.length > EMBEDDING_DIMENSIONS) {
    // Gemini 001 and Qwen3 use MRL: the leading dimensions are a valid
    // smaller embedding. Renormalize so cosine similarity stays meaningful.
    const truncated = numbers.slice(0, EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(truncated.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? truncated.map((value) => value / norm) : truncated;
  }

  throw new Error(
    `Embedding has ${numbers.length} dimensions; expected ${EMBEDDING_DIMENSIONS}. ` +
      "Choose a model that supports 1536 dimensions.",
  );
}

async function embedPrompt(
  prompt: string,
  config: EmbeddingConfig,
  apiKey: string,
): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    let url: string;
    let headers: Record<string, string>;
    let body: unknown;

    if (config.provider === "gemini") {
      url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(config.model)}:embedContent`;
      headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      };
      body = {
        content: { parts: [{ text: prompt }] },
        output_dimensionality: EMBEDDING_DIMENSIONS,
        // gemini-embedding-2 does not accept taskType; 001 does.
        ...(config.model.includes("gemini-embedding-2") ? {} : { taskType: "RETRIEVAL_QUERY" }),
      };
    } else {
      url =
        config.provider === "openai"
          ? `${OPENAI_BASE_URL}/embeddings`
          : `${OPENROUTER_BASE_URL}/embeddings`;
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      if (config.provider === "openrouter") {
        headers["HTTP-Referer"] = "https://hobbybox-fe-delight.lovable.app";
        headers["X-Title"] = "Hobbybox Omni Search";
      }
      body = {
        model: config.model,
        input: prompt,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: "float",
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();

    if (!response.ok) {
      throw new UpstreamError(
        `${config.label} embeddings failed (${response.status}): ${raw.slice(0, 500)}`,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new UpstreamError(`${config.label} returned a non-JSON response.`);
    }

    if (config.provider === "gemini") {
      const values = (payload as GeminiEmbeddingResponse).embedding?.values;
      return normalizeEmbedding(values);
    }

    const values = (payload as OpenAICompatibleEmbeddingResponse).data?.[0]?.embedding;
    return normalizeEmbedding(values);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new UpstreamError(`${config.label} embedding request timed out.`);
    }
    throw new UpstreamError(
      `${config.label} embedding request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Deterministic natural-language plan                                        */
/* -------------------------------------------------------------------------- */

function parsePlan(prompt: string): SearchPlan {
  const lower = prompt.toLowerCase();
  const formats: string[] = [];

  if (/\b(movie|movies|film|films)\b/.test(lower)) formats.push("film");
  if (/\b(tv|television|show|shows|series)\b/.test(lower)) formats.push("tv");
  if (/\banime\b/.test(lower)) formats.push("anime");
  if (/\b(book|books|novel|novels)\b/.test(lower)) formats.push("book");
  if (/\b(manga|comic|comics|graphic novel)\b/.test(lower)) formats.push("manga");

  const genreAliases = new Set<string>();
  for (const [key, aliases] of Object.entries(GENRE_ALIASES)) {
    const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) {
      aliases.forEach((alias) => genreAliases.add(alias));
    }
  }

  const plan: SearchPlan = {
    formats: [...new Set(formats)],
    genreAliases: [...genreAliases],
    excludeUserLibrary: false,
    needsFriends: false,
    needsHistory: false,
    hardFormats: false,
    hardGenres: false,
    hasFilters: false,
  };

  const range =
    lower.match(/between\s+(\d{4})\s+and\s+(\d{4})/) ||
    lower.match(/from\s+(\d{4})\s+to\s+(\d{4})/);
  if (range) {
    plan.yearMin = Number(range[1]);
    plan.yearMax = Number(range[2]);
  } else {
    const decade = lower.match(/\b(?:the\s+)?(?:'|’)?(\d{2})s\b/);
    if (decade) {
      const value = Number(decade[1]);
      plan.yearMin = value >= 30 ? 1900 + value : 2000 + value;
      plan.yearMax = plan.yearMin + 9;
    } else {
      const after = lower.match(/(?:after|since|from)\s+(\d{4})/);
      if (after) plan.yearMin = Number(after[1]);
      const before = lower.match(/(?:before|until|up to)\s+(\d{4})/);
      if (before) plan.yearMax = Number(before[1]);
    }
  }

  const friendRating =
    lower.match(/friends?[^.!?]{0,80}?(?:rated|rating|gave|score)[^0-9]{0,20}([1-5])\s*\+?/) ||
    lower.match(/([1-5])\s*\+?\s*(?:stars?|rating)[^.!?]{0,40}?(?:by|from)\s+(?:my\s+)?friends/) ||
    lower.match(/([1-5])\s*\+?[^.!?]{0,30}?(?:by|from)\s+(?:my\s+)?friends/);
  if (friendRating) {
    plan.minFriendRating = Number(friendRating[1]);
  } else if (
    /\bfriends?\b/.test(lower) &&
    /(highly rated|top[- ]rated|loved|liked|favorites?)/.test(lower)
  ) {
    plan.minFriendRating = 4;
  }

  if (
    /\bfriends?\b/.test(lower) &&
    /(reviewed|watched|read|logged).*(this month|last 30 days|recently)/.test(lower)
  ) {
    const now = new Date();
    plan.friendReviewedSince = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString();
  }

  if (
    /(haven'?t|have not|not yet)\s+(logged|watched|read|seen|started)/.test(lower) ||
    /not in my (library|watchlist|logs)/.test(lower) ||
    /new to me/.test(lower)
  ) {
    plan.excludeUserLibrary = true;
  }

  const issues = lower.match(/under\s+(\d+)\s*(?:issues?|chapters?)/);
  if (issues) plan.maxIssues = Number(issues[1]);
  const pages = lower.match(/under\s+(\d+)\s*(?:pages?)/);
  if (pages) plan.maxPages = Number(pages[1]);
  const episodes = lower.match(/under\s+(\d+)\s*(?:episodes?)/);
  if (episodes) plan.maxEpisodes = Number(episodes[1]);
  const hours = lower.match(/under\s+(\d+)\s*(?:hours?|hrs?)/);
  if (hours) plan.maxRuntimeMinutes = Number(hours[1]) * 60;
  const minutes = lower.match(/under\s+(\d+)\s*(?:minutes?|mins?)/);
  if (minutes) plan.maxRuntimeMinutes = Number(minutes[1]);

  plan.needsFriends = plan.minFriendRating !== undefined || plan.friendReviewedSince !== undefined;
  plan.needsHistory = plan.excludeUserLibrary;

  const structuredCue =
    plan.yearMin !== undefined ||
    plan.yearMax !== undefined ||
    plan.needsFriends ||
    plan.needsHistory ||
    plan.maxRuntimeMinutes !== undefined ||
    plan.maxEpisodes !== undefined ||
    plan.maxPages !== undefined ||
    plan.maxIssues !== undefined ||
    /\b(show me|only|find me|recommend|looking for)\b/.test(lower);
  plan.hardFormats = structuredCue;
  plan.hardGenres = structuredCue;

  plan.hasFilters =
    plan.formats.length > 0 ||
    plan.genreAliases.length > 0 ||
    plan.yearMin !== undefined ||
    plan.yearMax !== undefined ||
    plan.needsFriends ||
    plan.needsHistory ||
    plan.maxRuntimeMinutes !== undefined ||
    plan.maxEpisodes !== undefined ||
    plan.maxPages !== undefined ||
    plan.maxIssues !== undefined;

  return plan;
}

function estimatedMinutes(media: MediaRow): number | null {
  if (media.runtime_minutes !== null) return media.runtime_minutes;
  if (media.format === "anime" && media.episode_count !== null) {
    return media.episode_count * 24;
  }
  if (media.format === "tv" && media.episode_count !== null) {
    return media.episode_count * 45;
  }
  return null;
}

function matchesPlan(
  media: MediaRow,
  plan: SearchPlan,
  friendAgg: Map<string, FriendAggregate>,
  loggedIds: Set<string>,
): boolean {
  if (plan.hardFormats && plan.formats.length && !plan.formats.includes(media.format)) {
    return false;
  }

  if (plan.hardGenres && plan.genreAliases.length) {
    const genres = (media.genres ?? []).map((genre) => genre.toLowerCase());
    const matchesGenre = genres.some((genre) =>
      plan.genreAliases.some((alias) => genre.includes(alias)),
    );
    if (!matchesGenre) return false;
  }

  if (plan.yearMin !== undefined && (media.release_year ?? 0) < plan.yearMin) return false;
  if (plan.yearMax !== undefined && (media.release_year ?? 9999) > plan.yearMax) return false;

  if (plan.minFriendRating !== undefined) {
    const aggregate = friendAgg.get(media.id);
    if (!aggregate || aggregate.maxRating < plan.minFriendRating) return false;
  }

  if (plan.friendReviewedSince !== undefined) {
    const aggregate = friendAgg.get(media.id);
    if (!aggregate?.latest) return false;
    if (new Date(aggregate.latest.created_at) < new Date(plan.friendReviewedSince)) {
      return false;
    }
  }

  if (plan.excludeUserLibrary && loggedIds.has(media.id)) return false;

  if (plan.maxRuntimeMinutes !== undefined) {
    const minutes = estimatedMinutes(media);
    if (minutes !== null && minutes > plan.maxRuntimeMinutes) return false;
  }
  if (
    plan.maxEpisodes !== undefined &&
    media.episode_count !== null &&
    media.episode_count > plan.maxEpisodes
  ) {
    return false;
  }
  if (
    plan.maxPages !== undefined &&
    media.page_count !== null &&
    media.page_count > plan.maxPages
  ) {
    return false;
  }
  if (
    plan.maxIssues !== undefined &&
    media.issue_count !== null &&
    media.issue_count > plan.maxIssues
  ) {
    return false;
  }

  return true;
}

function preferenceScore(media: MediaRow, plan: SearchPlan): number {
  let score = 0;
  if (!plan.hardFormats && plan.formats.includes(media.format)) score += 1;
  if (
    !plan.hardGenres &&
    plan.genreAliases.some((alias) =>
      (media.genres ?? []).some((genre) => genre.toLowerCase().includes(alias)),
    )
  ) {
    score += 1;
  }
  return score;
}

function rankRows(
  rows: MediaRow[],
  plan: SearchPlan,
  similarityById: Map<string, number>,
  friendAgg: Map<string, FriendAggregate>,
): MediaRow[] {
  return [...rows].sort((left, right) => {
    if (plan.needsFriends) {
      const leftFriend = friendAgg.get(left.id)?.maxRating ?? 0;
      const rightFriend = friendAgg.get(right.id)?.maxRating ?? 0;
      if (rightFriend !== leftFriend) return rightFriend - leftFriend;
    }

    const leftSimilarity = similarityById.get(left.id) ?? -1;
    const rightSimilarity = similarityById.get(right.id) ?? -1;
    if (rightSimilarity !== leftSimilarity) return rightSimilarity - leftSimilarity;

    const leftPreference = preferenceScore(left, plan);
    const rightPreference = preferenceScore(right, plan);
    if (rightPreference !== leftPreference) return rightPreference - leftPreference;

    return (right.average_rating ?? 0) - (left.average_rating ?? 0);
  });
}

function withoutSoftFilters(plan: SearchPlan): SearchPlan {
  return {
    ...plan,
    yearMin: undefined,
    yearMax: undefined,
    maxRuntimeMinutes: undefined,
    maxEpisodes: undefined,
    maxPages: undefined,
    maxIssues: undefined,
    genreAliases: [],
    hardGenres: false,
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP handler                                                               */
/* -------------------------------------------------------------------------- */

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, 405, {
      Allow: "POST, OPTIONS",
    });
  }

  let embeddingConfig: EmbeddingConfig;
  let embeddingKey: string;
  let supabaseUrl: string;
  let serviceRoleKey: string;
  let anonKey: string;

  try {
    embeddingConfig = getEmbeddingConfig();
    embeddingKey = requireEnv(embeddingConfig.apiKeyEnv);
    supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  } catch (error) {
    console.error(
      "omni-search is not configured:",
      error instanceof Error ? error.message : String(error),
    );
    return json({ error: "Server is not configured." }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!isRecord(body)) {
    return json({ error: "Request body must be a JSON object." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return json({ error: "`prompt` is required and must be a non-empty string." }, 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: `\`prompt\` must be at most ${MAX_PROMPT_LENGTH} characters.` }, 400);
  }

  const plan = parsePlan(prompt);

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    try {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data.user) userId = data.user.id;
    } catch (error) {
      console.warn(
        "Could not verify the caller JWT:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if ((plan.needsFriends || plan.needsHistory) && !userId) {
    return json({ error: "Sign in to search your friends' activity or your own library." }, 401);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: mediaData, error: mediaError } = await supabase
      .from("media_items")
      .select(MEDIA_FIELDS)
      .limit(500);
    if (mediaError) {
      console.error(`media_items query failed: ${mediaError.message}`);
      return json({ error: "Search is temporarily unavailable." }, 502);
    }
    const mediaRows = (mediaData ?? []) as MediaRow[];

    let semanticRows: SemanticRow[] = [];
    let semanticFailed = false;
    try {
      const embedding = await embedPrompt(prompt, embeddingConfig, embeddingKey);
      const { data, error } = await supabase.rpc("match_media", {
        query_embedding: embedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
      });
      if (error) {
        semanticFailed = true;
        console.error(`match_media RPC failed: ${error.message} (code=${error.code ?? "unknown"})`);
      } else {
        semanticRows = (Array.isArray(data) ? data : []) as SemanticRow[];
      }
    } catch (error) {
      semanticFailed = true;
      console.error(
        "Semantic embedding failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    if (semanticFailed && !plan.hasFilters) {
      return json({ error: "Search is temporarily unavailable." }, 502);
    }

    const similarityById = new Map(
      semanticRows
        .filter((row) => typeof row.similarity === "number")
        .map((row) => [row.id, row.similarity]),
    );

    let friendIds: string[] = [];
    const friendAgg = new Map<string, FriendAggregate>();
    let loggedIds = new Set<string>();

    if (userId && plan.needsFriends) {
      const { data: friendships, error: friendshipError } = await supabase
        .from("friendships")
        .select("user_id,friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (friendshipError) {
        console.error(`friendships query failed: ${friendshipError.message}`);
      } else {
        const friendRows = (friendships ?? []) as Array<{
          user_id: string;
          friend_id: string;
        }>;
        friendIds = [
          ...new Set(
            friendRows.map((friendship) =>
              friendship.user_id === userId ? friendship.friend_id : friendship.user_id,
            ),
          ),
        ];
      }
    }

    if (friendIds.length) {
      const [{ data: reviews, error: reviewError }, { data: profiles }] = await Promise.all([
        supabase
          .from("reviews")
          .select("media_item_id,user_id,rating,content,created_at")
          .in("user_id", friendIds)
          .limit(1000),
        supabase.from("profiles").select("id,display_name").in("id", friendIds),
      ]);

      if (reviewError) {
        console.error(`friend reviews query failed: ${reviewError.message}`);
      }

      const nameById = new Map(
        ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.display_name]),
      );

      for (const review of (reviews ?? []) as FriendReviewRow[]) {
        const current = friendAgg.get(review.media_item_id) ?? {
          maxRating: 0,
          latest: null,
          name: null,
        };
        if (review.rating > current.maxRating) current.maxRating = review.rating;
        if (
          !current.latest ||
          new Date(review.created_at).getTime() > new Date(current.latest.created_at).getTime()
        ) {
          current.latest = review;
          current.name = nameById.get(review.user_id) ?? null;
        }
        friendAgg.set(review.media_item_id, current);
      }
    }

    if (userId && plan.excludeUserLibrary) {
      const { data: library, error: libraryError } = await supabase
        .from("library_entries")
        .select("media_item_id")
        .eq("user_id", userId);
      if (libraryError) {
        console.error(`library query failed: ${libraryError.message}`);
      } else {
        loggedIds = new Set(((library ?? []) as LibraryRow[]).map((entry) => entry.media_item_id));
      }
    }

    let filtered = mediaRows.filter((media) => matchesPlan(media, plan, friendAgg, loggedIds));
    let relaxed = false;

    if (!filtered.length && plan.hasFilters) {
      relaxed = true;
      filtered = mediaRows.filter((media) =>
        matchesPlan(media, withoutSoftFilters(plan), friendAgg, loggedIds),
      );
    }

    const ranked = rankRows(filtered, plan, similarityById, friendAgg).slice(0, RESULT_LIMIT);

    const results: SearchResultRow[] = ranked.map((media) => {
      const aggregate = friendAgg.get(media.id);
      const similarity = similarityById.get(media.id) ?? null;
      return {
        ...media,
        similarity,
        friend_rating: aggregate?.maxRating ?? null,
        friend_review: aggregate?.latest?.content ?? null,
        friend_name: aggregate?.name ?? null,
        match_reason: aggregate?.latest
          ? `Friend rated ${aggregate.maxRating}★`
          : similarity !== null
            ? "Semantic match"
            : null,
      };
    });

    let message = MESSAGE;
    if (!results.length) message = EMPTY_MESSAGE;
    else if (relaxed) message = RELAXED_MESSAGE;
    else if (semanticFailed) {
      message = "Semantic search was unavailable, but these match your filters:";
    }

    return json({ message, results });
  } catch (error) {
    if (error instanceof UpstreamError) {
      console.error(error.message);
      return json({ error: "Search is temporarily unavailable." }, 502);
    }

    console.error(
      "Unexpected omni-search error:",
      error instanceof Error ? error.message : String(error),
    );
    return json({ error: "Internal server error." }, 500);
  }
});
