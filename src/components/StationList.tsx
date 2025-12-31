// Component - StationList: display list of radio stations
import { Radio, Play, Pause, Globe, Music } from 'lucide-react';
import { Station, normalizeGenre } from '@/engine/types/radio';
import { usePlayer } from '@/hooks/usePlayer';

interface StationListProps {
  stations: Station[];
  isLoading?: boolean;
}

const genreColors: Record<string, string> = {
  pop: 'bg-genre-pop/20 text-genre-pop',
  rock: 'bg-genre-rock/20 text-genre-rock',
  jazz: 'bg-genre-jazz/20 text-genre-jazz',
  classical: 'bg-genre-classical/20 text-genre-classical',
  electronic: 'bg-genre-electronic/20 text-genre-electronic',
  hiphop: 'bg-genre-hiphop/20 text-genre-hiphop',
  country: 'bg-genre-country/20 text-genre-country',
  other: 'bg-muted text-muted-foreground',
};

export function StationList({ stations, isLoading }: StationListProps) {
  const { currentStation, status, play, toggle } = usePlayer();

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
        <p className="text-sm text-muted-foreground mt-1">Cliquez sur un pays pour voir ses stations</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
      {stations.map((station) => {
        const isActive = currentStation?.id === station.id;
        const isPlaying = isActive && status === 'playing';
        const genre = normalizeGenre(station.tags);

        return (
          <button
            key={station.id}
            onClick={() => isActive ? toggle() : play(station)}
            className={`w-full neo-raised p-3 transition-all hover:scale-[1.02] ${
              isActive ? 'ring-2 ring-primary neo-pressed' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Station icon/favicon */}
              <div className="neo-circle w-10 h-10 flex items-center justify-center flex-shrink-0 relative">
                {station.favicon ? (
                  <img
                    src={station.favicon}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <Radio className={`w-5 h-5 text-primary ${station.favicon ? 'hidden' : ''}`} />
                
                {/* Playing indicator */}
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-full animate-pulse">
                    <Pause className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>

              {/* Station info */}
              <div className="flex-1 min-w-0 text-left">
                <h4 className="font-medium text-foreground truncate text-sm">{station.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${genreColors[genre] || genreColors.other}`}>
                    {genre}
                  </span>
                  {station.bitrate && (
                    <span className="text-xs text-muted-foreground">{station.bitrate} kbps</span>
                  )}
                </div>
              </div>

              {/* Play button */}
              <div className={`neo-button-primary w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isPlaying ? 'animate-pulse-glow' : ''
              }`}>
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
