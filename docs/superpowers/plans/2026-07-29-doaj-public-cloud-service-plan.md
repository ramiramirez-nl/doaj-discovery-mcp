# Public Cloud Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a simple, public, read-only DOAJ Discovery MCP at a Cloud Run HTTPS URL with no user account, DOAJ API key, or client-side installation.

**Architecture:** Keep the existing TypeScript/Node.js MCP server and Docker image. Add stateless Streamable HTTP handling, a small built-in landing/privacy surface, bounded public requests, accurate read-only tool annotations, and a GitHub Actions deployment path to Google Cloud Run using Workload Identity Federation.

**Tech Stack:** Node.js 20+, TypeScript, `@modelcontextprotocol/sdk`, Zod, Vitest, ESLint, Prettier, Docker, GitHub Actions, Google Cloud Run.

## Global Constraints

- Production project: `doaj-discovery-mcp`.
- Production region: `europe-west1`.
- Cloud Run service: `doaj-discovery-mcp`.
- Cloud Run minimum instances: `0`; maximum instances: `1`.
- Initial Cloud Run memory: `512MiB`; initial CPU: `1`.
- Public routes: `/`, `/mcp`, `/health`, `/privacy`.
- Public DOAJ search only; remove public `DOAJ_API_KEY` and Bearer-header behavior.
- All tools are read-only: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`.
- Do not log query text, abstracts, request bodies, full query URLs, cache keys, or result bodies.
- No analytics, cookies, advertising, paid semantic search, database, or custom domain in first release.
- Every source change is tested and pushed to GitHub `main`.

---

### Task 1: Align configuration and DOAJ client with public API use

**Files:**
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Modify: `src/doaj/client.ts`
- Modify: `.env.example`
- Modify: `tests/config.test.ts`
- Modify: `tests/normalize.test.ts` or create `tests/doaj-client.test.ts`

**Interfaces:**
- `loadConfig(env)` continues returning `AppConfig`.
- `DoajClient` continues exposing `searchJournals`, `searchArticles`, `fetchJournal`, and `fetchArticle`.
- Add one bounded timeout helper used by all upstream requests.

- [ ] **Step 1: Add failing config tests**

Test that production configuration has no required API key, preserves `https://doaj.org/api` as the default, clamps page/result limits, and accepts a configurable upstream timeout.

- [ ] **Step 2: Run the focused config tests**

Run:

```bash
npx vitest run tests/config.test.ts
```

Expected: new assertions fail until configuration is updated.

- [ ] **Step 3: Remove public API-key configuration**

Remove `DOAJ_API_KEY` from `AppConfig`, `loadConfig`, and `.env.example`. Keep the base URL configurable for tests. Add `DOAJ_REQUEST_TIMEOUT_MS` with a safe default of `10000` and a hard lower bound of `1000`.

- [ ] **Step 4: Add bounded upstream requests**

Use `AbortSignal.timeout(config.doajRequestTimeoutMs)` in `fetch`. Do not add an authorization header. Preserve structured warnings for HTTP `429`, timeout, non-JSON, and non-2xx responses. Never include the full query URL in a warning or log message.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npx vitest run tests/config.test.ts tests/normalize.test.ts
npm run build
```

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/config.ts src/doaj/client.ts .env.example tests/config.test.ts tests/normalize.test.ts tests/doaj-client.test.ts
git commit -m "fix: use public DOAJ API safely"
```

### Task 2: Make HTTP transport stateless and add public web routes

**Files:**
- Modify: `src/server.ts`
- Create: `src/http/pages.ts`
- Create: `tests/server.test.ts`
- Modify: `package.json` only if a test helper is required

**Interfaces:**
- `startServer(): void` remains the executable entry point.
- `createMcpServer(): McpServer` remains available to tests.
- `renderHomePage(baseUrl: string): string` and `renderPrivacyPage(): string` return complete HTML documents.

- [ ] **Step 1: Write route and transport tests**

Cover `GET /`, `GET /privacy`, `GET /health`, `GET /mcp`, unsupported routes, and the `PORT` environment variable. Assert that the landing page contains the MCP URL, setup links, examples, and the independence notice. Assert that privacy text says query text and abstracts are not intentionally persisted in application logs.

- [ ] **Step 2: Run the new server tests**

Run:

```bash
npx vitest run tests/server.test.ts
```

Expected: tests fail because pages and testable server lifecycle are not implemented.

- [ ] **Step 3: Extract HTML page rendering**

Create `src/http/pages.ts` with escaped dynamic values, no external assets, and English copy. Include the exact independence notice from the approved design. Keep HTML small and accessible.

- [ ] **Step 4: Replace session-map dependence**

Configure Streamable HTTP transport without requiring a server-local session map. Each request must be safe after scale-to-zero or routing to a fresh instance. Preserve MCP initialization and tool discovery behavior.

- [ ] **Step 5: Add routes and safe request handling**

Return correct content types, `404` JSON for unknown routes, bounded request-body reads, and generic `500` responses. Do not print request bodies or full URLs to stdout.

- [ ] **Step 6: Run route tests, build, and lint**

```bash
npx vitest run tests/server.test.ts
npm run build
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/server.ts src/http/pages.ts tests/server.test.ts
git commit -m "feat: add public landing and stateless HTTP routes"
```

### Task 3: Add read-only annotations and abuse controls

**Files:**
- Modify: `src/tools/register.ts`
- Create: `src/http/rate-limit.ts`
- Modify: `src/types.ts` if public-limit config fields are added
- Modify: `src/config.ts` and `.env.example`
- Modify: `tests/tools.test.ts`
- Create: `tests/rate-limit.test.ts`

**Interfaces:**
- `createRateLimiter(options): RateLimiter` exposes `allow(key): { allowed: boolean; retryAfterSeconds: number }`.
- Tool registration continues using the existing `registerDiscoveryTools(server, client, config)` signature.

- [ ] **Step 1: Write rate-limit and annotation tests**

Test burst allowance, rejection with retry seconds, expiry after the configured window, and bounded input lengths. Inspect every registered tool and assert the read-only annotation fields.

- [ ] **Step 2: Run focused tests**

```bash
npx vitest run tests/rate-limit.test.ts tests/tools.test.ts
```

Expected: new tests fail before implementation.

- [ ] **Step 3: Implement bounded rate limiting**

Use an in-memory fixed-window or token-bucket limiter with configurable limits. Key on the direct request source unless a trusted proxy has been explicitly configured. Add a global concurrency guard and `Retry-After` handling. Keep defaults generous enough for shared AI-provider egress.

- [ ] **Step 4: Add MCP tool annotations**

Add accurate annotations to all six tools. Keep tool names and input signatures backward compatible. Add output warnings and source-link fields without exposing hidden metadata.

- [ ] **Step 5: Enforce public input/output bounds**

Limit query, title, abstract, and term lengths. Keep result counts within `MAX_RESULTS_LIMIT`. Return structured validation errors instead of throwing uncaught exceptions.

- [ ] **Step 6: Run full local checks**

```bash
npm test
npm run build
npm run lint
```

Expected: 13 existing tests plus new tests pass; build and lint exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/tools/register.ts src/http/rate-limit.ts src/types.ts src/config.ts .env.example tests/tools.test.ts tests/rate-limit.test.ts
git commit -m "feat: harden public read-only MCP access"
```

### Task 4: Update public documentation and licensing

**Files:**
- Modify: `README.md`
- Create: `PRIVACY.md`
- Create: `LICENSE`
- Create: `CHANGELOG.md`

**Interfaces:**
- Documentation must match the actual `/mcp`, `/health`, `/privacy`, npm/local, Docker, Claude, ChatGPT, and Codex setup paths.

- [ ] **Step 1: Write the documentation checklist into the README**

Add sections for what the MCP does, what it does not do, benefits, no-key setup, local setup, Docker, public URL setup, examples, privacy, source attribution, support, and independent-project status.

- [ ] **Step 2: Add platform connection examples**

Document the placeholder public URL as an environment/config value during development, then show the final Cloud Run URL after deployment. Do not publish a fake live endpoint.

- [ ] **Step 3: Add privacy and license files**

Write `PRIVACY.md` using the approved logging and retention statements. Add an MIT license with the repository owner as the copyright holder. Add an initial changelog entry for the public cloud release.

- [ ] **Step 4: Run documentation consistency checks**

```bash
rg -n "DOAJ_API_KEY|localhost:3000|/mcp|/privacy|not affiliated|no account" README.md PRIVACY.md .env.example
git diff --check
```

Expected: no README instruction requires a DOAJ API key, and all public routes are documented.

- [ ] **Step 5: Commit**

```bash
git add README.md PRIVACY.md LICENSE CHANGELOG.md
git commit -m "docs: prepare public MCP distribution"
```

### Task 5: Add Cloud Run deployment and GitHub automation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-cloud-run.yml`
- Create: `cloudbuild.yaml` only if required by the chosen deployment path
- Modify: `Dockerfile`
- Modify: `.gitignore` if deployment artifacts require it

**Interfaces:**
- CI validates pull requests and `main`.
- Deploy workflow publishes the container to Cloud Run project `doaj-discovery-mcp`, region `europe-west1`, service `doaj-discovery-mcp`.
- Authentication uses GitHub OIDC and Google Workload Identity Federation, never a long-lived service-account JSON key.

- [ ] **Step 1: Make the container Cloud Run compatible**

Ensure the server listens on `process.env.PORT`, the production command is `node dist/src/server.js`, and the image includes only runtime dependencies and required synonym data.

- [ ] **Step 2: Add CI workflow**

Run `npm ci`, `npm test`, `npm run build`, `npm run lint`, and `docker build` on pushes and pull requests. Fail before deploy when any command fails.

- [ ] **Step 3: Define deployment inputs**

Use repository variables for project ID, region, and service name. Use Google provider, workload identity provider, and deployer service-account identifiers as protected configuration. Do not put credentials in workflow source.

- [ ] **Step 4: Configure the first Cloud Run revision**

Deploy the image with public unauthenticated access, request-based billing, 512MiB memory, 1 CPU, minimum instances 0, maximum instances 1, bounded concurrency, and a health check on `/health`.

- [ ] **Step 5: Configure spend protection**

Create the project/service budget or spend cap at USD 5 where available, plus alerts. Document that billing reporting can lag and that maximum instances and application limits are the primary first-line controls.

- [ ] **Step 6: Run workflow validation locally**

```bash
git diff --check
npm test
npm run build
npm run lint
docker build -t doaj-discovery-mcp:local .
```

Expected: all commands exit 0 before enabling deploy automation.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows Dockerfile cloudbuild.yaml .gitignore
git commit -m "ci: deploy public MCP to Cloud Run"
```

### Task 6: Deploy, smoke-test, and release

**Files:**
- Modify: `README.md` with the real public URL after successful deployment.
- Modify: `CHANGELOG.md` with the release result.
- Create: `docs/superpowers/plans/2026-07-29-doaj-public-cloud-service-release-notes.md` only if a separate release record is needed.

**Interfaces:**
- Public endpoint: `https://<cloud-run-service-url>/mcp`.
- Health endpoint: `https://<cloud-run-service-url>/health`.

- [ ] **Step 1: Authenticate the local deployment operator**

Install Google Cloud CLI if absent, authenticate the user's Google account in the browser, select project `doaj-discovery-mcp`, and verify the active account and project without exposing credentials.

- [ ] **Step 2: Enable required APIs**

Enable Cloud Run, Artifact Registry, Cloud Build, IAM Credentials, and Service Usage APIs in the user's project. Confirm the project ID before each write operation.

- [ ] **Step 3: Configure GitHub OIDC deployment**

Create the least-privileged deployer service account, workload identity provider, and repository binding for `ramiramirez-nl/doaj-discovery-mcp`. Store only non-secret identifiers in GitHub configuration.

- [ ] **Step 4: Deploy the first revision**

Run the workflow from `main` and wait for a successful Cloud Run revision. Record the generated URL in the README.

- [ ] **Step 5: Run remote smoke tests**

Verify `GET /health`, `GET /`, `GET /privacy`, MCP initialization, tool discovery, one journal search, one article search, invalid input handling, and upstream failure warnings.

- [ ] **Step 6: Inspect operational logs**

Confirm that logs contain service health and error context but no query text, abstract, request body, full query URL, cache key, or result payload.

- [ ] **Step 7: Run final release checks and push**

```bash
npm test
npm run build
npm run lint
git status --short --branch
git push origin main
```

Expected: clean working tree, `main` tracking `origin/main`, and public smoke tests successful.

- [ ] **Step 8: Commit release documentation**

```bash
git add README.md CHANGELOG.md
git commit -m "release: publish public DOAJ Discovery MCP"
git push origin main
```

## Plan Self-Review

- Spec coverage: public routes, stateless transport, public DOAJ API, annotations, rate limiting, privacy, licensing, CI, OIDC deploy, Cloud Run limits, spend control, rollback path, and smoke tests are assigned to Tasks 1-6.
- Placeholder scan: no unfinished marker or unspecified implementation step appears in this plan.
- Type consistency: existing `AppConfig`, `DoajClient`, `registerDiscoveryTools`, `startServer`, and `createMcpServer` signatures are preserved unless a new field is explicitly named.
- Scope: marketplace submissions remain Phase 2 and are intentionally outside this first implementation plan.
