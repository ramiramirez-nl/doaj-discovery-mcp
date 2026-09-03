# Cloud Run Operations

Production service:

```text
https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app
```

The GitHub Actions deployment uses Google Workload Identity Federation. No service-account JSON
key is stored in GitHub.

## One-Time Google Cloud Setup

Project: `doaj-discovery-mcp`; region: `europe-west1`.

1. Enable Cloud Run, Cloud Build, Artifact Registry, IAM Credentials, and Service Usage APIs.
2. Create a Workload Identity Pool and GitHub provider restricted to
   `ramiramirez-nl/doaj-discovery-mcp`.
3. Create `github-deployer@doaj-discovery-mcp.iam.gserviceaccount.com`.
4. Grant only the deployment, build, Artifact Registry write, service-account use, and service
   usage roles required by the workflow.
5. Allow the repository principal to impersonate the deployer through
   `roles/iam.workloadIdentityUser`.

The deployer is also the explicit Cloud Build service account. This avoids relying on the default
Compute Engine service account.

## GitHub Repository Variables

Configure these under **Settings → Secrets and variables → Actions → Variables**:

| Variable                         | Value                                                            |
| -------------------------------- | ---------------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `doaj-discovery-mcp`                                             |
| `GCP_REGION`                     | `europe-west1`                                                   |
| `CLOUD_RUN_SERVICE`              | `doaj-discovery-mcp`                                             |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full `projects/.../workloadIdentityPools/.../providers/...` name |
| `GCP_DEPLOYER_SERVICE_ACCOUNT`   | `github-deployer@doaj-discovery-mcp.iam.gserviceaccount.com`     |

CI verifies every `main` commit. The deploy workflow runs only after that CI run succeeds, checks
out the same commit, deploys it, and verifies the live landing, health, MCP, traffic, and exact
commit identity. There is no manual production bypass.

## Runtime Controls

Production uses:

- request-based billing;
- zero minimum and one maximum instance;
- one CPU and 512 MiB memory;
- concurrency 20 and timeout 60 seconds;
- `ENABLE_CACHE=false`;
- `TRUST_PROXY=true`;
- workflow-managed `BUILD_SHA`.

`TRUST_PROXY=true` is for Cloud Run only. It makes the application rate-limit the verified client
address immediately before Google Cloud's load-balancer address, ignoring spoofable prefixes.
`BUILD_SHA` is exposed by `/health` so deployment verification can prove which commit receives
production traffic.

## Cost Controls

**Configured:** a monthly EUR 10 alerts-only budget named `DOAJ Discovery MCP monthly`, scoped to
this project and all its services, so Cloud Build and Artifact Registry are covered rather than
only Cloud Run. Google notifies billing administrators and project owners at 50%, 80% and 100%.

The amount is in euro because a budget must use its billing account's currency and this account is
EUR; a lira figure cannot be entered. EUR 10 is roughly TRY 560 at the time of writing.

**Not configured:** a spend cap. A budget alerts, it does not stop spending. Spend caps are a
separate budget type that pauses Cloud Run once the cap is reached, and they are console-only:
neither `gcloud billing budgets` nor the Cloud Billing Budget API exposes an enforcement field, so
one has to be created under Billing, Budgets & alerts, choosing the spend-cap type and the Cloud
Run service. Note that an enforced cap returns 5xx for every request until it is lifted by hand.

Billing reports lag, so overages remain possible either way, and a cap uses gross eligible costs,
meaning it can pause the service even while promotional credits cover the bill.

## Verify

```bash
curl --fail https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app/health
```

The landing page is `/`, privacy is `/privacy`, and the public MCP endpoint is `/mcp`.
