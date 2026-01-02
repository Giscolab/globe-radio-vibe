# 🌍 Globe Radio Engine

Application de radio mondiale interactive avec globe 3D, permettant d'explorer et d'écouter des stations radio du monde entier.

![Globe Radio Engine](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Three.js](https://img.shields.io/badge/Three.js-0.160-green)

## ✨ Fonctionnalités

- 🌐 **Globe 3D interactif** - Navigation fluide avec rotation et zoom
- 📻 **50 000+ stations** - Données RadioBrowser en temps réel
- 🎵 **Lecteur audio** - Streaming avec retry automatique
- ❤️ **Favoris** - Sauvegardez vos stations préférées
- 📜 **Historique** - Retrouvez vos écoutes récentes
- 🔍 **Recherche & filtres** - Par genre, bitrate, pays
- 💾 **Local-first** - Persistance SQLite WASM (OPFS)
- 🎨 **Design neumorphique** - Interface moderne et élégante

## 🚀 Démarrage rapide

```bash
# Installation des dépendances
npm install

# Configuration locale
cp .env.example .env

# Lancement du serveur de développement
npm run dev

# Vérification TypeScript
npm run typecheck

# Build de production
npm run build

# Tests
npm run test
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Application                                │
├─────────────────────────────────────────────────────────────────────┤
│  Pages              │  Components          │  Hooks                 │
│  - Index            │  - GlobeCanvas       │  - useStations         │
│  - NotFound         │  - StationsPanel     │  - useFavorites        │
│                     │  - PlayerBar         │  - useHistory          │
│                     │  - SearchBar         │  - usePlayer           │
│                     │  - FilterPanel       │  - useAudioAnalysis    │
├─────────────────────────────────────────────────────────────────────┤
│                          Stores (Zustand)                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬────────┐ │
│  │ radio.store │ audio.store │ health.store│ geo.store   │ai.store│ │
│  │ - stations  │ - analyzer  │ - status    │ - country   │- search│ │
│  │ - playback  │ - frequency │ - history   │ - globe     │- reco  │ │
│  │ - favorites │ - peaks     │ - monitor   │ - zoom      │- cache │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┴────────┘ │
│  settings.store (proxy, safeAudioMode) — persisté avec migration    │
├─────────────────────────────────────────────────────────────────────┤
│                            Engine                                    │
├───────────┬───────────┬───────────┬───────────┬───────────┬─────────┤
│   Core    │    Geo    │   Radio   │  Player   │  Storage  │  Audio  │
│ - logger  │ - proj    │ - service │ - audio   │ - sqlite  │ - FFT   │
│ - math    │ - cluster │ - repo    │ - retry   │ - export  │ - peaks │
│ - errors  │ - country │ - AI      │ - metrics │ - import  │ - smooth│
│ - throttle│ - topo    │ - health  │           │ - migrate │         │
└───────────┴───────────┴───────────┴───────────┴───────────┴─────────┘
```

### Structure détaillée

```
src/
├── engine/              # Logique métier (TypeScript pur, sans React)
│   ├── core/            # Utilitaires (logger, math, errors, throttle)
│   ├── audio/           # Analyse audio (FFT, détection de pics, lissage)
│   ├── geo/             # Géographie
│   │   ├── clustering/  # Supercluster pour 50k+ stations
│   │   ├── country/     # Index pays, point-in-polygon
│   │   ├── projection/  # Conversion lon/lat → 3D
│   │   └── topo/        # Chargement TopoJSON/GeoJSON
│   ├── media/           # Extraction couleurs, cache favicons
│   ├── player/          # Moteur audio
│   │   ├── audioEngine  # Wrapper Howler.js
│   │   ├── retryPolicy  # Retry exponentiel
│   │   └── metrics      # Statistiques d'écoute
│   ├── radio/           # Service stations
│   │   ├── ai/          # Moteur IA (scoring, recherche, recommandations)
│   │   ├── health/      # Monitoring santé stations
│   │   ├── enrichment/  # Mapping genres, badges qualité
│   │   ├── sources/     # RadioBrowser API
│   │   └── repository/  # Cache et validation
│   ├── storage/         # Persistance
│   │   ├── sqlite/      # SQLite WASM + migrations
│   │   └── export/      # Import/Export .db
│   └── types/           # Types partagés
├── components/          # Composants React
│   ├── ui/              # Primitives shadcn/ui
│   ├── GlobeCanvas      # Canvas Three.js
│   ├── StationsPanel    # Panel latéral avec tabs
│   ├── PlayerBar        # Barre de lecture
│   ├── StationsLayer    # Points stations (InstancedMesh)
│   ├── ClusterMarker    # Marqueurs clusters
│   ├── AudioVisualizer  # Visualisation audio temps réel
│   └── ...
├── hooks/               # Hooks personnalisés
│   ├── useStations      # Chargement stations par pays
│   ├── useFavorites     # Gestion favoris + SQLite
│   ├── useHistory       # Gestion historique + SQLite
│   ├── usePlayer        # Contrôle lecteur audio
│   ├── useAudioAnalysis # Analyse FFT temps réel
│   ├── useClusteredStations  # Clustering dynamique
│   └── useStationSearch # Recherche + filtres
├── stores/              # État global (Zustand avec subscribeWithSelector)
│   ├── radio/           # Stations, playback, favoris, historique
│   ├── ai.store         # Recherche IA, cache immuable, sync embeddings
│   ├── audio.store      # Analyse audio, fréquences, pics
│   ├── geo.store        # Pays sélectionné, état globe
│   ├── health.store     # Statut santé stations
│   └── settings.store   # Préférences utilisateur (persisté)
└── pages/               # Pages de l'application
```

### Principes architecturaux

1. **Séparation Engine/App** — L'engine est en TypeScript pur sans dépendance React
2. **Local-first** — SQLite WASM avec OPFS pour persistance durable
3. **Performance** — InstancedMesh pour 50k+ stations, supercluster pour clustering
4. **État immuable** — Tous les stores Zustand utilisent `subscribeWithSelector` et patterns immuables
5. **Scoring IA multicritère** — Santé, préférence, contexte, récence, diversité

### Flux de données

```
RadioBrowser API → StationService → SQLite → Zustand Stores → React Components
       ↑                                           ↓
   Validation Zod                           Three.js Globe
                    ↓
         Supabase Edge Functions (recherche IA, embeddings)
```

## 🛠️ Technologies

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **3D** | Three.js, React Three Fiber, React Three Drei |
| **Audio** | Howler.js |
| **Storage** | SQLite WASM (@sqlite.org/sqlite-wasm) |
| **État** | Zustand, TanStack Query |
| **API** | RadioBrowser |
| **Validation** | Zod |
| **Géo** | d3-geo, topojson-client, supercluster |

## 📦 Scripts CLI

### build-geo.mjs

Construit les données géographiques optimisées depuis world-atlas.

```bash
node scripts/build-geo.mjs [options]

Options:
  --resolution <110m|50m|10m>  Résolution carte (défaut: 110m)
  --output <path>              Dossier sortie (défaut: public/geo)
  --countries <codes>          Codes ISO séparés par virgule
  --simplify <factor>          Facteur simplification 0-1 (défaut: 0.01)

Exemples:
  node scripts/build-geo.mjs
  node scripts/build-geo.mjs --resolution 50m --countries FR,DE,ES
```

### import-stations.mjs

Importe les stations depuis l'API RadioBrowser.

```bash
node scripts/import-stations.mjs [options]

Options:
  --countries <codes>   Codes ISO (défaut: tous)
  --limit <n>           Max stations par pays (défaut: 1000)
  --output <path>       Fichier sortie (défaut: public/data/stations.json)
  --min-votes <n>       Votes minimum (défaut: 0)

Exemples:
  node scripts/import-stations.mjs --countries FR,US,JP --limit 500
  node scripts/import-stations.mjs --min-votes 10
```

### validate-data.mjs

Valide les données GeoJSON et stations.

```bash
node scripts/validate-data.mjs [options]

Options:
  --geo <path>       Fichier GeoJSON (défaut: public/geo/world.json)
  --stations <path>  Fichier stations (défaut: public/data/stations.json)
  --strict           Erreur sur warning
  --verbose          Affichage détaillé

Exemples:
  node scripts/validate-data.mjs --verbose
  node scripts/validate-data.mjs --strict
```

## 🗄️ Base de données

### Schéma SQLite

```sql
-- Stations
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  country_code TEXT,
  lat REAL, lon REAL,
  genre TEXT,
  bitrate INTEGER,
  data TEXT  -- JSON complet
);

-- Favoris
CREATE TABLE favorites (
  station_id TEXT PRIMARY KEY,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Historique d'écoute
CREATE TABLE play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  played_at TEXT DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0
);

-- Signaux IA (préférences utilisateur)
CREATE TABLE ai_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'play', 'skip', 'favorite', etc.
  duration_seconds INTEGER DEFAULT 0,
  details TEXT,              -- JSON métadonnées
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Paramètres utilisateur
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## 🧠 Moteur IA

Le moteur IA fournit des recommandations intelligentes avec :

- **Scoring multicritère** — Santé, préférences utilisateur, contexte, récence, diversité
- **Inférence d'intention** — Détecte l'intention utilisateur depuis des requêtes naturelles
- **Signaux contextuels** — Heure du jour, historique d'écoute, préférences de genre
- **Cache TTL** — Cache avec expiration et éviction LRU

```typescript
// Poids de scoring (configurables)
const weights = {
  health: 0.25,      // Fiabilité de la station
  preference: 0.30,  // Correspondance goûts utilisateur
  context: 0.20,     // Pertinence contextuelle
  recency: 0.15,     // Pénalité de fraîcheur
  diversity: 0.10,   // Bonus de variété
};
```

### Export/Import

```typescript
import { exportDatabase, importDatabase } from '@/engine/storage';

// Export vers fichier .db
const blob = await exportDatabase();

// Import depuis fichier
await importDatabase(file);
```

## 🧪 Tests

```bash
# Lancer tous les tests
npm run test

# Tests avec couverture
npm run test -- --coverage

# Tests en mode watch
npm run test -- --watch
```

### Structure des tests

```
src/engine/
├── geo/__tests__/
│   └── countryIndex.test.ts
├── radio/__tests__/
│   └── stationService.test.ts
├── player/__tests__/
│   └── audioEngine.test.ts
└── storage/__tests__/
    └── db.test.ts
```

## ⚙️ Variables d'environnement

Les variables nécessaires sont listées dans `.env.example` :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_LOG_LEVEL` (optionnel : `none`, `error`, `warn`, `info`, `debug`)

## 🩺 Troubleshooting audio

1. **CORS / Mixed content** : utilisez le proxy audio (`/functions/v1/audio-stream-proxy`).
2. **HLS** : certains flux `.m3u8` ne sont pas supportés selon le navigateur.
3. **Flux instables** : le health monitor détecte les stations offline/unstable.
4. **SSRF** : le proxy Edge bloque les hôtes privés (localhost, 127.0.0.1, 10/172/192).

## 📄 Documentation

- [Architecture détaillée](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Audio](docs/architecture/audio.md)
- [IA](docs/architecture/ai.md)
- [Storage](docs/architecture/storage.md)

## 🚢 Déploiement

### Via Lovable

Cliquez sur **Share → Publish** dans l'interface Lovable.

### Auto-hébergement

```bash
npm run build
# Servir le dossier dist/ avec n'importe quel serveur statique
```

## 📝 Licence

MIT
