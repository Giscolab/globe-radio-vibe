#!/usr/bin/env node
/**
 * validate-data.mjs - Validate GeoJSON and station data.
 *
 * Usage: node scripts/validate-data.mjs [options]
 * Options:
 *   --geo <path>       Path to GeoJSON file (default: public/geo/world.json)
 *   --stations <path>  Path to stations file (default: public/data/world-stations.json)
 *   --strict           Exit with error on any warning
 *   --verbose          Show detailed validation info
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

let datasetHelpersPromise = null;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    geo: 'public/geo/world.json',
    stations: 'public/data/world-stations.json',
    strict: false,
    verbose: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    switch (args[index]) {
      case '--geo':
        options.geo = args[index + 1];
        index += 1;
        break;
      case '--stations':
        options.stations = args[index + 1];
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        break;
    }
  }

  return options;
}

async function loadDatasetHelpers() {
  if (!datasetHelpersPromise) {
    datasetHelpersPromise = import(
      pathToFileURL(
        resolve(PROJECT_ROOT, 'src', 'engine', 'radio', 'dataset', 'worldStationDataset.ts')
      ).href
    );
  }

  return datasetHelpersPromise;
}

class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  error(message) {
    this.errors.push(message);
    console.error(`ERROR: ${message}`);
  }

  warn(message) {
    this.warnings.push(message);
    console.warn(`WARNING: ${message}`);
  }

  log(message) {
    this.info.push(message);
    console.log(`INFO: ${message}`);
  }

  get hasErrors() {
    return this.errors.length > 0;
  }

  get hasWarnings() {
    return this.warnings.length > 0;
  }
}

function validateGeoJSON(data, result, verbose) {
  if (!data || typeof data !== 'object') {
    result.error('GeoJSON: Invalid root object');
    return;
  }

  if (data.type !== 'FeatureCollection') {
    result.error(`GeoJSON: Expected type "FeatureCollection", got "${data.type}"`);
    return;
  }

  if (!Array.isArray(data.features)) {
    result.error('GeoJSON: "features" must be an array');
    return;
  }

  const stats = {
    total: data.features.length,
    polygons: 0,
    multiPolygons: 0,
    withId: 0,
    withName: 0,
    invalidGeom: 0,
  };

  for (let index = 0; index < data.features.length; index += 1) {
    const feature = data.features[index];

    if (feature.type !== 'Feature') {
      result.warn(`GeoJSON: Feature ${index} has invalid type "${feature.type}"`);
      continue;
    }

    const geometry = feature.geometry;
    if (!geometry) {
      result.warn(`GeoJSON: Feature ${index} has no geometry`);
      stats.invalidGeom += 1;
      continue;
    }

    if (geometry.type === 'Polygon') {
      stats.polygons += 1;
    } else if (geometry.type === 'MultiPolygon') {
      stats.multiPolygons += 1;
    } else {
      result.warn(`GeoJSON: Feature ${index} has unsupported geometry type "${geometry.type}"`);
      stats.invalidGeom += 1;
    }

    if (feature.id !== undefined) stats.withId += 1;
    if (feature.properties?.name) stats.withName += 1;
  }

  if (verbose) {
    result.log(`GeoJSON: ${stats.total} features`);
    result.log(`GeoJSON: ${stats.polygons} polygons, ${stats.multiPolygons} multipolygons`);
    result.log(`GeoJSON: ${stats.withId} with ID, ${stats.withName} with name`);
  }

  if (stats.invalidGeom > 0) {
    result.warn(`GeoJSON: ${stats.invalidGeom} features with invalid geometry`);
  }

  if (stats.total === 0) {
    result.error('GeoJSON: No features found');
  }
}

function formatIssuePath(path) {
  if (!path || path.length === 0) {
    return '(root)';
  }

  return path.join('.');
}

function buildStationStats(stations) {
  const stats = {
    total: stations.length,
    withGeo: 0,
    withTags: 0,
    withBitrate: 0,
    countries: new Set(),
  };

  for (const station of stations) {
    if (station.geo?.lat !== undefined && station.geo?.lon !== undefined) {
      stats.withGeo += 1;
    }

    if (Array.isArray(station.tags) && station.tags.length > 0) {
      stats.withTags += 1;
    }

    if (station.bitrate && station.bitrate > 0) {
      stats.withBitrate += 1;
    }

    if (station.countryCode) {
      stats.countries.add(station.countryCode);
    }
  }

  return stats;
}

async function validateStations(data, result, verbose) {
  const { safeNormalizeWorldStationDatasetPayload } = await loadDatasetHelpers();
  const legacyArray = Array.isArray(data);
  const parsed = safeNormalizeWorldStationDatasetPayload(data, {
    acceptLegacyArray: true,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues;
    const visibleIssues = issues.slice(0, 25);
    for (const issue of visibleIssues) {
      result.error(`Stations: ${formatIssuePath(issue.path)} - ${issue.message}`);
    }

    if (issues.length > visibleIssues.length) {
      result.error(`Stations: ${issues.length - visibleIssues.length} additional validation issues omitted`);
    }
    return;
  }

  const payload = parsed.data;
  const stats = buildStationStats(payload.stations);

  if (legacyArray) {
    result.warn(
      'Stations: Legacy array format detected. Wrap the dataset in { version, generatedAt, source, total, stations }.'
    );
  }

  if (verbose) {
    result.log(
      `Stations: version=${payload.version}, generatedAt=${payload.generatedAt}, source=${payload.source}`
    );
    result.log(`Stations: ${stats.total} total, ${payload.total} declared`);
    result.log(
      `Stations: ${stats.withGeo} with geolocation (${Math.round((stats.withGeo / Math.max(stats.total, 1)) * 100)}%)`
    );
    result.log(`Stations: ${stats.withTags} with tags, ${stats.withBitrate} with bitrate`);
    result.log(`Stations: ${stats.countries.size} countries`);
  }

  if (stats.total === 0) {
    result.error('Stations: No valid stations found');
  }
}

async function validate() {
  const options = parseArgs();
  const result = new ValidationResult();

  console.log('Validating data files...\n');

  const geoPath = join(PROJECT_ROOT, options.geo);
  if (existsSync(geoPath)) {
    console.log(`Validating GeoJSON: ${options.geo}`);
    try {
      const data = JSON.parse(readFileSync(geoPath, 'utf-8'));
      validateGeoJSON(data, result, options.verbose);
    } catch (error) {
      result.error(`GeoJSON: Failed to parse - ${error.message}`);
    }
    console.log('');
  } else {
    result.log(`GeoJSON: File not found (${options.geo})`);
  }

  const stationsPath = join(PROJECT_ROOT, options.stations);
  if (existsSync(stationsPath)) {
    console.log(`Validating stations: ${options.stations}`);
    try {
      const data = JSON.parse(readFileSync(stationsPath, 'utf-8'));
      await validateStations(data, result, options.verbose);
    } catch (error) {
      result.error(`Stations: Failed to parse - ${error.message}`);
    }
    console.log('');
  } else {
    result.log(`Stations: File not found (${options.stations})`);
  }

  console.log('-'.repeat(50));
  console.log('\nValidation Summary:\n');
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Warnings: ${result.warnings.length}`);

  if (result.hasErrors) {
    console.log('\nValidation FAILED');
    process.exit(1);
  }

  if (options.strict && result.hasWarnings) {
    console.log('\nValidation FAILED (strict mode)');
    process.exit(1);
  }

  console.log('\nValidation PASSED');
}

validate();
