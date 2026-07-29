# DOAJ Discovery MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality, costless-first TypeScript/Node.js MCP server for DOAJ journal and article discovery.

**Architecture:** Use a small HTTP server that exposes `GET /health` and a Streamable HTTP MCP endpoint at `/mcp`. Keep DOAJ access, cache, normalization, ranking, query analysis, and MCP tools in separate modules with defensive parsing and testable pure functions.

**Tech Stack:** Node.js 20+, TypeScript, `@modelcontextprotocol/sdk`, Zod, Vitest, tsx, ESLint, Prettier, Docker.

---

### Task 1: Project Skeleton

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `Dockerfile`
- Create: `README.md`

- [ ] **Step 1: Add package and tooling config**

Create package scripts for dev, build, start, test, lint, and format. Keep dependencies limited to free local runtime libraries.

- [ ] **Step 2: Add environment example**

Use only public/costless settings, including optional `DOAJ_API_KEY` and no `OPENAI_API_KEY`.

- [ ] **Step 3: Add Dockerfile**

Use Node 20 Alpine, install dependencies, build TypeScript, and run `dist/server.js`.

### Task 2: Core Types and Config

**Files:**

- Create: `src/config.ts`
- Create: `src/types.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write tests**

Verify numeric env parsing, defaults, result limits, and absence of OpenAI config.

- [ ] **Step 2: Implement config**

Parse env defensively and clamp `MAX_RESULTS_DEFAULT` to `MAX_RESULTS_LIMIT`.

### Task 3: Cache Layer

**Files:**

- Create: `src/cache/store.ts`
- Create: `src/cache/file-cache-store.ts`
- Create: `src/cache/keys.ts`
- Test: `tests/cache.test.ts`

- [ ] **Step 1: Write tests**

Verify entries include key, timestamp, TTL, source, payload version, payload; expired entries return misses; invalidation removes entries.

- [ ] **Step 2: Implement cache**

Use filesystem JSON files with SHA-256 key filenames and a swappable `CacheStore` interface.

### Task 4: DOAJ Client and Normalization

**Files:**

- Create: `src/doaj/client.ts`
- Create: `src/doaj/normalize.ts`
- Test: `tests/normalize.test.ts`

- [ ] **Step 1: Write tests**

Verify defensive extraction from nested DOAJ-like records for journal title, ISSN, country, languages, APC/no-fee status, article title, abstract, authors, published date, and links.

- [ ] **Step 2: Implement normalization**

Handle multiple common nested shapes without assuming one rigid API response.

- [ ] **Step 3: Implement client**

Support search/fetch journals and articles, pagination, optional API key header, cache lookup/write, structured errors, and rate-limit warnings.

### Task 5: Lexical Ranking and Query Analysis

**Files:**

- Create: `src/search/text.ts`
- Create: `src/search/synonyms.ts`
- Create: `src/search/rank.ts`
- Create: `src/query/preferences.ts`
- Create: `src/synonyms.yml`
- Test: `tests/rank.test.ts`
- Test: `tests/preferences.test.ts`

- [ ] **Step 1: Write tests**

Verify diacritic-insensitive tokenization, synonym expansion, phrase boost, field weighting, no-fee/diamond terms, language and country boosts, and semantic-search warning behavior.

- [ ] **Step 2: Implement ranking**

Use BM25-like scoring over candidate records plus conservative synonym expansion and metadata boosts.

### Task 6: MCP Tools and HTTP Server

**Files:**

- Create: `src/tools/explain.ts`
- Create: `src/tools/journals.ts`
- Create: `src/tools/articles.ts`
- Create: `src/tools/register.ts`
- Create: `src/server.ts`
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write tests**

Verify tool schemas accept discovery queries, reject invalid limits, and return warnings for semantic/similar-article lexical fallback.

- [ ] **Step 2: Implement tools**

Expose tools for journal discovery, article discovery, manuscript-fit recommendations, no-fee journals, similar articles, and DOAJ metadata explanation. Keep scope discovery-only and add warnings against editorial review use.

- [ ] **Step 3: Implement server**

Expose `/health` and `/mcp` using Streamable HTTP transport from MCP SDK.

### Task 7: Verification

**Files:**

- Modify as needed based on verification failures.

- [ ] **Step 1: Run tests**

Run `npm test`.

- [ ] **Step 2: Run typecheck/build**

Run `npm run build`.

- [ ] **Step 3: Run lint**

Run `npm run lint`.

- [ ] **Step 4: Smoke-test server**

Run server and request `/health`.

### Self-Review

Coverage: project skeleton, env, optional DOAJ key, no OpenAI key, cache, DOAJ client, normalization, lexical ranking, synonym expansion, language/location preference, discovery-only MCP tools, semantic fallback warning, Docker, README.

No placeholders remain. Types and file names are consistent across tasks.
