// Recommendations Panel - Personalized station suggestions
import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Radio } from 'lucide-react';
import { useRadioStore } from '@/stores/radio';
import { aiEngine, type AIExplanation } from '@/engine/radio/ai';
import { usePlayer } from '@/hooks/usePlayer';

export function RecommendationsPanel() {
  const { stations, recommendations, setRecommendations, currentStation, isPlaying } = useRadioStore();
  const { play, pause } = usePlayer();
  const [isLoading, setIsLoading] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, AIExplanation>>({});

  const loadRecommendations = async () => {
    if (stations.length === 0) return;
    
    setIsLoading(true);
    try {
      const result = aiEngine.recommend('', { stations, limit: 6 });
      setRecommendations(result.stations);
      setExplanations(result.explanations);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (stations.length > 0 && recommendations.length === 0) {
      loadRecommendations();
    }
  }, [stations.length]);

  const handleStationClick = (station: typeof stations[0]) => {
    if (currentStation?.id === station.id && isPlaying) {
      pause();
    } else {
      play(station);
    }
  };

  if (recommendations.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Recommandé pour toi</span>
        </div>
        <button
          onClick={loadRecommendations}
          disabled={isLoading}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {recommendations.slice(0, 6).map((station) => {
            const isActive = currentStation?.id === station.id;
            const isCurrentlyPlaying = isActive && isPlaying;
            
            return (
              <button
                key={station.id}
                onClick={() => handleStationClick(station)}
                className={`
                  flex items-center gap-2 p-2 rounded-lg text-left
                  transition-all duration-200
                  ${isActive 
                    ? 'neo-pressed bg-primary/10' 
                    : 'neo-flat hover:neo-pressed'
                  }
                `}
              >
                {station.favicon ? (
                  <img
                    src={station.favicon}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-8 h-8 rounded object-cover bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <Radio className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {station.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {station.country}
                  </div>
                  {explanations[station.id]?.summary && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {explanations[station.id].summary}
                    </div>
                  )}
                </div>
                {isCurrentlyPlaying && (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
