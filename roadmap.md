# Development roadmap

Completed interface work, integration milestones and planned improvements for Hobbybox. Historical entries describe the state at the time of each change.

## Badge sharpness
- [x] Regenerate Marvel and Tolkien badges at high resolution and load them locally.
- [x] Render badges larger with thicker line art and verify on the profile.
- [x] Add achievement cards below Quintuple and the two reference icons beside Friends.
- [x] Add working See more views for achievements and recent reviews.
- [x] Test saved-log progress and verify the profile flow in Quick view.

## Catalog connection
- [x] Load all database media into search, home, and title details.
- [x] Preserve existing on-phone logs and watchlist lookups.
- [x] Test all 60 titles and verify search-to-detail-to-watchlist in Quick view.

## Search controls
- [x] Add nested release-year, genre and rating filters.
- [x] Make the AI switch visual-only and enlarge the inactive floating AI button.
- [x] Test filter rules and verify Search interactions in Quick view.

## Release-year range
- [x] Replace decade/year lists with a non-crossing, integer-step 1940–2027 two-dot slider.
- [x] Test year bounds, meeting behavior and inclusive filtering; verify dragging in Quick view.

## Filter pop-up
- [x] Replace the full-screen filter with a smaller overlay showing genre, the existing year slider, and ratings.
- [x] Verify opening, applying, and dismissing the pop-up in Quick view.

## Compact filter rows
- [x] Add Category above a single horizontally scrollable Genre row.
- [x] Keep the original year slider visible and verify dragging and filter application in Quick view.
- [x] Test all five category selections.

## Public AI search
- [x] Replace local discovery with the existing omni-search POST and map backend fields without UI or backend changes.
- [x] Test request headers, result mapping and failures; verify live public search in Quick view.

## Log achievement hint
- [x] Show "Attack on Titan Marathon" card (7/8) between rewatch and Save log when logging Attack on Titan; verified in Quick view.

## Public portfolio polish
- [x] Replace the generated README with the product problem, capabilities, setup and honest MVP boundaries.
- [x] Handle signup email confirmation and distinguish local reset from online account deletion.
- [x] Label sample activity and device-local storage in the app.
- [ ] Add cloud synchronization for logs, reviews, watchlists and favorites.
- [ ] Connect the Friends feed and friend management to authenticated backend data.
- [ ] Add session refresh, password recovery and server-side account deletion.
- [ ] Record a demo and capture real app screenshots after verifying the deployed build.
