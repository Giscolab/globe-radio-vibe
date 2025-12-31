#!/usr/bin/env node
/**
 * build-geo.mjs - Build optimized GeoJSON from TopoJSON world atlas
 * 
 * Usage: node scripts/build-geo.mjs [options]
 * Options:
 *   --resolution <110m|50m|10m>  Map resolution (default: 110m)
 *   --output <path>              Output directory (default: public/geo)
 *   --countries <codes>          Comma-separated ISO country codes to include
 *   --simplify <factor>          Simplification factor 0-1 (default: 0.01)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    resolution: '110m',
    output: 'public/geo',
    countries: null,
    simplify: 0.01,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--resolution':
        options.resolution = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--countries':
        options.countries = args[++i]?.split(',');
        break;
      case '--simplify':
        options.simplify = parseFloat(args[++i]);
        break;
    }
  }

  return options;
}

// Fetch TopoJSON from world-atlas
async function fetchWorldAtlas(resolution) {
  const url = `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-${resolution}.json`;
  console.log(`📡 Fetching world atlas (${resolution})...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  return response.json();
}

// Convert TopoJSON to GeoJSON
function topoToGeo(topology, objectName) {
  // Simple TopoJSON to GeoJSON conversion
  const object = topology.objects[objectName];
  if (!object) {
    throw new Error(`Object "${objectName}" not found in topology`);
  }

  const { arcs, transform } = topology;
  
  // Decode arc coordinates
  function decodeArc(arcIndex) {
    const arc = arcs[arcIndex < 0 ? ~arcIndex : arcIndex];
    const decoded = [];
    let x = 0, y = 0;
    
    for (const [dx, dy] of arc) {
      x += dx;
      y += dy;
      
      if (transform) {
        decoded.push([
          x * transform.scale[0] + transform.translate[0],
          y * transform.scale[1] + transform.translate[1]
        ]);
      } else {
        decoded.push([x, y]);
      }
    }
    
    return arcIndex < 0 ? decoded.reverse() : decoded;
  }

  // Decode ring from arc indices
  function decodeRing(arcIndices) {
    const coords = [];
    for (const arcIndex of arcIndices) {
      const decoded = decodeArc(arcIndex);
      // Skip first point of subsequent arcs (shared with previous)
      const start = coords.length > 0 ? 1 : 0;
      for (let i = start; i < decoded.length; i++) {
        coords.push(decoded[i]);
      }
    }
    return coords;
  }

  // Convert geometry
  function convertGeometry(geom) {
    switch (geom.type) {
      case 'Polygon':
        return {
          type: 'Polygon',
          coordinates: geom.arcs.map(ring => decodeRing(ring))
        };
      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: geom.arcs.map(polygon => 
            polygon.map(ring => decodeRing(ring))
          )
        };
      default:
        return null;
    }
  }

  // Convert to GeoJSON FeatureCollection
  const features = [];
  
  if (object.type === 'GeometryCollection') {
    for (const geom of object.geometries) {
      const geometry = convertGeometry(geom);
      if (geometry) {
        features.push({
          type: 'Feature',
          id: geom.id,
          properties: geom.properties || {},
          geometry
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

// Simplify GeoJSON coordinates
function simplifyCoords(coords, factor) {
  if (coords.length <= 4) return coords;
  
  const step = Math.max(1, Math.floor(1 / factor));
  const simplified = [];
  
  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i]);
  }
  
  // Ensure ring is closed
  if (simplified.length > 0 && coords.length > 0) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push(first);
    }
  }
  
  return simplified;
}

function simplifyGeometry(geometry, factor) {
  if (!geometry) return geometry;
  
  switch (geometry.type) {
    case 'Polygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(ring => simplifyCoords(ring, factor))
      };
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(polygon =>
          polygon.map(ring => simplifyCoords(ring, factor))
        )
      };
    default:
      return geometry;
  }
}

// Filter countries by ISO code
function filterCountries(geojson, countryCodes) {
  if (!countryCodes || countryCodes.length === 0) {
    return geojson;
  }

  const codes = new Set(countryCodes.map(c => c.toUpperCase()));
  
  return {
    ...geojson,
    features: geojson.features.filter(f => {
      const iso = f.properties?.ISO_A2 || f.properties?.iso_a2 || f.id;
      return codes.has(String(iso).toUpperCase());
    })
  };
}

// Main build function
async function build() {
  const options = parseArgs();
  
  console.log('🌍 Building optimized GeoJSON...');
  console.log(`   Resolution: ${options.resolution}`);
  console.log(`   Output: ${options.output}`);
  console.log(`   Simplify: ${options.simplify}`);
  
  try {
    // Fetch TopoJSON
    const topology = await fetchWorldAtlas(options.resolution);
    
    // Convert to GeoJSON
    console.log('🔄 Converting TopoJSON to GeoJSON...');
    let geojson = topoToGeo(topology, 'countries');
    
    // Filter countries if specified
    if (options.countries) {
      console.log(`🔍 Filtering countries: ${options.countries.join(', ')}`);
      geojson = filterCountries(geojson, options.countries);
    }
    
    // Simplify geometries
    if (options.simplify < 1) {
      console.log(`✂️  Simplifying geometries (factor: ${options.simplify})...`);
      geojson.features = geojson.features.map(f => ({
        ...f,
        geometry: simplifyGeometry(f.geometry, options.simplify)
      }));
    }
    
    // Create output directory
    const outputDir = join(PROJECT_ROOT, options.output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Write output file
    const outputFile = join(outputDir, 'world.json');
    const json = JSON.stringify(geojson);
    writeFileSync(outputFile, json);
    
    // Stats
    const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
    console.log(`\n✅ Success!`);
    console.log(`   Features: ${geojson.features.length}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Output: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

build();
