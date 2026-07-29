# DOAJ Discovery MCP

Simple, read-only Model Context Protocol server for discovering DOAJ-indexed journals and articles.

> **Independent project:** DOAJ Discovery MCP is an independent, unofficial open-source project. It is not affiliated with, endorsed by, sponsored by, or operated by DOAJ. It uses publicly available DOAJ metadata and APIs for discovery.

## What It Does

- Search DOAJ journals and articles.
- Recommend journal candidates for a manuscript topic or abstract.
- Find diamond OA and no-fee journal candidates.
- Find similar articles using lexical and metadata ranking.
- Explain common DOAJ metadata terms such as APC, license, language, and ISSN.

This is a discovery assistant, not an editorial review, acceptance predictor, compliance checker, or publishing decision service. Results should be verified on the journal's own website and in DOAJ.

## Use The Public Server

The easiest setup is to paste the public MCP URL into an AI client that supports remote MCP servers. The URL is:

```text
https://YOUR-CLOUD-RUN-URL/mcp
```

Remote MCP support and menu names vary by client. Look for **MCP**, **Connectors**, **Integrations**, or **Developer mode**, then add the URL as a remote HTTP server. No DOAJ account, DOAJ API key, OpenAI key, or user account is required.

The public landing page at the server root contains the current endpoint and short client-specific examples.

## Why Connect The API?

The API connection lets an AI client search current public DOAJ metadata through MCP tools instead of relying only on the model's memory. It can retrieve candidate journals or articles, apply simple filters, rank results for a topic, and return source links. It does not provide private DOAJ data or guarantee that a journal meets editorial criteria.

## Run Locally

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Then open `http://localhost:3000/` for the setup page. The local MCP endpoint is `http://localhost:3000/mcp` and the health check is `http://localhost:3000/health`.

## Configuration

All settings are documented in `.env.example`. The server uses the public DOAJ API by default and does not need an API key. The main settings are result limits, request timeout, cache behavior, and the public rate limit.

## Docker

```bash
docker build -t doaj-discovery-mcp .
docker run --rm -p 3000:3000 --env-file .env doaj-discovery-mcp
```

The container honors the `PORT` environment variable supplied by Cloud Run or another host.

## Deploy To Cloud Run

The repository includes an automatic GitHub Actions deployment using Workload Identity Federation. Follow [docs/CLOUD_RUN.md](docs/CLOUD_RUN.md) for the one-time Google Cloud and GitHub variable setup.

## Development

```bash
npm test
npm run build
npm run lint
```

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [PRIVACY.md](PRIVACY.md), and the [MIT License](LICENSE).

## Links

- Repository: https://github.com/ramiramirez-nl/doaj-discovery-mcp
- DOAJ: https://doaj.org/
- DOAJ API documentation: https://doaj.org/api/docs
