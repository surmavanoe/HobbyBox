import covers from "./covers.json";

export type Category = "film" | "tv" | "anime" | "manga" | "book";

export const CATEGORIES: { key: Category; label: string; icon: string; plural: string }[] = [
  { key: "film", label: "Films", icon: "film-outline", plural: "Films" },
  { key: "tv", label: "TV", icon: "tv-outline", plural: "TV Shows" },
  { key: "anime", label: "Anime", icon: "sparkles-outline", plural: "Anime" },
  { key: "manga", label: "Manga/Comics", icon: "chatbubbles-outline", plural: "Manga & Comics" },
  { key: "book", label: "Books", icon: "book-outline", plural: "Books" },
];

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.key === c)!.label;
export const categoryIcon = (c: Category) => CATEGORIES.find((x) => x.key === c)!.icon;

// "Popular this week" covers everything when no category is picked, otherwise it names the category.
export const popularTitle = (filters: (Category | "all")[]) => {
  const cats = filters.filter((f): f is Category => f !== "all");
  return cats.length === 1 ? `${categoryLabel(cats[0])} popular this week` : "Popular this week";
};

// Ranks titles by how many words from recent searches they contain; unmatched titles keep catalog order.
export function rankByRecentSearches(items: Media[], searches: string[]): Media[] {
  const words = [...new Set(searches.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))];
  if (!words.length) return items;
  const score = (m: Media) => { const t = `${m.title} ${m.genres.join(" ")} ${m.synopsis}`.toLowerCase(); return words.filter((w) => t.includes(w)).length; };
  return items.map((m, i) => ({ m, s: score(m), i })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.m);
}

export interface Media {
  id: string;
  title: string;
  category: Category;
  year: number;
  creator: string;
  cover: string;
  rating: number; // community avg 0-5
  genres: string[];
  synopsis: string;
  logs: number;
  trendingRank?: number;
  friendNote?: string;
}

const c = (k: string) => ((covers as Record<string, string>)[k] ?? "") as string;

export const MEDIA: Media[] = [
  // Films
  { id: "f1", title: "Dune: Part Two", category: "film", year: 2024, creator: "Denis Villeneuve", cover: c("Dune Part Two"), rating: 4.6, genres: ["sci-fi", "epic", "desert", "adventure"], synopsis: "Paul Atreides unites with the Fremen to wage war against the conspirators who destroyed his family.", logs: 2400000 },
  { id: "f2", title: "Oppenheimer", category: "film", year: 2023, creator: "Christopher Nolan", cover: c("Oppenheimer"), rating: 4.4, genres: ["drama", "history", "biopic"], synopsis: "The story of J. Robert Oppenheimer and the creation of the atomic bomb.", logs: 2900000 },
  { id: "f3", title: "Past Lives", category: "film", year: 2023, creator: "Celine Song", cover: c("Past Lives"), rating: 4.3, genres: ["romance", "drama", "slow", "emotional"], synopsis: "Two childhood friends reunite decades later and confront notions of love and destiny.", logs: 980000 },
  { id: "f4", title: "Everything Everywhere All at Once", category: "film", year: 2022, creator: "Daniels", cover: c("Everything Everywhere All at Once"), rating: 4.5, genres: ["sci-fi", "comedy", "multiverse", "family", "emotional"], synopsis: "A laundromat owner is swept into a multiverse adventure where only she can save existence.", logs: 2100000 },
  { id: "f5", title: "Parasite", category: "film", year: 2019, creator: "Bong Joon-ho", cover: c("Parasite"), rating: 4.6, genres: ["thriller", "dark", "comedy", "class"], synopsis: "A poor family schemes its way into the lives of a wealthy household, with shocking results.", logs: 3200000 },
  { id: "f6", title: "Interstellar", category: "film", year: 2014, creator: "Christopher Nolan", cover: c("Interstellar"), rating: 4.5, genres: ["sci-fi", "space", "emotional", "epic"], synopsis: "Explorers travel through a wormhole in search of a new home for humanity.", logs: 3500000 },
  { id: "f7", title: "Spirited Away", category: "film", year: 2001, creator: "Hayao Miyazaki", cover: c("Spirited Away"), rating: 4.7, genres: ["fantasy", "animation", "cozy", "adventure"], synopsis: "A young girl wanders into a world of spirits and must free herself and her parents.", logs: 2700000 },
  { id: "f8", title: "Arrival", category: "film", year: 2016, creator: "Denis Villeneuve", cover: c("Arrival"), rating: 4.3, genres: ["sci-fi", "slow", "emotional", "mystery"], synopsis: "A linguist races to communicate with mysterious visitors before tensions boil over.", logs: 1500000 },
  { id: "f9", title: "Whiplash", category: "film", year: 2014, creator: "Damien Chazelle", cover: c("Whiplash"), rating: 4.5, genres: ["drama", "music", "intense"], synopsis: "A young drummer is pushed to his limits by a ruthless instructor.", logs: 2000000 },
  { id: "f10", title: "La La Land", category: "film", year: 2016, creator: "Damien Chazelle", cover: c("La La Land"), rating: 4.1, genres: ["romance", "music", "drama"], synopsis: "A jazz pianist and an aspiring actress fall in love while chasing their dreams in LA.", logs: 2300000 },
  // TV
  { id: "t1", title: "The Bear", category: "tv", year: 2022, creator: "Christopher Storer", cover: c("The Bear"), rating: 4.5, genres: ["drama", "comedy", "intense", "food"], synopsis: "A fine-dining chef returns home to run his family's chaotic sandwich shop.", logs: 1200000, trendingRank: 2 },
  { id: "t2", title: "Severance", category: "tv", year: 2022, creator: "Dan Erickson", cover: c("Severance"), rating: 4.7, genres: ["sci-fi", "mystery", "thriller", "dark"], synopsis: "Office workers have their work and personal memories surgically divided.", logs: 1800000, trendingRank: 1 },
  { id: "t3", title: "Succession", category: "tv", year: 2018, creator: "Jesse Armstrong", cover: c("Succession"), rating: 4.6, genres: ["drama", "family", "dark", "comedy"], synopsis: "The Roy family fights for control of a global media empire.", logs: 1400000, trendingRank: 5 },
  { id: "t4", title: "Breaking Bad", category: "tv", year: 2008, creator: "Vince Gilligan", cover: c("Breaking Bad"), rating: 4.8, genres: ["crime", "drama", "dark", "thriller"], synopsis: "A chemistry teacher turned drug manufacturer descends into the criminal underworld.", logs: 4100000 },
  { id: "t5", title: "Shōgun", category: "tv", year: 2024, creator: "Rachel Kondo & Justin Marks", cover: c("Shogun"), rating: 4.6, genres: ["history", "epic", "drama", "japan"], synopsis: "An English sailor is shipwrecked in feudal Japan and caught in a deadly power struggle.", logs: 950000, trendingRank: 3 },
  { id: "t6", title: "The Last of Us", category: "tv", year: 2023, creator: "Craig Mazin", cover: c("The Last of Us"), rating: 4.4, genres: ["drama", "post-apocalyptic", "emotional", "dark"], synopsis: "A smuggler escorts a teenage girl across a ruined America.", logs: 1700000, trendingRank: 4 },
  { id: "t7", title: "Arcane", category: "tv", year: 2021, creator: "Christian Linke", cover: c("Arcane"), rating: 4.8, genres: ["animation", "fantasy", "action", "sisters"], synopsis: "Two sisters end up on opposite sides of a war between utopian Piltover and the undercity.", logs: 1300000, trendingRank: 6 },
  { id: "t8", title: "Dark", category: "tv", year: 2017, creator: "Baran bo Odar", cover: c("Dark"), rating: 4.6, genres: ["sci-fi", "mystery", "time travel", "dark"], synopsis: "A missing child sets four families on a frantic hunt across generations of time.", logs: 900000 },
  { id: "t9", title: "Fleabag", category: "tv", year: 2016, creator: "Phoebe Waller-Bridge", cover: c("Fleabag"), rating: 4.6, genres: ["comedy", "drama", "short"], synopsis: "A dry-witted woman navigates life and love in London while coping with tragedy.", logs: 850000 },
  { id: "t10", title: "Fallout", category: "tv", year: 2024, creator: "Jonathan Nolan & Lisa Joy", cover: c("Fallout"), rating: 4.3, genres: ["post-apocalyptic", "action", "comedy"], synopsis: "Vault dwellers emerge into a retro-futuristic wasteland 200 years after the bombs.", logs: 1100000, trendingRank: 7 },
  // Anime
  { id: "a1", title: "Frieren: Beyond Journey's End", category: "anime", year: 2023, creator: "Madhouse", cover: c("A:Frieren"), rating: 4.8, genres: ["fantasy", "cozy", "slow", "emotional", "adventure"], synopsis: "An elf mage reflects on mortality and friendship after her hero party's quest ends.", logs: 760000 },
  { id: "a2", title: "Attack on Titan", category: "anime", year: 2013, creator: "Wit Studio / MAPPA", cover: c("A:Attack on Titan"), rating: 4.6, genres: ["action", "dark", "war", "mystery"], synopsis: "Humanity fights for survival against giant man-eating Titans.", logs: 2200000 },
  { id: "a3", title: "Cowboy Bebop", category: "anime", year: 1998, creator: "Sunrise", cover: c("A:Cowboy Bebop"), rating: 4.7, genres: ["sci-fi", "space", "noir", "jazz"], synopsis: "A ragtag crew of bounty hunters drifts through the solar system.", logs: 980000 },
  { id: "a4", title: "Jujutsu Kaisen", category: "anime", year: 2020, creator: "MAPPA", cover: c("A:Jujutsu Kaisen"), rating: 4.4, genres: ["action", "supernatural", "dark"], synopsis: "A teen swallows a cursed finger and joins a school of sorcerers.", logs: 1600000 },
  { id: "a5", title: "Demon Slayer", category: "anime", year: 2019, creator: "ufotable", cover: c("A:Demon Slayer"), rating: 4.4, genres: ["action", "family", "supernatural"], synopsis: "A boy becomes a demon slayer to cure his sister and avenge his family.", logs: 1900000 },
  { id: "a6", title: "Fullmetal Alchemist: Brotherhood", category: "anime", year: 2009, creator: "Bones", cover: c("A:Fullmetal Alchemist Brotherhood"), rating: 4.9, genres: ["fantasy", "adventure", "brothers", "action"], synopsis: "Two brothers search for the Philosopher's Stone to restore their bodies.", logs: 2000000 },
  { id: "a7", title: "Spy x Family", category: "anime", year: 2022, creator: "Wit Studio / CloverWorks", cover: c("A:Spy x Family"), rating: 4.4, genres: ["comedy", "family", "cozy", "action"], synopsis: "A spy, an assassin and a telepath form a fake family—each hiding secrets.", logs: 1100000 },
  { id: "a8", title: "Chainsaw Man", category: "anime", year: 2022, creator: "MAPPA", cover: c("A:Chainsaw Man"), rating: 4.3, genres: ["action", "dark", "gore", "comedy"], synopsis: "A broke teen merges with his chainsaw devil dog and becomes a devil hunter.", logs: 1200000 },
  // Manga / Comics
  { id: "m1", title: "Berserk", category: "manga", year: 1989, creator: "Kentaro Miura", cover: c("M:Berserk"), rating: 4.9, genres: ["dark", "fantasy", "epic", "action"], synopsis: "A lone mercenary battles demons and fate in a brutal medieval world.", logs: 640000 },
  { id: "m2", title: "Vagabond", category: "manga", year: 1998, creator: "Takehiko Inoue", cover: c("M:Vagabond"), rating: 4.8, genres: ["history", "samurai", "slow", "japan"], synopsis: "A fictional retelling of the life of swordsman Miyamoto Musashi.", logs: 410000 },
  { id: "m3", title: "One Piece", category: "manga", year: 1997, creator: "Eiichiro Oda", cover: c("M:One Piece"), rating: 4.7, genres: ["adventure", "comedy", "epic", "pirates"], synopsis: "Monkey D. Luffy sets sail to find the legendary One Piece treasure.", logs: 1500000 },
  { id: "m4", title: "Monster", category: "manga", year: 1994, creator: "Naoki Urasawa", cover: c("M:Monster"), rating: 4.8, genres: ["thriller", "mystery", "dark", "crime"], synopsis: "A surgeon hunts the former patient he saved who became a serial killer.", logs: 380000 },
  { id: "m5", title: "Watchmen", category: "manga", year: 1986, creator: "Alan Moore & Dave Gibbons", cover: c("M:Watchmen"), rating: 4.6, genres: ["superhero", "dark", "mystery", "comic"], synopsis: "Retired vigilantes investigate the murder of one of their own.", logs: 720000 },
  { id: "m6", title: "Saga", category: "manga", year: 2012, creator: "Brian K. Vaughan & Fiona Staples", cover: c("M:Saga"), rating: 4.5, genres: ["sci-fi", "space", "romance", "family", "comic"], synopsis: "Lovers from warring alien races fight to raise their daughter.", logs: 450000 },
  { id: "m7", title: "Vinland Saga", category: "manga", year: 2005, creator: "Makoto Yukimura", cover: c("M:Vinland Saga"), rating: 4.8, genres: ["history", "war", "vikings", "emotional"], synopsis: "A young Viking seeks revenge, then a life beyond violence.", logs: 520000 },
  { id: "m8", title: "Dandadan", category: "manga", year: 2021, creator: "Yukinobu Tatsu", cover: c("M:Dandadan"), rating: 4.5, genres: ["supernatural", "comedy", "action", "romance"], synopsis: "A girl who believes in ghosts and a boy who believes in aliens discover both are real.", logs: 610000 },
  // Books
  { id: "b1", title: "Project Hail Mary", category: "book", year: 2021, creator: "Andy Weir", cover: c("B:Project Hail Mary"), rating: 4.7, genres: ["sci-fi", "space", "funny", "friendship"], synopsis: "A lone astronaut wakes with no memory and must save Earth from an extinction-level threat.", logs: 890000 },
  { id: "b2", title: "Tomorrow, and Tomorrow, and Tomorrow", category: "book", year: 2022, creator: "Gabrielle Zevin", cover: c("B:Tomorrow and Tomorrow and Tomorrow"), rating: 4.3, genres: ["literary", "friendship", "games", "emotional"], synopsis: "Two friends build video games together over three decades of love and loss.", logs: 640000 },
  { id: "b3", title: "Dune", category: "book", year: 1965, creator: "Frank Herbert", cover: c("B:Dune Frank Herbert"), rating: 4.5, genres: ["sci-fi", "epic", "desert", "politics"], synopsis: "A noble family takes control of the desert planet Arrakis, source of the universe's most precious spice.", logs: 1300000 },
  { id: "b4", title: "The Midnight Library", category: "book", year: 2020, creator: "Matt Haig", cover: c("B:The Midnight Library"), rating: 4.0, genres: ["fantasy", "emotional", "short", "cozy"], synopsis: "Between life and death is a library holding every life you could have lived.", logs: 1100000 },
  { id: "b5", title: "Klara and the Sun", category: "book", year: 2021, creator: "Kazuo Ishiguro", cover: c("B:Klara and the Sun"), rating: 4.1, genres: ["sci-fi", "literary", "slow", "emotional"], synopsis: "An Artificial Friend observes the humans around her with wonder.", logs: 520000 },
  { id: "b6", title: "Piranesi", category: "book", year: 2020, creator: "Susanna Clarke", cover: c("B:Piranesi"), rating: 4.4, genres: ["fantasy", "mystery", "short", "cozy"], synopsis: "A man lives in an infinite house of statues and tides—until clues reveal the truth.", logs: 480000 },
  { id: "b7", title: "The Hobbit", category: "book", year: 1937, creator: "J.R.R. Tolkien", cover: c("B:The Hobbit"), rating: 4.6, genres: ["fantasy", "adventure", "cozy", "classic"], synopsis: "Bilbo Baggins is swept into a quest to reclaim a dwarf kingdom from a dragon.", logs: 2100000 },
  { id: "b8", title: "Normal People", category: "book", year: 2018, creator: "Sally Rooney", cover: c("B:Normal People Sally Rooney"), rating: 4.0, genres: ["romance", "literary", "emotional"], synopsis: "Two Irish teens drift together and apart through school and university.", logs: 900000 },
  { id: "b9", title: "Circe", category: "book", year: 2018, creator: "Madeline Miller", cover: c("B:Circe Madeline Miller"), rating: 4.4, genres: ["fantasy", "mythology", "emotional"], synopsis: "The witch of Aiaia tells her own story among gods and mortals.", logs: 1000000 },
  { id: "b10", title: "The Name of the Wind", category: "book", year: 2007, creator: "Patrick Rothfuss", cover: c("B:The Name of the Wind"), rating: 4.5, genres: ["fantasy", "adventure", "epic", "music"], synopsis: "Kvothe recounts his journey from gifted child to legendary wizard.", logs: 950000 },
];

let databaseCatalog: Media[] = [];
let posterSubstitutes = new Map<string, Media>();
export function setDatabaseCatalog(items: Media[]) {
  databaseCatalog = items;
  posterSubstitutes = buildPosterSubstitutes(MEDIA, items);
}
// Demo items without a poster are swapped for a distinct same-category catalog item that has one.
export function buildPosterSubstitutes(seed: Media[], catalog: Media[]) {
  const map = new Map<string, Media>();
  const used = new Set(seed.map((m) => m.title.toLowerCase()));
  for (const m of seed) {
    if (m.cover) continue;
    const pick = catalog.find((c) => c.cover && !used.has(c.title.toLowerCase()) && c.category === m.category)
      ?? catalog.find((c) => c.cover && !used.has(c.title.toLowerCase()));
    if (pick) { used.add(pick.title.toLowerCase()); map.set(m.id, pick); }
  }
  return map;
}
// Legacy demo IDs still resolve so saved logs and favorites are not lost.
export const mediaById = (id: string) => {
  const db = databaseCatalog.find((m) => m.id === id);
  if (db) return db;
  const seed = MEDIA.find((m) => m.id === id);
  if (seed && !seed.cover) return posterSubstitutes.get(id) ?? seed;
  return seed;
};

export interface Friend {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export const FRIENDS: Friend[] = [
  { id: "sarah", name: "Sarah", handle: "@sarahreads", avatar: "https://i.pravatar.cc/150?img=47" },
  { id: "leo", name: "Leo", handle: "@leowatches", avatar: "https://i.pravatar.cc/150?img=12" },
  { id: "alex", name: "Alex", handle: "@alexanime", avatar: "https://i.pravatar.cc/150?img=33" },
  { id: "emma", name: "Emma", handle: "@emmalogs", avatar: "https://i.pravatar.cc/150?img=44" },
];
export const friendById = (id: string) => FRIENDS.find((f) => f.id === id)!;

export interface Log {
  id: string;
  userId: string; // "me" or friend id
  mediaId: string;
  rating: number;
  review: string;
  rewatch: boolean;
  createdAt: number;
  likes: number;
}

const H = 3600 * 1000;
const now = Date.now();
export const FRIEND_LOGS: Log[] = [
  { id: "l1", userId: "sarah", mediaId: "b1", rating: 5, review: "Rocky is the best character I've met in years. Cried, laughed, cried again.", rewatch: false, createdAt: now - 1 * H, likes: 24 },
  { id: "l2", userId: "leo", mediaId: "f1", rating: 5, review: "IMAX was shaking. Villeneuve does it again.", rewatch: true, createdAt: now - 3 * H, likes: 41 },
  { id: "l3", userId: "alex", mediaId: "a1", rating: 5, review: "The most beautiful meditation on time in any anime.", rewatch: false, createdAt: now - 5 * H, likes: 33 },
  { id: "l4", userId: "emma", mediaId: "t2", rating: 4, review: "Season 2 finale had me yelling at the screen.", rewatch: false, createdAt: now - 8 * H, likes: 18 },
  { id: "l5", userId: "alex", mediaId: "m1", rating: 5, review: "The Eclipse arc is untouchable.", rewatch: true, createdAt: now - 12 * H, likes: 27 },
  { id: "l6", userId: "sarah", mediaId: "f3", rating: 5, review: "Quiet, devastating, perfect.", rewatch: false, createdAt: now - 20 * H, likes: 15 },
  { id: "l7", userId: "leo", mediaId: "t1", rating: 4, review: "Yes chef. Anxiety in TV form.", rewatch: false, createdAt: now - 26 * H, likes: 12 },
  { id: "l8", userId: "emma", mediaId: "b9", rating: 4, review: "Gorgeous prose. Made me want to reread the Odyssey.", rewatch: false, createdAt: now - 30 * H, likes: 9 },
  { id: "l9", userId: "leo", mediaId: "f5", rating: 5, review: "Every frame is planned. Masterpiece.", rewatch: true, createdAt: now - 40 * H, likes: 22 },
  { id: "l10", userId: "sarah", mediaId: "f4", rating: 5, review: "Hot dog fingers made me sob. 10/10.", rewatch: false, createdAt: now - 50 * H, likes: 30 },
  { id: "l11", userId: "emma", mediaId: "f6", rating: 4, review: "The docking scene. That's it. That's the review.", rewatch: true, createdAt: now - 60 * H, likes: 14 },
  { id: "l12", userId: "alex", mediaId: "f7", rating: 5, review: "Comfort film forever.", rewatch: true, createdAt: now - 70 * H, likes: 19 },
  { id: "l13", userId: "alex", mediaId: "t7", rating: 5, review: "Animation will never be the same.", rewatch: false, createdAt: now - 80 * H, likes: 25 },
];

export const MY_SEED_LOGS: Log[] = [
  { id: "me1", userId: "me", mediaId: "a6", rating: 5, review: "Perfect ending.", rewatch: true, createdAt: now - 2 * 24 * H, likes: 3 },
  { id: "me2", userId: "me", mediaId: "b3", rating: 4, review: "Dense but rewarding.", rewatch: false, createdAt: now - 4 * 24 * H, likes: 1 },
  { id: "me3", userId: "me", mediaId: "t4", rating: 5, review: "Still the GOAT.", rewatch: true, createdAt: now - 6 * 24 * H, likes: 5 },
  { id: "me4", userId: "me", mediaId: "m4", rating: 5, review: "Johan is terrifying.", rewatch: false, createdAt: now - 8 * 24 * H, likes: 2 },
  { id: "me5", userId: "me", mediaId: "f8", rating: 4, review: "", rewatch: false, createdAt: now - 10 * 24 * H, likes: 0 },
];

export const DEFAULT_FAVORITES: Record<Category, string> = {
  film: "f5",
  tv: "t4",
  anime: "a6",
  manga: "m1",
  book: "b7",
};

export const RECENT_SEARCHES = ["sci-fi", "fantasy", "emotional"];

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function timeAgo(t: number) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
