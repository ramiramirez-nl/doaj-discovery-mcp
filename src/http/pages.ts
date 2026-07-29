const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const documentLayout = (title: string, body: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: system-ui, sans-serif; line-height: 1.5; }
      body { margin: 0; color: #18212b; background: #f6f8fa; }
      main { max-width: 760px; margin: 0 auto; padding: 48px 24px 72px; }
      h1 { margin: 0 0 12px; font-size: 2.4rem; line-height: 1.1; }
      h2 { margin-top: 36px; font-size: 1.25rem; }
      p, li { color: #40505f; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      code { background: #e9eef2; padding: 2px 5px; border-radius: 4px; }
      pre { overflow-x: auto; padding: 16px; background: #18212b; color: #f5f7f9; border-radius: 6px; }
      a { color: #075985; }
      .url { display: block; padding: 14px; background: #fff; border: 1px solid #ccd5dc; border-radius: 6px; overflow-wrap: anywhere; }
      .notice { padding: 14px 16px; border-left: 4px solid #64748b; background: #e9eef2; }
      footer { margin-top: 48px; font-size: .9rem; }
    </style>
  </head>
  <body><main>${body}</main></body>
</html>`;

export const renderHomePage = (baseUrl: string): string => {
  const mcpUrl = new URL("/mcp", baseUrl).toString();
  const escapedUrl = escapeHtml(mcpUrl);
  return documentLayout(
    "DOAJ Discovery MCP",
    `<h1>DOAJ Discovery MCP</h1>
    <p>Read-only journal and article discovery for AI tools through one public MCP connection.</p>
    <p><strong>No account, no DOAJ API key, no payment.</strong></p>
    <h2>Public MCP URL</h2>
    <p class="url"><code>${escapedUrl}</code></p>
    <h2>Connect</h2>
    <ol>
      <li>Claude: open Settings, Connectors, Add custom connector, then paste the URL.</li>
      <li>ChatGPT: add a custom MCP app in developer mode, then scan this URL.</li>
      <li>Codex or another MCP client: configure a remote Streamable HTTP server with this URL.</li>
    </ol>
    <h2>Try asking</h2>
    <pre>Find diamond open-access journals for climate economics.
Recommend journals for this manuscript abstract.
Find articles similar to this research topic.</pre>
    <h2>What it does</h2>
    <p>It searches public DOAJ metadata, ranks candidates locally, and returns source links. It does not perform editorial review, compliance checking, or acceptance prediction.</p>
    <p class="notice"><strong>Independent project:</strong> DOAJ Discovery MCP is an independent, unofficial open-source project. It is not affiliated with, endorsed by, sponsored by, or operated by DOAJ. It uses publicly available DOAJ metadata and APIs for discovery.</p>
    <footer><a href="/health">Service status</a> · <a href="/privacy">Privacy</a> · <a href="https://github.com/ramiramirez-nl/doaj-discovery-mcp">GitHub</a></footer>`
  );
};

export const renderPrivacyPage = (): string =>
  documentLayout(
    "Privacy | DOAJ Discovery MCP",
    `<h1>Privacy</h1>
    <p>DOAJ Discovery MCP is a public, read-only discovery service.</p>
    <h2>What happens to requests</h2>
    <p>Queries and manuscript abstracts are sent to this service and transformed into requests to the public DOAJ API. Query text and abstracts are not intentionally persisted in application logs.</p>
    <p>A short-lived best-effort cache may exist while a server instance is running. Cache loss does not affect correctness.</p>
    <h2>What not to send</h2>
    <p>Do not submit confidential, unpublished, or personally identifying manuscript content. Google Cloud and DOAJ may process network and request metadata under their own policies.</p>
    <p><a href="/">Back to DOAJ Discovery MCP</a></p>`
  );
