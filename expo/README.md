# Hobbybox application

React Native and Expo Router application for tracking and discovering films, TV, anime, books and manga.

| Path | Contents |
| --- | --- |
| `app/` | Home, Search, Friends, Profile, account and navigation routes. |
| `components/` | Cards, title details, review logging, filters, AI chat and reusable controls. |
| `lib/` | Catalog access, local state, search rules, achievement logic and tests. |
| `assets/` | App icon, assistant artwork and achievement images. |

From this directory, use `bun install --frozen-lockfile` and `bun run dev` for the web preview. `bun run typecheck`, `bun test` and `bun run build` run the automated checks and web export.

Logs, favorites, watchlists and recent searches currently stay on the device. Catalog reads, authentication and AI discovery use the connected backend. See the [project overview](../README.md) for the full MVP boundaries.
