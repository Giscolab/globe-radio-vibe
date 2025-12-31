// Component - FavoritesPanel: display favorite stations
import { Heart, Play, Radio } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useRadioStore } from '@/stores/radio.store';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Station } from '@/engine/types';

export function FavoritesPanel() {
  const { favorites, toggleFavorite } = useFavorites();
  const { currentStation, setCurrentStation, setIsPlaying } = useRadioStore();

  const handlePlay = (station: Station) => {
    setCurrentStation(station);
    setIsPlaying(true);
  };

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="neo-circle w-16 h-16 flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Pas de favoris</h3>
        <p className="text-sm text-muted-foreground">
          Cliquez sur le cœur d'une station pour l'ajouter à vos favoris
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {favorites.map((station) => {
          const isActive = currentStation?.id === station.id;
          
          return (
            <div
              key={station.id}
              className={`neo-raised-sm p-3 flex items-center gap-3 transition-all ${
                isActive ? 'ring-2 ring-primary' : ''
              }`}
            >
              {/* Station icon */}
              <div className={`neo-circle w-10 h-10 flex items-center justify-center ${
                isActive ? 'bg-primary text-primary-foreground' : ''
              }`}>
                <Radio className="w-5 h-5" />
              </div>

              {/* Station info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate">
                  {station.name}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {station.country} {station.bitrate ? `• ${station.bitrate}kbps` : ''}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlay(station)}
                  className="neo-button p-2"
                  title="Écouter"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleFavorite(station)}
                  className="neo-button p-2"
                  title="Retirer des favoris"
                >
                  <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
