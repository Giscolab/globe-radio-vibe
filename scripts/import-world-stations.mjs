#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const outputPath = resolve(projectRoot, 'public', 'data', 'world-stations.json');

function normalizeStation(station) {
  return {
    ...station,
    countryCode: station.countryCode?.toUpperCase() || '',
    tags: Array.from(new Set((station.tags || []).map((tag) => String(tag).trim()).filter(Boolean))).slice(0, 24),
    votes: Number(station.votes || 0),
    clickCount: Number(station.clickCount || 0),
    clickTrend: Number(station.clickTrend || 0),
    bitrate: station.bitrate != null ? Number(station.bitrate) : undefined,
    lastCheckOk: station.lastCheckOk !== false,
  };
}

async function main() {
  const radioBrowserModuleUrl = pathToFileURL(
    resolve(projectRoot, 'src', 'engine', 'radio', 'sources', 'radiobrowser.ts')
  ).href;
  const { fetchAllStations, dedupeStations } = await import(radioBrowserModuleUrl);

  console.log('[import-world-stations] Fetching stations from RadioBrowser...');
  const fetchedStations = await fetchAllStations({
    pageSize: 10000,
    hidebroken: true,
  });

  const normalizedStations = dedupeStations(fetchedStations.map(normalizeStation));
  const generatedAt = new Date().toISOString();
  const payload = {
    version: generatedAt,
    generatedAt,
    source: 'RadioBrowser',
    total: normalizedStations.length,
    stations: normalizedStations,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload));

  console.log(`[import-world-stations] Wrote ${payload.total} stations to ${outputPath}`);
  console.log('[import-world-stations] The app will import this dataset into SQLite OPFS on next startup.');
}

main().catch((error) => {
  console.error('[import-world-stations] Fatal error:', error);
  process.exit(1);
});
