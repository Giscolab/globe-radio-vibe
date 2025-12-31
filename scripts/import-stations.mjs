#!/usr/bin/env node
/**
 * robust-import-stations.mjs
 * Robust RadioBrowser dump exporter with multi-server fallback and GitHub fallback.
 *
 * Usage: node scripts/robust-import-stations.mjs
 *
 * Requirements: Node 18+ (native fetch). If older Node, install node-fetch and adapt.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// Candidate servers and alternate raw dump fallback
const SERVERS = [
  // prefer explicit mirrors that historically serve /json
  "https://fr1.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://uk1.api.radio-browser.info",
  "https://us1.api.radio-browser.info",
];

// Some hosts (load balancers) may not accept /json path; we will try both patterns
const LOAD_BALANCER = "https://api.radio-browser.info";

// Optional public dump fallback (raw GitHub URL). Replace if you have a preferred dump.
const GITHUB_DUMP_URL =
  "https://raw.githubusercontent.com/segler-alex/radiobrowser-data/main/stations.json";

async function tryFetch(url, opts = {}, retries = 2, backoffMs = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
}

async function fetchJsonWithFallback(path) {
  let lastErr = null;

  // 1) Try explicit mirrors with /json prefix (most mirrors)
  for (const server of SERVERS) {
    const url = `${server}/json${path}`;
    try {
      const res = await tryFetch(url, { headers: { "User-Agent": "GlobeRadioEngine/1.0" } }, 1, 800);
      return await res.json();
    } catch (e) {
      lastErr = e;
      console.warn(`⚠️  ${server} (with /json) failed: ${e.message}`);
    }
  }

  // 2) Try load balancer with and without /json (some setups)
  try {
    const url1 = `${LOAD_BALANCER}/json${path}`;
    const res1 = await tryFetch(url1, { headers: { "User-Agent": "GlobeRadioEngine/1.0" } }, 1, 800);
    return await res1.json();
  } catch (e) {
    lastErr = e;
    console.warn(`⚠️  ${LOAD_BALANCER}/json failed: ${e.message}`);
  }

  try {
    const url2 = `${LOAD_BALANCER}${path}`; // try without /json
    const res2 = await tryFetch(url2, { headers: { "User-Agent": "GlobeRadioEngine/1.0" } }, 1, 800);
    return await res2.json();
  } catch (e) {
    lastErr = e;
    console.warn(`⚠️  ${LOAD_BALANCER} (no /json) failed: ${e.message}`);
  }

  // 3) Last resort: try GitHub raw dump (single large file)
  try {
    console.log("ℹ️  Trying GitHub dump fallback...");
    const res = await tryFetch(GITHUB_DUMP_URL, { headers: { "User-Agent": "GlobeRadioEngine/1.0" } }, 1, 1000);
    const json = await res.json();
    if (Array.isArray(json)) return json;
    throw new Error("GitHub dump did not return an array");
  } catch (e) {
    lastErr = e;
    console.warn(`⚠️  GitHub dump fallback failed: ${e.message}`);
  }

  throw lastErr ?? new Error("All RadioBrowser servers and fallbacks failed");
}

function transformStation(rb) {
  return {
    id: rb.stationuuid,
    name: rb.name?.trim() || "",
    url: rb.url_resolved || rb.url || "",
    homepage: rb.homepage || null,
    favicon: rb.favicon || null,
    country: rb.country || "",
    countryCode: rb.countrycode || "",
    state: rb.state || null,
    language: rb.language || null,
    tags: (rb.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    codec: rb.codec || null,
    bitrate: Number(rb.bitrate || 0),
    votes: Number(rb.votes || 0),
    clickCount: Number(rb.clickcount || 0),
    lastCheckOk: rb.lastcheckok === 1 || rb.lastcheckok === true,
    geo:
      rb.geo_lat != null && rb.geo_long != null
        ? { lat: Number(rb.geo_lat), lon: Number(rb.geo_long) }
        : null,
    lastChangeTime: rb.changetimestamp || null,
  };
}

function isValid(s) {
  if (!s.id) return false;
  if (!s.name) return false;
  if (!s.url || !/^https?:\/\//i.test(s.url)) return false;
  return true;
}

async function main() {
  const outRel = "public/data/stations.dump.json";
  const outPath = join(PROJECT_ROOT, outRel);
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // safer page size
  const pageSize = 10000;
  let offset = 0;
  const all = [];
  let totalFetched = 0;

  // If GitHub fallback returns full array, we will detect it and stop pagination
  let usedGithubFallback = false;

  for (;;) {
    const path = `/stations?hidebroken=true&order=stationuuid&reverse=false&limit=${pageSize}&offset=${offset}`;

    let batch;
    try {
      batch = await fetchJsonWithFallback(path);
    } catch (err) {
      // If the error occurs on the first page, try GitHub dump directly (already attempted inside fetchJsonWithFallback)
      console.error("❌ Fetch failed:", err.message);
      if (offset === 0) {
        // If fetchJsonWithFallback already tried GitHub and returned array, it would have returned earlier.
        // Here we bail out and write partial file if any.
        break;
      } else {
        break;
      }
    }

    // If fallback returned a full dump (array of all stations), detect and use it
    if (Array.isArray(batch) && batch.length > pageSize) {
      // treat as full dump
      console.log("ℹ️  Received large array (treating as full dump).");
      usedGithubFallback = true;
      for (const rb of batch) {
        const s = transformStation(rb);
        if (isValid(s)) all.push(s);
      }
      totalFetched += batch.length;
      break;
    }

    if (!Array.isArray(batch) || batch.length === 0) break;

    totalFetched += batch.length;

    for (const rb of batch) {
      const s = transformStation(rb);
      if (isValid(s)) all.push(s);
    }

    console.log(`offset=${offset} fetched=${batch.length} totalValid=${all.length}`);
    offset += pageSize;

    // safety: avoid infinite loops
    if (offset > 5_000_000) {
      console.warn("⚠️  Aborting: offset limit reached");
      break;
    }
  }

  // write partial or full result
  writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`✅ Done. fetched=${totalFetched} valid=${all.length} -> ${outRel}`);
  if (usedGithubFallback) console.log("ℹ️  Note: data came from GitHub dump fallback.");
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
