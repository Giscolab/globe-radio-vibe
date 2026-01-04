// Engine - Radio Enrichment: Genre taxonomy and sub-genre mapping

// Comprehensive genre taxonomy with sub-genres
export const GENRE_TAXONOMY: Record<string, string[]> = {
  pop: ['pop', 'top 40', 'charts', 'hits', 'mainstream', 'adult contemporary', 'soft rock'],
  rock: ['rock', 'classic rock', 'indie rock', 'alternative', 'hard rock', 'punk', 'grunge', 'metal', 'heavy metal'],
  jazz: ['jazz', 'smooth jazz', 'bebop', 'jazz fusion', 'latin jazz', 'swing', 'big band', 'vocal jazz'],
  classical: ['classical', 'opera', 'symphony', 'baroque', 'romantic', 'contemporary classical', 'chamber music'],
  electronic: ['electronic', 'house', 'techno', 'trance', 'edm', 'dance', 'ambient', 'drum and bass', 'dubstep', 'chillout', 'lounge'],
  hiphop: ['hip hop', 'hip-hop', 'rap', 'r&b', 'rnb', 'urban', 'trap', 'soul', 'funk'],
  country: ['country', 'folk', 'bluegrass', 'americana', 'western', 'country rock'],
  world: ['world', 'latin', 'reggae', 'african', 'caribbean', 'brazilian', 'salsa', 'flamenco', 'celtic'],
  news: ['news', 'talk', 'talk radio', 'information', 'public radio'],
  sports: ['sports', 'sport'],
  religious: ['religious', 'christian', 'gospel', 'catholic', 'islamic', 'spiritual'],
  oldies: ['oldies', '60s', '70s', '80s', '90s', 'retro', 'vintage', 'nostalgia'],
};

// Reverse mapping for quick lookup
const TAG_TO_GENRE: Map<string, string> = new Map();
const TAG_TO_SUBGENRE: Map<string, string> = new Map();

// Build reverse mappings
for (const [genre, subGenres] of Object.entries(GENRE_TAXONOMY)) {
  for (const subGenre of subGenres) {
    const normalized = subGenre.toLowerCase();
    TAG_TO_GENRE.set(normalized, genre);
    TAG_TO_SUBGENRE.set(normalized, subGenre);
  }
}

/**
 * Extract sub-genres from station tags
 */
export function extractSubGenres(tags: string[], max: number = 5): string[] {
  const subGenres: string[] = [];
  const seen = new Set<string>();
  
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    const subGenre = TAG_TO_SUBGENRE.get(normalized);
    
    if (subGenre && !seen.has(subGenre)) {
      seen.add(subGenre);
      subGenres.push(subGenre);
      
      if (subGenres.length >= max) break;
    }
  }
  
  return subGenres;
}

/**
 * Get primary genre from tags
 */
export function getPrimaryGenre(tags: string[]): string {
  // Count genre occurrences
  const genreCounts = new Map<string, number>();
  
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    const genre = TAG_TO_GENRE.get(normalized);
    
    if (genre) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }
  
  if (genreCounts.size === 0) {
    return 'other';
  }
  
  // Return genre with highest count
  return Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Get icon/emoji for genre
 */
export function getGenreIcon(genre: string): string {
  const icons: Record<string, string> = {
    pop: '🎤',
    rock: '🎸',
    jazz: '🎷',
    classical: '🎻',
    electronic: '🎧',
    hiphop: '🎹',
    country: '🤠',
    world: '🌍',
    news: '📰',
    sports: '⚽',
    religious: '🙏',
    oldies: '📻',
    other: '🎵',
  };
  return icons[genre] || icons.other;
}

/**
 * Get display label for genre
 */
export function getGenreLabel(genre: string): string {
  const labels: Record<string, string> = {
    pop: 'Pop',
    rock: 'Rock',
    jazz: 'Jazz',
    classical: 'Classique',
    electronic: 'Électronique',
    hiphop: 'Hip-Hop',
    country: 'Country',
    world: 'Musique du monde',
    news: 'Info/Talk',
    sports: 'Sports',
    religious: 'Religieux',
    oldies: 'Oldies',
    other: 'Autre',
  };
  return labels[genre] || genre;
}

/**
 * Get all available genres
 */
export function getAllGenres(): string[] {
  return Object.keys(GENRE_TAXONOMY);
}
