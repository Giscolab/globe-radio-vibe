# 🌍 Globe Radio Engine v3.5

Application de radio mondiale interactive avec globe 3D, moteur de recommandation IA et architecture local-first.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript) ![Three.js](https://img.shields.io/badge/Three.js-0.160-000000?logo=three.js) ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite) ![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?logo=sqlite)

---

## ✨ Fonctionnalités

| Catégorie | Description |
|-----------|-------------|
| 🌐 **Globe 3D interactif** | Navigation fluide Three.js avec rotation, zoom et effet atmosphère Fresnel |
| 📻 **50 000+ stations** | Données RadioBrowser en temps réel avec clustering supercluster |
| 🎵 **Lecteur audio robuste** | Streaming Howler.js avec fallback proxy HTTPS et retry exponentiel |
| 🧠 **Moteur IA** | Recommandations multi-critères (santé, préférence, contexte, diversité) |
| 🔍 **Recherche sémantique** | Recherche IA via Edge Functions + embeddings pgvector |
| ❤️ **Favoris & Historique** | Persistance locale SQLite WASM (OPFS) |
| 🎛️ **Mode Audio Sûr** | Désactive WebAudio pour compatibilité maximale |
| 📊 **Monitoring santé** | Vérification temps réel de la santé des flux |
| 🎨 **Design neumorphique** | Interface moderne avec système de design tokens |

---

## 🚀 Démarrage rapide

```bash
# Installation
npm install

# Configuration
cp .env.example .env

# Développement
npm run dev

# Build production
npm run build

# Tests
npm run test

# Type check
npm run typecheck
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pages              │  Components              │  Hooks                      │
│  ├─ Index           │  ├─ GlobeCanvas          │  ├─ usePlayer              │
│  ├─ Login           │  ├─ StationsLayer        │  ├─ useStations            │
│  └─ NotFound        │  ├─ PlayerBar            │  ├─ useFavorites           │
│                     │  ├─ StationsPanel        │  ├─ useHistory             │
│                     │  ├─ AudioVisualizer      │  ├─ useAudioAnalysis       │
│                     │  ├─ RecommendationsPanel │  ├─ useClusteredStations   │
│                     │  └─ ui/ (shadcn)         │  └─ useEnrichedStation     │
├─────────────────────────────────────────────────────────────────────────────┤
│                           STORES (Zustand)                                   │
│  ┌────────────┬────────────┬────────────┬────────────┬────────────────────┐ │
│  │radio.store │audio.store │health.store│ geo.store  │     ai.store       │ │
│  │ stations   │ volume     │ status     │ selected   │ searchResults      │ │
│  │ favorites  │ bass/peak  │ latency    │ hovered    │ cache (TTL)        │ │
│  │ history    │ BPM        │ uptime     │ loading    │ syncProgress       │ │
│  │ filters    │ analyzer   │ aggregates │            │                    │ │
│  └────────────┴────────────┴────────────┴────────────┴────────────────────┘ │
│  settings.store (persisté v1) — proxy, safeAudioMode, theme, volume         │
├─────────────────────────────────────────────────────────────────────────────┤
│                              ENGINE (TypeScript pur)                         │
├──────────┬──────────┬───────────┬──────────┬───────────┬────────────────────┤
│   Core   │   Geo    │   Radio   │  Player  │  Storage  │       Audio        │
│ logger   │ cluster  │ service   │ engine   │ sqlite    │ analyzer           │
│ math     │ country  │ ai/       │ retry    │ export    │ fftSmoother        │
│ errors   │ proj     │ health/   │ metrics  │ import    │ peakDetector       │
│ throttle │ topo     │ enrichment│          │ migrations│                    │
└──────────┴──────────┴───────────┴──────────┴───────────┴────────────────────┘
```

---

## 📁 Structure détaillée

```
src/
├── components/                  # Composants React UI
│   ├── GlobeCanvas.tsx            # Globe 3D (React Three Fiber)
│   ├── StationsLayer.tsx          # Marqueurs stations (InstancedMesh)
│   ├── ClusterMarker.tsx          # Marqueurs clusters
│   ├── AtmosphereLayer.tsx        # Shader atmosphère Fresnel
│   ├── PlayerBar.tsx              # Lecteur audio principal
│   ├── StationsPanel.tsx          # Panel latéral multi-tabs
│   ├── StationList.tsx            # Liste stations enrichies
│   ├── FavoritesPanel.tsx         # Gestion favoris
│   ├── HistoryPanel.tsx           # Historique d'écoute
│   ├── SettingsPanel.tsx          # Paramètres utilisateur
│   ├── RecommendationsPanel.tsx   # Suggestions IA
│   ├── AudioVisualizer.tsx        # Visualiseur FFT temps réel
│   ├── FallbackVisualizer.tsx     # Visualiseur sans WebAudio
│   ├── SearchBar.tsx              # Barre de recherche
│   ├── FilterPanel.tsx            # Filtres genre/bitrate/qualité
│   ├── AmbienceChips.tsx          # Chips ambiance (chill, focus, etc.)
│   ├── GenrePills.tsx             # Pills genres colorés
│   ├── QualityBadge.tsx           # Badge qualité (low/medium/high/hd)
│   ├── PopularityIndicator.tsx    # Indicateur popularité
│   ├── StationHealthBadge.tsx     # Badge santé flux
│   └── ui/                        # Primitives shadcn/ui
│
├── engine/                      # Cœur métier (TypeScript pur, sans React)
│   ├── core/
│   │   ├── logger.ts              # Système de logs structuré
│   │   ├── math.ts                # Utilitaires mathématiques
│   │   ├── errors.ts              # Classes d'erreur custom
│   │   ├── throttle.ts            # Rate limiter pour API
│   │   └── engineConfig.ts        # Configuration engine
│   │
│   ├── audio/
│   │   ├── audioAnalyzer.ts       # WebAudio FFT + détection BPM
│   │   ├── fftSmoother.ts         # Lissage données fréquentielles
│   │   ├── peakDetector.ts        # Détection pics audio
│   │   └── index.ts               # Exports publics
│   │
│   ├── player/
│   │   ├── audioEngine.ts         # Source de vérité lecture (Howler.js)
│   │   ├── retryPolicy.ts         # Stratégie retry exponentiel
│   │   ├── metrics.ts             # Métriques de lecture
│   │   └── index.ts               # Exports publics
│   │
│   ├── radio/
│   │   ├── stationService.ts      # Service principal stations
│   │   ├── ai/
│   │   │   ├── aiEngine.ts        # Moteur scoring/recommandation
│   │   │   ├── searchAI.ts        # Interface Edge Functions
│   │   │   └── index.ts           # Exports publics AI
│   │   ├── enrichment/
│   │   │   ├── stationEnricher.ts # Enrichissement métadonnées
│   │   │   ├── genreMapper.ts     # Normalisation genres
│   │   │   ├── qualityBadge.ts    # Tier qualité (bitrate+codec)
│   │   │   ├── popularityScore.ts # Score popularité
│   │   │   ├── locationParser.ts  # Parsing localisation
│   │   │   ├── aiDescriptor.ts    # Descripteurs pour embeddings
│   │   │   └── index.ts           # Exports enrichment
│   │   ├── health/
│   │   │   ├── healthChecker.ts   # Vérification santé flux
│   │   │   ├── healthMonitor.ts   # Monitoring périodique
│   │   │   ├── healthHistory.ts   # Historique santé
│   │   │   └── index.ts           # Exports health
│   │   ├── repository/
│   │   │   └── stationRepo.ts     # Interface repository
│   │   ├── sources/
│   │   │   └── radiobrowser.ts    # Client API RadioBrowser
│   │   ├── utils/
│   │   │   └── httpsUpgrade.ts    # Logique proxy HTTPS
│   │   └── index.ts               # Exports radio
│   │
│   ├── geo/
│   │   ├── clustering/
│   │   │   └── stationCluster.ts  # Clustering supercluster
│   │   ├── country/
│   │   │   ├── countryIndex.ts    # Index spatial pays (rbush)
│   │   │   ├── containsCountry.ts # Point-in-polygon
│   │   │   └── isoMapping.ts      # Mapping ISO numérique → alpha-2
│   │   ├── projection/
│   │   │   └── lonLat.ts          # Conversions lat/lon ↔ XYZ
│   │   ├── topo/
│   │   │   ├── loadWorldAtlas.ts  # Chargement TopoJSON
│   │   │   └── topoToGeo.ts       # Conversion TopoJSON → GeoJSON
│   │   └── index.ts               # Exports geo
│   │
│   ├── storage/
│   │   ├── sqlite/
│   │   │   ├── db.ts              # Gestionnaire SQLite WASM (OPFS)
│   │   │   ├── migrations.sql     # Schéma SQL
│   │   │   ├── migrations.ts      # Application migrations
│   │   │   ├── stationRepository.ts # Repository stations
│   │   │   └── seed/
│   │   │       └── stations.json  # Données seed
│   │   ├── export/
│   │   │   ├── exportDb.ts        # Export base .db
│   │   │   └── importDb.ts        # Import base .db
│   │   └── index.ts               # Exports storage
│   │
│   ├── media/
│   │   ├── colorExtractor.ts      # Extraction couleurs favicon
│   │   └── faviconColorCache.ts   # Cache couleurs
│   │
│   ├── types/
│   │   ├── radio.ts               # Types Station, EnrichedStation, etc.
│   │   ├── geo.ts                 # Types CountryData, GeoPoint, etc.
│   │   └── index.ts               # Barrel export
│   │
│   └── index.ts                   # Exports engine principaux
│
├── stores/                      # États Zustand
│   ├── radio/
│   │   ├── radio.store.ts         # Stations, favoris, historique, filtres
│   │   ├── radio.types.ts         # Types du store
│   │   ├── radio.selectors.ts     # Sélecteurs dérivés
│   │   └── index.ts               # Export
│   ├── audio.store.ts             # Données audio temps réel
│   ├── health.store.ts            # Santé des flux
│   ├── geo.store.ts               # Pays sélectionné/survolé
│   ├── ai.store.ts                # Cache recherche IA
│   └── settings.store.ts          # Préférences persistées (v1)
│
├── hooks/                       # Hooks React custom
│   ├── usePlayer.ts               # Interface audioEngine
│   ├── useStations.ts             # Requêtes React Query (infinite)
│   ├── useAudioAnalysis.ts        # Données FFT temps réel
│   ├── useFavorites.ts            # Gestion favoris + SQLite
│   ├── useHistory.ts              # Historique écoute + SQLite
│   ├── useEnrichedStation.ts      # Enrichissement station
│   ├── useClusteredStations.ts    # Stations clusterisées
│   ├── useStationSearch.ts        # Recherche + filtres
│   ├── usePlaybackSignals.ts      # Signaux IA (play/skip/error)
│   └── useAuth.ts                 # Authentification Supabase
│
├── integrations/
│   └── supabase/
│       ├── client.ts              # Client Supabase (auto-généré)
│       └── types.ts               # Types DB (auto-généré)
│
├── pages/                       # Pages application
│   ├── Index.tsx                  # Page principale (globe + panels)
│   ├── Login.tsx                  # Page authentification
│   └── NotFound.tsx               # Page 404
│
├── utils/
│   └── image.ts                   # Utilitaire proxification images
│
├── config/
│   └── env.ts                     # Configuration environnement
│
├── lib/
│   └── utils.ts                   # Utilitaires (cn, etc.)
│
├── App.tsx                      # Composant racine
├── App.css                      # Styles globaux neumorphiques
├── index.css                    # Tokens CSS (design system)
└── main.tsx                     # Point d'entrée

supabase/functions/              # Edge Functions (Deno)
├── radio-proxy/                   # Proxy API RadioBrowser
├── audio-stream-proxy/            # Proxy flux audio HTTPS
├── check-station-health/          # Vérification santé distribuée
├── search-stations/               # Recherche sémantique IA
├── similar-stations/              # Stations similaires par descripteur
├── sync-embeddings/               # Batch sync embeddings pgvector
└── image-proxy/                   # Proxy images (favicons)

scripts/                         # Scripts CLI
├── build-geo.mjs                  # Build données géographiques
├── import-stations.mjs            # Import stations RadioBrowser
└── validate-data.mjs              # Validation données
```

---

## 📊 Stores Zustand

| Store | Responsabilité | Middleware | Persistance |
|-------|---------------|------------|-------------|
| `radio.store` | Stations, favoris, historique, filtres, AI results | — | Non |
| `audio.store` | Volume, peak, bass, BPM (haute fréquence) | `subscribeWithSelector` | Non |
| `health.store` | Santé flux, latence, uptime, stats agrégées | `subscribeWithSelector` | Non |
| `geo.store` | Pays sélectionné/survolé, loading | `subscribeWithSelector` | Non |
| `ai.store` | Cache recherche (Map immuable), sync progress | `subscribeWithSelector` | Non |
| `settings.store` | Préférences utilisateur (proxy, safeAudio, theme) | `persist` (v1) | Oui |

---

## 🧠 Moteur IA

### Système de scoring (v3.5)

| Critère | Poids | Description |
|---------|-------|-------------|
| **Health** | 30% | Fiabilité du flux (latence, uptime) |
| **Preference** | 25% | Correspondance favoris, tags préférés |
| **Context** | 20% | Heure du jour, pays, requête |
| **Recency** | 15% | Pénalité stations récemment jouées |
| **Diversity** | 10% | Bonus variété, pénalité sur-écoute |

### Pénalités

| Signal | Impact |
|--------|--------|
| Skip fréquent | -15% par skip |
| Erreur lecture | -10% par erreur |
| Flux instable | -35% |
| Flux offline | -60% |

### Intent Detection

```typescript
type UserIntent = 'focus' | 'chill' | 'discover' | 'explore';

// Détection basée sur:
// - Mots-clés dans la requête
// - Heure du jour (9h-17h → focus, 22h-5h → chill)
// - Mode smart actif → discover
// - Tags évités selon intent (talk, news, sports)
```

### Cache recommandations

- TTL : 5 minutes par défaut
- Taille max : 100 entrées
- Éviction : LRU (Least Recently Used)
- Clé : hash(stations + signals + context)

---

## 🗄️ Schéma SQLite

```sql
-- Stations (cache local ~10k+)
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
CREATE INDEX idx_stations_country ON stations(country_code);
CREATE INDEX idx_stations_name ON stations(name);
CREATE INDEX idx_stations_votes ON stations(
  json_extract(data, '$.votes') DESC
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

-- Signaux IA
CREATE TABLE ai_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'play', 'skip', 'favorite', 'error'
  duration_seconds INTEGER DEFAULT 0,
  details TEXT,                 -- JSON métadonnées
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Paramètres utilisateur
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## 🔌 Edge Functions

| Fonction | Endpoint | Rôle |
|----------|----------|------|
| `radio-proxy` | `/radio-proxy` | Proxy RadioBrowser API avec cache |
| `audio-stream-proxy` | `/audio-stream-proxy?url=` | Proxy HTTPS pour flux HTTP (ICY, Range) |
| `check-station-health` | `/check-station-health` | Vérification santé distribuée |
| `search-stations` | `/search-stations` | Recherche sémantique (Lovable AI) |
| `similar-stations` | `/similar-stations` | Stations similaires par embeddings |
| `sync-embeddings` | `/sync-embeddings` | Batch sync embeddings pgvector |
| `image-proxy` | `/image-proxy` | Proxy images (favicons CORS) |

---

## 🎵 Audio Engine - Invariants

1. **Source de vérité unique** pour l'état de lecture
2. **Fallback automatique** proxy/direct avec timeout 8s
3. **Transitions sérialisées** (une seule à la fois)
4. **Safe Audio Mode** pour compatibilité maximale (désactive WebAudio)
5. **Reconnexion automatique** avec backoff exponentiel
6. **Cache global source nodes** pour éviter InvalidStateError
7. **Visualisation fallback** en cas de blocage CORS

---

## 🛠️ Technologies

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | React 18.3, TypeScript 5.8, Tailwind CSS 3.4 |
| **Build** | Vite 7, ESLint 9 |
| **3D** | Three.js 0.160, @react-three/fiber 8, @react-three/drei 9 |
| **Audio** | Howler.js 2.2, Web Audio API |
| **Storage** | SQLite WASM 3.51 (OPFS) |
| **État** | Zustand 5, TanStack React Query 5 |
| **Backend** | Supabase Edge Functions (Deno), pgvector |
| **API** | RadioBrowser |
| **Validation** | Zod 3.25 |
| **Géo** | d3-geo 3.1, topojson-client 3.1, supercluster 8, rbush 4 |

---

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
```

---

## ⚙️ Variables d'environnement

```env
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_SUPABASE_PROJECT_ID=<project_id>
VITE_LOG_LEVEL=info  # none, error, warn, info, debug
```

---

## 🧪 Tests

```bash
# Tous les tests
npm run test

# Avec couverture
npm run test -- --coverage

# Mode watch
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

---

## 🩺 Troubleshooting

### Audio

| Problème | Solution |
|----------|----------|
| CORS / Mixed content | Utiliser le proxy audio (`audio-stream-proxy`) |
| HLS non supporté | Filtrage automatique des `.m3u8` sur desktop (sauf Safari) |
| Flux instables | Health monitor détecte automatiquement |
| SSRF | Proxy Edge bloque hôtes privés (localhost, 127.x, 10.x, 172.x, 192.x) |
| InvalidStateError | Cache global source nodes + cleanup |

### Performance

| Problème | Solution |
|----------|----------|
| TBT élevé | Chunking Vite + `requestIdleCallback` |
| Rendu lent | InstancedMesh pour stations (50k+) |
| Mémoire | LRU cache + TTL sur recommandations |

---

## 📄 Documentation

- [Architecture détaillée](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Audio](docs/architecture/audio.md)
- [IA](docs/architecture/ai.md)
- [Storage](docs/architecture/storage.md)

---

## 🚢 Déploiement

### Via Lovable

Cliquez sur **Share → Publish** dans l'interface.

### Auto-hébergement

```bash
npm run build
# Servir le dossier dist/ avec n'importe quel serveur statique
```

---

## 📝 Licence

MIT — voir [LICENSE](LICENSE)

---

## 🤝 Contribution

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines de contribution.
