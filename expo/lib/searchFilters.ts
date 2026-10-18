import type { Category, Media } from "./data";

export const MIN_RELEASE_YEAR = 1940;
export const MAX_RELEASE_YEAR = 2027;
export type YearRange = [number, number];
export const FILM_GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"];
export type RatingOrder = "best" | "worst" | null;
export interface SearchFilters {
  categories: Category[];
  yearRange: YearRange | null;
  genre: string | null;
  ratingOrder: RatingOrder;
}
export const EMPTY_SEARCH_FILTERS: SearchFilters = { categories: [], yearRange: null, genre: null, ratingOrder: null };
export function moveYearHandle(range: YearRange, handle: 0 | 1, year: number): YearRange {
  const next = Math.max(MIN_RELEASE_YEAR, Math.min(MAX_RELEASE_YEAR, Math.round(year)));
  return handle === 0 ? [Math.min(next, range[1]), range[1]] : [range[0], Math.max(next, range[0])];
}
export function formatYearRange(range: YearRange): string {
  return range[0] === range[1] ? String(range[0]) : `${range[0]} – ${range[1]}`;
}
export function applySearchFilters(items: Media[], filters: SearchFilters): Media[] {
  const result = items.filter((item) =>
    (filters.categories.length === 0 || filters.categories.includes(item.category)) &&
    (filters.yearRange === null || (item.year >= filters.yearRange[0] && item.year <= filters.yearRange[1])) &&
    (filters.genre === null || item.genres.some((genre) => genre.toLowerCase() === filters.genre?.toLowerCase())),
  );
  if (filters.ratingOrder) {
    result.sort((a, b) => {
      // Missing ratings stay last; zero is not a consumer rating.
      if (!a.rating && b.rating) return 1;
      if (a.rating && !b.rating) return -1;
      const difference = filters.ratingOrder === "best" ? b.rating - a.rating : a.rating - b.rating;
      return difference || a.title.localeCompare(b.title);
    });
  }
  return result;
}