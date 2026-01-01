import type { Station } from '@/engine/types';
import { audioEngine } from '@/engine/player/audioEngine';
import { getHealthTier } from '@/engine/radio/health';
import { getSqliteRepository, type AISignalRecord, type AISignalType, type PlayHistoryRecord } from '@/engine/storage/sqlite/stationRepository';
import { useAIStore } from '@/stores/ai.store';
import { useGeoStore } from '@/stores/geo.store';
import { useRadioStore } from '@/stores/radio';
import {
  searchByAmbience,
  searchByText,
  searchSimilarStations,
  type AmbienceType,
} from './searchAI';

export type UserIntent = 'focus' | 'chill' | 'discover' | 'unknown';

export interface ContextSnapshot {
  countryCode: string | null;
  country: string | null;
  hour: number;
  isMobile: boolean;
  query: string;
  mode: 'text' | 'smart';
  isPlaying: boolean;
  lastStationId: string | null;
  intent: UserIntent;
}

export interface UserSignals {
  favorites: Station[];
  history: PlayHistoryRecord[];
  recentPlays: AISignalRecord[];
  recentSkips: AISignalRecord[];
  recentErrors: AISignalRecord[];
}

export interface AIExplanation {
  summary: string;
  signals: string[];
}

export interface AIRecommendationResult {
  stations: Station[];
  explanations: Record<string, AIExplanation>;
}

export interface RecommendOptions {
  stations?: Station[];
  limit?: number;
  query?: string;
  mode?: 'text' | 'smart';
}

export interface AIEngine {
  search: (query: string, stations: Station[], limit?: number) => Promise<Station[]>;
  searchByAmbience: (
    ambience: AmbienceType,
    stations: Station[],
    genre?: string
  ) => Promise<Station[]>;
  similar: (stationId: string, stations: Station[], limit?: number) => Promise<Station[]>;
  recommend: (query?: string, options?: RecommendOptions) => AIRecommendationResult;
  explain: (station: Station, context?: { reason?: string }) => AIExplanation;
  getContext: () => ContextSnapshot;
  getUserSignals: () => UserSignals;
  invalidateCache: () => void;
}

const RECOMMENDATION_TTL_MS = 5 * 60 * 1000;
const recommendationCache = new Map<string, { timestamp: number; result: AIRecommendationResult }>();

const intentKeywords: Record<UserIntent, string[]> = {
  focus: ['focus', 'study', 'work', 'concentration', 'instrumental', 'ambient'],
  chill: ['chill', 'relax', 'calm', 'sleep', 'lofi', 'downtempo', 'lounge'],
  discover: ['discover', 'new', 'explore', 'random', 'surprise'],
  unknown: [],
};

const intentTags: Record<Exclude<UserIntent, 'unknown'>, string[]> = {
  focus: ['instrumental', 'ambient', 'classical', 'piano', 'jazz', 'lofi', 'electronic'],
  chill: ['chill', 'lounge', 'relax', 'acoustic', 'downtempo', 'soft'],
  discover: ['world', 'indie', 'local', 'eclectic'],
};

const intentAvoidTags: Record<UserIntent, string[]> = {
  focus: ['talk', 'news', 'sports'],
  chill: ['talk', 'news', 'sports', 'party'],
  discover: [],
  unknown: [],
};

const normalizeTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const getStationTokens = (station: Station): string[] => {
  const tags = station.tags ?? [];
  const pieces = [station.genre ?? '', station.country ?? '', ...tags];
  return pieces.flatMap(normalizeTokens);
};

const inferIntent = (context: Omit<ContextSnapshot, 'intent'>): UserIntent => {
  const queryTokens = normalizeTokens(context.query);

  for (const [intent, keywords] of Object.entries(intentKeywords) as Array<[UserIntent, string[]]>) {
    if (intent === 'unknown') continue;
    if (keywords.some((keyword) => queryTokens.includes(keyword))) {
      return intent;
    }
  }

  if (!context.query) {
    if (context.hour >= 22 || context.hour <= 5) return 'chill';
    if (context.mode === 'smart') return 'discover';
  }

  return 'unknown';
};

const buildExplanation = (signals: string[]): AIExplanation => {
  const summary = signals.length > 0 ? signals.slice(0, 2).join(' · ') : 'Sélection équilibrée';
  return { summary, signals };
};

const getSignalsByType = (signals: AISignalRecord[], type: AISignalType) =>
  signals.filter((signal) => signal.type === type);

// AI engine is read-only: it never mutates stores or triggers playback.
export const aiEngine: AIEngine = {
  search: (query, stations, limit) => searchByText(query, stations, limit),
  searchByAmbience: (ambience, stations, genre) => searchByAmbience(ambience, stations, genre),
  similar: (stationId, stations, limit) => searchSimilarStations(stationId, stations, limit),
  recommend: (query, options) => {
    const context = aiEngine.getContext();
    const resolvedQuery = query ?? options?.query ?? context.query;
    const stations = options?.stations ?? useRadioStore.getState().stations;
    const limit = options?.limit ?? 10;
    const cacheKey = [
      resolvedQuery ?? '',
      context.intent,
      context.countryCode ?? '',
      options?.mode ?? context.mode,
    ].join('|');

    const cached = recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < RECOMMENDATION_TTL_MS) {
      return cached.result;
    }

    const signals = aiEngine.getUserSignals();
    const favorites = signals.favorites;
    const history = signals.history;
    const healthMap = useRadioStore.getState().stationHealth;

    const favoriteIds = new Set(favorites.map((fav) => fav.id));
    const preferenceTokens = new Set(
      [...favorites, ...history.map((record) => record.station)]
        .flatMap((station) => getStationTokens(station))
    );

    const playCounts = new Map<string, number>();
    const lastPlayedAt = new Map<string, number>();
    for (const record of history) {
      playCounts.set(record.station.id, (playCounts.get(record.station.id) ?? 0) + 1);
      const playedAt = Date.parse(record.playedAt);
      if (!Number.isNaN(playedAt)) {
        lastPlayedAt.set(record.station.id, playedAt);
      }
    }

    const recentSkips = signals.recentSkips;
    const recentErrors = signals.recentErrors;
    const skipCounts = new Map<string, number>();
    const errorCounts = new Map<string, number>();

    for (const skip of recentSkips) {
      skipCounts.set(skip.stationId, (skipCounts.get(skip.stationId) ?? 0) + 1);
    }
    for (const error of recentErrors) {
      errorCounts.set(error.stationId, (errorCounts.get(error.stationId) ?? 0) + 1);
    }

    const queryTokens = normalizeTokens(resolvedQuery);

    const scored = stations.map((station) => {
      const tokens = getStationTokens(station);
      const health = station.id ? healthMap[station.id] : null;
      const healthTier = health ? getHealthTier(health) : 'healthy';
      const healthScore = healthTier === 'healthy' ? 1 : healthTier === 'slow' ? 0.6 : healthTier === 'unstable' ? 0.3 : 0;

      const isFavorite = favoriteIds.has(station.id);
      const tokenMatches = tokens.filter((token) => preferenceTokens.has(token)).length;
      const preferenceScore = Math.min(1, (isFavorite ? 0.6 : 0) + tokenMatches * 0.08);

      const intent = context.intent;
      const intentMatch = intent !== 'unknown'
        ? intentTags[intent].some((tag) => tokens.includes(tag))
        : false;
      const intentPenalty = intentAvoidTags[intent].some((tag) => tokens.includes(tag)) ? 0.2 : 0;

      const queryMatch = queryTokens.length > 0
        ? queryTokens.filter((token) => tokens.includes(token)).length
        : 0;
      const queryScore = Math.min(0.4, queryMatch * 0.1);

      const countryMatch = context.countryCode && station.countryCode === context.countryCode ? 0.2 : 0;
      const contextScore = Math.min(1, queryScore + (intentMatch ? 0.4 : 0) + countryMatch);

      const lastPlayed = lastPlayedAt.get(station.id);
      const daysSinceLastPlay = lastPlayed ? (Date.now() - lastPlayed) / (1000 * 60 * 60 * 24) : null;
      const recencyScore = daysSinceLastPlay === null ? 0.4 : Math.max(0, 1 - Math.min(1, daysSinceLastPlay / 7));

      const plays = playCounts.get(station.id) ?? 0;
      const diversityScore = Math.max(0, 1 - Math.min(1, plays / 5));

      const skipPenalty = Math.min(0.4, (skipCounts.get(station.id) ?? 0) * 0.2);
      const errorPenalty = Math.min(0.3, (errorCounts.get(station.id) ?? 0) * 0.15);
      const unstablePenalty = healthTier === 'offline' ? 0.5 : healthTier === 'unstable' ? 0.3 : 0;

      const score = Math.max(
        0,
        Math.min(
          1,
          0.3 * healthScore +
            0.25 * preferenceScore +
            0.2 * contextScore +
            0.15 * recencyScore +
            0.1 * diversityScore -
            intentPenalty -
            skipPenalty -
            errorPenalty -
            unstablePenalty
        )
      );

      const explanationSignals: string[] = [];
      if (isFavorite) explanationSignals.push('Favori');
      if (healthTier === 'healthy') explanationSignals.push('Bonne santé');
      if (intentMatch) explanationSignals.push(`Intent ${intent}`);
      if (queryScore > 0) explanationSignals.push('Match recherche');
      if (countryMatch > 0) explanationSignals.push('Même pays');
      if (diversityScore > 0.7 && plays === 0) explanationSignals.push('Nouveau');

      return {
        station,
        score,
        explanation: buildExplanation(explanationSignals),
      };
    });

    const sorted = scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.station.id.localeCompare(b.station.id);
      })
      .slice(0, limit);

    const result: AIRecommendationResult = {
      stations: sorted.map((item) => item.station),
      explanations: Object.fromEntries(sorted.map((item) => [item.station.id, item.explanation])),
    };

    recommendationCache.set(cacheKey, { timestamp: Date.now(), result });
    return result;
  },
  explain: (station, context) => ({
    summary: `Suggestion déterministe${context?.reason ? ` (${context.reason})` : ''}.`,
    signals: [
      station.genre ? `Genre: ${station.genre}` : 'Genre proche',
      station.country ? `Pays: ${station.country}` : 'Pays proche',
    ],
  }),
  getContext: () => {
    const aiState = useAIStore.getState();
    const geoState = useGeoStore.getState();
    const audioState = audioEngine.getState();
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches;

    const baseContext = {
      countryCode: geoState.selectedCountry?.code ?? null,
      country: geoState.selectedCountry?.name ?? null,
      hour: new Date().getHours(),
      isMobile,
      query: aiState.query ?? '',
      mode: aiState.mode ?? 'text',
      isPlaying: audioState.status === 'playing',
      lastStationId: audioState.currentStation?.id ?? null,
    };

    return {
      ...baseContext,
      intent: inferIntent(baseContext),
    };
  },
  getUserSignals: () => {
    try {
      const repo = getSqliteRepository();
      const history = repo.getPlayHistory(50);
      const favorites = repo.getFavorites();
      const signals = repo.getSignals(200);

      return {
        favorites,
        history,
        recentPlays: getSignalsByType(signals, 'play'),
        recentSkips: getSignalsByType(signals, 'skip'),
        recentErrors: getSignalsByType(signals, 'error'),
      };
    } catch (error) {
      const fallback = useRadioStore.getState();
      return {
        favorites: fallback.favorites,
        history: fallback.history.map((record) => ({
          station: record.station,
          playedAt: record.playedAt.toISOString(),
          durationSeconds: record.durationSeconds,
        })),
        recentPlays: [],
        recentSkips: [],
        recentErrors: [],
      };
    }
  },
  invalidateCache: () => {
    recommendationCache.clear();
  },
};
