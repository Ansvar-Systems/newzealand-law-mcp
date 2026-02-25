/**
 * XML parser for New Zealand legislation from legislation.govt.nz /subscribe/ endpoint.
 *
 * Parses the PCO XML format which uses elements like:
 *   <act>          - Root element with metadata attributes
 *   <cover>        - Title, assent date, commencement
 *   <body>         - Contains all provisions
 *   <part>         - Major divisions (Part 1, Part 2, etc.)
 *   <subpart>      - Subdivisions within parts
 *   <prov>         - Individual provisions (sections)
 *   <label>        - Section number
 *   <heading>      - Section title
 *   <prov.body>    - Section content
 *   <def-para>     - Definition paragraph
 *   <def-term>     - Defined term
 *   <schedule>     - Schedules at end of act
 *   <crosshead>    - Grouping headings within parts
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Strip XML/HTML tags and normalize whitespace.
 * Preserves meaningful text structure.
 */
function stripXml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract inner XML content of the first matching element.
 * Returns null if not found.
 */
function extractElement(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract all top-level occurrences of an element, handling nesting properly.
 * Uses depth counting instead of non-greedy regex to avoid backtracking.
 */
function extractTopLevelElements(xml: string, tagName: string): Array<{ inner: string; attrs: string; startPos: number }> {
  const results: Array<{ inner: string; attrs: string; startPos: number }> = [];
  const openPattern = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'gi');
  const closeTag = `</${tagName}>`;
  const closeTagLen = closeTag.length;

  let openMatch: RegExpExecArray | null;
  while ((openMatch = openPattern.exec(xml)) !== null) {
    const startPos = openMatch.index;
    const attrs = openMatch[1] || '';
    const contentStart = startPos + openMatch[0].length;

    // Count nesting depth to find the matching close tag
    let depth = 1;
    let pos = contentStart;
    const searchOpenTag = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'gi');
    const searchCloseTag = closeTag.toLowerCase();

    while (depth > 0 && pos < xml.length) {
      const nextOpen = xml.indexOf(`<${tagName}`, pos);
      const nextOpenAlt = xml.indexOf(`<${tagName}>`, pos);
      const nextOpenSpace = xml.indexOf(`<${tagName} `, pos);
      const nextClose = xml.toLowerCase().indexOf(searchCloseTag, pos);

      // Find the earliest next open (must be followed by > or space)
      let effectiveNextOpen = -1;
      if (nextOpenAlt !== -1 && (effectiveNextOpen === -1 || nextOpenAlt < effectiveNextOpen)) {
        effectiveNextOpen = nextOpenAlt;
      }
      if (nextOpenSpace !== -1 && (effectiveNextOpen === -1 || nextOpenSpace < effectiveNextOpen)) {
        effectiveNextOpen = nextOpenSpace;
      }

      if (nextClose === -1) {
        // No more close tags, bail
        break;
      }

      if (effectiveNextOpen !== -1 && effectiveNextOpen < nextClose) {
        // Found a nested open tag before the close tag
        depth++;
        pos = effectiveNextOpen + tagName.length + 2; // Skip past the opening tag
      } else {
        // Found a close tag
        depth--;
        if (depth === 0) {
          const inner = xml.substring(contentStart, nextClose);
          results.push({ inner, attrs, startPos });
          // Move the outer regex past this element
          openPattern.lastIndex = nextClose + closeTagLen;
        }
        pos = nextClose + closeTagLen;
      }
    }
  }

  return results;
}

/**
 * Extract all occurrences of an element (non-greedy, non-nested).
 * Use only for elements that don't nest (like def-para, def-term).
 */
function extractAllSimpleElements(xml: string, tagName: string): Array<{ outer: string; inner: string; attrs: string }> {
  const results: Array<{ outer: string; inner: string; attrs: string }> = [];
  const regex = new RegExp(`<${tagName}(\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push({
      outer: match[0],
      inner: match[2],
      attrs: match[1] || '',
    });
  }
  return results;
}

/**
 * Pre-compute a sorted list of part boundaries with their context strings.
 * This avoids the O(n*m) cost of running findPartContext per provision.
 */
interface PartBoundary {
  position: number;
  context: string;
}

function buildPartIndex(xml: string): PartBoundary[] {
  const parts: PartBoundary[] = [];
  // Find <part ...> opening tags and extract label+heading from the first child elements
  const partOpenRegex = /<part\s[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = partOpenRegex.exec(xml)) !== null) {
    const startPos = match.index;
    // Look ahead (limited window) for label and heading
    const window = xml.substring(startPos, Math.min(startPos + 500, xml.length));

    const labelMatch = window.match(/<label[^>]*>(.*?)<\/label>/i);
    const headingMatch = window.match(/<heading[^>]*>(.*?)<\/heading>/i);

    if (labelMatch || headingMatch) {
      const label = labelMatch ? stripXml(labelMatch[1]) : '';
      const heading = headingMatch ? stripXml(headingMatch[1]) : '';
      const context = label ? `Part ${label}${heading ? ': ' + heading : ''}` : (heading || '');
      parts.push({ position: startPos, context });
    }
  }

  return parts;
}

/**
 * Look up the part context for a given position using the pre-computed index.
 */
function lookupPartContext(partIndex: PartBoundary[], position: number): string | undefined {
  // Binary search for the last part boundary before this position
  let lo = 0;
  let hi = partIndex.length - 1;
  let result: string | undefined;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (partIndex[mid].position <= position) {
      result = partIndex[mid].context;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

/**
 * Parse New Zealand legislation XML to extract provisions.
 *
 * The PCO XML uses <prov> elements for each section:
 *   <prov id="LMS..." toc="yes">
 *     <label denominator="yes">7</label>
 *     <heading>Interpretation</heading>
 *     <prov.body>
 *       <subprov>
 *         <label denominator="yes">1</label>
 *         <para><text>content here...</text></para>
 *       </subprov>
 *     </prov.body>
 *   </prov>
 */
export function parseNzXml(xml: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];
  const seenRefs = new Set<string>();

  // Pre-compute part boundaries for O(log n) lookups
  const partIndex = buildPartIndex(xml);

  // ─── Extract body section (everything between <body> and </body>) ───
  // This excludes schedules from the main prov extraction
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyXml = bodyMatch ? bodyMatch[1] : xml;

  // ─── Extract provisions from <prov> elements ───
  // Use depth-aware extraction to handle nested <prov> elements
  const topProvs = extractTopLevelElements(bodyXml, 'prov');
  const bodyOffset = bodyMatch ? (bodyMatch.index ?? 0) + bodyMatch[0].indexOf(bodyMatch[1]) : 0;

  for (const prov of topProvs) {
    const provContent = prov.inner;
    const provPosition = bodyOffset + prov.startPos;

    // Extract section number from the first <label> (direct child level)
    const labelMatch = provContent.match(/<label[^>]*>([\s\S]*?)<\/label>/);
    if (!labelMatch) continue;

    const sectionNum = stripXml(labelMatch[1]).trim();
    if (!sectionNum || sectionNum === '') continue;

    // Build provision_ref (NZ uses "s" prefix for sections)
    const provisionRef = `s${sectionNum}`;

    // Skip duplicates
    if (seenRefs.has(provisionRef)) continue;
    seenRefs.add(provisionRef);

    // Extract heading/title
    const headingMatch = provContent.match(/<heading[^>]*>([\s\S]*?)<\/heading>/);
    const title = headingMatch ? stripXml(headingMatch[1]) : '';

    // Extract body content from <prov.body>
    const bodyContentMatch = provContent.match(/<prov\.body>([\s\S]*)<\/prov\.body>/i);
    const bodyContentXml = bodyContentMatch ? bodyContentMatch[1] : provContent;
    const content = stripXml(bodyContentXml);

    if (content.length < 5) continue;

    // Determine part context using pre-computed index
    const chapter = lookupPartContext(partIndex, provPosition);

    provisions.push({
      provision_ref: provisionRef,
      chapter,
      section: sectionNum,
      title,
      content: content.substring(0, 8000), // Cap at 8K chars
    });

    // ─── Extract definitions from this provision ───
    const defParas = extractAllSimpleElements(provContent, 'def-para');
    for (const defPara of defParas) {
      const termMatch = defPara.inner.match(/<def-term[^>]*>([\s\S]*?)<\/def-term>/);
      if (!termMatch) continue;

      const term = stripXml(termMatch[1]).trim();
      if (!term) continue;

      const definition = stripXml(defPara.inner).trim();
      if (!definition) continue;

      definitions.push({
        term,
        definition: definition.substring(0, 4000),
        source_provision: provisionRef,
      });
    }
  }

  // ─── Extract schedule provisions ───
  // Schedules may contain clauses (like mini-acts within the act)
  const schedules = extractTopLevelElements(xml, 'schedule');

  for (const sched of schedules) {
    const schedContent = sched.inner;
    const schedLabelMatch = schedContent.match(/<label[^>]*>([\s\S]*?)<\/label>/);
    const schedHeadingMatch = schedContent.match(/<heading[^>]*>([\s\S]*?)<\/heading>/);

    const schedLabel = schedLabelMatch ? stripXml(schedLabelMatch[1]).trim() : '';
    const schedHeading = schedHeadingMatch ? stripXml(schedHeadingMatch[1]) : '';
    const schedChapter = schedLabel
      ? `Schedule ${schedLabel}${schedHeading ? ': ' + schedHeading : ''}`
      : (schedHeading ? `Schedule: ${schedHeading}` : 'Schedule');

    // Extract provisions within the schedule (top-level only)
    const schedProvs = extractTopLevelElements(schedContent, 'prov');

    for (const schedProv of schedProvs) {
      const innerContent = schedProv.inner;

      const innerLabelMatch = innerContent.match(/<label[^>]*>([\s\S]*?)<\/label>/);
      if (!innerLabelMatch) continue;

      const clauseNum = stripXml(innerLabelMatch[1]).trim();
      if (!clauseNum) continue;

      const provisionRef = `sch${schedLabel ? schedLabel + '-' : ''}cl${clauseNum}`;
      if (seenRefs.has(provisionRef)) continue;
      seenRefs.add(provisionRef);

      const innerHeadingMatch = innerContent.match(/<heading[^>]*>([\s\S]*?)<\/heading>/);
      const innerTitle = innerHeadingMatch ? stripXml(innerHeadingMatch[1]) : '';

      const innerBodyMatch = innerContent.match(/<prov\.body>([\s\S]*)<\/prov\.body>/i);
      const innerBody = innerBodyMatch ? innerBodyMatch[1] : innerContent;
      const innerText = stripXml(innerBody);

      if (innerText.length < 5) continue;

      provisions.push({
        provision_ref: provisionRef,
        chapter: schedChapter,
        section: clauseNum,
        title: innerTitle,
        content: innerText.substring(0, 8000),
      });
    }
  }

  // ─── Deduplicate definitions (keep longest per term) ───

  const deduped = new Map<string, ParsedDefinition>();
  for (const def of definitions) {
    const key = def.term.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || def.definition.length > existing.definition.length) {
      deduped.set(key, def);
    }
  }
  const uniqueDefinitions = Array.from(deduped.values());

  // ─── Build description from cover element ───

  const coverTitle = extractElement(xml, 'title');
  const description = coverTitle ? `${stripXml(coverTitle)} (New Zealand)` : undefined;

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description,
    provisions,
    definitions: uniqueDefinitions,
  };
}

/**
 * Pre-configured list of key New Zealand Acts to ingest.
 * These are the most important statutes for cybersecurity, data protection,
 * and compliance use cases.
 *
 * The `url` field uses the legislation.govt.nz whole.html pattern for reference,
 * but actual fetching uses the /subscribe/ XML endpoint.
 *
 * @deprecated Use census.json for full corpus ingestion instead.
 */
export const KEY_NZ_ACTS: ActIndexEntry[] = [
  {
    id: 'privacy-act-2020',
    title: 'Privacy Act 2020',
    titleEn: 'Privacy Act 2020',
    shortName: 'Privacy Act',
    status: 'in_force',
    issuedDate: '2020-06-30',
    inForceDate: '2020-12-01',
    url: 'https://www.legislation.govt.nz/act/public/2020/0031/latest/whole.html',
  },
  {
    id: 'harmful-digital-communications-act-2015',
    title: 'Harmful Digital Communications Act 2015',
    titleEn: 'Harmful Digital Communications Act 2015',
    shortName: 'HDCA',
    status: 'in_force',
    issuedDate: '2015-07-02',
    inForceDate: '2015-11-28',
    url: 'https://www.legislation.govt.nz/act/public/2015/0063/latest/whole.html',
  },
  {
    id: 'electronic-transactions-act-2002',
    title: 'Electronic Transactions Act 2002',
    titleEn: 'Electronic Transactions Act 2002',
    shortName: 'ETA',
    status: 'in_force',
    issuedDate: '2002-11-17',
    inForceDate: '2003-03-01',
    url: 'https://www.legislation.govt.nz/act/public/2002/0035/latest/whole.html',
  },
  {
    id: 'companies-act-1993',
    title: 'Companies Act 1993',
    titleEn: 'Companies Act 1993',
    shortName: 'Companies Act',
    status: 'in_force',
    issuedDate: '1993-09-28',
    inForceDate: '1993-07-01',
    url: 'https://www.legislation.govt.nz/act/public/1993/0105/latest/whole.html',
  },
  {
    id: 'commerce-act-1986',
    title: 'Commerce Act 1986',
    titleEn: 'Commerce Act 1986',
    shortName: 'Commerce Act',
    status: 'in_force',
    issuedDate: '1986-06-04',
    inForceDate: '1986-05-01',
    url: 'https://www.legislation.govt.nz/act/public/1986/0005/latest/whole.html',
  },
  {
    id: 'films-videos-publications-classification-act-1993',
    title: 'Films, Videos, and Publications Classification Act 1993',
    titleEn: 'Films, Videos, and Publications Classification Act 1993',
    shortName: 'FVPC Act',
    status: 'in_force',
    issuedDate: '1993-08-03',
    inForceDate: '1993-10-01',
    url: 'https://www.legislation.govt.nz/act/public/1993/0094/latest/whole.html',
  },
  {
    id: 'search-and-surveillance-act-2012',
    title: 'Search and Surveillance Act 2012',
    titleEn: 'Search and Surveillance Act 2012',
    shortName: 'SSA',
    status: 'in_force',
    issuedDate: '2012-04-18',
    inForceDate: '2012-04-18',
    url: 'https://www.legislation.govt.nz/act/public/2012/0024/latest/whole.html',
  },
  {
    id: 'telecommunications-interception-capability-security-act-2013',
    title: 'Telecommunications (Interception Capability and Security) Act 2013',
    titleEn: 'Telecommunications (Interception Capability and Security) Act 2013',
    shortName: 'TICSA',
    status: 'in_force',
    issuedDate: '2013-11-11',
    inForceDate: '2014-05-11',
    url: 'https://www.legislation.govt.nz/act/public/2013/0091/latest/whole.html',
  },
  {
    id: 'consumer-guarantees-act-1993',
    title: 'Consumer Guarantees Act 1993',
    titleEn: 'Consumer Guarantees Act 1993',
    shortName: 'CGA',
    status: 'in_force',
    issuedDate: '1993-08-18',
    inForceDate: '1994-04-01',
    url: 'https://www.legislation.govt.nz/act/public/1993/0091/latest/whole.html',
  },
  {
    id: 'intelligence-and-security-act-2017',
    title: 'Intelligence and Security Act 2017',
    titleEn: 'Intelligence and Security Act 2017',
    shortName: 'ISA',
    status: 'in_force',
    issuedDate: '2017-03-28',
    inForceDate: '2017-03-28',
    url: 'https://www.legislation.govt.nz/act/public/2017/0010/latest/whole.html',
  },
];
