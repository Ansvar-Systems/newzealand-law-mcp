/**
 * Statute ID resolution for New Zealand Law MCP.
 *
 * Resolves fuzzy document references (titles, Act names) to database document IDs.
 * New Zealand legislation uses Act title + year as canonical identifiers
 * (e.g., "Privacy Act 2020", "Companies Act 1993").
 */

import type Database from '@ansvar/mcp-sqlite';

/**
 * Resolve a document identifier to a database document ID.
 * Supports:
 * - Direct ID match (e.g., "privacy-act-2020")
 * - Act title match (e.g., "Privacy Act 2020", "Companies Act 1993")
 * - Title substring match (e.g., "Privacy Act", "Companies")
 * - Short name match (e.g., "HDCA", "ETA")
 */
export function resolveDocumentId(
  db: InstanceType<typeof Database>,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ID match
  const directMatch = db.prepare(
    'SELECT id FROM legal_documents WHERE id = ?'
  ).get(trimmed) as { id: string } | undefined;
  if (directMatch) return directMatch.id;

  // Exact title match (case-insensitive)
  const exactTitleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(title) = LOWER(?) LIMIT 1"
  ).get(trimmed) as { id: string } | undefined;
  if (exactTitleResult) return exactTitleResult.id;

  // Short name match (e.g., "HDCA", "ETA")
  const shortNameResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(short_name) = LOWER(?) LIMIT 1"
  ).get(trimmed) as { id: string } | undefined;
  if (shortNameResult) return shortNameResult.id;

  // Title/short_name fuzzy match
  const titleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (titleResult) return titleResult.id;

  // Case-insensitive fallback
  const lowerResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(title) LIKE LOWER(?) OR LOWER(short_name) LIKE LOWER(?) OR LOWER(title_en) LIKE LOWER(?) LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (lowerResult) return lowerResult.id;

  return null;
}
