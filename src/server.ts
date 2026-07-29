import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { FileCacheStore } from "./cache/file-cache-store.js";
import { loadConfig } from "./config.js";
import { DoajClient } from "./doaj/client.js";
import { renderHomePage, renderPrivacyPage } from "./http/pages.js";
import { registerDiscoveryTools } from "./tools/register.js";

export const createMcpServer = (client: DoajClient, config: ReturnType<typeof loadConfig>): McpServer => {
  const server = new McpServer({
    name: "doaj-discovery-mcp",
    version: "0.1.0"
  });
  registerDiscoveryTools(server, client, config);
  return server;
};

export const createHttpServer = (
  config = loadConfig(),
  suppliedClient?: DoajClient
): ReturnType<typeof createServer> => {
  const cache = config.enableCache ? new FileCacheStore(config.cacheDir) : undefined;
  const client = suppliedClient ?? new DoajClient(config, cache);

  return createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const baseUrl = config.deploymentBaseUrl ?? `${req.headers["x-forwarded-proto"] ?? "http"}://${req.headers.host ?? "localhost"}`;

    if (req.method === "GET" && requestUrl.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderHomePage(baseUrl));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/privacy") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPrivacyPage());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          name: "doaj-discovery-mcp",
          semanticSearch: config.enableSemanticSearch ? config.semanticProvider : "lexical"
        })
      );
      return;
    }

    if (requestUrl.pathname === "/mcp") {
      // SDK runtime uses an explicit undefined generator for stateless mode, but its optional
      // property type conflicts with this project's exactOptionalPropertyTypes setting.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
      const server = createMcpServer(client, config);
      await server.connect(transport as unknown as Transport);
      await transport.handleRequest(req, res);
      await transport.close();
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
};

export const startServer = (): void => {
  const config = loadConfig();
  const httpServer = createHttpServer(config);

  httpServer.listen(config.port, () => {
    console.log(`DOAJ Discovery MCP listening on :${config.port}`);
  });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
