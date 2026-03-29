import { Info, BarChart3, Activity, Radio, Wifi, WifiOff, Volume2, Headphones, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings.store';
import { useRadioStore } from '@/stores/radio';
import { needsProxy } from '@/engine/radio/utils/httpsUpgrade';
import { setSafeAudioMode as setSafeAudioModeEngine } from '@/engine/player/audioEngine';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlayer } from '@/hooks/usePlayer';
import { audioEngine } from '@/engine/player/audioEngine';
import { Badge } from '@/components/ui/badge';

export function SettingsPanel() {
  const { safeAudioMode, setSafeAudioMode } = useSettingsStore();
  const { stations, topStations } = useRadioStore();

  useEffect(() => {
    setSafeAudioModeEngine(safeAudioMode);
  }, [safeAudioMode]);

  const streamStats = useMemo(() => {
    const allStations = [...stations, ...topStations];
    const uniqueStations = Array.from(new Map(allStations.map((station) => [station.id, station])).values());

    const httpsCount = uniqueStations.filter((station) => station.url?.startsWith('https://')).length;
    const httpCount = uniqueStations.filter(
      (station) => station.url?.startsWith('http://') && !station.url?.startsWith('https://')
    ).length;
    const blockedOnSecureOrigin = uniqueStations.filter((station) => needsProxy(station.url || '')).length;
    const upgradedCount = httpCount - blockedOnSecureOrigin;

    return {
      total: uniqueStations.length,
      https: httpsCount,
      http: httpCount,
      upgraded: upgradedCount,
      blockedOnSecureOrigin,
    };
  }, [stations, topStations]);

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Mode Audio</h3>
        </div>

        <div className="neo-inset space-y-4 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">Mode audio sur</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Desactive l'analyse WebAudio pour maximiser la compatibilite. Activez si vous n'entendez pas de son.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch checked={safeAudioMode} onCheckedChange={setSafeAudioMode} />
          </div>

          <p className="text-xs text-muted-foreground">
            {safeAudioMode
              ? 'Lecture HTML5 directe. Visualiseur desactive pour privilegier la compatibilite.'
              : 'Analyse audio active. Le visualiseur est disponible mais certains navigateurs sont plus fragiles.'}
          </p>

          <TestBeepButton />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Compatibilite des flux</h3>
        </div>

        <div className="neo-inset space-y-3 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            <StatItem label="Stations analysees" value={streamStats.total} color="text-foreground" />
            <StatItem label="HTTPS natif" value={streamStats.https} color="text-emerald-400" />
            <StatItem label="HTTP upgradable" value={streamStats.upgraded} color="text-blue-400" />
            <StatItem
              label="Bloquees en HTTPS"
              value={streamStats.blockedOnSecureOrigin}
              color="text-amber-400"
              highlight
            />
          </div>

          {streamStats.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(streamStats.https / streamStats.total) * 100}%` }}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${(streamStats.upgraded / streamStats.total) * 100}%` }}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(streamStats.blockedOnSecureOrigin / streamStats.total) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  HTTPS
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Upgrade auto
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  HTTP only
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <AudioDiagnosticsPanel />

      <div className="space-y-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
        <p>
          <strong>HTTPS natif :</strong> flux deja securise, lecture directe.
        </p>
        <p>
          <strong>HTTP upgradable :</strong> flux HTTP de domaines connus, convertis vers HTTPS cote client.
        </p>
        <p>
          <strong>Bloquees en HTTPS :</strong> flux HTTP purs qui ne fonctionneront pas sur une origine HTTPS sans proxy local.
        </p>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded p-2 ${highlight ? 'bg-primary/10' : ''}`}>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TestBeepButton() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const playTestBeep = useCallback(() => {
    if (isPlaying) return;

    setIsPlaying(true);
    setResult(null);

    try {
      const WebkitAudioContext = (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
      const audioContext = new (window.AudioContext || WebkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.9);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);

      oscillator.onended = () => {
        setIsPlaying(false);
        setResult('success');
        void audioContext.close();
        setTimeout(() => setResult(null), 3000);
      };
    } catch (error) {
      console.error('Test beep error:', error);
      setIsPlaying(false);
      setResult('error');
      setTimeout(() => setResult(null), 3000);
    }
  }, [isPlaying]);

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={playTestBeep} disabled={isPlaying} className="gap-2">
        <Volume2 className="h-4 w-4" />
        {isPlaying ? 'Bip en cours...' : 'Jouer un bip test'}
      </Button>
      {result === 'success' && (
        <span className="text-xs text-emerald-500">Si vous avez entendu le bip, votre sortie audio fonctionne.</span>
      )}
      {result === 'error' && <span className="text-xs text-destructive">Erreur lors du test audio.</span>}
    </div>
  );
}

function AudioDiagnosticsPanel() {
  const { currentStation, status, currentUrl, urlType, candidateIndex, totalCandidates, error } = usePlayer();
  const [audioState, setAudioState] = useState<{
    readyState: number;
    networkState: number;
    currentTime: number;
    paused: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (status !== 'playing' && status !== 'loading') {
      setAudioState(null);
      return;
    }

    const updateState = () => {
      const audioElement = audioEngine.getAudioElement();
      if (!audioElement) {
        return;
      }

      setAudioState({
        readyState: audioElement.readyState,
        networkState: audioElement.networkState,
        currentTime: audioElement.currentTime,
        paused: audioElement.paused,
        error: audioElement.error?.message || null,
      });
    };

    updateState();
    const interval = setInterval(updateState, 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (!currentStation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Diagnostics Audio</h3>
        </div>
        <div className="neo-inset rounded-lg p-4">
          <p className="text-center text-sm text-muted-foreground">Aucune station en cours de lecture</p>
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
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Diagnostics Audio</h3>
      </div>

      <div className="neo-inset space-y-3 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{currentStation.name}</span>
          <Badge variant={status === 'playing' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
            {status}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {urlType === 'hls' ? (
              <Wifi className="h-4 w-4 text-blue-500" />
            ) : urlType === 'direct' ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs text-muted-foreground">
              Type: <strong>{urlType || 'N/A'}</strong>
              {totalCandidates > 1 && ` (candidat ${candidateIndex + 1}/${totalCandidates})`}
            </span>
          </div>
          {currentUrl && (
            <p className="truncate font-mono text-xs text-muted-foreground" title={currentUrl}>
              {currentUrl.length > 60 ? `${currentUrl.slice(0, 60)}...` : currentUrl}
            </p>
          )}
        </div>

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

        {(error || audioState?.error) && (
          <div className="flex items-center gap-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>{error || audioState?.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
