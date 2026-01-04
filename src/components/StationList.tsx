// Component - StationList: display list of enriched radio stations
import React, { useState, useCallback } from 'react';
import { Radio, Play, Pause, Globe, MapPin, Wifi, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Station } from '@/engine/types/radio';
import { usePlayer } from '@/hooks/usePlayer';
import { QualityBadge } from './QualityBadge';
import { PopularityIndicator } from './PopularityIndicator';
import { GenrePills } from './GenrePills';
import { HealthDot } from './StationHealthBadge';
import { useRadioStore } from '@/stores/radio';
import { checkStationHealth } from '@/engine/radio/health/healthChecker';
import { shallow } from 'zustand/shallow';
import { proxify } from '@/utils/image';

interface StationListProps {
  stations?: Station[];
  isLoading?: boolean;
}

export function StationList({ stations = [], isLoading }: StationListProps) {
  const { currentStation, status, play, toggle } = usePlayer();

  const stationHealth = useRadioStore((s) => s.stationHealth, shallow);
  const setSelectedGenre = useRadioStore((s) => s.setSelectedGenre);
  const setStationHealth = useRadioStore((s) => s.setStationHealth);

  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [brokenFavicons, setBrokenFavicons] = useState<Set<string>>(new Set());

  const handleFaviconError = useCallback((stationId: string) => {
    setBrokenFavicons((prev) => new Set(prev).add(stationId));
  }, []);

  const handleTestConnection = useCallback(
    async (e: React.MouseEvent, station: Station) => {
      e.stopPropagation();

      const url = station.urlResolved || station.url;
      if (!url) return;

      let shouldTest = false;
      setTestingIds((prev) => {
        if (prev.has(station.id)) return prev;
        shouldTest = true;
        const next = new Set(prev);
        next.add(station.id);
        return next;
      });

      if (!shouldTest) return;

      try {
        const health = await checkStationHealth(url, 5000, station.id);
        setStationHealth(station.id, health);
      } finally {
        setTestingIds((prev) => {
          const next = new Set(prev);
          next.delete(station.id);
          return next;
        });
      }
    },
    [setStationHealth]
  );

  const handleGenreClick = useCallback(
    (genre: string) => {
      setSelectedGenre(genre);
    },
    [setSelectedGenre]
  );

  const handleRowAction = useCallback(
    (station: Station) => {
      const isActive = currentStation?.id === station.id;
      if (isActive) {
        toggle();
      } else {
        play(station);
      }
    },
    [currentStation?.id ?? '', play, toggle]
  );

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, station: Station) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRowAction(station);
      }
    },
    [handleRowAction]
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="neo-raised p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="p-8 text-center">
        <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucune station trouvée</p>
        <p className="text-sm text-muted-foreground mt-1">
          Cliquez sur un pays pour voir ses stations
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
      {stations.map((station) => {
        const isActive = currentStation?.id === station.id;
        const isPlaying = isActive && status === 'playing';
        const health = stationHealth?.[station.id] ?? null;
        const faviconUrl = proxify(station.favicon);

        return (
          <div
            key={station.id}
            role="button"
            tabIndex={0}
            onClick={() => handleRowAction(station)}
            onKeyDown={(e) => handleRowKeyDown(e, station)}
            className={`w-full neo-raised p-3 transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 ${
              isActive ? 'ring-2 ring-primary neo-pressed' : ''
            }`}
            style={{
              borderLeft: station.colors
                ? `3px solid ${station.colors.dominant}`
                : undefined,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="neo-circle w-10 h-10 flex items-center justify-center flex-shrink-0 relative"
                style={{
                  background: station.colors
                    ? `linear-gradient(135deg, ${station.colors.dominant}20, ${station.colors.secondary}20)`
                    : undefined,
                }}
              >
                {faviconUrl && !brokenFavicons.has(station.id) ? (
                  <img
                    src={faviconUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-7 h-7 rounded-full object-cover"
                    onError={() => handleFaviconError(station.id)}
                  />
                ) : (
                  <Radio className="w-5 h-5 text-primary" />
                )}

                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-full animate-pulse">
                    <Pause className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <HealthDot health={health} />
                  <h4 className="font-medium text-foreground truncate text-sm">
                    {station.name}
                  </h4>
                  <QualityBadge tier={station.qualityTier} />
                  <PopularityIndicator
                    score={station.popularityScore}
                    tier={station.popularityTier}
                  />
                </div>

                {station.displayLocation && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{station.displayLocation}</span>
                  </div>
                )}

                <div className="mt-1.5">
                  <GenrePills
                    genres={station.subGenres}
                    primaryGenre={station.primaryGenre}
                    max={2}
                    onGenreClick={handleGenreClick}
                    size="sm"
                    insideButton
                  />
                </div>

                {station.bitrate && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {station.bitrate} kbps
                      {station.codec && ` • ${station.codec.toUpperCase()}`}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => handleTestConnection(e, station)}
                disabled={testingIds.has(station.id)}
                className="neo-raised w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform disabled:opacity-50"
                title="Tester la connexion"
                aria-label={`Tester la connexion de ${station.name}`}
              >
                {testingIds.has(station.id) ? (
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                ) : health?.ok === true ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : health?.ok === false ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlaying) {
                    toggle();
                  } else {
                    play(station);
                  }
                }}
                className={`neo-button-primary w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isPlaying ? 'animate-pulse-glow' : ''
                }`}
                aria-label={isPlaying ? `Pause ${station.name}` : `Play ${station.name}`}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
