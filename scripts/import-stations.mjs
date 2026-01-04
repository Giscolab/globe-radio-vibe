#!/usr/bin/env node
/**
 * import-stations.mjs
 * Massive RadioBrowser import with SQLite persistence.
 *
 * Usage: node --loader ts-node/esm scripts/import-stations.mjs
 */

import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

async function main() {
  const { fetchAllStations } = await import(
    new URL("../src/engine/radio/sources/radiobrowser.ts", import.meta.url).href
  );
  const { initDatabase, getStorageMode } = await import(
    new URL("../src/engine/storage/sqlite/db.ts", import.meta.url).href
  );
  const { initSqliteRepository } = await import(
    new URL("../src/engine/storage/sqlite/stationRepository.ts", import.meta.url).href
  );

  const stations = await fetchAllStations({ pageSize: 10000, hidebroken: true });
  console.log(`✅ Fetched ${stations.length} stations from RadioBrowser`);

  await initDatabase();
  const repository = await initSqliteRepository();

  if (getStorageMode() !== "opfs") {
    console.warn("⚠️  OPFS is not active. Import will not persist across sessions.");
  }

  repository.insertMany(stations);
  console.log("✅ Stations inserted into SQLite");

  console.log(`📦 Project root: ${PROJECT_ROOT}`);
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
