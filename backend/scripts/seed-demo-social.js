#!/usr/bin/env node
/**
 * Demo social data for HOBBYBOX.
 *
 * Creates five confirmed demo auth users, profiles, accepted friendships,
 * reviews, and library entries. Idempotent: rerunning replaces the demo rows.
 *
 * Run:
 *   npm run seed:social
 *
 * Demo login for the frontend:
 *   email:    demo@hobbybox.app
 *   password: hobbybox-demo
 *
 * Requires the P0 migration (profiles, library_entries, friendship status,
 * review visibility). Uses SUPABASE_SERVICE_ROLE_KEY, so run it locally only.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ENV_FILE = [process.env.ENV_FILE, ".env", "hobbybox.env"]
  .filter(Boolean)
  .map((candidate) =>
    path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate),
  )
  .find((candidate) => fs.existsSync(candidate));

dotenv.config({ path: ENV_FILE || path.resolve(process.cwd(), ".env"), quiet: true });

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.");
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "hobbybox-demo";
const USERS = [
  {
    email: process.env.DEMO_EMAIL || "demo@hobbybox.app",
    handle: "demo",
    displayName: "Alex Rivera",
    role: "demo",
  },
  { email: "alice@hobbybox.app", handle: "alice", displayName: "Alice", role: "friend" },
  { email: "sam@hobbybox.app", handle: "sam", displayName: "Sam", role: "friend" },
  { email: "maya@hobbybox.app", handle: "maya", displayName: "Maya", role: "friend" },
  { email: "leo@hobbybox.app", handle: "leo", displayName: "Leo", role: "friend" },
];

const REVIEW_TEXTS = [
  "Exactly the kind of story I wanted. The atmosphere carried the whole thing.",
  "Slow burn, but the payoff is worth it. Would recommend to a friend.",
  "Watched/read this in one sitting. The characters are the best part.",
  "Beautifully made. A few pacing issues, but I keep thinking about it.",
  "This is going straight into my favorites. The ending floored me.",
  "A cozy, satisfying pick. Perfect for a quiet weekend.",
  "Dark, strange, and completely engrossing. Not for everyone, but it is for me.",
  "The premise sounded ridiculous and then it worked. Big fan.",
];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(message) {
  console.log(message);
}

async function ensureUser(definition) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`auth.admin.listUsers: ${listError.message}`);

  const existing = list.users.find(
    (user) => user.email?.toLowerCase() === definition.email.toLowerCase(),
  );
  if (existing) {
    // Keep the documented demo password working on reruns.
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (updateError) {
      throw new Error(`updateUserById(${definition.email}): ${updateError.message}`);
    }
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: definition.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      handle: definition.handle,
      display_name: definition.displayName,
    },
  });
  if (error) throw new Error(`createUser(${definition.email}): ${error.message}`);
  if (!data.user) throw new Error(`createUser(${definition.email}) returned no user.`);
  return data.user;
}

async function main() {
  log("Creating demo auth users...");
  const users = {};
  for (const definition of USERS) {
    const user = await ensureUser(definition);
    users[definition.handle] = user;
    log(`  ${definition.handle.padEnd(6)} ${user.id}  ${definition.email}`);
  }

  const allIds = Object.values(users).map((user) => user.id);
  const demoId = users.demo.id;
  const friendHandles = ["alice", "sam", "maya", "leo"];
  const friendIds = friendHandles.map((handle) => users[handle].id);

  log("Upserting profiles...");
  const { error: profileError } = await supabase.from("profiles").upsert(
    USERS.map((definition) => ({
      id: users[definition.handle].id,
      handle: definition.handle,
      display_name: definition.displayName,
      avatar_url: null,
    })),
    { onConflict: "id" },
  );
  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  log("Loading media...");
  const { data: media, error: mediaError } = await supabase
    .from("media_items")
    .select("id, title, format, release_year, genres")
    .order("title", { ascending: true });
  if (mediaError) throw new Error(`media_items: ${mediaError.message}`);
  if (!media?.length) throw new Error("media_items is empty; run the catalog seed first.");

  function pick(format, count, genrePattern) {
    return media
      .filter((item) => item.format === format)
      .filter(
        (item) => !genrePattern || (item.genres || []).some((genre) => genrePattern.test(genre)),
      )
      .slice(0, count);
  }

  const selected = [
    ...pick("film", 4),
    ...pick("tv", 4),
    ...pick("anime", 4),
    ...pick("book", 4),
    ...pick("manga", 4),
  ];
  const sciFi = media
    .filter((item) => (item.genres || []).some((genre) => /sci-?fi|science fiction/i.test(genre)))
    .slice(0, 6);
  const reviewMedia = [...new Map([...selected, ...sciFi].map((item) => [item.id, item])).values()];
  log(
    `  ${reviewMedia.length} media selected across ${new Set(reviewMedia.map((m) => m.format)).size} formats`,
  );

  log("Resetting demo friendships, reviews, and library rows...");
  await supabase.from("friendships").delete().in("user_id", allIds);
  await supabase.from("friendships").delete().in("friend_id", allIds);
  await supabase.from("reviews").delete().in("user_id", allIds);
  await supabase.from("library_entries").delete().in("user_id", allIds);

  log("Creating accepted friendships...");
  const friendshipRows = [
    ...friendIds.map((friendId) => ({ user_id: demoId, friend_id: friendId, status: "accepted" })),
    { user_id: users.alice.id, friend_id: users.sam.id, status: "accepted" },
    { user_id: users.maya.id, friend_id: users.leo.id, status: "accepted" },
  ];
  const { error: friendshipError } = await supabase.from("friendships").insert(friendshipRows);
  if (friendshipError) throw new Error(`friendships: ${friendshipError.message}`);

  log("Creating friend reviews...");
  const reviewRows = [];
  for (const [index, item] of reviewMedia.entries()) {
    const reviewers = friendHandles.slice(0, 2 + (index % 2));
    for (const [reviewerIndex, handle] of reviewers.entries()) {
      reviewRows.push({
        user_id: users[handle].id,
        media_item_id: item.id,
        rating: reviewerIndex === 0 ? 5 : 4,
        content: REVIEW_TEXTS[(index + reviewerIndex) % REVIEW_TEXTS.length],
        visibility: "public",
        is_rewatch: false,
      });
    }
  }
  const { error: reviewError } = await supabase.from("reviews").insert(reviewRows);
  if (reviewError) throw new Error(`reviews: ${reviewError.message}`);

  log("Creating library entries...");
  const libraryRows = [];
  for (const [index, item] of reviewMedia.entries()) {
    libraryRows.push({
      user_id: demoId,
      media_item_id: item.id,
      status: index < 8 ? "completed" : index < 12 ? "in_progress" : "planned",
      rating: index < 8 ? 5 : index < 12 ? 4 : null,
      review: index < 8 ? REVIEW_TEXTS[index % REVIEW_TEXTS.length] : null,
      progress: index < 8 ? 100 : index < 12 ? 40 : 0,
    });
  }
  for (const handle of friendHandles) {
    for (const item of reviewMedia.slice(0, 6)) {
      libraryRows.push({
        user_id: users[handle].id,
        media_item_id: item.id,
        status: "completed",
        rating: 5,
        review: null,
        progress: 100,
      });
    }
  }
  const { error: libraryError } = await supabase
    .from("library_entries")
    .upsert(libraryRows, { onConflict: "user_id,media_item_id" });
  if (libraryError) throw new Error(`library_entries: ${libraryError.message}`);

  log("");
  log("Demo social data ready:");
  log(`  users:          ${USERS.length}`);
  log(`  friendships:    ${friendshipRows.length}`);
  log(`  reviews:        ${reviewRows.length}`);
  log(`  library rows:   ${libraryRows.length}`);
  log("");
  log("Demo login:");
  log(`  email:    ${USERS[0].email}`);
  log(`  password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(`Demo social seed failed: ${error.message}`);
  process.exitCode = 1;
});
