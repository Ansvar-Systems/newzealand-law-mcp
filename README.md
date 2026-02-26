# New Zealand Law MCP Server

**The legislation.govt.nz alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fnewzealand-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/newzealand-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/newzealand-law-mcp?style=social)](https://github.com/Ansvar-Systems/newzealand-law-mcp)
[![CI](https://github.com/Ansvar-Systems/newzealand-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/newzealand-law-mcp/actions/workflows/ci.yml)
[![Provisions](https://img.shields.io/badge/provisions-184%2C118-blue)]()

Query **4,025 New Zealand public Acts** -- from the Privacy Act 2020 and Companies Act 1993 to the Commerce Act 1986, Harmful Digital Communications Act 2015, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing New Zealand legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

New Zealand legal research is scattered across legislation.govt.nz, NZLII, the New Zealand Gazette, and various government agency websites. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking if an Act is still in force
- A **legal tech developer** building tools on New Zealand law
- A **researcher** tracing 168 years of legislative history from 1858 to 2026

...you shouldn't need a dozen browser tabs and manual cross-referencing through the Parliamentary Counsel Office website. Ask Claude. Get the exact provision. With context.

This MCP server makes New Zealand law **searchable, cross-referenceable, and AI-readable** -- with 4,025 public Acts, 184,118 provisions, and 47,194 legal definitions covering 168 years of legislation.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://newzealand-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add newzealand-law --transport http https://newzealand-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "newzealand-law": {
      "type": "url",
      "url": "https://newzealand-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "newzealand-law": {
      "type": "http",
      "url": "https://newzealand-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/newzealand-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "newzealand-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/newzealand-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "newzealand-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/newzealand-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the Privacy Act 2020 Information Privacy Principle 1 say?"*
- *"Find provisions about harmful digital communications"*
- *"Is the Commerce Act 1986 still in force?"*
- *"What sections of the Intelligence and Security Act deal with warrants?"*
- *"What EU laws does New Zealand privacy law align with?"*
- *"Find penalties for copyright infringement in NZ law"*
- *"What are the director's duties under the Companies Act 1993?"*
- *"Compare data breach notification requirements across NZ statutes"*
- *"Validate the citation s 22 Privacy Act 2020"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Acts** | 4,025 public Acts | Census-first full corpus from PCO |
| **Provisions** | 184,118 sections | Full-text searchable with FTS5 |
| **Legal Definitions** | 47,194 definitions | Extracted from interpretation sections |
| **Year Range** | 1858--2026 | 168 years of continuous legislation |
| **Languages** | English + te reo Maori | Bilingual where available |
| **Database Size** | ~300 MB | Optimized SQLite, portable |
| **Freshness Checks** | Automated | Weekly drift detection against PCO |

**Verified data only** -- every provision is ingested verbatim from the Parliamentary Counsel Office's official XML. Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All legislation text is ingested from the Parliamentary Counsel Office's official XML publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains legislation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Act title + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
PCO XML --> Parse --> SQLite --> FTS5 snippet() --> MCP response
              |                        |
       Provision parser        Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search legislation.govt.nz by Act title | Search by plain English: *"data breach notification"* |
| Navigate multi-part Acts manually | Get the exact provision with context |
| Manual cross-referencing between statutes | `build_legal_stance` aggregates across sources |
| "Is this Act still in force?" --> check manually | `check_currency` tool --> answer in seconds |
| Find EU alignment --> dig through policy papers | `get_eu_basis` --> linked EU directives instantly |
| Check government website for updates | Weekly automated freshness checks |
| No API, no integration | MCP protocol --> AI-native |

**Traditional:** Search legislation.govt.nz --> Browse Act --> Ctrl+F --> Cross-reference with other Acts --> Check New Zealand Gazette --> Repeat

**This MCP:** *"What are the privacy breach notification requirements under s 114 Privacy Act 2020?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 search across 184,118 provisions with BM25 ranking. Supports quoted phrases, boolean operators, and prefix wildcards |
| `get_provision` | Retrieve specific provision by Act title + section (e.g., "Privacy Act 2020", section "22") |
| `validate_citation` | Validate a citation against the database -- zero-hallucination check. Supports formats: "Section 22 Privacy Act 2020", "s 22 Privacy Act 2020" |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal question |
| `format_citation` | Format citations per NZ conventions (full/short/pinpoint) |
| `check_currency` | Check if an Act is in force, amended, or repealed |
| `list_sources` | Dataset provenance, statistics, and coverage metadata |
| `about` | Server metadata, version, database fingerprint, and capability summary |

### EU/International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations that a NZ statute aligns with |
| `get_nz_implementations` | Find NZ Acts that align with a specific EU directive or regulation |
| `search_eu_implementations` | Search EU documents with NZ alignment counts |
| `get_provision_eu_basis` | Get EU/international basis for a specific provision (pinpoint level) |
| `validate_eu_compliance` | Check EU/international alignment status with warnings |

---

## EU Law Integration

New Zealand is not an EU member state, but many NZ laws **autonomously align** with EU directives and regulations through trade agreements, mutual recognition arrangements, and independent policy adoption. The Privacy Act 2020, for example, was designed with GDPR-level protections -- enabling New Zealand's EU adequacy decision for cross-border data transfers.

This server maps those alignments bidirectionally:

| Capability | Description |
|------------|-------------|
| **NZ --> EU** | Given an NZ statute, find the EU directives/regulations it aligns with |
| **EU --> NZ** | Given an EU directive, find NZ statutes that implement similar provisions |
| **Provision-level** | Pinpoint EU basis for specific sections, not just whole Acts |
| **Compliance check** | Detect references to repealed EU directives, missing alignment, outdated references |

### Key Alignments

| NZ Act | EU Equivalent | Nature |
|--------|---------------|--------|
| Privacy Act 2020 | GDPR (2016/679) | Autonomous alignment; NZ has EU adequacy decision |
| Commerce Act 1986 | EU Competition Law | Autonomous alignment with EU competition principles |
| Financial Markets Conduct Act 2013 | MiFID II, MAR | Autonomous alignment for financial regulation |
| Consumer Guarantees Act 1993 | Consumer Rights Directive | Similar consumer protection framework |

---

## Data Sources & Freshness

All content is sourced from the authoritative New Zealand legal database:

- **[New Zealand Legislation](https://www.legislation.govt.nz)** -- Parliamentary Counsel Office (PCO), the official source of NZ legislation
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0)

### Automated Freshness Checks (Weekly)

A [weekly GitHub Actions workflow](.github/workflows/check-updates.yml) monitors the data source:

| Source | Check | Method |
|--------|-------|--------|
| **New Acts** | PCO publication feed | Diffed against database |
| **Amendments** | PCO XML date comparison | All 4,025 Acts checked |
| **Repeals** | Status field monitoring | Flagged when Acts change status |
| **Drift detection** | Golden hash comparison | 6 anchor provisions verified |

> Full provenance metadata: [`sources.yml`](./sources.yml)

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](.github/SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Legislation text is sourced verbatim from the Parliamentary Counsel Office's official XML publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Verify critical citations** against the [official legislation.govt.nz](https://www.legislation.govt.nz) for court filings and formal legal opinions
> - **Check the New Zealand Gazette** for the most recent amendments and commencement orders
> - **EU/international alignments** are editorial cross-references, not official government positions
> - **Te reo Maori provisions** are included where available in PCO data, but may not cover all bilingual enactments

### New Zealand-Specific Notes

- New Zealand Acts are identified by **title + year** (e.g., "Privacy Act 2020"), not systematic numbering
- Citation format follows NZ convention: "Section N, [Act Title Year]" or "s N [Act Title Year]"
- Some historical Acts (pre-1900) may have incomplete digitisation
- Imperial Acts still in force in New Zealand may not be fully covered
- Regulations (secondary legislation) are included where available in the PCO corpus

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API (or your chosen LLM provider). For privileged or confidential matters, use on-premise deployment via the npm package (`npx @ansvar/newzealand-law-mcp`). See [PRIVACY.md](PRIVACY.md) for data handling guidance.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/newzealand-law-mcp
cd newzealand-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/src/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run build:db               # Rebuild SQLite database from raw data
npm run ingest                 # Ingest legislation from PCO
npm run drift:detect           # Run drift detection against golden hashes
npm run check-updates          # Check for amendments and new Acts
npm run validate               # Full validation (lint + test + contract)
```

### Testing

```bash
npm test                       # Run all tests
npm run test:contract          # Run contract tests (golden file validation)
npm run lint                   # TypeScript type checking
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~300 MB (comprehensive, portable)
- **Provisions:** 184,118 sections across 4,025 Acts
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/newzealand-law-mcp (This Project)
**Query 4,025 New Zealand public Acts directly from Claude** -- Privacy Act, Companies Act, Commerce Act, and more. Full provision text with EU alignment cross-references. `npx @ansvar/newzealand-law-mcp`

### [@ansvar/australian-law-mcp](https://github.com/Ansvar-Systems/australian-law-mcp)
**Query Australian federal legislation directly from Claude** -- Privacy Act, Corporations Act, Criminal Code, and more. Trans-Tasman legal research made easy. `npx @ansvar/australian-law-mcp`

### [@ansvar/uk-law-mcp](https://github.com/Ansvar-Systems/uk-law-mcp)
**Query UK legislation directly from Claude** -- Data Protection Act, Companies Act, and more. Commonwealth legal tradition comparison. `npx @ansvar/uk-law-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/Security_controls_MCP)
**Query 261 security frameworks and 1,451 controls** -- ISO 27001, NIST CSF, SOC 2, CIS, and more. `npx @ansvar/security-controls-mcp`

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Case law integration (Supreme Court, Court of Appeal, High Court via NZLII)
- Historical statute version tracking
- Regulations (secondary legislation) expansion
- Te reo Maori language coverage improvement
- Cross-references to Australian law (Trans-Tasman mutual recognition)

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{newzealand_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {New Zealand Law MCP Server: Production-Grade Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/newzealand-law-mcp},
  note = {Comprehensive New Zealand legal database with 4,025 public Acts, 184,118 provisions, and 47,194 definitions spanning 1858--2026}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data License

- **Legislation:** New Zealand Parliamentary Counsel Office -- [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://www.legislation.govt.nz/disclaimer)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools. This MCP server makes 168 years of New Zealand legislation -- from the earliest colonial statutes of 1858 to Acts passed in 2026 -- searchable, citable, and AI-readable.

4,025 public Acts. 184,118 provisions. 47,194 definitions. One MCP server.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
