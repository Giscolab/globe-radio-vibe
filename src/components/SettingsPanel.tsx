// Component - SettingsPanel: user settings, proxy statistics, and audio diagnostics
import { Shield, Info, BarChart3, Activity, Radio, Wifi, WifiOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/stores/settings.store';
import { useRadioStore } from '@/stores/radio.store';
import { needsProxy, setForceProxy as setForceProxyEngine } from '@/engine/radio/utils/httpsUpgrade';
import { useMemo, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlayer } from '@/hooks/usePlayer';
import { audioEngine } from '@/engine/player/audioEngine';
import { Badge } from '@/components/ui/badge';

export function SettingsPanel() {
  const { forceProxy, setForceProxy } = useSettingsStore();
  const { stations, topStations } = useRadioStore();
  
  // Sync engine force proxy state with store
  useEffect(() => {
    setForceProxyEngine(forceProxy);
  }, [forceProxy]);
  
  // Calculate proxy statistics
  const proxyStats = useMemo(() => {
    const allStations = [...stations, ...topStations];
    const uniqueStations = Array.from(new Map(allStations.map(s => [s.id, s])).values());
    
    const httpsCount = uniqueStations.filter(s => s.url?.startsWith('https://')).length;
    const httpCount = uniqueStations.filter(s => s.url?.startsWith('http://') && !s.url?.startsWith('https://')).length;
    const proxiedCount = forceProxy 
      ? httpCount 
      : uniqueStations.filter(s => needsProxy(s.url || '')).length;
    const upgradedCount = httpCount - proxiedCount;
    
    return {
      total: uniqueStations.length,
      https: httpsCount,
      http: httpCount,
      proxied: forceProxy ? httpCount : proxiedCount,
      upgraded: forceProxy ? 0 : upgradedCount,
    };
  }, [stations, topStations, forceProxy]);

  return (
    <div className="p-4 space-y-6">
      {/* Proxy Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Paramètres du Proxy</h3>
        </div>
        
        <div className="neo-inset p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">Forcer le proxy HTTPS</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Active le proxy pour tous les flux HTTP, même ceux qui pourraient être mis à niveau directement vers HTTPS. Utile si vous rencontrez des problèmes de lecture.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch 
              checked={forceProxy} 
              onCheckedChange={setForceProxy}
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            {forceProxy 
              ? "Tous les flux HTTP passeront par le proxy sécurisé."
              : "Seuls les flux incompatibles HTTPS utilisent le proxy."}
          </p>
        </div>
      </div>

      {/* Proxy Statistics */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Statistiques des flux</h3>
        </div>
        
        <div className="neo-inset p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatItem 
              label="Total stations" 
              value={proxyStats.total} 
              color="text-foreground"
            />
            <StatItem 
              label="HTTPS natif" 
              value={proxyStats.https} 
              color="text-emerald-400"
            />
            <StatItem 
              label="HTTP → HTTPS" 
              value={proxyStats.upgraded} 
              color="text-blue-400"
            />
            <StatItem 
              label="Via proxy" 
              value={proxyStats.proxied} 
              color="text-amber-400"
              highlight
            />
          </div>
          
          {/* Visual bar */}
          {proxyStats.total > 0 && (
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div 
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(proxyStats.https / proxyStats.total) * 100}%` }}
                />
                <div 
                  className="bg-blue-500 transition-all"
                  style={{ width: `${(proxyStats.upgraded / proxyStats.total) * 100}%` }}
                />
                <div 
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(proxyStats.proxied / proxyStats.total) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  HTTPS
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Upgradé
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Proxy
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audio Diagnostics */}
      <AudioDiagnosticsPanel />

      {/* Info section */}
      <div className="text-xs text-muted-foreground space-y-2 p-3 rounded-lg bg-muted/30">
        <p>
          <strong>HTTPS natif :</strong> Flux déjà sécurisés, lecture directe.
        </p>
        <p>
          <strong>HTTP → HTTPS :</strong> Flux HTTP de domaines compatibles, mis à niveau automatiquement.
        </p>
        <p>
          <strong>Via proxy :</strong> Flux HTTP incompatibles, transitent par notre serveur sécurisé.
        </p>
      </div>
    </div>
  );
}

function StatItem({ 
  label, 
  value, 
  color,
  highlight = false 
}: { 
  label: string; 
  value: number; 
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-2 rounded ${highlight ? 'bg-primary/10' : ''}`}>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Audio diagnostics panel for debugging playback issues
 */
function AudioDiagnosticsPanel() {
  const { currentStation, status, currentUrl, urlType, candidateIndex, totalCandidates, error } = usePlayer();
  const [audioState, setAudioState] = useState<{
    readyState: number;
    networkState: number;
    currentTime: number;
    paused: boolean;
    error: string | null;
  } | null>(null);
  
  // Update audio element state periodically when playing
  useEffect(() => {
    if (status !== 'playing' && status !== 'loading') {
      setAudioState(null);
      return;
    }
    
    const updateState = () => {
      const audioEl = audioEngine.getAudioElement();
      if (audioEl) {
        setAudioState({
          readyState: audioEl.readyState,
          networkState: audioEl.networkState,
          currentTime: audioEl.currentTime,
          paused: audioEl.paused,
          error: audioEl.error?.message || null,
        });
      }
    };
    
    updateState();
    const interval = setInterval(updateState, 1000);
    return () => clearInterval(interval);
  }, [status]);
  
  if (!currentStation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Diagnostics Audio</h3>
        </div>
        <div className="neo-inset p-4 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Aucune station en cours de lecture
          </p>
        </div>
      </div>
    );
  }
  
  const readyStateLabels: Record<number, string> = {
    0: 'HAVE_NOTHING',
    1: 'HAVE_METADATA',
    2: 'HAVE_CURRENT_DATA',
    3: 'HAVE_FUTURE_DATA',
    4: 'HAVE_ENOUGH_DATA',
  };
  
  const networkStateLabels: Record<number, string> = {
    0: 'NETWORK_EMPTY',
    1: 'NETWORK_IDLE',
    2: 'NETWORK_LOADING',
    3: 'NETWORK_NO_SOURCE',
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Diagnostics Audio</h3>
      </div>
      
      <div className="neo-inset p-4 rounded-lg space-y-3">
        {/* Station info */}
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{currentStation.name}</span>
          <Badge variant={status === 'playing' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
            {status}
          </Badge>
        </div>
        
        {/* URL info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {urlType === 'proxy' ? (
              <Shield className="w-4 h-4 text-emerald-500" />
            ) : urlType === 'hls' ? (
              <Wifi className="w-4 h-4 text-blue-500" />
            ) : (
              <Wifi className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              Type: <strong>{urlType || 'N/A'}</strong>
              {totalCandidates > 1 && ` (candidat ${candidateIndex + 1}/${totalCandidates})`}
            </span>
          </div>
          {currentUrl && (
            <p className="text-xs text-muted-foreground truncate font-mono" title={currentUrl}>
              {currentUrl.length > 60 ? currentUrl.slice(0, 60) + '...' : currentUrl}
            </p>
          )}
        </div>
        
        {/* Audio element state */}
        {audioState && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">readyState:</span>{' '}
              <span className="font-mono">{readyStateLabels[audioState.readyState] || audioState.readyState}</span>
            </div>
            <div>
              <span className="text-muted-foreground">networkState:</span>{' '}
              <span className="font-mono">{networkStateLabels[audioState.networkState] || audioState.networkState}</span>
            </div>
            <div>
              <span className="text-muted-foreground">currentTime:</span>{' '}
              <span className="font-mono">{audioState.currentTime.toFixed(1)}s</span>
            </div>
            <div>
              <span className="text-muted-foreground">paused:</span>{' '}
              <span className="font-mono">{audioState.paused ? 'oui' : 'non'}</span>
            </div>
          </div>
        )}
        
        {/* Error display */}
        {(error || audioState?.error) && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>{error || audioState?.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
