# DOAJ Discovery MCP

Public, read-only MCP server for discovering DOAJ-indexed journals and articles.

> **Public beta:** The service is free to use and has no uptime SLA. Verify important results on
> DOAJ and the journal's own website.

> **Independent project:** DOAJ Discovery MCP is an independent, unofficial open-source project.
> It is not affiliated with, endorsed by, sponsored by, or operated by DOAJ.

## Connect

No account, API key, or payment is required. Add this remote Streamable HTTP MCP URL:

```text
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/mcp
```

- **Claude paid plans:** open **Settings → Connectors → Add custom connector**, then paste the URL.
- **ChatGPT Business, Enterprise, or Edu:** an authorized admin or developer creates a custom MCP
  app under **Settings → Apps** with developer mode enabled.
- **Codex or another MCP client:** add the URL as a remote Streamable HTTP MCP server.

Client availability and menu names can change. See the current
[Claude connector guide](https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp)
and [ChatGPT developer mode guide](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta).

## Tools

The server exposes six read-only tools:

- `search_doaj_journals`
- `search_doaj_articles`
- `recommend_doaj_journals_for_manuscript`
- `find_diamond_oa_journals`
- `find_similar_doaj_articles`
- `explain_doaj_metadata`

They search current public DOAJ metadata, apply bounded filters and local lexical ranking, and
return source links. They do not perform editorial review, acceptance prediction, compliance
checking, or publishing decisions.

## Why Use The MCP Connection?

An AI client can query current DOAJ metadata instead of relying only on model memory. It can find
journal or article candidates, identify no-APC records, rank results for a topic, and preserve links
for verification. The connection does not provide private DOAJ data.

## Privacy

Do not send confidential, unpublished, personal, or sensitive manuscript text to the public
service. Requests pass through Google Cloud and the public DOAJ API. Query text and abstracts are
not intentionally persisted by the application, and production caching is disabled. Read
[PRIVACY.md](PRIVACY.md) for details.

## Run Locally

Requirements: Node.js 24 or newer.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000/`. The MCP endpoint is `http://localhost:3000/mcp`; health is
`http://localhost:3000/health`.

Configuration is documented in [.env.example](.env.example). The public DOAJ API is used without
an API key.

## Docker

```bash
docker build -t doaj-discovery-mcp .
docker run --rm -p 3000:3000 --env-file .env doaj-discovery-mcp
```

## Development

```bash
npm run check
docker build -t doaj-discovery-mcp:local .
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [MIT License](LICENSE).

## Deployment

Pushes to `main` are verified by CI and then deployed to Google Cloud Run through keyless Workload
Identity Federation. See [docs/CLOUD_RUN.md](docs/CLOUD_RUN.md).

- Landing page: https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/
- Health: https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/health
- Issues: https://github.com/ramiramirez-nl/doaj-discovery-mcp/issues
