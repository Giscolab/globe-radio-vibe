// Component - GenreLegend: shows color legend for genre markers on globe
import { memo } from 'react';
import { GENRE_COLOR_HEX } from './stations-layer-colors';
import { getGenreLabel, getGenreIcon } from '@/engine/radio/enrichment/genreMapper';

const VISIBLE_GENRES = ['pop', 'rock', 'jazz', 'classical', 'electronic', 'hiphop', 'world', 'other'];

export const GenreLegend = memo(function GenreLegend() {
  return (
    <div className="absolute bottom-20 left-4 neo-raised p-3 rounded-lg bg-background/90 backdrop-blur-sm z-10">
      <h4 className="text-xs font-semibold text-muted-foreground mb-2">Genres</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {VISIBLE_GENRES.map(genre => (
          <div key={genre} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: GENRE_COLOR_HEX[genre] }}
            />
            <span className="text-xs text-foreground truncate">
              {getGenreIcon(genre)} {getGenreLabel(genre)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
