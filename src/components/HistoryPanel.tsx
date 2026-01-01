// Component - HistoryPanel: display play history
import { History, Play, Trash2, Radio } from 'lucide-react';
import { useHistory } from '@/hooks/useHistory';
import { useRadioStore } from '@/stores/radio';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Station } from '@/engine/types';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

export function HistoryPanel() {
  const { history, clearHistory } = useHistory();
  const { currentStation, setCurrentStation, setIsPlaying } = useRadioStore();

  const handlePlay = (station: Station) => {
    setCurrentStation(station);
    setIsPlaying(true);
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="neo-circle w-16 h-16 flex items-center justify-center mb-4">
          <History className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Pas d'historique</h3>
        <p className="text-sm text-muted-foreground">
          Les stations écoutées apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with clear button */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {history.length} écoute{history.length > 1 ? 's' : ''}
        </span>
        <button
          onClick={clearHistory}
          className="neo-button p-2 text-destructive"
          title="Effacer l'historique"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* History list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {history.map((record, index) => {
            const isActive = currentStation?.id === record.station.id;
            
            return (
              <div
                key={`${record.station.id}-${index}`}
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
                    {record.station.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(record.playedAt)}
                    {record.durationSeconds > 0 && ` • ${Math.floor(record.durationSeconds / 60)}min`}
                  </p>
                </div>

                {/* Play button */}
                <button
                  onClick={() => handlePlay(record.station)}
                  className="neo-button p-2"
                  title="Réécouter"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
