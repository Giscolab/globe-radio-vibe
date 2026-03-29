# Globe Radio Vibe

Globe radio app built with React, Three.js and a fully local SQLite WASM stack.

## Current architecture

- No backend SaaS dependency remains in the app.
- SQLite runs in a dedicated Web Worker.
- Persistence uses OPFS, so the local database survives refreshes and browser restarts.
- The worker applies `migrations.sql`, seeds the 9 local stations from `src/engine/storage/sqlite/seed/stations.json`, then imports the world dataset from `public/data/world-stations.json` when its version changes.
- Runtime queries go through the local SQLite repository only.

## Local data

- Local seed: `src/engine/storage/sqlite/seed/stations.json`
- World dataset source file: `public/data/world-stations.json`
- Import script: `scripts/import-world-stations.mjs`

The current generated world dataset contains `53,407` RadioBrowser stations.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run import:world-stations
npm run validate:world-stations
npm run verify:world-stations
npm run check:world-stations
```

## OPFS requirements

SQLite OPFS requires these headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

They are configured in `vite.config.ts` for both `dev` and `preview`.

## Important files

- `src/worker/sqlite-worker.ts`
- `src/worker/sqlite-opfs-init.ts`
- `src/engine/storage/sqlite/db.ts`
- `src/engine/storage/sqlite/stationRepository.ts`
- `src/engine/radio/stationService.ts`
- `src/engine/radio/sources/radiobrowser.ts`
- `scripts/import-world-stations.mjs`
