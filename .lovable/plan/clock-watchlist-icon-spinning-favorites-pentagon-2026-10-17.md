# Clock watchlist icon + spinning favorites pentagon

## 1. Watchlist icon becomes a clock
Replace the bookmark/banner icon everywhere it means "watchlist" with a clock ("Watch later" style):
- Title detail sheet "Add to watchlist" button (outline clock, filled clock when saved)
- Friends page "Add to watchlist" button (same on/off states)
- Profile Watchlist row badge
- Profile empty-state text: "Titles you add to your watchlist will show up here."

## 2. Favorites pentagon redesign
- Posters get noticeably larger (about 30% of the pentagon width instead of 20%), so they overlap.
- Depth effect: posters closer to the bottom (the "front") are drawn bigger and on top, so the two front posters partly cover the two side posters; the back poster is smallest.
- The pentagon outline and glowing corner dots stay, sized to the larger posters.

## 3. Slow clockwise spin
- The five posters slowly travel clockwise around the pentagon, one full turn about every 40 seconds, looping forever.
- Posters stay upright while moving (they orbit, they don't tip over), and the size/overlap order updates continuously as each one comes to the front.
- The outline turns with them. Tapping a poster still opens the "change favorite" picker.

## Technical details
- Icons: Ionicons `time` / `time-outline` in `DetailModal.tsx`, `friends.tsx`, `profile.tsx`.
- `Pentagon` in `profile.tsx`: drive an angle offset with Reanimated `useSharedValue` + `withRepeat(withTiming(2π, {duration: 40000, easing: linear}))`; each slot uses `useAnimatedStyle` computing left/top from the angle, `scale` from its y (0.8 back to 1.15 front), and `zIndex` from y. All animated properties (transform, position, zIndex) live only inside the animated style. Outline wrapper rotates with the same value.
- If Reanimated isn't already installed, use RN `Animated` with an interpolated loop instead (no new native dependency).
