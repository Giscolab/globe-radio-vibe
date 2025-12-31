// Engine - Radio Enrichment: Popularity score calculation

export type PopularityTier = 'underground' | 'growing' | 'popular' | 'trending';

interface PopularityInput {
  votes?: number;
  clickCount?: number;
  clickTrend?: number;
  lastCheckOk?: boolean;
}

interface PopularityResult {
  score: number;
  tier: PopularityTier;
}

// Reference maximums for normalization (based on RadioBrowser data analysis)
const MAX_VOTES = 50000;
const MAX_CLICKS = 100000;
const MAX_TREND = 500;

/**
 * Calculate normalized popularity score (0-100) from station metrics
 */
export function calculatePopularityScore(input: PopularityInput): PopularityResult {
  const { 
    votes = 0, 
    clickCount = 0, 
    clickTrend = 0, 
    lastCheckOk = true 
  } = input;
  
  // Normalize each metric to 0-1 range
  const normalizedVotes = Math.min(votes / MAX_VOTES, 1);
  const normalizedClicks = Math.min(clickCount / MAX_CLICKS, 1);
  const normalizedTrend = (Math.min(Math.max(clickTrend, -MAX_TREND), MAX_TREND) + MAX_TREND) / (2 * MAX_TREND);
  const onlineFactor = lastCheckOk ? 1 : 0;
  
  // Weighted combination
  const score = Math.round(
    (
      normalizedVotes * 0.3 +
      normalizedClicks * 0.4 +
      normalizedTrend * 0.2 +
      onlineFactor * 0.1
    ) * 100
  );
  
  return {
    score,
    tier: getPopularityTier(score),
  };
}

/**
 * Get popularity tier from score
 */
export function getPopularityTier(score: number): PopularityTier {
  if (score >= 81) return 'trending';
  if (score >= 51) return 'popular';
  if (score >= 21) return 'growing';
  return 'underground';
}

/**
 * Get display label for tier
 */
export function getPopularityLabel(tier: PopularityTier): string {
  const labels: Record<PopularityTier, string> = {
    underground: 'Underground',
    growing: 'En croissance',
    popular: 'Populaire',
    trending: 'Tendance',
  };
  return labels[tier];
}

/**
 * Get icon/emoji for tier
 */
export function getPopularityIcon(tier: PopularityTier): string {
  const icons: Record<PopularityTier, string> = {
    underground: '💎',
    growing: '📈',
    popular: '⭐',
    trending: '🔥',
  };
  return icons[tier];
}
