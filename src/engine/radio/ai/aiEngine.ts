import type { Station } from '@/engine/types';
import {
  getRecommendations,
  searchByAmbience,
  searchByText,
  searchSimilarStations,
  type AmbienceType,
} from './searchAI';

export interface AIExplanation {
  summary: string;
  signals: string[];
}

export interface AIEngine {
  search: (query: string, stations: Station[], limit?: number) => Promise<Station[]>;
  searchByAmbience: (
    ambience: AmbienceType,
    stations: Station[],
    genre?: string
  ) => Promise<Station[]>;
  similar: (stationId: string, stations: Station[], limit?: number) => Promise<Station[]>;
  recommend: (
    recentHistory: Station[],
    favorites: Station[],
    allStations: Station[],
    limit?: number
  ) => Promise<Station[]>;
  explain: (station: Station, context?: { reason?: string }) => AIExplanation;
}

// AI engine is read-only: it never mutates stores or triggers playback.
export const aiEngine: AIEngine = {
  search: (query, stations, limit) => searchByText(query, stations, limit),
  searchByAmbience: (ambience, stations, genre) => searchByAmbience(ambience, stations, genre),
  similar: (stationId, stations, limit) => searchSimilarStations(stationId, stations, limit),
  recommend: (recentHistory, favorites, allStations, limit) =>
    getRecommendations(recentHistory, favorites, allStations, limit),
  explain: (station, context) => ({
    summary: `Suggestion basée sur vos écoutes récentes${context?.reason ? ` (${context.reason})` : ''}.`,
    signals: [
      station.genre ? `Genre: ${station.genre}` : 'Genre similaire',
      station.country ? `Pays: ${station.country}` : 'Pays similaire',
    ],
  }),
};
