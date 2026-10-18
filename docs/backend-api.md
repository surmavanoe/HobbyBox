> **This repo is the Expo app.** References below to `src/lib/public-config.ts`,
> `src/routes`, `VITE_*` and the old web frontend are from the web prototype.
> For this app, use the publishable key already in `expo/lib/mediaService.ts`
> (or `VITE_SUPABASE_PUBLISHABLE_KEY`).


# HOBBYBOX backend contract

This document is for the Lovable/frontend team. The backend owns the Supabase
database, auth/demo users, catalog data, embeddings, RLS and the AI search
function. The frontend owns all UI, navigation, cards, sheets and layout.

## Project

- Supabase project: `smeucssdhwbfoiaethcm`
- URL: `https://smeucssdhwbfoiaethcm.supabase.co`
- Function: `omni-search` — ACTIVE
- Function URL:
  `https://smeucssdhwbfoiaethcm.supabase.co/functions/v1/omni-search`

Use the **anon public key** in the frontend. Never use the service-role key in
the browser or in a `VITE_*` variable.

The public URL/anon key are committed in `src/lib/public-config.ts` as a
GitHub-only build fallback. Lovable environment variables override it if set:

```text
VITE_SUPABASE_URL=https://smeucssdhwbfoiaethcm.supabase.co
VITE_SUPABASE_ANON_KEY=<public anon key>
```

## Auth

- Supabase Auth email/password is enabled.
- Demo account: `demo@hobbybox.app` / `hobbybox-demo`
- Demo user id: `d244fd8c-9195-458d-ad5c-04194369226c`
- Friend users: Alice, Sam, Maya, Leo.

The function derives the user from the caller's JWT. Do **not** send `user_id`
in the request body; it is ignored. Friend/personal filters require a signed-in
session. Public semantic search works with the anon key.

## Search endpoint

`POST /functions/v1/omni-search`

Request:

```json
{ "prompt": "A dark manga about a notebook that kills people" }
```

Headers when using raw HTTP:

```text
Authorization: Bearer <user access token or anon key>
apikey: <anon key>
Content-Type: application/json
```

When using `supabase-js`, `functions.invoke` attaches the current session
automatically:

```ts
const { data, error } = await supabase.functions.invoke("omni-search", {
  body: { prompt },
});
```

Response:

```json
{
  "message": "Here are some movies, series, books, or comics you could be looking for:",
  "results": [
    {
      "id": "uuid",
      "title": "Death Note",
      "format": "manga",
      "synopsis": "...",
      "poster_url": null,
      "release_year": 2003,
      "genres": ["Mystery", "Thriller", "Supernatural"],
      "average_rating": 4.6,
      "runtime_minutes": null,
      "episode_count": null,
      "page_count": null,
      "issue_count": null,
      "similarity": 0.76,
      "friend_rating": null,
      "friend_review": null,
      "friend_name": null,
      "match_reason": "Semantic match"
    }
  ]
}
```

- `similarity` is `0..1`; display as `Math.round(similarity * 100)%`.
- `poster_url` may be null (curated demo titles); render a fallback.
- `friend_rating` / `friend_name` / `friend_review` are populated when the
  query used friend context.
- `format` is one of `film`, `tv`, `anime`, `book`, `manga`.
- `results` is capped at 10.

Error responses:

| Status | Meaning |
|---|---|
| 400 | Invalid JSON, missing prompt, prompt > 6000 chars |
| 401 | Friend/personal filter requested without a signed-in user |
| 500 | Server configuration (missing secret) |
| 502 | Embedding/RPC upstream failure |

## Supported natural-language filters

The backend currently parses, deterministically:

- Format: movie/film, TV/series, anime, book/novel, manga/comic
- Genres: sci-fi, fantasy, romance, thriller, mystery, horror, comedy, drama,
  action, adventure, crime, documentary, animation, supernatural, historical,
  slice of life, psychological, cyberpunk
- Years: “between 1985 and 1995”, “from the 90s”, “after 2010”, “before 2000”
- Friend ratings: “friends rated 4+”, “4+ by my friends”, “highly rated by my
  friends”
- Friend recency: “friends reviewed this month” / “recently”
- Personal history: “I haven’t logged/watched/read”, “not in my library”
- Length: “under 30 issues”, “under 300 pages”, “under 12 episodes”,
  “under 5 hours”

Hard filters are applied when the query has structured cues (years, social,
history, length, “only”, “show me”, “find me”). Otherwise formats/genres are
soft preferences so fuzzy “Shazam” queries still return useful candidates. If a
strict query has no matches, the function relaxes year/length/genre and sets a
“close matches” message.

This is not an open-ended LLM planner. For unsupported combinations, the
semantic prompt still drives results.

## Database tables for the UI

### `media_items`

`id, title, format, synopsis, poster_url, release_year, genres,
average_rating, runtime_minutes, episode_count, page_count, issue_count,
external_source, external_url, metadata, created_at`

### `library_entries` — personal state

`id, user_id, media_item_id, status, rating, review, progress, is_rewatch,
started_at, completed_at, updated_at`

`status` is `planned | in_progress | completed | dropped`.
Unique per `(user_id, media_item_id)`.

### `reviews` — public/social reviews

`id, user_id, media_item_id, rating, content, visibility, is_rewatch,
created_at`

`visibility` is `public | friends | private`.

### `friendships`

`id, user_id, friend_id, status, created_at`

`status` is `pending | accepted | blocked`.

### `profiles`

`id, handle, display_name, avatar_url, created_at`

### `media_embeddings`

`id, media_item_id, embedding vector(1536)`. Only the backend/search function
should read raw embeddings.

## RLS / access

- `media_items`: public read.
- `library_entries`: users can read/write only their own rows.
- `reviews`: public reviews plus own rows.
- `profiles`: authenticated read; own update.
- `friendships`: own rows.
- Friend/personal search is executed server-side by `omni-search` after JWT
  verification.

If Lovable creates a **new** user account instead of using the demo account,
that user has no friends/reviews/library. Friend/personal filters will be
empty until you seed or create relationships for that user. For the hackathon,
use the demo account or add friendships/reviews for the test account.

## Current data

- 106 media items, all five formats
- 106 embeddings (1536-dim Gemini)
- 5 profiles
- 6 accepted friendships
- 65 reviews
- 50 library entries

## Tested examples

| Prompt | Result |
|---|---|
| Volleyball / stranded thriller | Cast Away |
| Notebook that kills people | Death Note |
| Dream detective / Tokyo nightmare | Paprika (book + film) |
| Books friends reviewed this month | Books with friend ratings |
| Sci-fi anime friends rated 4+ | Anime with 5★ friend context |
| Sci-fi comics 1985–1995 under 30 issues | Relaxed manga matches |

## What the backend does not own

- UI routes, cards, sheets, navigation, animations, empty states.
- The Friends page / social feed UI.
- Custom lists UI, rewatch UI, tags UI.
- Home-page presentation.

The old web frontend files are not part of this Expo app. The backend contract
is independent of the UI; the Expo owner can wire it from `expo/lib/mediaService.ts`.

## Moving or bootstrapping the backend

`supabase/schema.sql` is a full snapshot of the live public schema: media
tables, `match_media`, profiles/library/reviews/friendships, triggers, RLS and
grants. The incremental files in `supabase/migrations/` only contain the later
P0 changes; the original table/RPC DDL was applied outside this repo.

### Same Supabase project (recommended for a new GitHub repo)

Do not run `supabase/schema.sql` or the migrations — the project already has
them. Copy the backend files, link the new repo to the existing project, and
deploy the function only if you want the new repo to be the deployment source:

```sh
supabase link --project-ref smeucssdhwbfoiaethcm
supabase functions deploy omni-search --project-ref smeucssdhwbfoiaethcm --use-api
```

The data, auth users, secrets and function URL stay unchanged.

### New Supabase project

1. Create the project.
2. Run `supabase/schema.sql` in the new project's SQL editor. It is written for
   a fresh project; do not run it against the existing project.
3. Set the function secret:
   `supabase secrets set GEMINI_API_KEY=... EMBEDDING_PROVIDER=gemini --project-ref <new-ref>`
4. Deploy: `supabase functions deploy omni-search --project-ref <new-ref> --use-api`
5. Configure the seed `.env` with the new URL/service-role key and run
   `npm run seed` and `npm run seed:social`.
6. Update the frontend public config / Lovable env with the new URL, anon key
   and function URL.

The schema snapshot does not contain auth users or rows. `seed:social` creates
the demo users, friendships, reviews and library entries. The demo user IDs
will differ in a new project, so update `docs/backend-api.md` accordingly.

## Expo / React Native client

This repo is the Expo app. It uses raw `fetch` and the connected project's
publishable key (see `expo/lib/mediaService.ts`), not `@supabase/supabase-js`.

Public semantic search works with the publishable key:

```ts
const res = await fetch(
  "https://smeucssdhwbfoiaethcm.supabase.co/functions/v1/omni-search",
  {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  },
);

const { message, results } = await res.json();
```

This was verified against the live function (HTTP 200). Map the result fields to
the app's `Media` shape:

- `format` -> `category`
- `release_year` -> `year`
- `poster_url` -> `cover`
- `average_rating` -> `rating`
- `genres` -> `genres`
- `synopsis` -> `synopsis`

Friend/personal filters ("my friends rated 4+", "books I haven't logged") need a
Supabase Auth user JWT in `Authorization`. The Expo app signs in over REST and
keeps the token in memory only; signing in again is required after a restart.
Account display details persist in AsyncStorage, but a stored profile is not an
active session. Signup may require email confirmation before a token is issued.

Logs, reviews, favorites and watchlists created in the Expo UI remain local.
They are not written to Supabase yet, so AI personal-history filters use existing
backend entries, and the sample Friends feed is separate from backend friendships.

## Secrets

Server-side only (Supabase Edge Function secrets / local seed):

- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TMDB_API_KEY`

Never expose these to the browser.
