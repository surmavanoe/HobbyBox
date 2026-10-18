# Posters, friend-aware suggestions, and the AI chat box

## 1. Hide titles without a poster
- Titles with no poster are left out everywhere titles are listed: Home rows, grids, Search results and AI results.
- AI results get the same check, so no blank cards slip through from there either.

## 2. Friend-aware suggestions
The AI already understands friend questions like "drama my friends rated 5 stars", but it only answers them for someone who is really signed in. Right now the app's sign-in only lives on the phone, so friend questions fail.
- The sign-in screen will use real accounts. The demo account (demo@hobbybox.app, which already has friends Alice, Sam, Maya and Leo with reviews) works out of the box.
- The AI search sends the signed-in person's session, so friend questions return real friend ratings.
- AI result cards show the friend context the AI returns, e.g. "Maya gave this 5 stars".
- New suggestions:
  - "Drama my friends rated 5 stars"
  - "Books my friends reviewed this month"
  - "Sci-fi anime my friends rated 4+"
  - "Something cozy like Frieren"
  - "A dark mind-bending sci-fi series"
- When signed out, friend questions show a short "Sign in to use your friends' ratings" message with a Sign in button.

## 3. AI assistant chat box
- The round orange AI button opens a small chat box that slides up from the bottom (not full screen), with a close button.
- You type a question and get the assistant's reply plus a row of tappable posters that open the title's detail sheet.
- Each question goes through the same AI search, so friend questions work there too. It answers "what should I watch / read" questions. It is not a general chatbot, and it does not remember earlier messages within a chat.
- Includes a short loading placeholder, a plain error message with Retry, and three starter suggestions when the chat is empty.

## Technical details
- `mapCatalogRow`/AI mapping keep only items with a non-empty cover (filter in `fetchCatalog` and `aiDiscover`); add tests.
- Install `@supabase/supabase-js` and friends via `bunx expo install` so the generated client at `expo/integrations/supabase/client.ts` appears; `auth.tsx` uses `signInWithPassword`/`signUp`, and the store mirrors the session into the account.
- `aiDiscover` uses the session access token for `Authorization` when one exists, otherwise the publishable key (existing test updated). Map `friend_name`/`friend_rating`.
- New `expo/components/AiChatSheet.tsx` (Modal, KeyboardAvoidingView, FlatList of messages); the FAB is enabled and opens it.
- Backend unchanged: no migrations, seeds or new keys.
