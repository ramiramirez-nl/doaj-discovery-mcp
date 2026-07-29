import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { FileCacheStore } from "./cache/file-cache-store.js";
import { loadConfig } from "./config.js";
import { DoajClient } from "./doaj/client.js";
import { createMcpServer } from "./server.js";

export const startStdioServer = async (): Promise<void> => {
  const config = loadConfig();
  const cache = config.enableCache ? new FileCacheStore(config.cacheDir) : undefined;
  const client = new DoajClient(config, cache);
  const server = createMcpServer(client, config);
  await server.connect(new StdioServerTransport());
};

startStdioServer().catch((error: unknown) => {
  // stdout is the MCP transport channel; diagnostics must go to stderr only.
  console.error("stdio_server_failed", error instanceof Error ? error.name : "UnknownError");
  process.exit(1);
});
