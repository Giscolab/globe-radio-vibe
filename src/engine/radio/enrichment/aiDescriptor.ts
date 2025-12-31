// AI Descriptor Generator - Creates rich text descriptors for embedding search
import type { EnrichedStation } from '@/engine/types';

/**
 * Build a rich text descriptor for AI-powered search
 * Includes all semantic features that help with similarity matching
 */
export function buildAIDescriptor(station: EnrichedStation): string {
  const parts: string[] = [];
  
  // Name (always first)
  parts.push(station.name);
  
  // Location info
  if (station.country) {
    parts.push(station.country);
  }
  if (station.region) {
    parts.push(station.region);
  }
  if (station.city) {
    parts.push(station.city);
  }
  
  // Primary genre
  if (station.primaryGenre) {
    parts.push(station.primaryGenre);
  }
  
  // Sub-genres (up to 5)
  if (station.subGenres && station.subGenres.length > 0) {
    parts.push(station.subGenres.slice(0, 5).join(', '));
  }
  
  // Quality tier
  if (station.qualityTier === 'hd') {
    parts.push('high quality');
  } else if (station.qualityTier === 'high') {
    parts.push('good quality');
  }
  
  // Popularity indicators
  if (station.popularityScore !== undefined) {
    if (station.popularityScore > 80) {
      parts.push('very popular');
    } else if (station.popularityScore > 50) {
      parts.push('popular');
    } else if (station.popularityScore < 20) {
      parts.push('underground');
    }
  }
  
  // Language
  if (station.language) {
    parts.push(station.language);
  }
  
  // Original tags (for additional context)
  if (station.tags && station.tags.length > 0) {
    const relevantTags = station.tags
      .slice(0, 10)
      .filter(tag => tag.length > 2 && !parts.some(p => p.toLowerCase().includes(tag.toLowerCase())));
    if (relevantTags.length > 0) {
      parts.push(relevantTags.join(', '));
    }
  }
  
  return parts.filter(Boolean).join(' — ');
}

/**
 * Build descriptors for multiple stations
 */
export function buildAIDescriptors(stations: EnrichedStation[]): Array<{ id: string; descriptor: string }> {
  return stations.map(station => ({
    id: station.id,
    descriptor: buildAIDescriptor(station)
  }));
}

/**
 * Extract mood/ambience keywords from a descriptor
 */
export function extractMoodFromDescriptor(descriptor: string): string[] {
  const moodKeywords = [
    'chill', 'relaxing', 'calm', 'peaceful', 'mellow',
    'energetic', 'upbeat', 'party', 'dance', 'club',
    'focus', 'ambient', 'instrumental', 'acoustic',
    'dark', 'intense', 'heavy', 'aggressive',
    'romantic', 'smooth', 'soft', 'gentle',
    'retro', 'classic', 'vintage', 'oldies',
    'modern', 'contemporary', 'fresh', 'new'
  ];
  
  const lowerDescriptor = descriptor.toLowerCase();
  return moodKeywords.filter(mood => lowerDescriptor.includes(mood));
}
