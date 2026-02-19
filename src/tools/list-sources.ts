/**
 * list_sources — Return provenance metadata for all data sources.
 */

import type Database from '@ansvar/mcp-sqlite';
import { readDbMetadata } from '../capabilities.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface SourceInfo {
  name: string;
  authority: string;
  url: string;
  license: string;
  coverage: string;
  languages: string[];
}

export interface ListSourcesResult {
  sources: SourceInfo[];
  database: {
    tier: string;
    schema_version: string;
    built_at?: string;
    document_count: number;
    provision_count: number;
  };
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export async function listSources(
  db: InstanceType<typeof Database>,
): Promise<ToolResponse<ListSourcesResult>> {
  const meta = readDbMetadata(db);

  return {
    results: {
      sources: [
        {
          name: 'New Zealand Legislation',
          authority: 'New Zealand Government, Parliamentary Counsel Office',
          url: 'https://www.legislation.govt.nz',
          license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
          coverage:
            'All New Zealand Acts of Parliament, legislative instruments, and regulations ' +
            'including Privacy Act 2020, Harmful Digital Communications Act 2015, ' +
            'Electronic Transactions Act 2002, Companies Act 1993, Commerce Act 1986',
          languages: ['en', 'mi'],
        },
      ],
      database: {
        tier: meta.tier,
        schema_version: meta.schema_version,
        built_at: meta.built_at,
        document_count: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
        provision_count: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
      },
    },
    _metadata: generateResponseMetadata(db),
  };
}
