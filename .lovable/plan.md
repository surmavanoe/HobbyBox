# Search suggestions shape + center plus

1. Search page suggestions: change the pills from fully round to softly rounded rectangles (small corner radius, about 10px). Orange tint and orange text stay the same.
2. Bottom bar center "+": remove the orange square behind it and show a large, thick orange plus on its own (drawn as two bold orange bars so it reads as heavy). Tap area stays 52x52 and still opens the Log screen; it dims slightly when pressed.

## Technical details
- `expo/app/(tabs)/search.tsx` line 94: `rounded-full` -> `rounded-[10px]`.
- `expo/app/(tabs)/_layout.tsx`: drop `rounded-2xl bg-primary`; render two `bg-primary` Views (e.g. 32x7 and 7x32, rounded-[2px]) centered instead of the Ionicon.
