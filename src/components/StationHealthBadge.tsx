// Component - Station Health Badge: visual indicator for station health
import { Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { type StationHealth, getHealthTier } from '@/engine/radio/health';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StationHealthBadgeProps {
  health: StationHealth | null;
  showLatency?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TIER_CONFIG = {
  healthy: {
    color: 'bg-green-500',
    textColor: 'text-green-500',
    icon: Wifi,
    label: 'Stable',
  },
  slow: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    icon: Activity,
    label: 'Lent',
  },
  unstable: {
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    icon: AlertTriangle,
    label: 'Instable',
  },
  offline: {
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: WifiOff,
    label: 'Hors ligne',
  },
};

const SIZE_CONFIG = {
  sm: { dot: 'w-2 h-2', icon: 'w-3 h-3', text: 'text-[10px]' },
  md: { dot: 'w-2.5 h-2.5', icon: 'w-4 h-4', text: 'text-xs' },
  lg: { dot: 'w-3 h-3', icon: 'w-5 h-5', text: 'text-sm' },
};

export function StationHealthBadge({ 
  health, 
  showLatency = false,
  size = 'sm',
  className = '' 
}: StationHealthBadgeProps) {
  if (!health) {
    return (
      <div className={`${SIZE_CONFIG[size].dot} rounded-full bg-muted animate-pulse ${className}`} />
    );
  }

  const tier = getHealthTier(health);
  const config = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${className}`}>
            <div className={`${sizeConfig.dot} rounded-full ${config.color} ${tier === 'healthy' ? 'animate-pulse' : ''}`} />
            {showLatency && health.latency !== null && (
              <span className={`${sizeConfig.text} ${config.textColor} font-mono`}>
                {health.latency}ms
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex items-center gap-2">
            <config.icon className={`${sizeConfig.icon} ${config.textColor}`} />
            <span>{config.label}</span>
            {health.latency !== null && (
              <span className="text-muted-foreground">({health.latency}ms)</span>
            )}
          </div>
          {health.error && (
            <div className="text-red-400 mt-1">{health.error}</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact dot indicator for lists
 */
export function HealthDot({ 
  health, 
  className = '' 
}: { 
  health: StationHealth | null; 
  className?: string 
}) {
  if (!health) {
    return <div className={`w-2 h-2 rounded-full bg-muted ${className}`} />;
  }

  const tier = getHealthTier(health);
  const config = TIER_CONFIG[tier];

  return (
    <div 
      className={`w-2 h-2 rounded-full ${config.color} ${tier === 'healthy' ? 'animate-pulse' : ''} ${className}`}
      title={`${config.label}${health.latency ? ` (${health.latency}ms)` : ''}`}
    />
  );
}

/**
 * Offline warning banner
 */
export function OfflineWarning({ 
  health,
  onRetry,
  className = '' 
}: { 
  health: StationHealth | null;
  onRetry?: () => void;
  className?: string;
}) {
  if (!health || health.ok) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 ${className}`}>
      <WifiOff className="w-4 h-4 text-red-500" />
      <span className="text-xs text-red-400">Flux instable</span>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-xs text-red-400 underline hover:text-red-300 ml-auto"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
