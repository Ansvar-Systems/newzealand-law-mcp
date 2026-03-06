/**
 * Response metadata utilities for New Zealand Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'New Zealand Legislation (legislation.govt.nz) — Parliamentary Counsel Office',
    jurisdiction: 'NZ',
    disclaimer:
      'This data is sourced from the New Zealand Legislation website under CC BY 4.0. ' +
      'The authoritative versions are published by the Parliamentary Counsel Office. ' +
      'Always verify with the official legislation.govt.nz portal.',
    freshness,
  };
}
