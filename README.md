# 🌍 Globe Radio Vibe

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160-000000?logo=three.js)](https://threejs.org/)
[![SQLite WASM](https://img.shields.io/badge/SQLite-WASM-003B57?logo=sqlite)](https://www.sqlite.org/wasm/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite)](https://vitejs.dev/)

**Application radio interactive avec globe 3D immersif, 53 000+ stations mondiales, et base de données SQLite locale persistante. Aucune dépendance backend — tout fonctionne offline.**

[🌐 Démo live](#demo) • [📚 Documentation](#documentation) • [🚀 Démarrage rapide](#démarrage-rapide) • [🛠️ Développement](#développement)

---

## ✨ Fonctionnalités principales

### 🌍 **Globe 3D Interactif**
- Visualisation en temps réel du monde avec **Three.js**
- Sélection de pays en cliquant → affiche les stations locales
- Highlighting dynamique au survol
- Contrôles fluides (rotation, zoom, pan avec souris/trackpad)
- **Skybox étoilé** et atmosphère 3D
- Clustering spatial intelligente des stations (supercluster)

### 📻 **Base de 53 407 Stations**
- Données en temps réel de **RadioBrowser** (API open-source)
- **9 stations locales pré-chargées** (stations.json)
- Métadonnées complètes : URL, favicon, codec, débit, votes, géolocalisation
- Importation automatique au premier lancement
- Mise à jour manuelle : `npm run import:world-stations`

### 🎯 **Recherche & Filtrage Avancés**
- Recherche multicritères (nom, pays, langue, tags)
- Filtrage par pays, codec (MP3, AAC, etc.), débit binaire
- Tri par popularité (clicks, votes, tendance)
- **Pagination intelligente** (50-100 stations/page)
- Historique de recherche

### 🤖 **Moteur IA de Recommandation**
- Sélection d'**ambiances** : Relaxant, Énergique, Découverte, etc.
- Recommandations basées sur les tags et métadonnées
- Apprentissage des préférences utilisateur via **signaux AI**
- Suggestions contextuelles par pays

### ❤️ **Gestion Utilisateur Complète**
- ⭐ **Favoris** : Ajout/suppression en un clic
- 📜 **Historique** : Toutes les stations écoutées avec durée
- 📊 **Signaux AI** : Enregistrement des actions (play, skip, favorite)
- ⚙️ **Paramètres** : Préférences persistantes (volume, mode audio)

### 🔊 **Lecteur Audio Professionnel**
- **AudioVisualizer en temps réel** : Spectre FFT (0-256 Hz)
- Détection de silence automatique
- Indicateurs visuels d'état (Lecture, Chargement, Erreur)
- **Multi-candidat** : Reconnexion automatique en cas d'échec
- **Fallback visualizer** en mode sécurisé (Safe Mode)
- Gestion du volume avec slider
- Support des formats : MP3, AAC, OGG, FLAC

### 💾 **Stockage Local 100% Persistant**
- **SQLite WASM** s'exécute dans un **Web Worker dédié**
- Persistence via **OPFS** (Origin Private File System)
- Aucune requête backend après chargement initial
- Database survit aux rafraîchissements et fermetures navigateur
- Schéma versionné avec **migrations SQL**

---

## 🏗️ Architecture Technique

### Stack Complet

| Couche | Technologie | Rôle |
|--------|------------|------|
| **UI** | React 18 + TypeScript | Composants interactifs |
| **3D** | Three.js + @react-three/fiber | Globe, frontières, stations |
| **Audio** | Howler.js + HLS.js | Streaming adaptatif |
| **Data** | SQLite WASM (OPFS) | Persistence locale |
| **État** | Zustand + TanStack React Query | Gestion globale |
| **Build** | Vite 7.3 | Build + dev ultra-rapide |
| **UI Kit** | Radix UI + Tailwind CSS | Accessibilité + design |
| **Géo** | TopoJSON + d3-geo | Géométrie du monde |

### Flux de Données

```
┌─────────────────────────────────────────────────────────┐
│ React Components (GlobeScene, StationsPanel, PlayerBar) │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Zustand Stores                                          │
│ ├─ geo.store (pays sélectionné, loading)              │
│ ├─ radio.store (stations, santé, AI results)          │
│ ├─ player.store (station actuelle, volume, status)    │
│ └─ settings.store (préférences)                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Engine (Business Logic)                                 │
│ ├─ stationService (cache 5min, recherche)              │
│ ├─ healthMonitor (vérification flux toutes 2min)      │
│ ├─ aiEngine (recommandations par ambiance)            │
│ └─ audioAnalysis (FFT, volume, détection silence)    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ SQLite Repository (Pattern DAO)                         │
│ ├─ getByCountry()        ├─ search()                   │
│ ├─ getAll()              ├─ addFavorite()              │
│ ├─ recordPlay()          └─ recordSignal() [AI]        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Web Worker (sqlite-worker.ts)                           │
│ Opère isolé du thread principal                        │
│ - Exécution SQL non-bloquante                          │
│ - Import/export bulk                                    │
│ - Integrity checks & optimization                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ OPFS (Origin Private File System)                       │
│ Stockage persistant navigateur (~50MB disponible)      │
└─────────────────────────────────────────────────────────┘
```

### Structure Répertoires

```
src/
├── components/              # 🎨 Composants React
│   ├── GlobeScene.tsx       # Géométrie 3D, logique globe
│   ├── GlobeCanvas.tsx      # Wrapper @react-three/fiber
│   ├── StationsPanel.tsx    # Panneau latéral (tabs)
│   ├── PlayerBar.tsx        # Lecteur + visualizer
│   ├── StationsLayer.tsx    # Points stations sur globe
│   ├── CountryMeshes.tsx    # Rendu pays/frontières
│   ├── CountryPicker.tsx    # Hit-test et sélection
│   ├── CameraAnimator.tsx   # Transitions caméra
│   ├── AudioVisualizer.tsx  # FFT temps réel
│   ├── FallbackVisualizer.tsx # Mode sécurisé
│   ├── SearchBar.tsx        # Recherche multicritères
│   ├── AmbienceChips.tsx    # Sélection ambiance
│   ├── FavoritesPanel.tsx   # Gestion favoris
│   ├── HistoryPanel.tsx     # Historique écoute
│   └── Skybox.tsx           # Fond étoilé
│
├── engine/                  # ⚙️ Logique métier
│   ├── core/
│   │   ├── logger.ts        # Système log configurable
│   │   └── engineConfig.ts  # Config globale
│   ├── storage/sqlite/
│   │   ├── db.ts            # Façade DB + init worker
│   │   ├── stationRepository.ts  # DAO (insert/select/delete)
│   │   ├── migrations.sql   # Schéma SQLite version 1
│   │   └── seed/
│   │       └── stations.json # 9 stations locales
│   ├── radio/
│   │   ├── stationService.ts     # Cache + pagination
│   │   ├── health.ts             # Monitor santé flux
│   │   ├── ai.ts                 # Moteur recommandation
│   │   ├── enrichment/           # Métadonnées qualité
│   │   ├── dataset/              # Normalisation world dataset
│   │   └── sources/
│   │       └── radiobrowser.ts   # Intégration RadioBrowser
│   ├── player/              # État lecteur
│   ├── audio/               # Web Audio API
│   ├── geo/                 # Géospatiaux (clustering)
│   └── types/               # Interfaces TypeScript
│
├── worker/                  # 🔄 Web Workers
│   ├── sqlite-worker.ts     # Adapter SQLite WASM
│   └── sqlite-opfs-init.ts  # Client RPC → worker
│
├── stores/                  # 📊 État global (Zustand)
│   ├── geo.store.ts         # Pays, chargement
│   ├── radio.store.ts       # Stations, santé, AI
│   ├── player.store.ts      # Lecteur, volume
│   └── settings.store.ts    # Préférences
│
├── hooks/                   # 🪝 Custom React Hooks
│   ├── useStations.ts       # React Query + pagination
│   ├── usePlayer.ts         # État lecteur
│   ├── useAudioAnalysis.ts  # FFT & volume
│   ├── usePlaybackSignals.ts # Enregistrement AI
│   └── useGeoInteraction.ts # Interactions globe
│
├── lib/                     # 📦 Utilitaires
│   ├── geo/                 # GeoJSON, clustering
│   └── utils/               # Helpers génériques
│
├── App.tsx                  # Point d'entrée
└── main.tsx                 # Bootstrap React
```

---

## 🗄️ Base de Données SQLite

### Schéma Complet

```sql
-- Stations radio mondiales
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  url_resolved TEXT,
  homepage TEXT,
  favicon TEXT,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  state TEXT,
  language TEXT,
  language_codes TEXT,
  codec TEXT,
  bitrate INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  click_trend INTEGER DEFAULT 0,
  lat REAL,
  lon REAL,
  tags TEXT,                    -- CSV: "jazz,blues,news"
  last_check_ok INTEGER DEFAULT 1,
  last_check_time TEXT,
  updated_at TIMESTAMP
);

-- Favoris utilisateur
CREATE TABLE favorites (
  station_id TEXT PRIMARY KEY REFERENCES stations(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historique de lecture
CREATE TABLE play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT REFERENCES stations(id),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0
);

-- Signaux pour l'IA (actions utilisateur)
CREATE TABLE ai_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT REFERENCES stations(id),
  type TEXT CHECK(type IN ('play','skip','favorite_add','favorite_remove','error')),
  duration_seconds INTEGER DEFAULT 0,
  details TEXT,                 -- JSON: {"error": "CORS", "statusCode": 403}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Paramètres application
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,                   -- JSON stringifié
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Performance

| Opération | Durée | Notes |
|-----------|-------|-------|
| Query 100 stations | <50ms | Pagination LIMIT 100 |
| Recherche multicritères | ~100ms | Index sur name, country_code |
| Health check batch | ~200ms | 50 stations en parallèle |
| Insertion 500 stations | ~300ms | Transaction avec COMMIT |
| Select favoris | <10ms | Cache in-memory |

### Optimisations

```typescript
// PRAGMA appliqués au démarrage
PRAGMA foreign_keys = ON;           // Contraintes intégrité
PRAGMA temp_store = MEMORY;         // Temp tables en RAM
PRAGMA journal_mode = WAL;          // Write-Ahead Logging (concurrence)
PRAGMA synchronous = NORMAL;        // Balance durabilité/perf
```

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js 18+** (Web Workers, OPFS)
- **npm ou pnpm**
- **Navigateur moderne** : Chrome 104+, Firefox 111+, Safari 17.2+

### Installation

```bash
# Cloner le repo
git clone https://github.com/Giscolab/globe-radio-vibe.git
cd globe-radio-vibe

# Installer dépendances
npm install

# Lancer le dev server
npm run dev
# → http://localhost:8080
```

### Scripts NPM

```bash
npm run dev                    # Dev server avec hot-reload
npm run build                  # Build production optimisé
npm run build:dev              # Build en mode développement
npm run preview                # Aperçu build production

npm run lint                   # ESLint
npm run typecheck              # TypeScript strict

npm run import:world-stations  # Importer dataset RadioBrowser
npm run validate:world-stations # Valider structure données
npm run verify:world-stations  # Vérifier intégrité

npm run audio-proxy            # Proxy audio (HTTPS issues)
npm test                       # Suite de tests Vitest
```

### Configuration requise

**Headers HTTP** (Vite configure automatiquement) :
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Ces headers sont **critiques** pour OPFS (SharedArrayBuffer). Si le lancement échoue, vérifiez `vite.config.ts`.

---

## 🛠️ Développement

### Setup local

```bash
# 1. Cloner et installer
git clone <repo>
npm install

# 2. Vérifier les types TypeScript
npm run typecheck

# 3. Démarrer dev server
npm run dev

# 4. Ouvrir http://localhost:8080
# (Attendre le chargement du dataset 53K stations...)
```

### Workflow recommandé

```bash
# Avant chaque commit
npm run lint        # Fix ESLint issues
npm run typecheck   # Catch TypeScript errors

# Pour tester une modification database
npm run import:world-stations
npm run validate:world-stations

# Avant push
npm run build       # Vérifier production build
```

### Points clés pour développer

**1. Web Worker SQLite**
- Les requêtes DB passent par `src/worker/sqlite-opfs-init.ts`
- Ne bloquez **jamais** le thread principal
- Utilisez `await getDatabase()` pour l'initialisation

**2. Zustand Stores**
- État global dans `src/stores/`
- Subscriptions automatiques → re-renders optimisés
- Devtools : `npm run dev` → Redux DevTools

**3. React Query**
- Pagination : `useStations(countryCode, pageSize)`
- Cache TTL configuré
- Infinite queries pour "load more"

**4. Three.js & Globe**
- Géométrie dans `GlobeScene.tsx`
- OrbitControls pour interaction
- Raycast pour hit-testing pays

---

## 📊 Performance & Optimisations

### Métriques de Base

| Métrique | Valeur | Technique |
|----------|--------|-----------|
| Chargement initial | 2-3s | Code splitting (vendor chunks) |
| TTI (Time to Interactive) | 3-4s | Lazy load GlobeScene + StationsPanel |
| Mémoire heap | ~80-120MB | Zustand lightweight, cleanup |
| Database queries | <50ms | Pagination 50-100 rows |
| Bundle size (gzip) | ~250KB | Three.js séparé, TopoJSON minimisé |

### Optimisations appliquées

✅ **Code Splitting** (Vite manualChunks)
```javascript
{
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-ui': ['@radix-ui/...']
}
```

✅ **Lazy Loading**
```tsx
const GlobeCanvas = lazy(() => 
  import('@/components/GlobeCanvas').then(m => ({ default: m.GlobeCanvas }))
);
```

✅ **Web Worker** → pas de blocage UI
```typescript
// Les 53K stations importées en arrière-plan
```

✅ **React Query** → pagination smart
```typescript
useStations(countryCode, 50)  // 50 stations/page
// ↓ Requête suivante seulement si scroll down
```

✅ **Clustering spatial** → affichage globe fluide
```typescript
supercluster.getClusters(bounds, zoom)  // Dynamique
```

✅ **SQLite PRAGMA** → performance DB
```sql
PRAGMA journal_mode = WAL;     -- Concurrence
PRAGMA synchronous = NORMAL;   -- Balance perf/durabilité
```

---

## 🐛 Troubleshooting

### "SQLite OPFS initialization failed"

**Cause** : Headers CORS manquants  
**Solution** :
```bash
# Vérifier vite.config.ts
grep "Cross-Origin" vite.config.ts

# Redémarrer dev server
npm run dev
```

### Pas de son après sélection station

**Cause** : URL stream invalide ou CORS bloqué  
**Solution** :
1. Vérifier l'URL dans DevTools → Network
2. Activer audio-proxy : `npm run audio-proxy`
3. Chercher une autre station dans le même pays

### Visualizer figé (audio en arrière-plan)

**Cause** : CORS bloque WebAudio API  
**Solution** : Activer **Safe Mode** dans Settings ⚙️

### Stations ne s'affichent pas

**Cause** : Dataset non chargé  
**Solution** :
```bash
# Importer manuellement
npm run import:world-stations
npm run validate:world-stations
```

### Console pleine d'erreurs de log

**Cause** : Niveau de log trop verbeux  
**Solution** :
```bash
# Réduire verbosité
VITE_LOG_LEVEL=warn npm run dev

# Ou dans DevTools console : console.setLevel('error')
```

---

## 🤝 Contributions

Les contributions sont bienvenues ! Domaines prioritaires :

- 🎨 **UI/UX** : Nouveaux filtres, thèmes, responsive
- 🌍 **Géo** : Améliorations clustering, résolution pays
- 🔊 **Audio** : Égaliseurs, nouveaux analyseurs, effects
- 📊 **AI** : ML-based recommendations, pattern recognition
- 🚀 **Perf** : Optimisations DB, caching layers
- 🐛 **Bugs** : CORS issues, streaming instable

### Comment contribuer

1. **Fork** le repo
2. Créer une branche : `git checkout -b feature/my-feature`
3. Commit : `git commit -m "feat: add feature"`
4. Push : `git push origin feature/my-feature`
5. Ouvrir une **Pull Request**

### Standards de Code

- ✅ TypeScript strict mode
- ✅ ESLint + Prettier (lance automatiquement)
- ✅ React hooks best practices
- ✅ Tests Vitest pour logique critique

---

## 📈 Roadmap

- [ ] Tests unitaires (Vitest) + E2E (Playwright)
- [ ] Offline-first PWA (service worker)
- [ ] Sync cloud optionnel (backup favoris)
- [ ] Recommandations ML basées signaux utilisateur
- [ ] Support multi-langue (i18n)
- [ ] Mode sombre/clair amélioré
- [ ] Export données (JSON, CSV)
- [ ] Analyse statistiques écoute

---

## 📜 Licence

MIT © 2025 Giscolab  
Voir [LICENSE](LICENSE)

---

## 🙏 Remerciements

- **RadioBrowser** : Dataset open-source de 53K+ stations
- **Three.js** : Visualisation 3D web
- **SQLite WASM** : Base de données navigateur
- **React** & **TypeScript** : Fondations robustes

---

## 📞 Support

- 🐛 **Issues** : [GitHub Issues](https://github.com/Giscolab/globe-radio-vibe/issues)
- 💬 **Discussions** : [GitHub Discussions](https://github.com/Giscolab/globe-radio-vibe/discussions)
- 📧 **Email** : [contact info si disponible]

---

<div align="center">

Made with ❤️ by [Giscolab](https://github.com/Giscolab)

⭐ Si le projet vous plaît, n'hésitez pas à laisser une star !

</div>
