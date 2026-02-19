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
  // Match both self-closing and content-bearing elements
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract all occurrences of an element (non-greedy, non-nested).
 * Returns array of { outerXml, innerXml, attributes } for each match.
 */
function extractAllElements(xml: string, tagName: string): Array<{ outer: string; inner: string; attrs: string }> {
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
 * Extract an attribute value from an element's attribute string.
 */
function getAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`${name}=["']([^"']*?)["']`));
  return match ? match[1] : null;
}

/**
 * Find the current Part context for a given position in the XML.
 * Returns "Part N: Title" or undefined.
 */
function findPartContext(xml: string, position: number): string | undefined {
  // Search backwards from position for the most recent <part> opening
  const beforeText = xml.substring(0, position);

  // Find all part headings before this position
  const partMatches = [...beforeText.matchAll(/<part\s[^>]*>[\s\S]*?<label[^>]*>([\s\S]*?)<\/label>[\s\S]*?<heading>([\s\S]*?)<\/heading>/gi)];

  if (partMatches.length > 0) {
    const lastPart = partMatches[partMatches.length - 1];
    const partLabel = stripXml(lastPart[1]);
    const partHeading = stripXml(lastPart[2]);
    return `Part ${partLabel}: ${partHeading}`;
  }

  return undefined;
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

  // ─── Extract provisions from <prov> elements ───

  const provRegex = /<prov\s([^>]*?)>([\s\S]*?)<\/prov>/gi;
  let provMatch: RegExpExecArray | null;

  while ((provMatch = provRegex.exec(xml)) !== null) {
    const provAttrs = provMatch[1];
    const provContent = provMatch[2];
    const provPosition = provMatch.index;

    // Skip nested provs (schedule provs will be handled separately)
    // We check toc="yes" which marks top-level provisions
    const isToc = getAttr(provAttrs, 'toc');
    // Also include provs without toc attribute but with a label

    // Extract section number from <label>
    const labelMatch = provContent.match(/<label[^>]*>([\s\S]*?)<\/label>/);
    if (!labelMatch) continue;

    const sectionNum = stripXml(labelMatch[1]).trim();
    if (!sectionNum || sectionNum === '') continue;

    // Build provision_ref (NZ uses "s" prefix for sections)
    const provisionRef = `s${sectionNum}`;

    // Skip duplicates (can happen with nested structures)
    if (seenRefs.has(provisionRef)) continue;
    seenRefs.add(provisionRef);

    // Extract heading/title
    const headingMatch = provContent.match(/<heading>([\s\S]*?)<\/heading>/);
    const title = headingMatch ? stripXml(headingMatch[1]) : '';

    // Extract body content from <prov.body>
    const bodyMatch = provContent.match(/<prov\.body>([\s\S]*?)<\/prov\.body>/);
    const bodyXml = bodyMatch ? bodyMatch[1] : provContent;
    const content = stripXml(bodyXml);

    if (content.length < 5) continue;

    // Determine part context
    const chapter = findPartContext(xml, provPosition);

    provisions.push({
      provision_ref: provisionRef,
      chapter,
      section: sectionNum,
      title,
      content: content.substring(0, 8000), // Cap at 8K chars
    });

    // ─── Extract definitions from this provision ───

    const defParas = extractAllElements(provContent, 'def-para');
    for (const defPara of defParas) {
      const termMatch = defPara.inner.match(/<def-term[^>]*>([\s\S]*?)<\/def-term>/);
      if (!termMatch) continue;

      const term = stripXml(termMatch[1]).trim();
      if (!term) continue;

      const definition = stripXml(defPara.inner).trim();
      if (!definition) continue;

      definitions.push({
        term,
        definition: definition.substring(0, 4000), // Cap definition length
        source_provision: provisionRef,
      });
    }
  }

  // ─── Extract schedule provisions ───
  // Schedules may contain clauses (like mini-acts within the act)

  const scheduleRegex = /<schedule\s([^>]*?)>([\s\S]*?)<\/schedule>/gi;
  let schedMatch: RegExpExecArray | null;

  while ((schedMatch = scheduleRegex.exec(xml)) !== null) {
    const schedContent = schedMatch[2];
    const schedLabelMatch = schedContent.match(/<label[^>]*>([\s\S]*?)<\/label>/);
    const schedHeadingMatch = schedContent.match(/<heading>([\s\S]*?)<\/heading>/);

    const schedLabel = schedLabelMatch ? stripXml(schedLabelMatch[1]).trim() : '';
    const schedHeading = schedHeadingMatch ? stripXml(schedHeadingMatch[1]) : '';
    const schedChapter = schedLabel
      ? `Schedule ${schedLabel}${schedHeading ? ': ' + schedHeading : ''}`
      : (schedHeading ? `Schedule: ${schedHeading}` : 'Schedule');

    // Extract provisions within the schedule
    const schedProvRegex = /<prov\s([^>]*?)>([\s\S]*?)<\/prov>/gi;
    let schedProvMatch: RegExpExecArray | null;

    while ((schedProvMatch = schedProvRegex.exec(schedContent)) !== null) {
      const innerContent = schedProvMatch[2];

      const innerLabelMatch = innerContent.match(/<label[^>]*>([\s\S]*?)<\/label>/);
      if (!innerLabelMatch) continue;

      const clauseNum = stripXml(innerLabelMatch[1]).trim();
      if (!clauseNum) continue;

      const provisionRef = `sch${schedLabel ? schedLabel + '-' : ''}cl${clauseNum}`;
      if (seenRefs.has(provisionRef)) continue;
      seenRefs.add(provisionRef);

      const innerHeadingMatch = innerContent.match(/<heading>([\s\S]*?)<\/heading>/);
      const innerTitle = innerHeadingMatch ? stripXml(innerHeadingMatch[1]) : '';

      const innerBodyMatch = innerContent.match(/<prov\.body>([\s\S]*?)<\/prov\.body>/);
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
