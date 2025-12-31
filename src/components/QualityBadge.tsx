// Component - QualityBadge: Display audio quality tier badge
import type { QualityTier } from '@/engine/types/radio';
import { 
  shouldShowQualityBadge, 
  getQualityShortLabel 
} from '@/engine/radio/enrichment/qualityBadge';

interface QualityBadgeProps {
  tier: QualityTier;
  showCodec?: boolean;
  codec?: string;
  className?: string;
}

const tierStyles: Record<QualityTier, string> = {
  hd: 'bg-gradient-to-r from-primary to-primary-glow text-primary-foreground',
  high: 'bg-secondary/20 text-secondary',
  medium: 'bg-muted text-muted-foreground',
  low: 'bg-destructive/20 text-destructive',
};

export function QualityBadge({ tier, showCodec, codec, className = '' }: QualityBadgeProps) {
  // Don't show badge for medium quality (default)
  if (!shouldShowQualityBadge(tier) && tier !== 'low') {
    return null;
  }
  
  const label = getQualityShortLabel(tier);
  
  if (!label) return null;
  
  return (
    <span
      className={`
        inline-flex items-center gap-1 
        px-1.5 py-0.5 text-[10px] font-semibold 
        rounded-md uppercase tracking-wide
        ${tierStyles[tier]}
        ${className}
      `}
    >
      {tier === 'hd' && <span className="text-xs">🎧</span>}
      {tier === 'high' && <span className="text-xs">✨</span>}
      {label}
      {showCodec && codec && (
        <span className="opacity-75">{codec.toUpperCase()}</span>
      )}
    </span>
  );
}
