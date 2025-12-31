import { Play, Pause, Volume2, VolumeX, Radio } from 'lucide-react';
import { useRadioStore } from '@/stores/radio.store';

export function PlayerBar() {
  const { currentStation, isPlaying, volume, setIsPlaying, setVolume } = useRadioStore();

  return (
    <div className="neo-raised-lg p-4">
      <div className="flex items-center gap-4">
        {/* Station info */}
        <div className="neo-circle w-14 h-14 flex items-center justify-center flex-shrink-0">
          {currentStation?.favicon ? (
            <img src={currentStation.favicon} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <Radio className="w-6 h-6 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {currentStation ? (
            <>
              <h4 className="font-medium text-foreground truncate">{currentStation.name}</h4>
              <p className="text-sm text-muted-foreground truncate">{currentStation.country}</p>
            </>
          ) : (
            <>
              <h4 className="font-medium text-muted-foreground">Aucune station</h4>
              <p className="text-sm text-muted-foreground">Sélectionnez une station pour écouter</p>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!currentStation}
            className={`neo-button-primary w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50 ${
              isPlaying ? 'animate-pulse-glow' : ''
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
            className="neo-button p-2"
          >
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <div className="w-24 neo-track h-2 relative">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              style={{ width: `${volume * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
