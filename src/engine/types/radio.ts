// Engine types - Radio module
import { z } from 'zod';

// Quality tier enum
export const QualityTierSchema = z.enum(['low', 'medium', 'high', 'hd']);
export type QualityTier = z.infer<typeof QualityTierSchema>;

// Extracted colors schema
export const ExtractedColorsSchema = z.object({
  dominant: z.string(),
  secondary: z.string(),
  isDark: z.boolean(),
});
export type ExtractedColors = z.infer<typeof ExtractedColorsSchema>;

// Zod schemas for validation
export const StationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  urlResolved: z.string().url().optional(),
  homepage: z.string().url().optional(),
  favicon: z.string().url().optional(),
  country: z.string(),
  countryCode: z.string().length(2).optional(),
  state: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).default([]),
  genre: z.string().optional(),
  bitrate: z.number().min(0).optional(),
  codec: z.string().optional(),
  votes: z.number().min(0).default(0),
  clickCount: z.number().min(0).default(0),
  clickTrend: z.number().default(0),
  lastCheckOk: z.boolean().default(true),
  lastCheckTime: z.string().datetime().optional(),
  geo: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }).optional(),
});

export type Station = z.infer<typeof StationSchema>;

// Enriched station with additional computed fields
export const EnrichedStationSchema = StationSchema.extend({
  // Color extraction from favicon
  colors: ExtractedColorsSchema.optional(),
  // Normalized popularity score 0-100
  popularityScore: z.number().min(0).max(100).default(0),
  // Popularity tier label
  popularityTier: z.enum(['underground', 'growing', 'popular', 'trending']).optional(),
  // Quality tier based on bitrate + codec
  qualityTier: QualityTierSchema.default('medium'),
  // Sub-genres derived from tags
  subGenres: z.array(z.string()).default([]),
  // Primary genre (normalized)
  primaryGenre: z.string().optional(),
  // Parsed location
  city: z.string().optional(),
  region: z.string().optional(),
  displayLocation: z.string().optional(),
  // Verification status
  isVerified: z.boolean().default(false),
});

export type EnrichedStation = z.infer<typeof EnrichedStationSchema>;

export const StationListSchema = z.array(StationSchema);

// Radio Browser API response schema
export const RadioBrowserStationSchema = z.object({
  stationuuid: z.string(),
  name: z.string(),
  url: z.string(),
  url_resolved: z.string().optional(),
  homepage: z.string().optional(),
  favicon: z.string().optional(),
  country: z.string(),
  countrycode: z.string().optional(),
  state: z.string().optional(),
  language: z.string().optional(),
  tags: z.string(),
  bitrate: z.number().optional(),
  codec: z.string().optional(),
  votes: z.number().optional(),
  clickcount: z.number().optional(),
  clicktrend: z.number().optional(),
  lastcheckok: z.number().optional(),
  lastchecktime: z.string().optional(),
  geo_lat: z.number().nullable().optional(),
  geo_long: z.number().nullable().optional(),
});

export type RadioBrowserStation = z.infer<typeof RadioBrowserStationSchema>;

// Player state
export interface PlayerState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  currentStation: Station | null;
  volume: number;
  muted: boolean;
  error: string | null;
  retryCount: number;
}

// Player metrics
export interface PlayerMetrics {
  playCount: number;
  errorCount: number;
  retryCount: number;
  totalPlayTime: number;
  lastPlayedAt: string | null;
  stationsPlayed: string[];
}

// Favorites
export const FavoriteSchema = z.object({
  stationId: z.string(),
  addedAt: z.string().datetime(),
  notes: z.string().optional(),
});

export type Favorite = z.infer<typeof FavoriteSchema>;

// Genre mapping
export const GENRE_MAP: Record<string, string> = {
  'pop': 'pop',
  'rock': 'rock',
  'jazz': 'jazz',
  'classical': 'classical',
  'electronic': 'electronic',
  'dance': 'electronic',
  'techno': 'electronic',
  'house': 'electronic',
  'hip hop': 'hiphop',
  'hip-hop': 'hiphop',
  'rap': 'hiphop',
  'country': 'country',
  'folk': 'country',
};

export function normalizeGenre(tags: string[]): string {
  const lowerTags = tags.map(t => t.toLowerCase());
  for (const tag of lowerTags) {
    if (GENRE_MAP[tag]) {
      return GENRE_MAP[tag];
    }
  }
  return 'other';
}
