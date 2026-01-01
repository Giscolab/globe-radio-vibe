import { Play, Pause, Volume2, VolumeX, Radio, AlertCircle, WifiOff, Shield } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useRadioStore } from '@/stores/radio.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { AudioVisualizer } from './AudioVisualizer';
import { FallbackVisualizer } from './FallbackVisualizer';
import { QualityBadge } from './QualityBadge';
import { StationHealthBadge } from './StationHealthBadge';
import { enrichStationSync } from '@/engine/radio/enrichment/stationEnricher';
import { getHealthTier } from '@/engine/radio/health';
import { needsProxy, isForceProxyEnabled } from '@/engine/radio/utils/httpsUpgrade';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function PlayerBar() {
  const { 
    currentStation, 
    status, 
    volume, 
    muted,
    toggle, 
    setVolume,
    toggleMute 
  } = usePlayer();
  
  const { stationHealth } = useRadioStore();
  const { safeAudioMode } = useSettingsStore();
  
  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  
  // Only use audio analysis when NOT in safe mode and playing
  const { fft, volume: audioVolume, peak, silent, isCorsBlocked } = useAudioAnalysis({ 
    enabled: isPlaying && !safeAudioMode,
    fps: 30 
  });
  
  // Use fallback visualizer in safe mode or when CORS blocked
  const useFallback = safeAudioMode || isCorsBlocked;
  
  // Enrich station for quality badge
  const enrichedStation = currentStation ? enrichStationSync(currentStation) : null;
  
  // Get health status
  const health = currentStation ? stationHealth[currentStation.id] : null;
  const isUnstable = health && !health.ok;
  
  // Check if station uses proxy (force proxy or needs proxy)
  const isProxied = currentStation?.url 
    ? (isForceProxyEnabled() && !currentStation.url.startsWith('https://')) || needsProxy(currentStation.url) 
    : false;

  return (
    <div className="neo-raised-lg p-4">
      <div className="flex items-center gap-4">
        {/* Station icon with visualizer halo */}
        <div 
          className="neo-circle w-14 h-14 flex items-center justify-center flex-shrink-0 relative overflow-hidden"
          style={{
            boxShadow: isPlaying && peak 
              ? `0 0 20px hsl(var(--accent) / 0.5)` 
              : undefined,
          }}
        >
          {currentStation?.favicon ? (
            <img 
              src={currentStation.favicon} 
              alt="" 
              className="w-10 h-10 rounded-full object-cover relative z-10" 
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Radio className="w-6 h-6 text-primary relative z-10" />
          )}
          
          {/* Pulsing glow based on volume */}
          {isPlaying && (
            <div 
              className="absolute inset-0 rounded-full bg-primary/20 transition-transform duration-100"
              style={{ 
                transform: `scale(${1 + audioVolume * 0.3})`,
                opacity: 0.5 + audioVolume * 0.5 
              }}
            />
          )}
        </div>

        {/* Station info */}
        <div className="flex-1 min-w-0">
          {currentStation ? (
            <>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-foreground truncate">{currentStation.name}</h4>
                {enrichedStation && (
                  <QualityBadge tier={enrichedStation.qualityTier} />
                )}
                {health && (
                  <StationHealthBadge health={health} size="sm" />
                )}
                {isProxied && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">
                        <Shield className="w-3 h-3" />
                        <span className="hidden sm:inline">Proxy</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Flux sécurisé via proxy HTTPS</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {currentStation.country}
                {/* Unstable stream warning */}
                {isUnstable && isPlaying && (
                  <span className="ml-2 text-red-400 inline-flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />
                    Flux instable
                  </span>
                )}
                {/* Silence warning */}
                {silent && isPlaying && !isUnstable && (
                  <span className="ml-2 text-amber-500 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Silence détecté
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <h4 className="font-medium text-muted-foreground">Aucune station</h4>
              <p className="text-sm text-muted-foreground">Sélectionnez une station pour écouter</p>
            </>
          )}
        </div>

        {/* Mini visualizer - uses fallback in safe mode or when CORS blocks WebAudio */}
        {isPlaying && (
          <div className="hidden sm:block">
            {useFallback ? (
              <FallbackVisualizer
                isPlaying={isPlaying}
                mode="bars"
                size="sm"
              />
            ) : (
              <AudioVisualizer
                fft={fft}
                volume={audioVolume}
                peak={peak}
                silent={silent}
                mode="bars"
                size="sm"
              />
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            disabled={!currentStation || isLoading}
            className={`neo-button-primary w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50 transition-all ${
              isPlaying ? 'animate-pulse-glow' : ''
            } ${peak ? 'scale-105' : 'scale-100'}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          <button
            onClick={toggleMute}
            className="neo-button p-2"
          >
            {muted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <div className="w-24 neo-track h-2 relative">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                peak ? 'bg-accent' : 'bg-primary'
              }`}
              style={{ width: `${(muted ? 0 : volume) * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
