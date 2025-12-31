// Component - PopularityIndicator: Display popularity score and tier
import type { PopularityTier } from '@/engine/radio/enrichment/popularityScore';
import { getPopularityIcon } from '@/engine/radio/enrichment/popularityScore';

interface PopularityIndicatorProps {
  score: number;
  tier?: PopularityTier;
  showBar?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const tierStyles: Record<PopularityTier, string> = {
  underground: 'text-muted-foreground',
  growing: 'text-secondary',
  popular: 'text-primary',
  trending: 'text-accent',
};

const barStyles: Record<PopularityTier, string> = {
  underground: 'bg-muted-foreground/30',
  growing: 'bg-secondary/50',
  popular: 'bg-primary/60',
  trending: 'bg-gradient-to-r from-accent to-primary',
};

export function PopularityIndicator({ 
  score, 
  tier = 'underground', 
  showBar = false,
  size = 'sm',
  className = '' 
}: PopularityIndicatorProps) {
  const icon = getPopularityIcon(tier);
  const isSmall = size === 'sm';
  
  // Only show for notable popularity (growing+)
  if (tier === 'underground' && score < 15) {
    return null;
  }
  
  if (showBar) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className={isSmall ? 'text-xs' : 'text-sm'}>{icon}</span>
        <div className={`flex-1 neo-track ${isSmall ? 'h-1' : 'h-1.5'}`}>
          <div 
            className={`h-full rounded-full transition-all ${barStyles[tier]}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        {!isSmall && (
          <span className={`text-xs ${tierStyles[tier]}`}>{score}</span>
        )}
      </div>
    );
  }
  
  return (
    <span className={`inline-flex items-center gap-0.5 ${tierStyles[tier]} ${className}`}>
      <span className={isSmall ? 'text-xs' : 'text-sm'}>{icon}</span>
      {tier === 'trending' && (
        <span className={`${isSmall ? 'text-[10px]' : 'text-xs'} font-medium`}>
          Tendance
        </span>
      )}
    </span>
  );
}
