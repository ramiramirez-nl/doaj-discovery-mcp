# DOAJ Discovery MCP

Costless-first Model Context Protocol server for discovering DOAJ-indexed journals and articles.

This server is read-only and discovery-only. It does not perform DOAJ editorial review, criteria checking, compliance checking, endogeny checking, or publishing decisions.

## Features

- Journal discovery
- Article discovery
- Manuscript-fit journal recommendations
- Diamond OA and no-fee journal discovery
- Similar article discovery with lexical and metadata ranking
- DOAJ metadata explanations
- Local filesystem cache
- BM25-like scoring, synonym expansion, language and location boosts
- Streamable HTTP MCP endpoint at `/mcp`
- Health endpoint at `/health`

## Costless First

No OpenAI API key is required. No paid embedding service, paid vector database, paid search service, or paid hosting-specific service is used.

If semantic search is requested while local vector search is disabled, the server ranks by lexical relevance, synonym expansion, and DOAJ metadata and returns a warning.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

MCP endpoint:

```text
http://localhost:3000/mcp
```

## Environment

See `.env.example`. `DOAJ_API_KEY` is optional.

## Docker

```bash
docker build -t doaj-discovery-mcp .
docker run -p 3000:3000 --env-file .env doaj-discovery-mcp
```
