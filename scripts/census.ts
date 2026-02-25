#!/usr/bin/env tsx
/**
 * New Zealand Law MCP — Census Script
 *
 * Enumerates ALL public Acts on legislation.govt.nz by year (1841–2026)
 * via the /subscribe/ endpoint which bypasses the Azure WAF.
 *
 * Outputs data/census.json in golden standard format.
 * Supports resuming: if census.json already exists, merges new results.
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --start-year 2000   # Resume from a specific year
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUBSCRIBE_BASE = 'https://legislation.govt.nz/subscribe';
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

const START_YEAR = 1841;
const END_YEAR = 2026;

interface CensusEntry {
  id: string;
  year: number;
  number: string;
  subscribe_url: string;
  status: 'ingestable' | 'inaccessible';
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  portal: string;
  generated: string;
  years_scanned: number;
  years_with_acts: number;
  total_acts: number;
  total_ingestable: number;
  total_inaccessible: number;
  acts: CensusEntry[];
}

function parseArgs(): { startYear: number } {
  const args = process.argv.slice(2);
  let startYear = START_YEAR;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-year' && args[i + 1]) {
      startYear = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return { startYear };
}

interface YearResult {
  acts: string[] | null;
  networkError: boolean;
}

/**
 * Fetch the year index page and extract act number links.
 * Returns acts array (or null if year has no acts) plus a networkError flag.
 */
async function fetchYearIndex(year: number): Promise<YearResult> {
  const url = `${SUBSCRIBE_BASE}/act/public/${year}/`;

  try {
    const result = await fetchWithRateLimit(url, 2);

    if (result.status === 404 || result.status === 403) {
      return { acts: null, networkError: false };
    }

    if (result.status !== 200) {
      console.log(`  WARNING: HTTP ${result.status} for year ${year}`);
      return { acts: null, networkError: false };
    }

    // Parse directory listing for act number links
    // Pattern: <a href="0001/"> or href="0001" or href="/subscribe/act/public/YEAR/0001/"
    const actNumbers: string[] = [];
    const linkRegex = /href="(?:\/subscribe\/act\/public\/\d{4}\/)?(\d{1,4})\/?"/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(result.body)) !== null) {
      const num = match[1];
      if (!actNumbers.includes(num)) {
        actNumbers.push(num);
      }
    }

    return { acts: actNumbers.length > 0 ? actNumbers : null, networkError: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: Failed to fetch year ${year}: ${msg}`);
    // Wait extra time before next request after a network error
    await new Promise(resolve => setTimeout(resolve, 5000));
    return { acts: null, networkError: true };
  }
}

/**
 * Load existing census file if present, to support resume/merge.
 */
function loadExistingCensus(): Map<string, CensusEntry> {
  const existing = new Map<string, CensusEntry>();
  if (fs.existsSync(CENSUS_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8')) as CensusFile;
      for (const act of data.acts) {
        existing.set(act.id, act);
      }
    } catch {
      // Ignore parse errors, start fresh
    }
  }
  return existing;
}

async function main(): Promise<void> {
  const { startYear } = parseArgs();

  console.log('New Zealand Law MCP — Census');
  console.log('============================\n');
  console.log(`  Source: legislation.govt.nz /subscribe/`);
  console.log(`  Scanning years: ${startYear}–${END_YEAR}\n`);

  // Load existing census for resume support
  const existingActs = loadExistingCensus();
  if (existingActs.size > 0) {
    console.log(`  Loaded ${existingActs.size} existing acts from previous census\n`);
  }

  // Track which years we actually scan this run
  const newActs: CensusEntry[] = [];
  let yearsScanned = 0;
  let yearsWithActs = 0;
  let networkErrors = 0;
  const MAX_CONSECUTIVE_NETWORK_ERRORS = 5;
  let consecutiveNetworkErrors = 0;

  for (let year = startYear; year <= END_YEAR; year++) {
    yearsScanned++;

    const { acts: actNumbers, networkError } = await fetchYearIndex(year);

    if (networkError) {
      networkErrors++;
      consecutiveNetworkErrors++;
      if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
        console.log(`\n  FATAL: ${MAX_CONSECUTIVE_NETWORK_ERRORS} consecutive network errors at year ${year}.`);
        console.log(`  Saving partial results and stopping. Re-run with --start-year ${year} to resume.`);
        break;
      }
      continue;
    }

    consecutiveNetworkErrors = 0; // Reset on successful HTTP response (even if 404)

    if (actNumbers === null) {
      if (yearsScanned % 20 === 0) {
        process.stdout.write(`  [${year}] ${newActs.length} new acts so far\n`);
      }
      continue;
    }

    yearsWithActs++;
    console.log(`  ${year}: ${actNumbers.length} acts`);

    for (const num of actNumbers) {
      const paddedNum = num.padStart(4, '0');
      const subscribeUrl = `${SUBSCRIBE_BASE}/act/public/${year}/${paddedNum}/latest`;
      const id = `act-public-${year}-${paddedNum}`;

      const entry: CensusEntry = {
        id,
        year,
        number: paddedNum,
        subscribe_url: subscribeUrl,
        status: 'ingestable',
      };

      newActs.push(entry);
      existingActs.set(id, entry);
    }
  }

  // Merge: existing acts + new acts, deduplicated by ID
  const allActs = Array.from(existingActs.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.number.localeCompare(b.number);
  });

  const census: CensusFile = {
    schema_version: '1.0',
    jurisdiction: 'NZ',
    portal: 'legislation.govt.nz',
    generated: new Date().toISOString().split('T')[0],
    years_scanned: yearsScanned,
    years_with_acts: yearsWithActs,
    total_acts: allActs.length,
    total_ingestable: allActs.filter(a => a.status === 'ingestable').length,
    total_inaccessible: allActs.filter(a => a.status === 'inaccessible').length,
    acts: allActs,
  };

  fs.mkdirSync(path.dirname(CENSUS_PATH), { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('\n============================');
  console.log('Census Complete');
  console.log('============================\n');
  console.log(`  Years scanned:    ${yearsScanned}`);
  console.log(`  Years with acts:  ${yearsWithActs}`);
  console.log(`  Total acts found: ${allActs.length}`);
  console.log(`  New acts (this run): ${newActs.length}`);
  console.log(`  Ingestable:       ${census.total_ingestable}`);
  console.log(`  Inaccessible:     ${census.total_inaccessible}`);
  if (networkErrors > 0) {
    console.log(`  Network errors:   ${networkErrors}`);
  }
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
