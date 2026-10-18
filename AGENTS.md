# Agent rules

- The phone app lives in `expo/` (Expo Router tabs under `app/(tabs)`); the center "+" tab is a placeholder route that opens the global Log modal — keeps logging reachable from every tab.
- App state (account, my logs, favorites, log modal) lives in `expo/lib/store.tsx`, persisted with AsyncStorage — single source until a backend exists.
- Media lookups go through `expo/lib/mediaService.ts`; public catalog reads use the connected Supabase Data API with a publishable key, while secret-key APIs (TMDB, AI) must stay server-side — no private credentials enter the app bundle.
- AI discovery posts only the prompt to the existing public `omni-search` Edge Function and maps its response in the media service; preserve the call signature and propagate failures to the existing retry UI — keeps backend ranking authoritative without changing screens.
- The store loads one shared database catalog, mapped by `expo/lib/catalog.ts`; database UUIDs identify new logs and bookmarks, and legacy demo IDs resolve separately — keeps search/details consistent without losing saved demo activity.
- Search filter rules live in a pure helper and the picker in a dedicated modal; the year-range control uses React Native responders with inclusive integer bounds and shared non-crossing logic — keeps native/web selection testable without adding a native dependency or inventing catalog metadata.
- The search filter modal keeps draft selections until Apply Filters; dismissing discards the draft — keeps the overlay from changing results behind the user before confirmation.

## Backend
- Supabase project: smeucssdhwbfoiaethcm. Do not create a new project.
- Frontend: expo/. Backend: supabase/ and backend/.
- AI function: supabase/functions/omni-search/index.ts, already deployed.
- Backend contract: docs/backend-api.md.
- Frontend uses the public publishable key. Service-role, Gemini and TMDB keys
  are server-side only and must never enter the app bundle.
- Do not run supabase db push, supabase/schema.sql, npm run seed, or
  npm run seed:social unless explicitly asked.
- Verify backend with: cd backend && npm run seed:check.
- Verify frontend with: cd expo && npx tsc --noEmit.
