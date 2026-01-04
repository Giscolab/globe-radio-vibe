#!/usr/bin/env node
/**
 * validate-data.mjs - Validate GeoJSON and station data
 * 
 * Usage: node scripts/validate-data.mjs [options]
 * Options:
 *   --geo <path>       Path to GeoJSON file (default: public/geo/world.json)
 *   --stations <path>  Path to stations file (default: public/data/stations.json)
 *   --strict           Exit with error on any warning
 *   --verbose          Show detailed validation info
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    geo: 'public/geo/world.json',
    stations: 'public/data/stations.json',
    strict: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--geo':
        options.geo = args[++i];
        break;
      case '--stations':
        options.stations = args[++i];
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

// Validation result tracker
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }
  
  error(message) {
    this.errors.push(message);
    console.error(`❌ ERROR: ${message}`);
  }
  
  warn(message) {
    this.warnings.push(message);
    console.warn(`⚠️  WARNING: ${message}`);
  }
  
  log(message) {
    this.info.push(message);
    console.log(`ℹ️  ${message}`);
  }
  
  get hasErrors() {
    return this.errors.length > 0;
  }
  
  get hasWarnings() {
    return this.warnings.length > 0;
  }
}

// Validate GeoJSON structure
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
  
  for (let i = 0; i < data.features.length; i++) {
    const feature = data.features[i];
    
    if (feature.type !== 'Feature') {
      result.warn(`GeoJSON: Feature ${i} has invalid type "${feature.type}"`);
      continue;
    }
    
    // Check geometry
    const geom = feature.geometry;
    if (!geom) {
      result.warn(`GeoJSON: Feature ${i} has no geometry`);
      stats.invalidGeom++;
      continue;
    }
    
    if (geom.type === 'Polygon') {
      stats.polygons++;
    } else if (geom.type === 'MultiPolygon') {
      stats.multiPolygons++;
    } else {
      result.warn(`GeoJSON: Feature ${i} has unsupported geometry type "${geom.type}"`);
      stats.invalidGeom++;
    }
    
    // Check properties
    if (feature.id !== undefined) stats.withId++;
    if (feature.properties?.name) stats.withName++;
  }
  
  if (verbose) {
    result.log(`GeoJSON: ${stats.total} features`);
    result.log(`GeoJSON: ${stats.polygons} Polygons, ${stats.multiPolygons} MultiPolygons`);
    result.log(`GeoJSON: ${stats.withId} with ID, ${stats.withName} with name`);
  }
  
  if (stats.invalidGeom > 0) {
    result.warn(`GeoJSON: ${stats.invalidGeom} features with invalid geometry`);
  }
  
  if (stats.total === 0) {
    result.error('GeoJSON: No features found');
  }
}

// Validate station data
function validateStations(data, result, verbose) {
  if (!Array.isArray(data)) {
    result.error('Stations: Root must be an array');
    return;
  }
  
  const stats = {
    total: data.length,
    valid: 0,
    withGeo: 0,
    withTags: 0,
    withBitrate: 0,
    missingUrl: 0,
    missingName: 0,
    invalidUrl: 0,
    countries: new Set(),
  };
  
  const seenIds = new Set();
  
  for (let i = 0; i < data.length; i++) {
    const station = data[i];
    
    // Required fields
    if (!station.id) {
      if (verbose) result.warn(`Station ${i}: Missing ID`);
      continue;
    }
    
    if (seenIds.has(station.id)) {
      result.warn(`Station ${i}: Duplicate ID "${station.id}"`);
    }
    seenIds.add(station.id);
    
    if (!station.name) {
      stats.missingName++;
      continue;
    }
    
    if (!station.url) {
      stats.missingUrl++;
      continue;
    }
    
    if (!station.url.startsWith('http://') && !station.url.startsWith('https://')) {
      stats.invalidUrl++;
      continue;
    }
    
    stats.valid++;
    
    // Optional fields
    if (station.geo?.lat !== undefined && station.geo?.lon !== undefined) {
      stats.withGeo++;
      
      // Validate coordinates
      if (station.geo.lat < -90 || station.geo.lat > 90) {
        result.warn(`Station "${station.name}": Invalid latitude ${station.geo.lat}`);
      }
      if (station.geo.lon < -180 || station.geo.lon > 180) {
        result.warn(`Station "${station.name}": Invalid longitude ${station.geo.lon}`);
      }
    }
    
    if (Array.isArray(station.tags) && station.tags.length > 0) {
      stats.withTags++;
    }
    
    if (station.bitrate && station.bitrate > 0) {
      stats.withBitrate++;
    }
    
    if (station.countryCode) {
      stats.countries.add(station.countryCode);
    }
  }
  
  if (verbose) {
    result.log(`Stations: ${stats.total} total, ${stats.valid} valid`);
    result.log(`Stations: ${stats.withGeo} with geolocation (${Math.round(stats.withGeo / stats.valid * 100)}%)`);
    result.log(`Stations: ${stats.withTags} with tags, ${stats.withBitrate} with bitrate`);
    result.log(`Stations: ${stats.countries.size} countries`);
  }
  
  if (stats.missingUrl > 0) {
    result.warn(`Stations: ${stats.missingUrl} missing URL`);
  }
  
  if (stats.missingName > 0) {
    result.warn(`Stations: ${stats.missingName} missing name`);
  }
  
  if (stats.invalidUrl > 0) {
    result.warn(`Stations: ${stats.invalidUrl} with invalid URL`);
  }
  
  if (stats.valid === 0) {
    result.error('Stations: No valid stations found');
  }
}

// Main validation function
async function validate() {
  const options = parseArgs();
  const result = new ValidationResult();
  
  console.log('🔍 Validating data files...\n');
  
  // Validate GeoJSON
  const geoPath = join(PROJECT_ROOT, options.geo);
  if (existsSync(geoPath)) {
    console.log(`📍 Validating GeoJSON: ${options.geo}`);
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
  
  // Validate stations
  const stationsPath = join(PROJECT_ROOT, options.stations);
  if (existsSync(stationsPath)) {
    console.log(`📻 Validating stations: ${options.stations}`);
    try {
      const data = JSON.parse(readFileSync(stationsPath, 'utf-8'));
      validateStations(data, result, options.verbose);
    } catch (error) {
      result.error(`Stations: Failed to parse - ${error.message}`);
    }
    console.log('');
  } else {
    result.log(`Stations: File not found (${options.stations})`);
  }
  
  // Summary
  console.log('━'.repeat(50));
  console.log('\n📊 Validation Summary:\n');
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Warnings: ${result.warnings.length}`);
  
  // Exit code
  if (result.hasErrors) {
    console.log('\n❌ Validation FAILED');
    process.exit(1);
  }
  
  if (options.strict && result.hasWarnings) {
    console.log('\n⚠️  Validation FAILED (strict mode)');
    process.exit(1);
  }
  
  console.log('\n✅ Validation PASSED');
}

validate();
