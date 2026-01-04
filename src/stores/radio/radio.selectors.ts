// Store - Radio Selectors (pure business logic)
import type { Station } from '@/engine/types';

/**
 * Filter stations based on search query, genre, bitrate, and online status.
 * Pure function with no side effects.
 */
export function selectFilteredStations(
  stations: Station[],
  searchQuery: string,
  selectedGenre: string | null,
  selectedBitrate: number | null,
  onlineOnly: boolean
): Station[] {
  let result = stations;

  // Text search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Genre filter
  if (selectedGenre) {
    const genre = selectedGenre.toLowerCase();
    result = result.filter(
      (s) =>
        s.genre === selectedGenre ||
        s.tags.some((t) => t.toLowerCase().includes(genre))
    );
  }

  // Bitrate filter
  if (selectedBitrate) {
    result = result.filter((s) => (s.bitrate ?? 0) >= selectedBitrate);
  }

  // Online only filter
  if (onlineOnly) {
    result = result.filter((s) => s.lastCheckOk !== false);
  }

  return result;
}

/**
 * Check if a station is in favorites list
 */
export function selectIsFavorite(favorites: Station[], stationId: string): boolean {
  return favorites.some((f) => f.id === stationId);
}

/**
 * Get unique genres from stations
 */
export function selectUniqueGenres(stations: Station[]): string[] {
  const genres = new Set<string>();
  for (const station of stations) {
    if (station.genre) {
      genres.add(station.genre);
    }
  }
  return Array.from(genres).sort();
}

/**
 * Get stations count by country
 */
export function selectStationsByCountry(stations: Station[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const station of stations) {
    const code = station.countryCode || 'unknown';
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}
