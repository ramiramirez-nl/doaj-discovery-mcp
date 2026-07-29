# Public Beta Hardening Design

## Goal

Prepare DOAJ Discovery MCP for a public, free beta release. The service must remain easy to
connect, inexpensive to operate, read-only, and explicit about its unofficial relationship with
DOAJ. The beta does not promise an uptime SLA.

## Scope

Keep one stateless Cloud Run service containing:

- the Streamable HTTP MCP endpoint at `/mcp`;
- the landing page at `/`;
- the health endpoint at `/health`;
- the privacy page at `/privacy`;
- six read-only discovery tools backed by the public DOAJ API.

Do not add accounts, authentication, a database, analytics, paid APIs, or a semantic-search
service. Remove dormant configuration that does not provide working behavior. Keep version and
public URL information in a single source where practical.

## Request Flow

1. Cloud Run accepts a public request and forwards it to the Node.js HTTP server.
2. Public page and health routes return small, dependency-free responses.
3. MCP requests pass method, content-type, body-size, and per-client rate-limit checks.
4. A stateless MCP transport validates the tool request.
5. The selected tool builds a bounded DOAJ query, receives public metadata, normalizes it, and
   ranks candidates locally.
6. The response returns structured results, source links, warnings, and the discovery-only notice.

No query or manuscript text is intentionally persisted. Production caching remains disabled.

## Reliability And Security

- Accept only the HTTP methods and content types required by Streamable HTTP MCP.
- Enforce request-size limits before and while reading a request.
- Convert unexpected request and upstream failures into bounded, non-sensitive responses without
  terminating the process.
- Apply compact security headers to all responses.
- Use the Cloud Run forwarding chain for per-client rate limiting only when the deployment is
  configured to trust that proxy; otherwise use the socket address.
- Handle DOAJ timeouts, network failures, invalid JSON, rate limits, and non-success responses with
  stable warnings.
- Keep inputs and result counts bounded.
- Keep tools read-only, idempotent, and explicit that results are discovery candidates rather than
  editorial decisions.

## User Experience And Documentation

The landing page and README must lead with the live public MCP URL and a short connection path.
They must clearly state:

- no account, payment, DOAJ API key, or model API key is required;
- the service is an independent, unofficial project;
- manuscript text sent to the public service is not confidential;
- results must be verified at DOAJ and the journal's own website;
- the service is a public beta without an uptime guarantee.

Local installation, Docker use, configuration, contribution, privacy, and Cloud Run deployment
documentation must agree with the actual implementation.

## Cost Controls

Retain request-based Cloud Run billing with zero minimum instances, one maximum instance, one CPU,
512 MiB memory, bounded concurrency, and application-level rate limits.

Configure two billing controls outside the repository:

1. A monthly TRY 500 Cloud Run spend-cap budget for project `doaj-discovery-mcp`. Google Cloud
   sends automatic notices at 50%, 80%, and 100%, then pauses new Cloud Run usage when enforcement
   catches up.
2. A monthly TRY 500 project-wide alerts-only budget to detect Cloud Build, Artifact Registry, and
   other costs outside the Cloud Run cap.

Budget and cap reporting can lag, so small overages remain possible. The Cloud Run cap is based on
gross eligible costs and can pause the service even when promotional credits cover the bill.

## Verification And Release

Use test-first changes for every behavior modification or bug fix. The final verification gate
must run:

- unit and HTTP integration tests;
- TypeScript build;
- lint and formatting checks;
- production dependency audit;
- container build;
- local container smoke tests where supported;
- live landing, health, and MCP initialize checks after deployment.

CI must run the repository checks on pull requests and `main`. Deployment must run only after
verification succeeds, use keyless Workload Identity Federation, deploy the tested revision, and
fail if post-deploy smoke checks fail.

Release the hardened beta as `0.2.0-beta.1`. Push the reviewed changes to GitHub and verify the
automatic Cloud Run deployment before announcing the service.

## Acceptance Criteria

- All automated checks pass without warnings that indicate broken behavior.
- The live public URL and `/mcp` endpoint work from outside the deployment.
- Common malformed, oversized, unsupported, and upstream-failure requests do not crash the
  service or expose internal details.
- Documentation contains no placeholder deployment URL or contradictory setup guidance.
- The service stores no credentials and intentionally persists no user query content.
- Billing alerts and the Cloud Run spend cap are visible in Google Cloud Billing.
