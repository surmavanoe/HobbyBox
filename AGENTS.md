# Agent rules

- The phone app lives in `expo/` (Expo Router tabs under `app/(tabs)`); the center "+" tab is a placeholder route that opens the global Log modal — keeps logging reachable from every tab.
- App state (account, my logs, favorites, log modal) lives in `expo/lib/store.tsx`, persisted with AsyncStorage — single source until a backend exists.
- Media lookups go through `expo/lib/mediaService.ts`; public catalog reads use the connected Supabase Data API with a publishable key, while secret-key APIs (TMDB, AI) must stay server-side — no private credentials enter the app bundle.
- The store loads one shared database catalog, mapped by `expo/lib/catalog.ts`; database UUIDs identify new logs and bookmarks, and legacy demo IDs resolve separately — keeps search/details consistent without losing saved demo activity.
- Search filter rules live in a pure helper and the nested picker in a dedicated modal; filters operate on the shared catalog without inventing missing metadata or ratings — keeps selection behavior testable and catalog values truthful.
