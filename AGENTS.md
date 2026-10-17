# Agent rules

- The phone app lives in `expo/` (Expo Router tabs under `app/(tabs)`); the center "+" tab is a placeholder route that opens the global Log modal — keeps logging reachable from every tab.
- App state (account, my logs, favorites, log modal) lives in `expo/lib/store.tsx`, persisted with AsyncStorage — single source until a backend exists.
- Media lookups go through `expo/lib/mediaService.ts`; secret-key APIs (TMDB, AI) must be called from a server, never from the app bundle.
