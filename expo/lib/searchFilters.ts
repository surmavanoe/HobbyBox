import type { Media } from "./data";

export const RELEASE_DECADES = Array.from({ length: 9 }, (_, i) => 1940 + i * 10);
export const FILM_GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"];
export type RatingOrder = "best" | "worst" | null;
export interface SearchFilters {
  year: number | null;
  genre: string | null;
  ratingOrder: RatingOrder;
}
export const EMPTY_SEARCH_FILTERS: SearchFilters = { year: null, genre: null, ratingOrder: null };
export function yearsInDecade(decade: number) {
  return Array.from({ length: 10 }, (_, i) => decade + i);
}
export function applySearchFilters(items: Media[], filters: SearchFilters): Media[] {
  const result = items.filter((item) =>
    (filters.year === null || item.year === filters.year) &&
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