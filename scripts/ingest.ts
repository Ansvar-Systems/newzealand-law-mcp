#!/usr/bin/env tsx
/**
 * New Zealand Law MCP — Ingestion Pipeline
 *
 * Fetches New Zealand legislation XML from legislation.govt.nz /subscribe/ endpoint.
 * Data is published by the New Zealand Parliamentary Counsel Office
 * under Creative Commons Attribution 4.0 International (CC BY 4.0).
 *
 * The /subscribe/ endpoint provides structured XML files that bypass the
 * Azure WAF JavaScript challenge on the main website.
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached XML files
 *
 * Data is sourced under CC BY 4.0 license.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchNzActXml, extractActIdentifiers } from './lib/fetcher.js';
import { parseNzXml, KEY_NZ_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<void> {
  console.log(`\nProcessing ${acts.length} New Zealand Acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;

  const report: Array<{ act: string; provisions: number; definitions: number; status: string }> = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.xml`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
      report.push({
        act: act.shortName,
        provisions: existing.provisions.length,
        definitions: existing.definitions.length,
        status: 'cached',
      });
      totalProvisions += existing.provisions.length;
      totalDefinitions += existing.definitions.length;
      skipped++;
      processed++;
      continue;
    }

    try {
      let xml: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        xml = fs.readFileSync(sourceFile, 'utf-8');
      } else {
        // Extract year/number from the act URL
        const ids = extractActIdentifiers(act.url);
        if (!ids) {
          console.log(`  ERROR: Cannot extract identifiers from URL: ${act.url}`);
          report.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'bad-url' });
          failed++;
          processed++;
          continue;
        }

        process.stdout.write(`  Fetching ${act.shortName} (${act.title})...`);
        const result = await fetchNzActXml(ids.year, ids.number, ids.type, ids.scope);

        if (result.status !== 200) {
          console.log(` HTTP ${result.status}`);
          report.push({ act: act.shortName, provisions: 0, definitions: 0, status: `http-${result.status}` });
          failed++;
          processed++;
          continue;
        }

        // Verify we got XML (not an HTML error page or WAF challenge)
        if (!result.body.includes('<?xml') && !result.body.includes('<act ')) {
          console.log(` ERROR: Response is not XML (got ${result.contentType})`);
          report.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'not-xml' });
          failed++;
          processed++;
          continue;
        }

        xml = result.body;
        fs.writeFileSync(sourceFile, xml);
        console.log(` OK (${(xml.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseNzXml(xml, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      report.push({
        act: act.shortName,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'ok',
      });
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.shortName}: ${msg}`);
      report.push({ act: act.shortName, provisions: 0, definitions: 0, status: `error: ${msg}` });
      failed++;
    }

    processed++;
  }

  // Print summary report
  console.log('\n========================================');
  console.log('Ingestion Report');
  console.log('========================================\n');

  console.log('  Act                    Provs   Defs   Status');
  console.log('  ' + '-'.repeat(56));
  for (const r of report) {
    const actName = r.act.padEnd(22);
    const provs = String(r.provisions).padStart(6);
    const defs = String(r.definitions).padStart(6);
    console.log(`  ${actName} ${provs} ${defs}   ${r.status}`);
  }

  console.log(`\n  Processed: ${processed}`);
  console.log(`  Skipped (cached): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('New Zealand Law MCP — Ingestion Pipeline');
  console.log('========================================\n');
  console.log(`  Source: legislation.govt.nz /subscribe/ (XML)`);
  console.log(`  License: CC BY 4.0`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_NZ_ACTS.slice(0, limit) : KEY_NZ_ACTS;
  await fetchAndParseActs(acts, skipFetch);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
