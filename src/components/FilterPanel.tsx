// Component - FilterPanel: collapsible filters for stations
import { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useRadioStore } from '@/stores/radio.store';

const GENRES = [
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'classical', label: 'Classique' },
  { id: 'electronic', label: 'Électro' },
  { id: 'hiphop', label: 'Hip-Hop' },
  { id: 'country', label: 'Country' },
];

const BITRATES = [
  { value: 64, label: '64+ kbps' },
  { value: 128, label: '128+ kbps' },
  { value: 192, label: '192+ kbps' },
  { value: 256, label: '256+ kbps' },
  { value: 320, label: '320 kbps' },
];

export function FilterPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    selectedGenre, 
    selectedBitrate, 
    onlineOnly,
    setSelectedGenre, 
    setSelectedBitrate,
    setOnlineOnly,
    clearFilters 
  } = useRadioStore();

  const hasActiveFilters = selectedGenre || selectedBitrate || onlineOnly;

  return (
    <div className="border-b border-border/50">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtres</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              Actifs
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Filter content */}
      {isOpen && (
        <div className="p-4 space-y-4 bg-muted/30">
          {/* Active filters pills */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {selectedGenre && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 text-primary rounded-full">
                  {GENRES.find(g => g.id === selectedGenre)?.label || selectedGenre}
                  <button onClick={() => setSelectedGenre(null)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedBitrate && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary/20 text-secondary rounded-full">
                  {selectedBitrate}+ kbps
                  <button onClick={() => setSelectedBitrate(null)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {onlineOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent/20 text-accent rounded-full">
                  En ligne
                  <button onClick={() => setOnlineOnly(false)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button 
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Effacer tout
              </button>
            </div>
          )}

          {/* Genre filter */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Genre
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(selectedGenre === genre.id ? null : genre.id)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedGenre === genre.id
                      ? 'neo-pressed bg-primary/20 text-primary'
                      : 'neo-raised-sm hover:bg-muted'
                  }`}
                >
                  {genre.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate filter */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Qualité audio
            </label>
            <div className="flex flex-wrap gap-2">
              {BITRATES.map((bitrate) => (
                <button
                  key={bitrate.value}
                  onClick={() => setSelectedBitrate(selectedBitrate === bitrate.value ? null : bitrate.value)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedBitrate === bitrate.value
                      ? 'neo-pressed bg-secondary/20 text-secondary'
                      : 'neo-raised-sm hover:bg-muted'
                  }`}
                >
                  {bitrate.label}
                </button>
              ))}
            </div>
          </div>

          {/* Online only toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Stations en ligne uniquement
            </label>
            <button
              onClick={() => setOnlineOnly(!onlineOnly)}
              className={`w-10 h-6 rounded-full transition-all ${
                onlineOnly 
                  ? 'bg-primary' 
                  : 'neo-pressed'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                onlineOnly ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
