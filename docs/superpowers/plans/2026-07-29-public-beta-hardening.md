# Public Beta Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release a compact, resilient, inexpensive `0.2.0-beta.1` public MCP service with clear onboarding and verified automatic deployment.

**Architecture:** Preserve the single stateless Node.js Cloud Run service and six read-only MCP tools. Harden the HTTP boundary, bound DOAJ queries, simplify dormant configuration, and make CI verify the exact revision before and after deployment.

**Tech Stack:** TypeScript, Node.js 24, `@modelcontextprotocol/sdk`, Zod, Vitest, ESLint, Prettier, Docker, GitHub Actions, Google Cloud Run.

## Global Constraints

- Keep one stateless Cloud Run service and six read-only discovery tools.
- Do not add accounts, authentication, a database, analytics, paid APIs, or semantic-search services.
- Do not intentionally persist query or manuscript text; production caching stays disabled.
- Preserve the independent, unofficial, not-affiliated-with-DOAJ notice.
- Treat the service as a free public beta without an uptime SLA.
- Keep Cloud Run at zero minimum instances, one maximum instance, one CPU, 512 MiB memory, and concurrency 20.
- Release version is exactly `0.2.0-beta.1`.
- Live base URL is `https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app`.

## File Map

- `src/meta.ts`: service name, display name, version, repository URL, and canonical public URL.
- `src/config.ts`, `src/types.ts`: active runtime configuration only, including explicit trusted-proxy behavior.
- `src/search/text.ts`: text normalization plus bounded public DOAJ query construction.
- `src/doaj/client.ts`: public DOAJ transport, cache isolation, timeout, response, and JSON failure handling.
- `src/http/request.ts`: bounded JSON body reading and trusted client-address extraction.
- `src/http/responses.ts`: security headers and compact JSON response helpers.
- `src/server.ts`: route orchestration and MCP lifecycle; no low-level parsing logic.
- `src/http/pages.ts`: dependency-free public beta landing and privacy pages.
- `tests/*.test.ts`: focused regression, integration, and metadata tests.
- `.github/workflows/ci.yml`: pre-deploy verification.
- `.github/workflows/deploy-cloud-run.yml`: successful-CI-only deployment and post-deploy smoke tests.
- `Dockerfile`: Node.js 24, non-root, reproducible production image.
- `README.md`, `PRIVACY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/CLOUD_RUN.md`: public documentation.

---

### Task 1: Remove Dormant Surface And Centralize Service Metadata

**Files:**

- Create: `src/meta.ts`
- Modify: `src/config.ts`
- Modify: `src/types.ts`
- Modify: `src/server.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `tests/config.test.ts`
- Create: `tests/meta.test.ts`
- Delete: `src/tools/articles.ts`
- Delete: `src/tools/journals.ts`
- Delete: `src/synonyms.yml`

**Interfaces:**

- Produces: `SERVICE_NAME`, `SERVICE_DISPLAY_NAME`, `SERVICE_VERSION`, `PUBLIC_BASE_URL`, and `REPOSITORY_URL` string constants.
- Produces: `AppConfig.trustProxy: boolean`.
- Removes: `AppConfig.enableSemanticSearch`, `AppConfig.semanticProvider`, and `AppConfig.logLevel`.

- [ ] **Step 1: Write failing configuration and metadata tests**

```ts
import packageMetadata from "../package.json";
import { describe, expect, test } from "vitest";

import { loadConfig } from "../src/config.js";
import { PUBLIC_BASE_URL, SERVICE_VERSION } from "../src/meta.js";

test("contains only active public-service configuration", () => {
  const config = loadConfig({});
  expect(config.trustProxy).toBe(false);
  expect("enableSemanticSearch" in config).toBe(false);
  expect("semanticProvider" in config).toBe(false);
  expect("logLevel" in config).toBe(false);
});

test("keeps package and public service metadata aligned", () => {
  expect(packageMetadata.version).toBe("0.2.0-beta.1");
  expect(SERVICE_VERSION).toBe(packageMetadata.version);
  expect(PUBLIC_BASE_URL).toBe("https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/config.test.ts tests/meta.test.ts`

Expected: FAIL because `trustProxy` and `src/meta.ts` do not exist and the package version is `0.1.0`.

- [ ] **Step 3: Add metadata and simplify configuration**

```ts
// src/meta.ts
export const SERVICE_NAME = "doaj-discovery-mcp";
export const SERVICE_DISPLAY_NAME = "DOAJ Discovery MCP";
export const SERVICE_VERSION = "0.2.0-beta.1";
export const PUBLIC_BASE_URL = "https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app";
export const REPOSITORY_URL = "https://github.com/ramiramirez-nl/doaj-discovery-mcp";
```

Set `package.json` and lockfile root package versions to `0.2.0-beta.1`. Replace dormant semantic
and log settings with:

```ts
trustProxy: readBoolean(env.TRUST_PROXY, false);
```

Use `SERVICE_NAME` and `SERVICE_VERSION` in MCP server and health metadata. Health reports
`ranking: "lexical"` rather than a fictional semantic provider.

- [ ] **Step 4: Remove unused compatibility files and settings**

Delete the two unused tool re-export files and unused YAML synonym file. Remove
`ENABLE_SEMANTIC_SEARCH`, `SEMANTIC_PROVIDER`, and `LOG_LEVEL` from `.env.example`; add
`TRUST_PROXY=false`.

- [ ] **Step 5: Run focused and full checks**

Run: `npm test -- tests/config.test.ts tests/meta.test.ts`

Expected: PASS.

Run: `npm run build && npm run lint`

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/meta.ts src/config.ts src/types.ts src/server.ts package.json package-lock.json .env.example tests/config.test.ts tests/meta.test.ts
git add -u src/tools/articles.ts src/tools/journals.ts src/synonyms.yml
git commit -m "refactor: simplify public service metadata"
```

---

### Task 2: Bound DOAJ Queries And Isolate Upstream Failures

**Files:**

- Modify: `src/search/text.ts`
- Modify: `src/doaj/client.ts`
- Modify: `tests/doaj-client.test.ts`
- Create: `tests/text.test.ts`

**Interfaces:**

- Produces: `buildDoajQuery(value: string, maxCharacters?: number): string`.
- Preserves: `DoajClient.searchJournals`, `searchArticles`, `fetchJournal`, and `fetchArticle`.
- Failure contract: returns `{ records: [], warnings: [safeMessage] }`; never exposes response bodies or query text.

- [ ] **Step 1: Write failing bounded-query tests**

```ts
import { describe, expect, test } from "vitest";

import { buildDoajQuery } from "../src/search/text.js";

describe("buildDoajQuery", () => {
  test("keeps useful unique terms within the encoded URL budget", () => {
    const input = `Climate economics and adaptation ${"regional resilience policy ".repeat(100)}`;
    const result = buildDoajQuery(input, 480);

    expect(result).toContain("climate");
    expect(result).toContain("economics");
    expect(result.length).toBeLessThanOrEqual(480);
    expect(result.split(" ").filter((term) => term === "regional")).toHaveLength(1);
  });

  test("returns a non-empty fallback for punctuation-only input", () => {
    expect(buildDoajQuery("...")).toBe("open access");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/text.test.ts`

Expected: FAIL because `buildDoajQuery` is not exported.

- [ ] **Step 3: Implement the smallest bounded query builder**

Build a normalized, order-preserving list of unique tokens longer than one character. Append tokens
until the joined string would exceed `maxCharacters`, defaulting to 480. Return `"open access"` if
normalization produces no tokens.

- [ ] **Step 4: Run the text tests and verify GREEN**

Run: `npm test -- tests/text.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing upstream resilience tests**

Add tests to `tests/doaj-client.test.ts` proving:

```ts
test("bounds the query placed in the DOAJ URL", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ total: 0, results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  vi.stubGlobal("fetch", fetchMock);

  const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
  await client.searchJournals("climate adaptation ".repeat(700));

  const [calledUrl] = fetchMock.mock.calls[0] as [URL, RequestInit];
  expect(decodeURIComponent(calledUrl.pathname).length).toBeLessThan(600);
});

test("returns a safe warning for invalid DOAJ JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("<html>bad gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      })
    )
  );
  const result = await new DoajClient(loadConfig({ ENABLE_CACHE: "false" })).searchJournals("test");
  expect(result).toEqual({
    records: [],
    warnings: ["DOAJ returned an invalid response. Try again later."]
  });
});

test("continues when an optional cache read fails", async () => {
  const cache: CacheStore = {
    async get<T>(): Promise<CacheEntry<T> | undefined> {
      throw new Error("disk unavailable");
    },
    async set<T>(): Promise<CacheEntry<T>> {
      throw new Error("disk unavailable");
    },
    async delete(): Promise<void> {},
    async clear(): Promise<void> {}
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    )
  );

  const result = await new DoajClient(loadConfig({ ENABLE_CACHE: "true" }), cache).searchJournals(
    "test"
  );
  expect(result).toEqual({ records: [], total: 0, warnings: [] });
});
```

- [ ] **Step 6: Run the client tests and verify RED**

Run: `npm test -- tests/doaj-client.test.ts`

Expected: FAIL on unbounded URL, JSON parsing rejection, and cache rejection.

- [ ] **Step 7: Harden `DoajClient`**

Use `buildDoajQuery` before encoding search paths. Wrap cache reads and writes so optional cache
failures never fail discovery. Validate JSON content type and catch parsing errors. Preserve the
existing timeout, network, rate-limit, and non-success warning text.

- [ ] **Step 8: Run focused and full tests**

Run: `npm test -- tests/text.test.ts tests/doaj-client.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/search/text.ts src/doaj/client.ts tests/text.test.ts tests/doaj-client.test.ts
git commit -m "fix: bound and harden DOAJ requests"
```

---

### Task 3: Harden The Public HTTP Boundary

**Files:**

- Create: `src/http/request.ts`
- Create: `src/http/responses.ts`
- Modify: `src/server.ts`
- Modify: `tests/server.test.ts`
- Create: `tests/http-request.test.ts`

**Interfaces:**

- Produces: `readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown>`.
- Produces: `getClientKey(req: IncomingMessage, trustProxy: boolean): string`.
- Produces: `applySecurityHeaders(res: ServerResponse): void`.
- Produces: `writeJson(res: ServerResponse, status: number, body: unknown, headers?: OutgoingHttpHeaders): void`.

- [ ] **Step 1: Write failing pure request-helper tests**

```ts
test("uses the first forwarded address only when proxy trust is enabled", () => {
  const request = {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" }
  } as IncomingMessage;

  expect(getClientKey(request, true)).toBe("203.0.113.7");
  expect(getClientKey(request, false)).toBe("127.0.0.1");
});

test("parses a bounded JSON body", async () => {
  const request = Readable.from(['{"ok":', "true}"]) as unknown as IncomingMessage;
  await expect(readJsonBody(request, 100)).resolves.toEqual({ ok: true });
});

test("maps malformed JSON to a public request error", async () => {
  const request = Readable.from(["{"]) as unknown as IncomingMessage;
  await expect(readJsonBody(request, 100)).rejects.toMatchObject({
    status: 400,
    code: "invalid_json"
  });
});

test("rejects streamed bodies beyond the byte limit", async () => {
  const request = Readable.from([
    '{"value":"',
    "x".repeat(100),
    '"}'
  ]) as unknown as IncomingMessage;
  await expect(readJsonBody(request, 32)).rejects.toMatchObject({
    status: 413,
    code: "request_too_large"
  });
});
```

- [ ] **Step 2: Run helper tests and verify RED**

Run: `npm test -- tests/http-request.test.ts`

Expected: FAIL because the request helpers do not exist.

- [ ] **Step 3: Implement bounded request helpers**

`readJsonBody` counts bytes from every received chunk, stops retaining chunks after the limit while
draining the request, parses UTF-8 JSON once, and maps parse failures to a typed public error.
`getClientKey` accepts only the first comma-separated forwarding value and bounds the resulting key
to 256 characters.

- [ ] **Step 4: Run helper tests and verify GREEN**

Run: `npm test -- tests/http-request.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing HTTP integration tests**

Change the test helper to accept focused configuration:

```ts
const startTestServer = async (env: NodeJS.ProcessEnv = {}): Promise<string> => {
  const server = createHttpServer(loadConfig({ ENABLE_CACHE: "false", ...env }));
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};
```

Add these cases to `tests/server.test.ts`:

```ts
test("adds compact security headers to every public response", async () => {
  const response = await fetch(`${await startTestServer()}/`);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
});

test("rejects unsupported MCP content types before SDK handling", async () => {
  const response = await fetch(`${await startTestServer()}/mcp`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}"
  });
  expect(response.status).toBe(415);
  expect(await response.json()).toEqual({ error: "unsupported_media_type" });
});

test("rejects streamed MCP bodies beyond the configured limit", async () => {
  const baseUrl = await startTestServer({
    MAX_REQUEST_BODY_BYTES: "1024"
  });
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json"
    },
    body: JSON.stringify({ value: "x".repeat(2_000) })
  });

  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: "request_too_large" });
});

test("rejects unsupported MCP methods", async () => {
  const response = await fetch(`${await startTestServer()}/mcp`, { method: "PUT" });
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("GET, POST, DELETE");
});

test("survives malformed MCP JSON", async () => {
  const baseUrl = await startTestServer();
  const malformed = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
  const health = await fetch(`${baseUrl}/health`);

  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({ error: "invalid_json" });
  expect(health.status).toBe(200);
});
```

- [ ] **Step 6: Run HTTP integration tests and verify RED**

Run: `npm test -- tests/server.test.ts`

Expected: FAIL on missing security headers and boundary checks.

- [ ] **Step 7: Refactor route orchestration**

Apply security headers before routing. Allow only `GET`, `POST`, and `DELETE` at `/mcp`; require
`application/json` for POST. Read POST JSON with `readJsonBody` and pass it as the third argument to
`transport.handleRequest`. Rate-limit with `getClientKey(req, config.trustProxy)`.

Wrap each request in a top-level `try/catch/finally`. Return typed public errors when headers are
still writable, destroy a partially written response otherwise, and always close the transport and
MCP server. Log only event name, method, path, and error class; never request bodies or query text.

- [ ] **Step 8: Run focused and full checks**

Run: `npm test -- tests/http-request.test.ts tests/server.test.ts`

Expected: PASS.

Run: `npm test && npm run build && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/http/request.ts src/http/responses.ts src/server.ts tests/http-request.test.ts tests/server.test.ts
git commit -m "fix: harden public MCP requests"
```

---

### Task 4: Polish Public Beta Onboarding And Documentation

**Files:**

- Modify: `src/http/pages.ts`
- Modify: `tests/server.test.ts`
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/CLOUD_RUN.md`

**Interfaces:**

- `renderHomePage(baseUrl: string): string` remains dependency-free and escapes the URL.
- Landing page uses `PUBLIC_BASE_URL` only as canonical metadata; request-derived `baseUrl` keeps local and custom-domain instructions correct.

- [ ] **Step 1: Write failing public-copy assertions**

Extend the landing test to require:

```ts
expect(body).toContain("Public beta");
expect(body).toContain("No account, API key, or payment");
expect(body).toContain("Do not send confidential manuscript text");
expect(body).toContain("Verify results on DOAJ and the journal");
expect(body).toContain("Paste this URL");
```

Require the privacy page to link to the repository issue tracker and state that Google Cloud and
DOAJ process upstream/network metadata.

- [ ] **Step 2: Run page tests and verify RED**

Run: `npm test -- tests/server.test.ts`

Expected: FAIL because the beta, confidentiality, verification, and copy affordance copy is absent.

- [ ] **Step 3: Implement the compact landing experience**

Use a quiet responsive layout with:

- service name and `Public beta` status near the top;
- one prominent, selectable MCP URL field;
- three short client connection instructions;
- three example prompts;
- compact capability and limitation copy;
- privacy, health, GitHub, and issue links;
- no external fonts, trackers, images, or third-party scripts.

Keep the page script-free. Use semantic HTML and a selectable `<code>` URL so the strict content
security policy can retain `script-src 'none'`.

- [ ] **Step 4: Align public documentation**

Replace every `YOUR-CLOUD-RUN-URL` placeholder with
`https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app`. Lead README with the `/mcp` URL and beta
status. Remove inactive semantic-search and log settings from documentation. Explain confidentiality,
result verification, scale-to-zero cold starts, support through GitHub issues, automatic deployment,
Cloud Run spend cap, and project-wide budget alerts.

Record `0.2.0-beta.1` changes in `CHANGELOG.md`.

- [ ] **Step 5: Verify copy and formatting**

Run: `rg -n "YOUR-CLOUD-RUN-URL|ENABLE_SEMANTIC_SEARCH|SEMANTIC_PROVIDER|LOG_LEVEL" README.md PRIVACY.md CONTRIBUTING.md CHANGELOG.md docs .env.example src`

Expected: no matches.

Run: `npm test -- tests/server.test.ts`

Expected: PASS.

Run: `npx prettier --check README.md PRIVACY.md CONTRIBUTING.md CHANGELOG.md docs src/http/pages.ts tests/server.test.ts`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/http/pages.ts tests/server.test.ts README.md PRIVACY.md CONTRIBUTING.md CHANGELOG.md docs/CLOUD_RUN.md
git commit -m "docs: polish public beta onboarding"
```

---

### Task 5: Make Builds Reproducible And Deployment Verification-Gated

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `Dockerfile`
- Modify: `.dockerignore`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy-cloud-run.yml`
- Modify: `docs/CLOUD_RUN.md`

**Interfaces:**

- Produces: `npm run check` for test, build, lint, and format verification.
- Deploy workflow consumes the successful CI `head_sha` and performs live smoke checks.

- [ ] **Step 1: Add check scripts and verify the format gate catches drift**

Add:

```json
"format:check": "prettier --check .",
"check": "npm test && npm run build && npm run lint && npm run format:check"
```

Run: `npm run format:check`

Expected: FAIL if repository formatting drift exists. Run `npm run format` once, inspect the diff,
and keep only mechanical formatting changes.

- [ ] **Step 2: Update the production image**

Use `node:24-alpine` for build and runtime. Install once with `npm ci --ignore-scripts`, build, prune
with `npm prune --omit=dev`, copy only production modules and `dist`, set `NODE_ENV=production`,
change ownership to `node`, and run as `USER node`. Do not copy the removed `src/synonyms.yml`.

- [ ] **Step 3: Build and smoke-test the container**

Run: `docker build --tag doaj-discovery-mcp:beta .`

Expected: exit 0 and runtime image uses Node.js 24.

Run the image with `ENABLE_CACHE=false`, request `/health`, and send an MCP initialize request.

Expected: health JSON contains `"version":"0.2.0-beta.1"` and initialize returns HTTP 200.

- [ ] **Step 4: Strengthen CI**

Use Node.js 24 and replace separate test/build/lint steps with `npm run check` plus:

```yaml
- name: Audit production dependencies
  run: npm audit --omit=dev --audit-level=high

- name: Build container
  run: docker build --tag doaj-discovery-mcp:ci .
```

Keep minimal `contents: read` permission and npm cache.

- [ ] **Step 5: Gate deploy on successful CI**

Change deployment triggers to:

```yaml
on:
  workflow_dispatch:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

Guard the deploy job so automatic runs require
`github.event.workflow_run.conclusion == 'success'`. Checkout
`${{ github.event.workflow_run.head_sha || github.sha }}`. Preserve Workload Identity Federation
and the explicit build service account.

Set production environment values:

```text
ENABLE_CACHE=false,TRUST_PROXY=true
```

- [ ] **Step 6: Add post-deploy smoke checks**

Capture the service URL from `gcloud run services describe`, then use `curl --fail --retry 5` to:

- verify `/health` includes `"ok":true` and `"version":"0.2.0-beta.1"`;
- verify `/` includes `DOAJ Discovery MCP` and the canonical `/mcp` URL;
- POST MCP initialize with protocol `2025-11-25` and verify server name/version.

Any failed assertion must fail the workflow.

- [ ] **Step 7: Run complete local verification**

Run: `npm ci`

Run: `npm run check`

Run: `npm audit --omit=dev --audit-level=high`

Run: `docker build --tag doaj-discovery-mcp:beta .`

Expected: every command exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json Dockerfile .dockerignore .github/workflows/ci.yml .github/workflows/deploy-cloud-run.yml docs/CLOUD_RUN.md
git commit -m "ci: gate and verify public beta deploys"
```

---

### Task 6: Review, Publish, Configure Cost Controls, And Verify Live

**Files:**

- Modify only if findings require fixes: files touched in Tasks 1-5.
- Update: `docs/superpowers/plans/2026-07-29-public-beta-hardening.md` checkboxes.

**Interfaces:**

- Produces: reviewed GitHub branch/PR, merged `main`, successful CI/deploy runs, live beta URL, and visible billing controls.

- [ ] **Step 1: Review the complete diff**

Run:

```bash
git status -sb
git diff main...HEAD --check
git diff main...HEAD --stat
git diff main...HEAD
```

Check every design acceptance criterion against the diff. Remove accidental complexity, duplicate
copy, stale configuration, generated artifacts, and unrelated formatting churn.

- [ ] **Step 2: Run the final verification gate**

Run:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
docker build --tag doaj-discovery-mcp:release .
```

Then run container health, landing, privacy, malformed-request, oversized-request, and MCP
initialize smoke checks.

Expected: all checks exit 0 with no test failures, lint errors, format drift, high/critical
production advisories, or container failures.

- [ ] **Step 3: Publish for review**

Push `agent/public-beta-hardening`, open a draft PR against `main`, and include the design, major
risk fixes, user impact, cost controls, and full verification results.

- [ ] **Step 4: Resolve review and merge**

Address every actionable review or CI finding with a regression test where behavior changes.
Re-run the final gate. Mark the PR ready and merge only when required checks pass.

- [ ] **Step 5: Verify automatic deployment**

Confirm the CI run for the merge commit succeeds. Confirm the deploy workflow checks out the same
commit and succeeds. Verify:

```text
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/privacy
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/health
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/mcp
```

- [ ] **Step 6: Configure and verify billing controls**

In Google Cloud Billing for project `doaj-discovery-mcp`, create:

- monthly TRY 500 `Spend cap enforcement`, scoped to the single project and Cloud Run service;
- monthly TRY 500 `Alerts only`, scoped to the full project and all services, with email
  notifications to billing administrators/project owners.

Verify the spend-cap budget shows automatic 50%, 80%, and 100% notifications and the project-wide
budget shows its configured thresholds and recipients.

- [ ] **Step 7: Final release record**

Record the merged commit, CI run, deployment run, live service revision, smoke-test timestamp,
billing-control state, and any residual beta limitations in the final handoff.
