import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { FileCacheStore } from "./cache/file-cache-store.js";
import { loadConfig } from "./config.js";
import { DoajClient } from "./doaj/client.js";
import { registerDiscoveryTools } from "./tools/register.js";

const config = loadConfig();
const cache = config.enableCache ? new FileCacheStore(config.cacheDir) : undefined;
const client = new DoajClient(config, cache);

export const createMcpServer = (): McpServer => {
  const server = new McpServer({
    name: "doaj-discovery-mcp",
    version: "0.1.0"
  });
  registerDiscoveryTools(server, client, config);
  return server;
};

export const startServer = (): void => {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
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

    if (req.url?.startsWith("/mcp")) {
      const sessionId = req.headers["mcp-session-id"];
      let transport =
        typeof sessionId === "string" && sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID()
        });
        const server = createMcpServer();
        await server.connect(transport as unknown as Transport);
        transport.onclose = () => {
          if (transport?.sessionId) transports.delete(transport.sessionId);
        };
        if (transport.sessionId) transports.set(transport.sessionId, transport);
      }

      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  httpServer.listen(config.port, () => {
    console.log(`DOAJ Discovery MCP listening on :${config.port}`);
  });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
