<div align="center">

<img src="https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/icon.svg" width="72" height="72" alt="">

# DOAJ Discovery MCP

**Search the Directory of Open Access Journals from any AI client — no account, no API key, no payment**

[![Claude Code compatible](https://img.shields.io/badge/Claude_Code-compatible-D97757?logo=anthropic&logoColor=white)](https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp)
[![Node](https://img.shields.io/badge/Node-22%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.30-000000)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Tools](https://img.shields.io/badge/Tools-8_read--only-4C1)](#-tools)
[![Transport](https://img.shields.io/badge/Transport-HTTP_%2B_stdio-0A66C2)](#-quick-start)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

[Problem](#-the-problem) · [Tools](#-tools) · [Quick Start](#-quick-start) · [Local](#-run-locally) · [Docker](#-docker) · [Privacy](#-privacy) · [Development](#-development) · [Deployment](#-deployment)

</div>

---

## 🎯 The Problem

The DOAJ indexes over 23,000 peer-reviewed open access journals, but finding the right one is
manual work. Its API speaks Elasticsearch query syntax — bare multi-word searches are `AND`-ed
together, so a natural-language question or a pasted abstract silently returns nothing. Filtering
by article processing charge, licence, publisher country, or language means knowing field paths
like `bibjson.apc.has_apc` and that DOAJ stores `"NL"` rather than `"Netherlands"`.

Meanwhile, an AI assistant asked "which no-fee journals publish Syriac manuscript studies?" will
answer from training data — plausible journal names, stale APC policies, no verifiable links.

This server closes that gap. It translates plain-language questions and manuscript abstracts into
valid DOAJ queries, applies real metadata filters server-side, ranks candidates locally, and
returns source links for verification.

> [!NOTE]
> **Public beta.** Free to use, no uptime SLA. Verify important results on DOAJ and the journal's
> own website.

> [!IMPORTANT]
> **Independent project.** DOAJ Discovery MCP is an independent, unofficial open-source project.
> It is not affiliated with, endorsed by, sponsored by, or operated by DOAJ.

---

## 🧰 Tools

Eight read-only tools. None performs editorial review, acceptance prediction, compliance
checking, or publishing decisions.

| Tool                                     | Key inputs                                                                | What it does                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `search_doaj_journals`                   | `query`, `country`, `language`, `license`, `noApcOnly`, `strict`          | Journal search with DOAJ-side metadata filters and local lexical ranking         |
| `search_doaj_articles`                   | `query`, `limit`, `strict`                                                | Article search with local lexical ranking                                        |
| `recommend_doaj_journals_for_manuscript` | `abstract`, `title`, `preferredLanguage`, `preferredCountry`, `noApcOnly` | Manuscript-fit discovery candidates from an abstract                             |
| `find_diamond_oa_journals`               | `query`, `limit`                                                          | No-fee journals via the `bibjson.apc.has_apc:false` filter                       |
| `find_similar_doaj_articles`             | `abstract`, `title`                                                       | Articles similar to a given abstract                                             |
| `get_doaj_journal_by_issn`               | `issn`                                                                    | Direct lookup by print or electronic ISSN                                        |
| `get_doaj_article_by_doi`                | `doi`                                                                     | Direct lookup by DOI                                                             |
| `explain_doaj_metadata`                  | `term`                                                                    | Explains APC, licence, language, ISSN, diamond OA — fully local, no network call |

Every search response includes the effective DOAJ query it ran, the upstream `total`, and how many
results were returned, so you can see and audit what was actually asked.

### Why connect this instead of asking directly?

An AI client can query **current** DOAJ metadata rather than relying on model memory. It can find
journal or article candidates, identify no-APC records, rank results for a topic, and preserve
links for verification. The connection exposes no private DOAJ data.

---

## 🚀 Quick Start

### Remote (Streamable HTTP)

No account, API key, or payment required. Add this URL:

```text
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/mcp
```

| Client                                  | Where to add it                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| **Claude** (paid plans)                 | Settings → Connectors → Add custom connector                                         |
| **ChatGPT** (Business, Enterprise, Edu) | Settings → Apps, developer mode enabled, created by an authorized admin or developer |
| **Codex / other MCP clients**           | Add as a remote Streamable HTTP MCP server                                           |

Client availability and menu names change. See the current
[Claude connector guide](https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp)
and [ChatGPT developer mode guide](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta).

### Local (stdio)

For clients that launch MCP servers as a subprocess:

```bash
npm ci && npm run build
```

```json
{
  "mcpServers": {
    "doaj-discovery": {
      "command": "node",
      "args": ["/absolute/path/to/doaj-discovery-mcp/dist/src/stdio.js"]
    }
  }
}
```

---

## 💻 Run Locally

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000/`. The MCP endpoint is `http://localhost:3000/mcp`; health is
`http://localhost:3000/health`. For the stdio transport instead, run `npm run dev:stdio`.

Configuration is documented in [.env.example](.env.example). The public DOAJ API is used without
an API key.

---

## 🐳 Docker

```bash
docker build -t doaj-discovery-mcp .
docker run --rm -p 3000:3000 --env-file .env doaj-discovery-mcp
```

---

## 🔒 Privacy

Do not send confidential, unpublished, personal, or sensitive manuscript text to the public
service. Requests pass through Google Cloud and the public DOAJ API. Query text and abstracts are
not intentionally persisted by the application, and production caching is disabled. Read
[PRIVACY.md](PRIVACY.md) for details.

---

## 🛠 Development

```bash
npm run check                 # tests, build, lint, format check
DOAJ_LIVE_TEST=1 npm test     # additionally hit the real DOAJ API
docker build -t doaj-discovery-mcp:local .
```

The live tests are skipped by default so CI stays hermetic. They exist as a regression guard: a
DOAJ query can be syntactically valid and still match zero records, which unit tests with a
stubbed `fetch` cannot detect.

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [MIT License](LICENSE).

---

## ☁️ Deployment

Pushes to `main` are verified by CI and then deployed to Google Cloud Run through keyless Workload
Identity Federation. See [docs/CLOUD_RUN.md](docs/CLOUD_RUN.md).

- Landing page: https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/
- Health: https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/health
- Issues: https://github.com/ramiramirez-nl/doaj-discovery-mcp/issues
