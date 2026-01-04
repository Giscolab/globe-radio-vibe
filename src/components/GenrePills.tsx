// Component - GenrePills: Display genre tags as clickable pills
import { getGenreIcon } from '@/engine/radio/enrichment/genreMapper';

interface GenrePillsProps {
  genres?: string[]; // <-- sécurisé
  primaryGenre?: string;
  max?: number;
  onGenreClick?: (genre: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  insideButton?: boolean;
}

const genreColors: Record<string, string> = {
  pop: 'bg-genre-pop/15 text-genre-pop hover:bg-genre-pop/25',
  rock: 'bg-genre-rock/15 text-genre-rock hover:bg-genre-rock/25',
  jazz: 'bg-genre-jazz/15 text-genre-jazz hover:bg-genre-jazz/25',
  classical: 'bg-genre-classical/15 text-genre-classical hover:bg-genre-classical/25',
  electronic: 'bg-genre-electronic/15 text-genre-electronic hover:bg-genre-electronic/25',
  hiphop: 'bg-genre-hiphop/15 text-genre-hiphop hover:bg-genre-hiphop/25',
  country: 'bg-genre-country/15 text-genre-country hover:bg-genre-country/25',
  world: 'bg-secondary/15 text-secondary hover:bg-secondary/25',
  news: 'bg-muted text-muted-foreground hover:bg-muted/80',
  sports: 'bg-accent/15 text-accent hover:bg-accent/25',
  religious: 'bg-primary/15 text-primary hover:bg-primary/25',
  oldies: 'bg-genre-other/15 text-genre-other hover:bg-genre-other/25',
  other: 'bg-muted text-muted-foreground hover:bg-muted/80',
};

export function GenrePills({ 
  genres = [],        // <-- valeur par défaut
  primaryGenre = '',  // <-- valeur par défaut
  max = 3, 
  onGenreClick,
  size = 'sm',
  className = '',
  insideButton = false
}: GenrePillsProps) {

  if (genres.length === 0 && !primaryGenre) {
    return null;
  }

  const displayGenres = genres.slice(0, max);
  const remaining = genres.length - max;
  const isSmall = size === 'sm';

  const getColorClass = (genre: string): string => {
    const normalizedGenre = genre.toLowerCase();
    for (const [key, value] of Object.entries(genreColors)) {
      if (normalizedGenre.includes(key) || key.includes(normalizedGenre)) {
        return value;
      }
    }
    return genreColors.other;
  };

  const handleClick = (genre: string) => {
    onGenreClick?.(genre);
  };

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {primaryGenre && (
        insideButton ? (
          <span
            onClick={(e) => { e.stopPropagation(); handleClick(primaryGenre); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleClick(primaryGenre); } }}
            role="button"
            tabIndex={0}
            className={`
              inline-flex items-center gap-1 rounded-full transition-colors
              ${isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
              ${getColorClass(primaryGenre)}
              ${onGenreClick ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <span>{getGenreIcon(primaryGenre)}</span>
            <span className="capitalize">{primaryGenre}</span>
          </span>
        ) : (
          <button
            onClick={() => handleClick(primaryGenre)}
            className={`
              inline-flex items-center gap-1 rounded-full transition-colors
              ${isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
              ${getColorClass(primaryGenre)}
              ${onGenreClick ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <span>{getGenreIcon(primaryGenre)}</span>
            <span className="capitalize">{primaryGenre}</span>
          </button>
        )
      )}

      {displayGenres.map((genre) => (
        insideButton ? (
          <span
            key={genre}
            onClick={(e) => { e.stopPropagation(); handleClick(genre); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleClick(genre); } }}
            role="button"
            tabIndex={0}
            className={`
              inline-flex items-center rounded-full transition-colors
              ${isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
              ${getColorClass(genre)}
              ${onGenreClick ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <span className="capitalize">{genre}</span>
          </span>
        ) : (
          <button
            key={genre}
            onClick={() => handleClick(genre)}
            className={`
              inline-flex items-center rounded-full transition-colors
              ${isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
              ${getColorClass(genre)}
              ${onGenreClick ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <span className="capitalize">{genre}</span>
          </button>
        )
      ))}

      {remaining > 0 && (
        <span 
          className={`
            inline-flex items-center rounded-full bg-muted text-muted-foreground
            ${isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
          `}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
