// Engine types - Radio module
import { z } from 'zod';

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
