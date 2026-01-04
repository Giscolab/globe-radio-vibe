// ============================================================================
// AI Engine - Recommendation & Scoring System (READ-ONLY, no side effects)
// ============================================================================
// Responsabilités:
// - Calcul déterministe de scores et recommandations
// - Extraction de contexte utilisateur (pas de mutation)
// - Explication des décisions IA
// ============================================================================

import type { Station } from '@/engine/types';
import { audioEngine } from '@/engine/player/audioEngine';
import { getHealthTier } from '@/engine/radio/health';
import {
  getSqliteRepository,
  type AISignalRecord,
  type AISignalType,
  type PlayHistoryRecord,
} from '@/engine/storage/sqlite/stationRepository';
import { useAIStore } from '@/stores/ai.store';
import { useGeoStore } from '@/stores/geo.store';
import { useRadioStore } from '@/stores/radio';
import {
  searchByAmbience,
  searchByText,
  searchSimilarStations,
  type AmbienceType,
} from './searchAI';

// ============= Types Publics =============

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
  searchByAmbience: (ambience: AmbienceType, stations: Station[], genre?: string) => Promise<Station[]>;
  similar: (stationId: string, stations: Station[], limit?: number) => Promise<Station[]>;
  recommend: (query?: string, options?: RecommendOptions) => AIRecommendationResult;
  explain: (station: Station, context?: { reason?: string }) => AIExplanation;
  getContext: () => ContextSnapshot;
  getUserSignals: () => UserSignals;
  invalidateCache: () => void;
}

// ============= Configuration Scoring =============

interface ScoringWeights {
  health: number;
  preference: number;
  context: number;
  recency: number;
  diversity: number;
}

const WEIGHTS: ScoringWeights = {
  health: 0.30,
  preference: 0.25,
  context: 0.20,
  recency: 0.15,
  diversity: 0.10,
};

const RECOMMENDATION_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 20;

// ============= Intent Detection =============

const intentKeywords: Record<UserIntent, string[]> = {
  focus: ['focus', 'study', 'work', 'concentration', 'instrumental', 'ambient', 'concentration'],
  chill: ['chill', 'relax', 'calm', 'sleep', 'lofi', 'downtempo', 'lounge', 'zen', 'meditation'],
  discover: ['discover', 'new', 'explore', 'random', 'surprise', 'unknown'],
  unknown: [],
};

const intentTags: Record<Exclude<UserIntent, 'unknown'>, string[]> = {
  focus: ['instrumental', 'ambient', 'classical', 'piano', 'jazz', 'lofi', 'electronic', 'minimal'],
  chill: ['chill', 'lounge', 'relax', 'acoustic', 'downtempo', 'soft', 'easy listening'],
  discover: ['world', 'indie', 'local', 'eclectic', 'experimental'],
};

const intentAvoidTags: Record<UserIntent, string[]> = {
  focus: ['talk', 'news', 'sports', 'comedy', 'podcast'],
  chill: ['talk', 'news', 'sports', 'party', 'hardcore', 'metal'],
  discover: [],
  unknown: [],
};

// ============= Utils Pures =============

const normalizeTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .split(/[\s,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

const getStationTokens = (station: Station): string[] => {
  const pieces = [
    station.genre ?? '',
    station.country ?? '',
    ...(station.tags ?? []),
  ];
  return pieces.flatMap(normalizeTokens);
};

const inferIntent = (context: Omit<ContextSnapshot, 'intent'>): UserIntent => {
  const queryTokens = normalizeTokens(context.query);

  for (const [intent, keywords] of Object.entries(intentKeywords) as [UserIntent, string[]][]) {
    if (intent === 'unknown') continue;
    if (keywords.some((kw) => queryTokens.includes(kw))) {
      return intent;
    }
  }

  // Inférence contextuelle par heure
  if (!context.query) {
    if (context.hour >= 22 || context.hour <= 5) return 'chill';
    if (context.hour >= 9 && context.hour <= 17 && context.mode === 'smart') return 'focus';
    if (context.mode === 'smart') return 'discover';
  }

  return 'unknown';
};

// ============= Scoring Engine =============

interface StationScore {
  station: Station;
  score: number;
  breakdown: {
    health: number;
    preference: number;
    context: number;
    recency: number;
    diversity: number;
    penalties: number;
  };
  signals: string[];
}

function computeStationScore(
  station: Station,
  context: ContextSnapshot,
  _signals: UserSignals,
  healthMap: Record<string, { ok: boolean; latency: number | null; lastChecked: number }>,
  preferenceTokens: Set<string>,
  favoriteIds: Set<string>,
  playCounts: Map<string, number>,
  lastPlayedAt: Map<string, number>,
  skipCounts: Map<string, number>,
  errorCounts: Map<string, number>
): StationScore {
  const tokens = getStationTokens(station);
  const explanationSignals: string[] = [];

  // 1. Health Score
  const health = station.id ? healthMap[station.id] : null;
  const healthTier = health ? getHealthTier(health) : 'healthy';
  const healthScore =
    healthTier === 'healthy' ? 1.0 :
    healthTier === 'slow' ? 0.6 :
    healthTier === 'unstable' ? 0.3 : 0;

  if (healthTier === 'healthy') explanationSignals.push('Bonne santé');

  // 2. Preference Score
  const isFavorite = favoriteIds.has(station.id);
  const tokenMatches = tokens.filter((t) => preferenceTokens.has(t)).length;
  const preferenceScore = Math.min(1, (isFavorite ? 0.5 : 0) + tokenMatches * 0.1);

  if (isFavorite) explanationSignals.push('Favori');
  if (tokenMatches > 2) explanationSignals.push('Préférences');

  // 3. Context Score
  const { intent } = context;
  const intentMatch =
    intent !== 'unknown' && intentTags[intent].some((tag) => tokens.includes(tag));
  const intentPenalty =
    intentAvoidTags[intent].some((tag) => tokens.includes(tag)) ? 0.25 : 0;

  const queryTokens = normalizeTokens(context.query);
  const queryMatch = queryTokens.filter((t) => tokens.includes(t)).length;
  const queryScore = Math.min(0.4, queryMatch * 0.15);

  const countryMatch = context.countryCode && station.countryCode === context.countryCode ? 0.2 : 0;
  const contextScore = Math.min(1, queryScore + (intentMatch ? 0.4 : 0) + countryMatch);

  if (intentMatch) explanationSignals.push(`Mode ${intent}`);
  if (queryScore > 0) explanationSignals.push('Match recherche');
  if (countryMatch > 0) explanationSignals.push('Même pays');

  // 4. Recency Score (favor recently played but not too much)
  const lastPlayed = lastPlayedAt.get(station.id);
  const daysSinceLast = lastPlayed ? (Date.now() - lastPlayed) / (1000 * 60 * 60 * 24) : null;
  const recencyScore = daysSinceLast === null ? 0.5 : Math.max(0, 1 - Math.min(1, daysSinceLast / 7));

  // 5. Diversity Score (penalize over-played stations)
  const plays = playCounts.get(station.id) ?? 0;
  const diversityScore = Math.max(0, 1 - Math.min(1, plays / 8));

  if (plays === 0) explanationSignals.push('Nouveau');

  // 6. Penalties
  const skipPenalty = Math.min(0.4, (skipCounts.get(station.id) ?? 0) * 0.15);
  const errorPenalty = Math.min(0.3, (errorCounts.get(station.id) ?? 0) * 0.1);
  const unstablePenalty =
    healthTier === 'offline' ? 0.6 :
    healthTier === 'unstable' ? 0.35 : 0;

  const totalPenalties = intentPenalty + skipPenalty + errorPenalty + unstablePenalty;

  // Weighted score
  const rawScore =
    WEIGHTS.health * healthScore +
    WEIGHTS.preference * preferenceScore +
    WEIGHTS.context * contextScore +
    WEIGHTS.recency * recencyScore +
    WEIGHTS.diversity * diversityScore -
    totalPenalties;

  const score = Math.max(0, Math.min(1, rawScore));

  return {
    station,
    score,
    breakdown: {
      health: healthScore,
      preference: preferenceScore,
      context: contextScore,
      recency: recencyScore,
      diversity: diversityScore,
      penalties: totalPenalties,
    },
    signals: explanationSignals,
  };
}

// ============= Cache =============

const recommendationCache = new Map<string, { timestamp: number; result: AIRecommendationResult }>();

function getCacheKey(query: string, intent: UserIntent, countryCode: string | null, mode: string): string {
  return [query, intent, countryCode ?? '', mode].join('|');
}

function pruneCache(): void {
  if (recommendationCache.size > MAX_CACHE_SIZE) {
    const oldest = recommendationCache.keys().next().value;
    if (oldest) recommendationCache.delete(oldest);
  }
}

// ============= Helpers =============

const getSignalsByType = (signals: AISignalRecord[], type: AISignalType) =>
  signals.filter((s) => s.type === type);

const buildExplanation = (signals: string[]): AIExplanation => ({
  summary: signals.length > 0 ? signals.slice(0, 2).join(' · ') : 'Sélection équilibrée',
  signals,
});

// ============= AI Engine Implementation =============

export const aiEngine: AIEngine = {
  // Proxies to searchAI (async/server-side)
  search: (query, stations, limit) => searchByText(query, stations, limit),
  searchByAmbience: (ambience, stations, genre) => searchByAmbience(ambience, stations, genre),
  similar: (stationId, stations, limit) => searchSimilarStations(stationId, stations, limit),

  // Core recommendation engine (sync, client-side)
  recommend: (query, options) => {
    const context = aiEngine.getContext();
    const resolvedQuery = query ?? options?.query ?? context.query;
    const stations = options?.stations ?? useRadioStore.getState().stations;
    const limit = options?.limit ?? 10;

    // Cache lookup
    const cacheKey = getCacheKey(resolvedQuery, context.intent, context.countryCode, options?.mode ?? context.mode);
    const cached = recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < RECOMMENDATION_TTL_MS) {
      return cached.result;
    }

    // Gather signals
    const signals = aiEngine.getUserSignals();
    const { favorites, history } = signals;
    const healthMap = useRadioStore.getState().stationHealth;

    // Build lookup structures
    const favoriteIds = new Set(favorites.map((f) => f.id));
    const preferenceTokens = new Set(
      [...favorites, ...history.map((r) => r.station)].flatMap(getStationTokens)
    );

    const playCounts = new Map<string, number>();
    const lastPlayedAt = new Map<string, number>();
    for (const record of history) {
      playCounts.set(record.station.id, (playCounts.get(record.station.id) ?? 0) + 1);
      const ts = Date.parse(record.playedAt);
      if (!Number.isNaN(ts)) lastPlayedAt.set(record.station.id, ts);
    }

    const skipCounts = new Map<string, number>();
    const errorCounts = new Map<string, number>();
    for (const s of signals.recentSkips) {
      skipCounts.set(s.stationId, (skipCounts.get(s.stationId) ?? 0) + 1);
    }
    for (const e of signals.recentErrors) {
      errorCounts.set(e.stationId, (errorCounts.get(e.stationId) ?? 0) + 1);
    }

    // Score all stations
    const scored = stations.map((station) =>
      computeStationScore(
        station,
        context,
        signals,
        healthMap,
        preferenceTokens,
        favoriteIds,
        playCounts,
        lastPlayedAt,
        skipCounts,
        errorCounts
      )
    );

    // Sort by score (stable secondary sort by id)
    const sorted = scored
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.station.id.localeCompare(b.station.id)))
      .slice(0, limit);

    const result: AIRecommendationResult = {
      stations: sorted.map((s) => s.station),
      explanations: Object.fromEntries(
        sorted.map((s) => [s.station.id, buildExplanation(s.signals)])
      ),
    };

    // Cache result
    recommendationCache.set(cacheKey, { timestamp: Date.now(), result });
    pruneCache();

    return result;
  },

  explain: (station, ctx) => ({
    summary: `Suggestion déterministe${ctx?.reason ? ` (${ctx.reason})` : ''}.`,
    signals: [
      station.genre ? `Genre: ${station.genre}` : 'Genre proche',
      station.country ? `Pays: ${station.country}` : 'Région proche',
    ],
  }),

  getContext: () => {
    const aiState = useAIStore.getState();
    const geoState = useGeoStore.getState();
    const audioState = audioEngine.getState();
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

    const baseContext = {
      countryCode: geoState.selectedCountry?.iso2 ?? null,
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
    } catch {
      // Fallback to store data
      const fallback = useRadioStore.getState();
      return {
        favorites: fallback.favorites,
        history: fallback.history.map((r) => ({
          station: r.station,
          playedAt: r.playedAt.toISOString(),
          durationSeconds: r.durationSeconds,
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
