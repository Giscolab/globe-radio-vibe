# Architecture

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                      Application                         │
├─────────────────────────────────────────────────────────┤
│  Pages          │  Components       │  Hooks            │
│  - Index        │  - GlobeCanvas    │  - useStations    │
│                 │  - StationsPanel  │  - useFavorites   │
│                 │  - PlayerBar      │  - useHistory     │
├─────────────────────────────────────────────────────────┤
│                       Stores (Zustand)                   │
│  - radio.store (stations, playback, favorites, history) │
│  - geo.store (selected country, globe state)            │
├─────────────────────────────────────────────────────────┤
│                        Engine                            │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│   Core   │   Geo    │  Radio   │  Player  │   Storage   │
│ - logger │ - proj   │ - service│ - audio  │ - sqlite    │
│ - math   │ - cluster│ - repo   │ - retry  │ - export    │
│ - errors │ - country│          │ - metrics│ - import    │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

## Principes

1. **Séparation Engine/App**: L'engine est en TypeScript pur sans dépendance React
2. **Local-first**: SQLite WASM avec OPFS pour persistance durable
3. **Performance**: InstancedMesh pour 50k+ stations, supercluster pour clustering
4. **Neumorphisme**: Design system cohérent via CSS variables

## Flux de données

```
RadioBrowser API → StationService → SQLite → Zustand Store → React Components
```
