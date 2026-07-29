# DOAJ Discovery MCP Public Cloud Service Design

Date: 2026-07-29

## Goal

Turn the existing DOAJ Discovery MCP server into a public, read-only remote MCP service that people can add to supported AI tools with one HTTPS URL. Users must not need Node.js, Docker, a DOAJ API key, an account, or a payment method.

The first production deployment will run on Google Cloud Run in project `doaj-discovery-mcp`. GitHub `main` will remain the source of truth.

## Success Criteria

- A public HTTPS MCP endpoint works from supported Claude, ChatGPT, and Codex clients.
- A first-time user can understand and connect the service from the landing page and README.
- No user account, DOAJ API key, or project-specific credential is required.
- All exposed tools are read-only and accurately annotated.
- Query text and manuscript abstracts are not written to application logs.
- Tests, build, lint, and a deployed smoke test pass before a release is considered successful.
- GitHub changes deploy automatically without storing a long-lived Google Cloud key.
- Initial Cloud Run spend is capped at USD 5 per month, with one maximum instance.

## Non-Goals

- DOAJ editorial review, policy compliance checks, acceptance prediction, or publishing decisions.
- Writing to DOAJ or accessing non-public DOAJ records.
- User accounts, subscriptions, payments, analytics, advertising, or cookies.
- Paid semantic search, embeddings, vector databases, or LLM API calls.
- Custom domain purchase for the first release.
- Immediate submission to every third-party marketplace. Registry and directory submissions follow after the public endpoint is stable.

## Users

Primary users are researchers, authors, librarians, and open-access advocates who use MCP-compatible AI tools. They should be able to ask natural-language questions about DOAJ-indexed journals and articles without learning the DOAJ query syntax.

## Public Experience

### Routes

- `/`: English landing page.
- `/mcp`: public Streamable HTTP MCP endpoint.
- `/health`: small JSON health response.
- `/privacy`: plain-language privacy statement.

### Landing Page

The landing page will be lightweight server-rendered HTML with no client framework, analytics, cookies, tracking pixels, or remote fonts. It will include:

- Product name and one-sentence value statement.
- Copyable public MCP URL.
- Short setup instructions for Claude, ChatGPT, and Codex.
- At least three realistic example prompts.
- Live service status from `/health`.
- "No account, no API key, no payment" statement.
- Links to GitHub, privacy information, support/issues, and DOAJ.
- A visible independence notice.

Initial content will be English only. Turkish localization can be added later without changing the MCP protocol.

### Independence Notice

Use this notice in the landing page, README, and relevant metadata:

> DOAJ Discovery MCP is an independent, unofficial open-source project. It is not affiliated with, endorsed by, sponsored by, or operated by DOAJ. It uses publicly available DOAJ metadata and APIs for discovery.

Do not use the DOAJ logo or imply official status.

## MCP Tools

The first release keeps the current discovery tool set:

- `search_doaj_journals`
- `search_doaj_articles`
- `recommend_doaj_journals_for_manuscript`
- `find_diamond_oa_journals`
- `find_similar_doaj_articles`
- `explain_doaj_metadata`

Every tool will declare accurate annotations:

- `readOnlyHint: true`
- `destructiveHint: false`
- `idempotentHint: true`
- `openWorldHint: true` for tools that call DOAJ

Tool descriptions and results must state that recommendations are discovery candidates, not acceptance predictions or editorial decisions. Results should include stable source links whenever DOAJ metadata provides them.

## DOAJ API Decision

Public journal and article search does not require a DOAJ API key. The service will use public DOAJ search and retrieval endpoints only.

`DOAJ_API_KEY` support will be removed from public configuration because it adds no value to this read-only use case and the current Bearer-header implementation does not match DOAJ's documented query-parameter authentication for protected routes. The server will not expose protected, private, or write endpoints.

The DOAJ base URL remains configurable for testing, but production uses the current official public API. Requests will have bounded page sizes and timeouts.

## Architecture

```text
MCP-compatible AI client
          |
          | HTTPS Streamable HTTP
          v
Google Cloud Run: doaj-discovery-mcp
          |
          | Public HTTPS API requests
          v
        DOAJ API

GitHub main
    |
    | tests, build, lint, container build
    v
GitHub Actions
    |
    | short-lived Workload Identity Federation
    v
Google Cloud Run revision
```

### Runtime

The MCP endpoint will use stateless Streamable HTTP behavior. Correctness must not depend on an in-memory session map, sticky routing, persistent local files, or a warm Cloud Run instance.

The existing filesystem cache may be retained as a best-effort optimization during an instance lifetime, but cache loss during scale-to-zero or a new revision must not affect correctness. Cache keys must not appear in logs.

### Cloud Run Configuration

- Project: `doaj-discovery-mcp`
- Region: `europe-west1`
- Service: `doaj-discovery-mcp`
- Public unauthenticated HTTPS access
- Request-based billing
- Minimum instances: `0`
- Maximum instances: `1`
- Initial memory: `512 MiB`
- Initial CPU: `1`
- Bounded request concurrency and timeout
- Provider-generated `run.app` domain for the first release

Maximum instances can be raised only after reviewing traffic, DOAJ upstream load, and cost.

## Data Flow

1. AI client calls a read-only MCP tool.
2. Server validates and bounds the input.
3. Server converts the request into a public DOAJ API query.
4. Server checks best-effort cache, then calls DOAJ on a miss.
5. Response metadata is normalized and ranked locally.
6. Server returns bounded JSON text with source links and discovery warnings.
7. Application logs contain operational metadata only, not query bodies, abstracts, or result payloads.

No LLM API is called by this service. The user's AI client performs language-model reasoning under the user's own account.

## Abuse Protection

The service is public and unauthenticated, so protection must be simple and transparent:

- Strict input length and result-count limits.
- Request body size limit.
- Per-source request throttling with a generous allowance for shared AI-provider egress.
- Global concurrency bound.
- Upstream timeout and limited retry behavior.
- `429` responses with `Retry-After`.
- Cloud Run maximum instance limit of one.
- No expensive background work.

Rate limiting must not rely on an untrusted forwarding header unless Cloud Run's proxy behavior has been verified. Limits should be configurable without code changes.

## Error Handling

- Invalid input: MCP validation error with actionable field information.
- DOAJ timeout or network failure: non-sensitive error with retry guidance.
- DOAJ rate limit: `429`-equivalent tool error or warning with `Retry-After` when available.
- Empty result: successful response with an empty list and a suggestion to broaden the query.
- Unexpected upstream shape: skip invalid records, preserve valid records, and return a warning.
- Internal error: generic client message; detailed stack trace only in protected Cloud Logging.

The server must not claim that a query has no matching journals when the upstream request failed.

## Privacy and Logging

The privacy page will state:

- No account is required.
- Queries are sent to the service and transformed into DOAJ API requests.
- Query text and manuscript abstracts are not intentionally persisted in application logs.
- Best-effort cache entries may exist temporarily during a running instance.
- Google Cloud and DOAJ process network and request metadata under their own policies.
- Users should not submit confidential or personally identifying manuscript content.

The application logger will avoid request bodies, full URLs containing user query text, MCP payloads, cache keys, and result bodies.

## Repository and Release Flow

GitHub repository:

`https://github.com/ramiramirez-nl/doaj-discovery-mcp`

The repository will include:

- MIT license.
- Expanded README.
- Deployment configuration.
- GitHub Actions validation and deployment workflows.
- Cloud Run container configuration.
- Environment variable reference.
- Privacy and support information.

GitHub Actions will authenticate to Google Cloud through Workload Identity Federation. No downloadable service-account JSON key will be committed or stored as a long-lived GitHub secret.

The deploy workflow runs only after required validation succeeds on `main`. Failed validation leaves the current Cloud Run revision serving traffic. Cloud Run revision history provides rollback.

## Cost Controls

- Cloud Run request-based billing and scale-to-zero.
- Maximum one instance.
- USD 5 monthly Cloud Run spend-cap budget where available.
- Billing alerts at the provider's configured thresholds.
- No custom domain, database, paid monitoring, paid semantic service, or minimum warm instance in the first release.

The initial target is USD 0 per month under light use. The service may pause if the spend cap is reached. Cost controls favor budget safety over uninterrupted availability.

## Testing

### Local

- Unit tests for config, cache, normalization, ranking, and preferences.
- MCP tool tests for schemas, annotations, bounded output, and discovery warnings.
- Server tests for `/`, `/privacy`, `/health`, method handling, body limits, rate limiting, and safe errors.
- DOAJ client tests for timeouts, `429`, malformed payloads, and partial normalization.
- Build and lint.

### Deployment

- Container starts with the Cloud Run-provided `PORT`.
- `/health` returns success.
- `/` and `/privacy` render without external assets.
- MCP initialization and tool discovery succeed against the public `/mcp` URL.
- At least one journal search and one article search succeed against public DOAJ data.
- Logs are inspected to confirm query bodies and abstracts are absent.

### Release Gate

Production deployment is complete only when:

1. Tests pass.
2. Build passes.
3. Lint passes.
4. Container build passes.
5. Cloud Run health check passes.
6. Remote MCP tool discovery passes.
7. Public search smoke tests pass.

## Rollout

### Phase 1: Public Service

Harden the server, add the landing and privacy pages, configure Cloud Run, add GitHub Actions, deploy, and verify the public URL.

### Phase 2: Distribution Metadata

After the endpoint is stable, add MCP Registry metadata and prepare Claude and ChatGPT directory submissions. Directory acceptance is controlled by each platform and is not guaranteed.

### Phase 3: Optional Improvements

Consider a custom domain, multilingual landing page, stronger shared cache, higher scale limits, and platform-specific app UI only when observed usage justifies them.
