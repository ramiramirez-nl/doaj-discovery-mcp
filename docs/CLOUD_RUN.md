# Cloud Run Setup

This repository is ready for a public Cloud Run deployment. The deploy workflow uses GitHub Actions OIDC and Google Workload Identity Federation; no service-account JSON key is stored in GitHub.

## One-Time Google Cloud Setup

In the Google Cloud project `doaj-discovery-mcp`:

1. Enable Cloud Run, Cloud Build, Artifact Registry, and IAM Credentials APIs.
2. Create a Workload Identity Pool and GitHub provider restricted to the repository `ramiramirez-nl/doaj-discovery-mcp`.
3. Create a deployer service account with the minimum Cloud Run deployment permissions needed by the project.
4. Allow the GitHub principal to impersonate that service account.

The exact Google Cloud Console labels can change. Use the official Workload Identity Federation setup guide when creating the GitHub provider.

## GitHub Repository Variables

Add these repository variables under **Settings > Secrets and variables > Actions > Variables**:

| Variable                         | Value                          |
| -------------------------------- | ------------------------------ |
| `GCP_PROJECT_ID`                 | `doaj-discovery-mcp`           |
| `GCP_REGION`                     | `europe-west1`                 |
| `CLOUD_RUN_SERVICE`              | `doaj-discovery-mcp`           |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name    |
| `GCP_DEPLOYER_SERVICE_ACCOUNT`   | Deployer service-account email |

After this one-time setup, pushes to `main` deploy automatically. The workflow makes the service public and prints the generated HTTPS URL. Add `/mcp` to that URL in an AI client.

## Cost Controls

The service is configured for scale-to-zero, one maximum instance, one CPU, 512 MiB memory, and request-based billing. Add a Google Cloud budget alert before sharing the URL. A budget alert notifies you; it is not a guaranteed hard spending cap.

## Verify

```bash
curl https://YOUR-CLOUD-RUN-URL/health
```

The landing page is at `/`, the MCP endpoint is `/mcp`, and the privacy statement is at `/privacy`.
