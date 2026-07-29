import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { FileCacheStore } from "./cache/file-cache-store.js";
import { loadConfig } from "./config.js";
import { DoajClient } from "./doaj/client.js";
import { renderHomePage, renderPrivacyPage } from "./http/pages.js";
import { createRateLimiter } from "./http/rate-limit.js";
import { getClientKey, HttpRequestError, readJsonBody } from "./http/request.js";
import { applySecurityHeaders, writeJson } from "./http/responses.js";
import { SERVICE_NAME, SERVICE_VERSION } from "./meta.js";
import { registerDiscoveryTools } from "./tools/register.js";

export const createMcpServer = (
  client: DoajClient,
  config: ReturnType<typeof loadConfig>
): McpServer => {
  const server = new McpServer({
    name: SERVICE_NAME,
    version: SERVICE_VERSION
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
  const rateLimiter = createRateLimiter({
    maxRequests: config.rateLimitMaxRequests,
    windowMs: config.rateLimitWindowSeconds * 1_000
  });

  return createServer(async (req, res) => {
    applySecurityHeaders(res);
    res.setHeader("cache-control", "no-store");

    try {
      const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const forwardedProto = config.trustProxy
        ? String(req.headers["x-forwarded-proto"] ?? "")
            .split(",", 1)[0]
            ?.trim()
        : undefined;
      const protocol = forwardedProto === "https" ? "https" : "http";
      const baseUrl =
        config.deploymentBaseUrl ?? `${protocol}://${req.headers.host ?? "localhost"}`;

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
        writeJson(res, 200, {
          ok: true,
          name: SERVICE_NAME,
          version: SERVICE_VERSION,
          revision: config.buildSha,
          ranking: "lexical"
        });
        return;
      }

      if (requestUrl.pathname === "/mcp") {
        const allowedMethods = ["GET", "POST", "DELETE"];
        if (!req.method || !allowedMethods.includes(req.method)) {
          writeJson(
            res,
            405,
            { error: "method_not_allowed" },
            { allow: allowedMethods.join(", ") }
          );
          return;
        }

        const rate = rateLimiter.allow(getClientKey(req, config.trustProxy));
        if (!rate.allowed) {
          writeJson(
            res,
            429,
            { error: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds },
            { "retry-after": String(rate.retryAfterSeconds) }
          );
          return;
        }

        let parsedBody: unknown;
        if (req.method === "POST") {
          const contentType = String(req.headers["content-type"] ?? "")
            .split(";", 1)[0]
            ?.trim()
            .toLowerCase();
          if (contentType !== "application/json") {
            writeJson(res, 415, { error: "unsupported_media_type" });
            return;
          }

          const contentLength = Number.parseInt(req.headers["content-length"] ?? "0", 10);
          if (Number.isFinite(contentLength) && contentLength > config.maxRequestBodyBytes) {
            writeJson(res, 413, { error: "request_too_large" });
            return;
          }
          parsedBody = await readJsonBody(req, config.maxRequestBodyBytes);
        }

        // SDK runtime uses an explicit undefined generator for stateless mode, but its optional
        // property type conflicts with this project's exactOptionalPropertyTypes setting.
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined
        } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
        const mcpServer = createMcpServer(client, config);
        try {
          await mcpServer.connect(transport as unknown as Transport);
          await transport.handleRequest(req, res, parsedBody);
        } finally {
          await mcpServer.close();
        }
        return;
      }

      writeJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }

      if (error instanceof HttpRequestError) {
        writeJson(res, error.status, { error: error.code });
        return;
      }

      console.error("request_failed", {
        method: req.method ?? "UNKNOWN",
        path: req.url?.split("?", 1)[0] ?? "/",
        error: error instanceof Error ? error.name : "UnknownError"
      });
      writeJson(res, 500, { error: "internal_error" });
    }
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
