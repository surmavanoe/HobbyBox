# Fix missing posters and connect the AI switch

## Findings
- **Missing posters:** the database has 106 titles, and 99 of them have a poster. The app never asks the database for posters. It only shows a picture when a title happens to match one of the old demo titles, so most titles show up blank.
- **AI key:** the Gemini key lives on the server, not in the app, which is correct. A live test of the AI search just returned real results ("cozy fantasy" brought back Frieren), so it works.
- **What uses AI today:** tapping a suggestion runs the real AI search. The AI switch in the search bar and the round AI button do nothing yet, as you asked earlier.

## Changes
1. Load poster, year, genres and rating from the database for every title, falling back to the demo picture only if the database has no poster. The 7 titles with no poster keep the plain placeholder.
2. Optional (you decide): when the AI switch is on, pressing search sends what you typed to the AI instead of the normal search. The round AI button stays inactive.

## Technical details
- `fetchCatalog` select adds `poster_url,release_year,genres,average_rating`; `CatalogRow` and `mapCatalogRow` map them (DB value first, demo match as fallback); update `catalog.test.ts`.
- Optional: in `search.tsx`, `onSubmitEditing` calls `runAi(query)` when `aiOn`.
- No backend, migration or key changes.
