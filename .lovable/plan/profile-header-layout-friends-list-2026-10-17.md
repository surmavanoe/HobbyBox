# Profile header layout + friends list

## 1. Username on the banner

- The username pill moves up so it sits on the lower part of the banner, just to the right of the profile picture, with its bottom edge lined up with the bottom of the banner.
- the pill is removed and the white text has a slight undershadow so it doesnt blend with the banner

## 2. Friends link under the banner

- Below the banner, next to the profile picture, a plain text link shows "Friends" with the friend count beside it (for example "Friends 4"), the number in orange.
- Tapping the word or the number opens a new Friends list page.

## 3. Friends list page

- Header with a back arrow and the title "Friends".
- One row per friend: their picture and name, plus how many titles they've logged.
- Tapping a friend opens the Friends activity tab filtered to that person.
- If you have no friends yet, a short line explains this, with a button to browse friends' activity.

## 4. Quintuple moved up

- Less space above "Quintuple", so the heading and the spinning pentagon move up together, closer to the header.

## Technical details

- `profile.tsx`: the username pill gets absolute positioning inside the banner (bottom-aligned, left = avatar left + 92 + 12); avatar overlap row stays. Friends `Pressable` (min-h 44px) sits in the row to the right of the avatar below the banner; count = `FRIENDS.length` from `lib/data`.
- Reduce the `mt-6` above Quintuple to `mt-2` and trim pentagon top padding.
- New route `expo/app/friends-list.tsx` (stack screen, safe-area top inset on header, `FlatList` of `FRIENDS`, empty state). Row tap: `router.push({ pathname: "/friends", params: { who: id } })`; `friends.tsx` reads `who` from `useLocalSearchParams` as initial filter.