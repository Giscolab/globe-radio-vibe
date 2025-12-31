#!/usr/bin/env node
/**
 * import-stations.mjs - Import radio stations from RadioBrowser API
 * 
 * Usage: node scripts/import-stations.mjs [options]
 * Options:
 *   --countries <codes>   Comma-separated ISO country codes (default: all)
 *   --limit <n>           Max stations per country (default: 1000)
 *   --output <path>       Output file path (default: public/data/stations.json)
 *   --format <json|db>    Output format (default: json)
 *   --min-votes <n>       Minimum votes filter (default: 0)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// RadioBrowser API base URL
const API_BASE = 'https://de1.api.radio-browser.info/json';

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    countries: null,
    limit: 1000,
    output: 'public/data/stations.json',
    format: 'json',
    minVotes: 0,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--countries':
        options.countries = args[++i]?.split(',').map(c => c.trim().toUpperCase());
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--min-votes':
        options.minVotes = parseInt(args[++i], 10);
        break;
    }
  }

  return options;
}

// Fetch with retry
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'GlobeRadioEngine/1.0' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Get list of countries from RadioBrowser
async function getCountries() {
  console.log('📡 Fetching country list...');
  const countries = await fetchWithRetry(`${API_BASE}/countries`);
  return countries.map(c => ({
    code: c.iso_3166_1,
    name: c.name,
    stationCount: c.stationcount
  }));
}

// Fetch stations for a specific country
async function getStationsByCountry(countryCode, limit) {
  const url = `${API_BASE}/stations/bycountrycodeexact/${countryCode}?limit=${limit}&order=votes&reverse=true`;
  return fetchWithRetry(url);
}

// Transform RadioBrowser station to our format
function transformStation(rb) {
  return {
    id: rb.stationuuid,
    name: rb.name?.trim() || 'Unknown',
    url: rb.url_resolved || rb.url,
    homepage: rb.homepage || null,
    favicon: rb.favicon || null,
    country: rb.country || '',
    countryCode: rb.countrycode || '',
    state: rb.state || null,
    language: rb.language || null,
    tags: rb.tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
    codec: rb.codec || null,
    bitrate: rb.bitrate || 0,
    votes: rb.votes || 0,
    clickCount: rb.clickcount || 0,
    lastCheckOk: rb.lastcheckok === 1,
    geo: rb.geo_lat && rb.geo_long ? {
      lat: rb.geo_lat,
      lon: rb.geo_long
    } : null,
  };
}

// Validate station data
function validateStation(station) {
  if (!station.id) return false;
  if (!station.name || station.name === 'Unknown') return false;
  if (!station.url) return false;
  if (!station.url.startsWith('http')) return false;
  return true;
}

// Progress bar
function progressBar(current, total, label) {
  const width = 30;
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  process.stdout.write(`\r${bar} ${percent}% ${label}`);
}

// Main import function
async function importStations() {
  const options = parseArgs();
  
  console.log('📻 Importing radio stations from RadioBrowser...');
  console.log(`   Limit per country: ${options.limit}`);
  console.log(`   Min votes: ${options.minVotes}`);
  console.log(`   Output: ${options.output}`);
  
  try {
    // Get country list
    let countries = await getCountries();
    
    // Filter countries if specified
    if (options.countries) {
      countries = countries.filter(c => 
        options.countries.includes(c.code?.toUpperCase())
      );
      console.log(`   Countries: ${options.countries.join(', ')}`);
    }
    
    console.log(`\n🌍 Processing ${countries.length} countries...\n`);
    
    const allStations = [];
    const stats = { total: 0, valid: 0, withGeo: 0, errors: 0 };
    
    // Process countries in batches
    const batchSize = 5;
    for (let i = 0; i < countries.length; i += batchSize) {
      const batch = countries.slice(i, i + batchSize);
      
      const promises = batch.map(async (country) => {
        try {
          const stations = await getStationsByCountry(country.code, options.limit);
          return { country, stations };
        } catch (error) {
          stats.errors++;
          return { country, stations: [], error: error.message };
        }
      });
      
      const results = await Promise.all(promises);
      
      for (const { country, stations, error } of results) {
        if (error) {
          console.log(`\n⚠️  ${country.name}: ${error}`);
          continue;
        }
        
        for (const rb of stations) {
          stats.total++;
          
          const station = transformStation(rb);
          
          // Apply filters
          if (options.minVotes > 0 && station.votes < options.minVotes) {
            continue;
          }
          
          if (!validateStation(station)) {
            continue;
          }
          
          stats.valid++;
          if (station.geo) stats.withGeo++;
          
          allStations.push(station);
        }
      }
      
      progressBar(i + batch.length, countries.length, `(${allStations.length} stations)`);
    }
    
    console.log('\n');
    
    // Create output directory
    const outputDir = dirname(join(PROJECT_ROOT, options.output));
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Write output
    const outputPath = join(PROJECT_ROOT, options.output);
    const json = JSON.stringify(allStations, null, 2);
    writeFileSync(outputPath, json);
    
    // Final stats
    const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
    
    console.log('✅ Import complete!\n');
    console.log('📊 Statistics:');
    console.log(`   Countries processed: ${countries.length}`);
    console.log(`   Total stations fetched: ${stats.total}`);
    console.log(`   Valid stations: ${stats.valid}`);
    console.log(`   With geolocation: ${stats.withGeo}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Output size: ${sizeMB} MB`);
    console.log(`   Output file: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

importStations();
