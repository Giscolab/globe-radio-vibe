import type { Station, EnrichedStation } from '@/engine/types';
import { buildAIDescriptor } from '@/engine/radio/enrichment/aiDescriptor';
import { enrichStationSync } from '@/engine/radio/enrichment/stationEnricher';

export type AmbienceType =
  | 'chill'
  | 'focus'
  | 'energetic'
  | 'relax'
  | 'night'
  | 'party'
  | 'acoustic'
  | 'vocal';

const AMBIENCE_QUERIES: Record<AmbienceType, string> = {
  chill: 'chill relaxing calm smooth lounge downtempo',
  focus: 'focus ambient instrumental concentration study minimal',
  energetic: 'energetic upbeat dance electronic house techno edm',
  relax: 'relaxing peaceful calm acoustic soft gentle soothing',
  night: 'night dark ambient chill downtempo late',
  party: 'party dance club house edm pop upbeat',
  acoustic: 'acoustic folk singer songwriter unplugged live stripped',
  vocal: 'vocal jazz soul rnb pop singer crooner smooth',
};

type DescriptorEntry = {
  station: Station;
  descriptor: string;
  tokens: Set<string>;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'avec',
  'by',
  'de',
  'des',
  'du',
  'for',
  'fm',
  'in',
  'la',
  'le',
  'les',
  'music',
  'of',
  'radio',
  'station',
  'stations',
  'the',
  'to',
  'une',
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9&+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildDescriptorEntry(station: Station): DescriptorEntry {
  const enriched = enrichStationSync(station, {
    calculatePopularity: true,
    mapGenres: true,
    parseLocation: true,
    useCache: true,
  });
  const descriptor = buildAIDescriptor(enriched);
  return {
    station,
    descriptor,
    tokens: new Set(tokenize(descriptor)),
  };
}

function scoreDescriptor(entry: DescriptorEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  let score = 0;
  const descriptorLower = entry.descriptor.toLowerCase();
  const station = entry.station;

  for (const token of queryTokens) {
    if (entry.tokens.has(token)) {
      score += 3;
    }

    if (station.name.toLowerCase().includes(token)) {
      score += 5;
    }

    if (station.country.toLowerCase().includes(token)) {
      score += 2;
    }

    if (station.language?.toLowerCase().includes(token)) {
      score += 2;
    }

    if (descriptorLower.includes(token)) {
      score += 1;
    }
  }

  score += Math.min(2, (station.votes ?? 0) / 500);
  score += Math.min(2, (station.clickCount ?? 0) / 1000);

  return score;
}

function rankStations(query: string, stations: Station[], limit: number): Station[] {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    return [];
  }

  return stations
    .map((station) => {
      const descriptorEntry = buildDescriptorEntry(station);
      return {
        station,
        score: scoreDescriptor(descriptorEntry, queryTokens),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftPopularity = (left.station.clickCount ?? 0) + (left.station.votes ?? 0);
      const rightPopularity = (right.station.clickCount ?? 0) + (right.station.votes ?? 0);
      return rightPopularity - leftPopularity;
    })
    .slice(0, limit)
    .map((entry) => entry.station);
}

function buildSimilarityQuery(station: Station): string {
  const enriched = enrichStationSync(station, {
    calculatePopularity: true,
    mapGenres: true,
    parseLocation: true,
    useCache: true,
  });

  const parts = [
    station.country,
    station.language,
    enriched.primaryGenre,
    ...(enriched.subGenres || []).slice(0, 4),
    ...(station.tags || []).slice(0, 4),
  ].filter(Boolean);

  return parts.join(' ');
}

export async function searchByText(
  query: string,
  stations: Station[],
  limit = 20
): Promise<Station[]> {
  return rankStations(query, stations, limit);
}

export async function searchSimilarStations(
  stationId: string,
  stations: Station[],
  limit = 10
): Promise<Station[]> {
  const baseStation = stations.find((station) => station.id === stationId);
  if (!baseStation) {
    return [];
  }

  return rankStations(buildSimilarityQuery(baseStation), stations.filter((station) => station.id !== stationId), limit);
}

export async function getRecommendations(
  recentHistory: Station[],
  favorites: Station[],
  allStations: Station[],
  limit = 10
): Promise<Station[]> {
  const preferredGenres = new Set<string>();
  const preferredCountries = new Set<string>();

  for (const station of [...recentHistory.slice(0, 5), ...favorites.slice(0, 5)]) {
    if (station.genre) {
      preferredGenres.add(station.genre);
    }
    if (station.country) {
      preferredCountries.add(station.country);
    }
    station.tags?.slice(0, 3).forEach((tag) => preferredGenres.add(tag));
  }

  if (preferredGenres.size === 0 && preferredCountries.size === 0) {
    return [...allStations]
      .sort((left, right) => ((right.clickCount ?? 0) + (right.votes ?? 0)) - ((left.clickCount ?? 0) + (left.votes ?? 0)))
      .slice(0, limit);
  }

  const query = [
    ...Array.from(preferredGenres).slice(0, 5),
    ...Array.from(preferredCountries).slice(0, 2),
  ].join(' ');

  return searchByText(query, allStations, limit);
}

export async function searchByAmbience(
  ambience: AmbienceType,
  stations: Station[],
  genre?: string
): Promise<Station[]> {
  const baseQuery = AMBIENCE_QUERIES[ambience] ?? ambience;
  const query = genre ? `${genre} ${baseQuery}` : baseQuery;
  return searchByText(query, stations, 20);
}

export async function syncEmbeddings(_stations: EnrichedStation[]): Promise<boolean> {
  return true;
}
