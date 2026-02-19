# New Zealand Law MCP

New Zealand law database for the [Model Context Protocol](https://modelcontextprotocol.io/), covering privacy, harmful digital communications, electronic transactions, companies, commerce, and publications classification legislation with full-text search.

**MCP Registry:** `eu.ansvar/newzealand-law-mcp`
**npm:** `@ansvar/newzealand-law-mcp`
**License:** Apache-2.0

---

## Deployment Tier

**SMALL** -- single tier, bundled. New Zealand has a smaller legislative corpus that fits comfortably within Vercel and npm size limits.

| Tier | Platform | Database | Content |
|------|----------|----------|---------|
| **Bundled** | Vercel (Hobby) / npm (stdio) / Docker | Full database (~100-200 MB) | All NZ Acts, regulations, FTS search, international cross-references |

No tiering is required. The full New Zealand legislative database fits within the Vercel 250 MB function bundle limit, similar to the Swedish and Slovenian Law MCPs.

---

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [New Zealand Legislation](https://www.legislation.govt.nz) | NZ Government, Parliamentary Counsel Office | XML Download | Weekly | CC BY 4.0 | All NZ Acts, legislative instruments, regulations |
| [NZLII](https://www.nzlii.org) | AustLII / University of Canterbury | HTML Scrape | Weekly | NZLII Terms of Use | Case law, tribunal decisions, law reform reports |

> Full provenance metadata: [`sources.yml`](./sources.yml)

---

## Quick Start

### Claude Desktop / Cursor (stdio)

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

### Vercel Streamable HTTP (ChatGPT / Claude.ai)

Once deployed, the public endpoint will be available at:

```
https://newzealand-law-mcp.vercel.app/api/mcp
```

---

## Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific section/article from a New Zealand Act |
| `search_legislation` | Full-text search across all NZ legislation |
| `list_acts` | List all available Acts with metadata |
| `get_act_structure` | Get table of contents / structure of an Act |
| `get_provision_eu_basis` | Cross-reference NZ law to EU/international equivalents |
| `search_case_law` | Search case law from NZ courts (via NZLII) |

All tools are available in the single bundled tier -- no upgrade gating required.

---

## Key Legislation Covered

| Act | Year | Domain | Key Topics |
|-----|------|--------|------------|
| **Privacy Act** | 2020 | Data Protection | Information Privacy Principles (IPPs), personal information, data breach notification, Privacy Commissioner |
| **Harmful Digital Communications Act** | 2015 | Digital Safety | Online harm, communication principles, safe harbour for ISPs, Netsafe approved agency |
| **Electronic Transactions Act** | 2002 | Digital | Electronic signatures, electronic contracts, validity of electronic information |
| **Companies Act** | 1993 | Corporate Law | Company incorporation, directors' duties, shareholder rights, liquidation |
| **Commerce Act** | 1986 | Competition | Anti-competitive practices, mergers, market dominance, Commerce Commission |
| **Films Videos and Publications Classification Act** | 1993 | Content Regulation | Classification of publications, objectionable material, Chief Censor |

---

## Languages

New Zealand legislation is primarily in English. Some legislation includes provisions in **te reo Maori** (the Maori language), particularly:
- Te Ture Whenua Maori Act 1993 (Maori Land Act)
- Treaty of Waitangi related legislation
- Maori Language Act 2016

The MCP indexes both English (`en`) and Maori (`mi`) text where available.

---

## Database Estimates

| Component | Size Estimate |
|-----------|---------------|
| NZ Acts and regulations | ~80-120 MB |
| Case law (via NZLII) | ~30-60 MB |
| Cross-references and metadata | ~5 MB |
| **Total** | **~100-200 MB** |

**Delivery strategy:** Full database bundled in npm package (same approach as Swedish and Slovenian Law MCPs). No tiering or runtime download needed.

---

## Development

```bash
# Clone the repository
git clone https://github.com/Ansvar-Systems/newzealand-law-mcp.git
cd newzealand-law-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Build database (requires raw data in data/ directory)
npm run build:db

# Run drift detection
npm run drift:detect

# Full validation
npm run validate
```

---

## Architecture

```
newzealand-law-mcp/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Test + lint + security scan
│   │   ├── publish.yml               # npm publish on version tags
│   │   ├── check-source-updates.yml  # Data freshness monitoring
│   │   └── drift-detect.yml          # Upstream drift detection
│   ├── SECURITY.md
│   ├── SECURITY-SETUP.md
│   └── ISSUE_TEMPLATE/
│       └── data-error.md
├── data/
│   └── .gitkeep
├── fixtures/
│   ├── golden-tests.json             # 12 contract tests
│   ├── golden-hashes.json            # 6 drift detection anchors
│   └── README.md
├── scripts/
│   ├── build-db.ts
│   ├── ingest.ts
│   ├── drift-detect.ts
│   └── check-source-updates.ts
├── src/
│   ├── server.ts
│   ├── db.ts
│   └── tools/
│       ├── get-provision.ts
│       ├── search-legislation.ts
│       ├── list-acts.ts
│       ├── get-act-structure.ts
│       ├── get-provision-eu-basis.ts
│       └── search-case-law.ts
├── __tests__/
│   ├── unit/
│   ├── contract/
│   │   └── golden.test.ts
│   └── integration/
├── sources.yml
├── server.json
├── package.json
├── tsconfig.json
├── CHANGELOG.md
├── LICENSE
└── README.md
```

---

## Related Documents

- [MCP Quality Standard](../../mcp-quality-standard.md) -- quality requirements for all Ansvar MCPs
- [MCP Infrastructure Blueprint](../../mcp-infrastructure-blueprint.md) -- infrastructure implementation templates
- [MCP Deployment Tiers](../../mcp-deployment-tiers.md) -- free vs. professional tier strategy
- [MCP Server Registry](../../mcp-server-registry.md) -- operational registry of all MCPs
- [MCP Remote Access](../../mcp-remote-access.md) -- public Vercel endpoint URLs

---

## Security

Report vulnerabilities to **security@ansvar.eu** (48-hour acknowledgment SLA).

See [SECURITY.md](.github/SECURITY.md) for full disclosure policy.

---

**Maintained by:** Ansvar Systems Engineering
**Contact:** hello@ansvar.eu
