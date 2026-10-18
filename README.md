<p align="center">
  <img src="expo/assets/icon.png" alt="Hobbybox app icon" width="88" />
</p>

<h1 align="center">Hobbybox</h1>
<p align="center"><strong>Every story. One place.</strong><br />A social media diary for films, TV, anime, books and manga.</p>
<p align="center">
  <a href="#why-hobbybox">The idea</a> ·
  <a href="#what-you-can-try">Features</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="docs/showcase.md">Demo walkthrough</a>
</p>

## Why Hobbybox?

Your watchlist is in one app, your reading list in another, and your friends' recommendations are buried in chats. Hobbybox brings those interests into one diary and helps you decide what to explore next.

Log and review what you watch or read, build a profile across five formats, and describe a half-remembered story to search for a title. The AI search backend can also use authenticated friend ratings and library history.

**Status: working MVP / portfolio prototype.** The app combines a live catalog and search service with device-local tracking and sample social activity. See the boundaries below before trying it.

## What you can try

| Feature | Current implementation |
| --- | --- |
| Unified discovery | Browse films, TV, anime, books and manga from the connected Supabase catalog. |
| Search filters | Filter by category, genre, release-year range and rating. |
| AI title discovery | Describe a story in natural language; the server searches catalog embeddings and applies supported filters. |
| Personal diary | Save ratings, reviews and rewatch/re-read entries on the current device. |
| Watchlist and favorites | Bookmark titles and choose a favorite from each format for the rotating “Quintuple” profile. |
| Achievements | Explore badges with progress derived from saved logs. |
| Social discovery | Explore a sample friends feed; signed-in AI queries can use relationships and reviews stored in the backend. |

### MVP boundaries

- Logs, watchlists, favorites and recent searches use **AsyncStorage on this device**. They do not sync to a cloud account.
- The Friends screen and initial profile activity use sample data. They are not a live feed of your own friends.
- Friend-aware AI search requires signing in and having relationships/reviews in the backend. A new account does not inherit the sample feed's friends.
- AI history filters use backend library entries; they do not yet see logs added locally in this app.
- Access tokens stay in memory. Sign in again after restarting; automatic session refresh is not implemented.
- “Reset local demo data” restores this device's demo state. It does not delete a Supabase account.
- The catalog is curated and depends on network access. AI results are suggestions, not guaranteed title identifications.
- iOS and Android targets are configured; this repository does not claim an App Store or Play Store release.

## Run locally

Use Node.js 22+ and [Bun](https://bun.sh). Bun is the package manager used by the committed frontend lockfile and test suite.

```sh
git clone https://github.com/surmavanoe/mobile-app-builder.git
cd mobile-app-builder/expo
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by Expo. The frontend lives in `expo/`; there is no root-level `npm run dev`.

The app already points to the connected demo backend in `expo/lib/mediaService.ts`. Its Supabase publishable key is a public client credential; no service-role or AI-provider secret is needed to run the frontend. Backend availability and third-party poster hosts require internet access.

| Command (from `expo/`) | Purpose |
| --- | --- |
| `bun run dev` | Start the web development preview. |
| `bun run start` | Start Expo for supported devices or simulators. |
| `bun run typecheck` | Check TypeScript. |
| `bun test` | Run catalog, filtering, achievements and service regression tests. |
| `bun run build` | Export the web app to `expo/dist/`. |

The GitHub Actions workflow runs type checking, tests and a web export without production secrets. The web output uses a single-page configuration; a host must serve `index.html` for app routes.

## How it is built

| Layer | Technology and responsibility |
| --- | --- |
| Interface | React Native, Expo Router, TypeScript, NativeWind and Reanimated. |
| Local state | React Context and AsyncStorage for the diary, favorites and watchlist. |
| Catalog and identity | Supabase Postgres/Data API and Supabase Auth. |
| Discovery | A Supabase Edge Function combines semantic search with deterministic format, genre, year, length and social filters. |
| Verification | Bun tests, TypeScript and an Expo web export. |

```text
expo/                  App screens, components, local state and tests
supabase/              Edge Function, schema snapshot and migration files
backend/               Catalog and demo-social data tooling
docs/backend-api.md    Backend request/response contract
docs/showcase.md       Short demo and portfolio description
```

AI discovery sends the prompt to `omni-search`; server-side credentials and ranking stay on the backend. This is semantic catalog search with supported filters, rather than an unrestricted conversational agent.

## Development and backend safety

Read [AGENTS.md](AGENTS.md) before changing the project. The existing Supabase project is shared: do not reapply the schema, seed data or create a replacement project as part of normal frontend setup.

Maintainers with backend credentials can run the read-only `npm run seed:check` from `backend/` after installing its dependencies. Keep service-role, Gemini and TMDB keys server-side and out of commits.

Built with [Lovable](https://lovable.dev) and continued in code. The [existing Lovable project](https://lovable.dev/projects/780deb0a-fb64-4657-9724-4c3aef43bf15) syncs changes from `main`.

## Next milestones

- Sync diary entries, reviews, watchlists and favorites with authenticated accounts.
- Connect the Friends feed and friend management to backend data.
- Add session refresh, password recovery and online account deletion.
- Validate native builds and improve accessibility across the main flows.

See [roadmap.md](roadmap.md) for implementation history. Posters, title metadata and third-party artwork belong to their respective owners.
