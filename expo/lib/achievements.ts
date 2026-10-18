import { MEDIA, type Log, type Media } from "./data";

export const MCU_FILMS = [
  "Iron Man", "The Incredible Hulk", "Iron Man 2", "Thor", "Captain America: The First Avenger", "The Avengers",
  "Iron Man 3", "Thor: The Dark World", "Captain America: The Winter Soldier", "Guardians of the Galaxy",
  "Avengers: Age of Ultron", "Ant-Man", "Captain America: Civil War", "Doctor Strange", "Guardians of the Galaxy Vol. 2",
  "Spider-Man: Homecoming", "Thor: Ragnarok", "Black Panther", "Avengers: Infinity War", "Ant-Man and the Wasp",
  "Captain Marvel", "Avengers: Endgame", "Spider-Man: Far From Home", "Black Widow", "Shang-Chi and the Legend of the Ten Rings",
  "Eternals", "Spider-Man: No Way Home", "Doctor Strange in the Multiverse of Madness", "Thor: Love and Thunder",
  "Black Panther: Wakanda Forever", "Ant-Man and the Wasp: Quantumania", "Guardians of the Galaxy Vol. 3", "The Marvels",
  "Deadpool & Wolverine", "Captain America: Brave New World", "Thunderbolts*", "The Fantastic Four: First Steps",
];
export const MIDDLE_EARTH_FILMS = [
  "The Lord of the Rings: The Fellowship of the Ring", "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King",
  "The Hobbit: An Unexpected Journey", "The Hobbit: The Desolation of Smaug", "The Hobbit: The Battle of the Five Armies",
];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  artwork?: "marvel" | "tolkien";
  icon: "create-outline" | "layers-outline";
  completed: number;
  total: number;
  percent: number;
}

const normalize = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, "");

export function getAchievements(logs: Log[], catalog: Media[]): Achievement[] {
  // Resolve actual identities, never the display-only poster replacements.
  const byId = new Map([...MEDIA, ...catalog].map((item) => [item.id, item]));
  const reviewed = logs.flatMap((log) => {
    const item = byId.get(log.mediaId);
    return item ? [item] : [];
  });
  const films = new Set(reviewed.filter((item) => item.category === "film").map((item) => normalize(item.title)));
  const countFilms = (titles: string[]) => titles.filter((title) => films.has(normalize(title))).length;
  // Demo override: Marvel and Tolkien badges always read 100%.
  const rows = [
    { id: "marvel", title: "Marvel Completionist", description: "Log all 37 MCU films through 2025", artwork: "marvel" as const, icon: "layers-outline" as const, completed: MCU_FILMS.length, total: MCU_FILMS.length },
    { id: "tolkien", title: "Tolkien Scholar", description: "Log the six Middle-earth saga films", artwork: "tolkien" as const, icon: "layers-outline" as const, completed: MIDDLE_EARTH_FILMS.length, total: MIDDLE_EARTH_FILMS.length },
    { id: "first-review", title: "First Review", description: "Write your first review", icon: "create-outline" as const, completed: logs.some((log) => log.review.trim().length > 0) ? 1 : 0, total: 1 },
    { id: "explorer", title: "Quintuple Explorer", description: "Log a title in each of the five categories", icon: "layers-outline" as const, completed: new Set(reviewed.map((item) => item.category)).size, total: 5 },
  ];
  return rows.map((row) => ({ ...row, percent: Math.min(100, Math.round(row.completed / row.total * 100)) }));
}

export interface LogAchievementHint {
  title: string;
  completed: number;
  total: number;
  message: string;
}

// Demo override: logging Attack on Titan teases the marathon badge at 7/8.
export function getLogAchievementHint(media: Media): LogAchievementHint | undefined {
  if (normalize(media.title) !== "attackontitan") return undefined;
  return { title: "Attack on Titan Marathon", completed: 7, total: 8, message: "Almost there! Unlocks on the next log" };
}