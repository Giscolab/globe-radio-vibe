#!/usr/bin/env node
/**
 * verify-world-stations.mjs - Verify a deterministic sample of stream URLs from the local dataset.
 *
 * Usage: node scripts/verify-world-stations.mjs [options]
 * Options:
 *   --stations <path>     Path to stations file (default: public/data/world-stations.json)
 *   --sample-size <n>     Number of stations to verify (default: 500)
 *   --timeout <ms>        Timeout per request in milliseconds (default: 10000)
 *   --concurrency <n>     Number of concurrent requests (default: 20)
 *   --threshold <n>       Minimum success rate percentage (default: 98)
 *   --verbose             Show successful samples in addition to failures
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

let datasetModulePromise = null;
let verificationModulePromise = null;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    stations: 'public/data/world-stations.json',
    sampleSize: 500,
    timeoutMs: 10_000,
    concurrency: 20,
    thresholdPercentage: 98,
    verbose: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    switch (args[index]) {
      case '--stations':
        options.stations = args[index + 1];
        index += 1;
        break;
      case '--sample-size':
        options.sampleSize = Number(args[index + 1]);
        index += 1;
        break;
      case '--timeout':
        options.timeoutMs = Number(args[index + 1]);
        index += 1;
        break;
      case '--concurrency':
        options.concurrency = Number(args[index + 1]);
        index += 1;
        break;
      case '--threshold':
        options.thresholdPercentage = Number(args[index + 1]);
        index += 1;
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

async function loadDatasetModule() {
  if (!datasetModulePromise) {
    datasetModulePromise = import(
      pathToFileURL(
        resolve(PROJECT_ROOT, 'src', 'engine', 'radio', 'dataset', 'worldStationDataset.ts')
      ).href
    );
  }

  return datasetModulePromise;
}

async function loadVerificationModule() {
  if (!verificationModulePromise) {
    verificationModulePromise = import(
      pathToFileURL(
        resolve(PROJECT_ROOT, 'src', 'engine', 'radio', 'dataset', 'worldStationVerification.ts')
      ).href
    );
  }

  return verificationModulePromise;
}

function formatResult(result) {
  const parts = [
    `${result.stationName} [${result.stationId}]`,
    result.url,
  ];

  if (result.statusCode != null) {
    parts.push(`status=${result.statusCode}`);
  }

  if (result.contentType) {
    parts.push(`contentType=${result.contentType}`);
  }

  parts.push(`latency=${result.latencyMs}ms`);

  if (result.reason) {
    parts.push(`reason=${result.reason}`);
  }

  if (result.error) {
    parts.push(`error=${result.error}`);
  }

  return parts.join(' | ');
}

function printFailureReasons(summary) {
  if (summary.failureReasons.length === 0) {
    return;
  }

  console.log('\nFailure reasons:');
  for (const reason of summary.failureReasons) {
    console.log(`- ${reason.reason}: ${reason.count}`);
  }
}

function printResultExamples(title, results) {
  if (results.length === 0) {
    return;
  }

  console.log(`\n${title}:`);
  for (const result of results) {
    console.log(`- ${formatResult(result)}`);
  }
}

async function main() {
  const options = parseArgs();
  const datasetPath = join(PROJECT_ROOT, options.stations);

  if (!existsSync(datasetPath)) {
    console.error(`[verify-world-stations] Dataset not found: ${options.stations}`);
    process.exit(1);
  }

  const rawPayload = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  const { normalizeWorldStationDatasetPayload } = await loadDatasetModule();
  const { verifyWorldStations } = await loadVerificationModule();

  const payload = normalizeWorldStationDatasetPayload(rawPayload, {
    acceptLegacyArray: true,
  });

  console.log(`[verify-world-stations] Dataset: ${options.stations}`);
  console.log(
    `[verify-world-stations] Config: sampleSize=${options.sampleSize}, timeoutMs=${options.timeoutMs}, concurrency=${options.concurrency}, threshold=${options.thresholdPercentage}%`
  );
  console.log(
    `[verify-world-stations] Metadata: version=${payload.version}, generatedAt=${payload.generatedAt}, source=${payload.source}, total=${payload.total}`
  );

  const { sample, results, summary } = await verifyWorldStations(payload.stations, {
    sampleSize: options.sampleSize,
    timeoutMs: options.timeoutMs,
    concurrency: options.concurrency,
    thresholdPercentage: options.thresholdPercentage,
  });

  console.log('\nVerification Summary:\n');
  console.log(`   Sample size: ${sample.length}`);
  console.log(`   Successes: ${summary.successCount}`);
  console.log(`   Failures: ${summary.failureCount}`);
  console.log(`   Success rate: ${summary.successRate}%`);
  console.log(`   Threshold: ${summary.thresholdPercentage}%`);
  console.log(`   Meets threshold: ${summary.meetsThreshold ? 'yes' : 'no'}`);

  printFailureReasons(summary);

  const failedExamples = results.filter((result) => !result.ok).slice(0, 10);
  printResultExamples('Failure examples', failedExamples);

  if (options.verbose) {
    const successExamples = results.filter((result) => result.ok).slice(0, 5);
    printResultExamples('Success examples', successExamples);
  }

  if (!summary.meetsThreshold) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[verify-world-stations] Fatal error:', error);
  process.exit(1);
});
