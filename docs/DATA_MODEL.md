# Data Model

## Station

```typescript
interface Station {
  id: string;           // UUID unique
  name: string;         // Nom de la station
  url: string;          // URL du stream
  homepage?: string;    // Site web
  favicon?: string;     // Logo
  country: string;      // Nom du pays
  countryCode: string;  // ISO 3166-1 alpha-2
  state?: string;       // Région/État
  language?: string;    // Langue principale
  tags: string[];       // Tags/genres
  codec?: string;       // Codec audio
  bitrate?: number;     // Bitrate en kbps
  votes?: number;       // Votes utilisateurs
  clickCount?: number;  // Nombre de clics
  lastCheckOk?: boolean;// Dernière vérification OK
  geo?: {
    lat: number;        // Latitude
    lon: number;        // Longitude
  };
}
```

## SQLite Schema

```sql
-- Stations
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  country_code TEXT,
  lat REAL,
  lon REAL,
  genre TEXT,
  bitrate INTEGER,
  data TEXT  -- JSON complet
);

-- Favoris
CREATE TABLE favorites (
  station_id TEXT PRIMARY KEY,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Historique
CREATE TABLE play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  played_at TEXT DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0
);

-- Paramètres
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```
