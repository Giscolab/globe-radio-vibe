// Engine - Radio Enrichment: Audio quality classification

import type { QualityTier } from '@/engine/types/radio';

// Quality rules based on bitrate and codec
interface QualityRule {
  minBitrate: number;
  codecs: string[];
}

const QUALITY_RULES: Record<QualityTier, QualityRule> = {
  hd: { minBitrate: 256, codecs: ['flac', 'aac', 'opus', 'vorbis'] },
  high: { minBitrate: 192, codecs: ['mp3', 'aac', 'ogg', 'opus', 'vorbis'] },
  medium: { minBitrate: 128, codecs: ['mp3', 'aac', 'ogg'] },
  low: { minBitrate: 0, codecs: ['*'] },
};

// Codec quality ranking (higher is better)
const CODEC_QUALITY: Record<string, number> = {
  flac: 5,
  opus: 4,
  aac: 4,
  vorbis: 3,
  ogg: 3,
  mp3: 2,
  wma: 1,
  unknown: 0,
};

/**
 * Determine quality tier from bitrate and codec
 */
export function getQualityTier(bitrate?: number, codec?: string): QualityTier {
  const normalizedCodec = (codec || 'unknown').toLowerCase();
  const actualBitrate = bitrate || 0;
  
  // Check from highest to lowest quality
  const tiers: QualityTier[] = ['hd', 'high', 'medium', 'low'];
  
  for (const tier of tiers) {
    const rule = QUALITY_RULES[tier];
    
    // Check bitrate threshold
    if (actualBitrate < rule.minBitrate) continue;
    
    // Check codec compatibility (or wildcard)
    if (rule.codecs.includes('*') || rule.codecs.includes(normalizedCodec)) {
      // For HD tier, require both high bitrate AND good codec
      if (tier === 'hd') {
        const codecQuality = CODEC_QUALITY[normalizedCodec] || 0;
        if (codecQuality >= 3) {
          return 'hd';
        }
        return 'high';
      }
      return tier;
    }
  }
  
  return 'medium';
}

/**
 * Get display label for quality tier
 */
export function getQualityLabel(tier: QualityTier): string {
  const labels: Record<QualityTier, string> = {
    hd: 'HD Audio',
    high: 'Haute qualité',
    medium: 'Standard',
    low: 'Basse qualité',
  };
  return labels[tier];
}

/**
 * Get short label for quality tier (for badges)
 */
export function getQualityShortLabel(tier: QualityTier): string {
  const labels: Record<QualityTier, string> = {
    hd: 'HD',
    high: 'HQ',
    medium: '',
    low: 'LQ',
  };
  return labels[tier];
}

/**
 * Get icon for quality tier
 */
export function getQualityIcon(tier: QualityTier): string {
  const icons: Record<QualityTier, string> = {
    hd: '🎧',
    high: '✨',
    medium: '📻',
    low: '📡',
  };
  return icons[tier];
}

/**
 * Check if quality tier should display a badge
 */
export function shouldShowQualityBadge(tier: QualityTier): boolean {
  return tier === 'hd' || tier === 'high';
}

/**
 * Get codec display name
 */
export function getCodecDisplayName(codec?: string): string {
  if (!codec) return '';
  
  const displayNames: Record<string, string> = {
    mp3: 'MP3',
    aac: 'AAC',
    flac: 'FLAC',
    ogg: 'OGG',
    opus: 'OPUS',
    vorbis: 'Vorbis',
    wma: 'WMA',
  };
  
  return displayNames[codec.toLowerCase()] || codec.toUpperCase();
}
