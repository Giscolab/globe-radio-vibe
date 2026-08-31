# 🤝 Guide de Contribution

Merci de votre intérêt pour **Globe Radio Vibe** ! Ce document vous guide pour contribuer au projet.

## 📋 Avant de commencer

- Lisez le [README](README.md) pour comprendre l'architecture
- Vérifiez les [issues ouvertes](https://github.com/Giscolab/globe-radio-vibe/issues)
- Rejoignez les [discussions](https://github.com/Giscolab/globe-radio-vibe/discussions) pour les questions

---

## 🛠️ Setup de développement

### 1. Fork & Clone

```bash
# Fork le repo sur GitHub
# Puis cloner votre fork
git clone https://github.com/YOUR-USERNAME/globe-radio-vibe.git
cd globe-radio-vibe

# Ajouter upstream
git remote add upstream https://github.com/Giscolab/globe-radio-vibe.git
```

### 2. Installer les dépendances

```bash
npm install
npm run typecheck
npm run lint
```

### 3. Lancer le dev server

```bash
npm run dev
# http://localhost:8080
```

---

## 💡 Types de Contributions

### 🎨 UI/UX Improvements

**Exemples** :
- Nouveaux filtres de recherche
- Thèmes additionnels (dark mode amélioré)
- Amélioration responsive design
- Nouvelles icônes/animations

**Processus** :
```bash
git checkout -b feature/ui-improvement
# Modifier src/components/
npm run lint          # Fix issues
npm run typecheck     # Type checking
git commit -m "feat(ui): description"
git push origin feature/ui-improvement
```

### 🌍 Geospatial & Globe Features

**Exemples** :
- Améliorer clustering des stations
- Ajouter des overlays cartographiques
- Optimiser hit-testing pays
- Ajouter coordonnées manquantes

**Fichiers clés** :
- `src/components/GlobeScene.tsx`
- `src/engine/geo/`
- `src/lib/geo/`

### 🔊 Audio & Streaming

**Exemples** :
- Nouveaux analyseurs audio (STFT, wavelets)
- Égaliseur temps réel
- Support formats supplémentaires
- Gestion CORS améliorée

**Fichiers clés** :
- `src/components/AudioVisualizer.tsx`
- `src/engine/audio/`
- `src/hooks/useAudioAnalysis.ts`

### 📊 AI & Recommendations

**Exemples** :
- Améliorer moteur de recommandation
- ML-based user preference learning
- Clustering stations par genre
- Détection anomalies flux

**Fichiers clés** :
- `src/engine/radio/ai.ts`
- `src/engine/radio/dataset/`
- `src/stores/radio.store.ts`

### 🗄️ Database & Performance

**Exemples** :
- Optimiser requêtes SQLite
- Ajouter indexes de performance
- Améliorer schéma migrations
- Caching strategy

**Fichiers clés** :
- `src/engine/storage/sqlite/`
- `src/engine/radio/stationService.ts`
- `src/worker/sqlite-worker.ts`

### 🐛 Bug Fixes

**Processus** :
```bash
# Créer une issue d'abord
git checkout -b fix/issue-number-description
# Corriger le bug
npm run typecheck
npm run lint
git commit -m "fix: description (fixes #ISSUE_NUMBER)"
```

---

## 📝 Workflow de contribution

### 1. Créer une branche

```bash
# Toujours partir de main à jour
git fetch upstream
git checkout -b feature/descriptive-name upstream/main

# Format recommandé :
# feature/  → nouvelle fonctionnalité
# fix/      → correction bug
# docs/     → documentation
# perf/     → optimisation
# refactor/ → refactorisation
```

### 2. Développer avec les bonnes pratiques

```bash
# Vérifier le type avant chaque commit
npm run typecheck

# Fixer les problèmes ESLint
npm run lint

# Tester localement
npm run build

# Vérifier la base de données si modifié
npm run import:world-stations
npm run validate:world-stations
```

### 3. Commits atomiques

```bash
# Bons commits (atomiques)
git commit -m "feat(globe): add country highlighting on hover"
git commit -m "refactor(player): simplify volume control logic"
git commit -m "fix(audio): handle CORS blocked streams"

# Mauvais (trop mélangé)
git commit -m "Fix stuff and add features"
```

**Format de message** (Conventional Commits) :
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types acceptés** :
- `feat` → nouvelle fonctionnalité
- `fix` → correction bug
- `docs` → documentation
- `style` → formatage (sans impact logique)
- `refactor` → restructuration
- `perf` → optimisation
- `test` → tests
- `chore` → dépendances, config

**Exemples** :
```
feat(audio): add equalizer controls

Add 10-band equalizer to PlayerBar with preset configurations.
Implements WebAudio API BiquadFilter chains.

Closes #42
```

### 4. Push et Pull Request

```bash
# Garder à jour avec upstream
git fetch upstream
git rebase upstream/main

# Push vers votre fork
git push origin feature/descriptive-name
```

**Sur GitHub** :
1. Cliquez "Compare & pull request"
2. Remplissez le template PR
3. Décrivez :
   - **Quoi** : Changements effectués
   - **Pourquoi** : Raison/issue
   - **Comment** : Approche technique
4. Référencez une issue : `Closes #42`

**Template PR à utiliser** :
```markdown
## Description
[Décrivez les changements]

## Type de changement
- [ ] Nouvel feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation

## Problème lié
Closes #ISSUE_NUMBER

## Screenshots (si UI)
[Avant/après si applicable]

## Checklist
- [ ] Code suit les standards du projet
- [ ] Tests passent (npm run typecheck + lint)
- [ ] Documentation mise à jour
- [ ] Commits avec messages clairs
```

---

## ✅ Standards de Code

### TypeScript

```typescript
// ✅ BON
interface Station {
  id: string;
  name: string;
  country: string;
  geo?: { lat: number; lon: number };
}

export async function getStationsByCountry(
  countryCode: string,
  options?: { limit?: number }
): Promise<Station[]> {
  // ...
}

// ❌ MAUVAIS
let station: any = {};
function getStations(c: string) {
  // ...
}
```

**Règles** :
- ✅ Strict mode activé (`tsconfig.json`)
- ✅ Types explicites (pas `any`)
- ✅ Interfaces/Types pour objets
- ✅ JSDoc pour fonctions publiques

### React & Hooks

```typescript
// ✅ BON
export function GlobeScene() {
  const [features, setFeatures] = useState<Feature[]>([]);
  
  useEffect(() => {
    loadGeoData();
  }, []);
  
  return <canvas ref={canvasRef} />;
}

// ❌ MAUVAIS
export function GlobeScene() {
  const features = useSelector(state => state.features); // pas memoized
  
  useEffect(() => {
    loadGeoData();
  }); // missing dependencies
  
  return <canvas />;
}
```

**Règles** :
- ✅ Functional components + hooks
- ✅ `useCallback` pour callbacks stables
- ✅ Dépendances `useEffect` complètes
- ✅ Pas de side effects dans render

### Styling

```tsx
// ✅ BON (Tailwind + custom CSS)
<div className="neo-raised-lg p-4 flex items-center gap-2">
  <Icon className="w-5 h-5" />
  <span>Texte</span>
</div>

// ❌ MAUVAIS (inline styles)
<div style={{padding: '1rem', display: 'flex'}}>
</div>
```

**Conventions** :
- ✅ Tailwind CSS pour layout
- ✅ `src/App.css` pour neumorphisme
- ✅ CSS modules si nécessaire
- ✅ Pas de `!important`

### Database

```typescript
// ✅ BON
async getByCountry(countryCode: string): Promise<Station[]> {
  const db = await this.getDb();
  return db.selectObjects<StationRow>(
    'SELECT * FROM stations WHERE country_code = ? LIMIT ?',
    [countryCode.toUpperCase(), 100]
  );
}

// ❌ MAUVAIS (SQL injection risk)
async getByCountry(countryCode: string): Promise<Station[]> {
  return db.selectObjects(
    `SELECT * FROM stations WHERE country_code = '${countryCode}'`
  );
}
```

**Règles** :
- ✅ Parameterized queries toujours
- ✅ Transactions pour bulk ops
- ✅ Indexes sur colonnes filtrées
- ✅ LIMIT sur queries ouvertes

---

## 🧪 Tests

### Tests unitaires (Vitest)

```typescript
// src/__tests__/engine/radio/stationService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getByCountry } from '@/engine/radio/stationService';

describe('stationService', () => {
  beforeEach(() => {
    // Setup
  });

  it('should return stations for valid country code', async () => {
    const stations = await getByCountry('FR');
    expect(stations).toHaveLength(expect.any(Number));
    expect(stations[0]).toHaveProperty('country');
  });
});
```

**Lancer les tests** :
```bash
npm test
npm test -- --ui  # UI mode
```

---

## 📚 Documentation

### Pour les fonctionnalités complexes

```typescript
/**
 * Calcule les clusters de stations visibles dans les limites de la caméra.
 * Utilise l'algorithme supercluster pour performance O(log n).
 * 
 * @param bounds - Limites géographiques {minX, maxX, minY, maxY}
 * @param zoom - Niveau de zoom actuel (0-20)
 * @returns Clusters et stations individuelles
 * 
 * @example
 * const result = getClusters({minX: -180, maxX: 180, minY: -90, maxY: 90}, 4);
 * // → {clusters: [...], stations: [...]}
 */
export function getClusters(bounds: Bounds, zoom: number): ClusterResult {
  // ...
}
```

### Pour les nouvelles features

Ajouter une section au README :
```markdown
## 🆕 Nouvelle Feature

### Description
Qu'est-ce que ça fait ?

### Usage
```typescript
// Exemple code
```

### Performance
Métriques si applicable
```

---

## 🚀 Performance

**Avant de soumettre une PR** :

```bash
# Build production
npm run build

# Vérifier bundle size
npm run build -- --analyze

# Profiler avec DevTools
# Chrome: F12 → Performance tab
```

**Checklist performance** :
- ❌ Pas de `<console.log>` en production
- ✅ Images optimisées (< 100KB)
- ✅ Lazy loading pour composants lourds
- ✅ Pas de requêtes N+1 database
- ✅ Memoization pour calculs coûteux

---

## 🔒 Security

- ✅ **SQL Injection** : Toujours parameterized queries
- ✅ **XSS** : React échappe automatiquement le contenu
- ✅ **CORS** : Vérifier headers OPFS
- ✅ **Secrets** : Jamais commiter de tokens/API keys
- ✅ **Dependencies** : Garder à jour (`npm audit`)

---

## ❓ Questions ?

- 💬 Ouvrez une [Discussion](https://github.com/Giscolab/globe-radio-vibe/discussions)
- 🐛 Un bug ? Créez une [Issue](https://github.com/Giscolab/globe-radio-vibe/issues)
- 📧 Email : [contact si disponible]

---

## 🙏 Merci !

Vos contributions rendent Globe Radio Vibe meilleur. On apprécie votre temps et votre énergie !

<div align="center">

**Happy coding! 🚀**

</div>
