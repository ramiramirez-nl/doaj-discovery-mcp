import { afterEach, describe, expect, test } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { loadConfig } from "../src/config.js";
import { createHttpServer } from "../src/server.js";

const servers: Server[] = [];

const startTestServer = async (): Promise<string> => {
  const server = createHttpServer(loadConfig({ ENABLE_CACHE: "false" }));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("public HTTP routes", () => {
  test("renders setup page with public MCP URL and independence notice", async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("DOAJ Discovery MCP");
    expect(body).toContain(`${baseUrl}/mcp`);
    expect(body).toContain("not affiliated with, endorsed by, sponsored by, or operated by DOAJ");
  });

  test("renders privacy statement without external assets", async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(`${baseUrl}/privacy`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Privacy");
    expect(body).toContain("not intentionally persisted in application logs");
    expect(body).not.toContain("<script src=");
  });

  test("returns health status and rejects unknown routes", async () => {
    const baseUrl = await startTestServer();

    const health = await fetch(`${baseUrl}/health`);
    const missing = await fetch(`${baseUrl}/missing`);

    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, name: "doaj-discovery-mcp" });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
  });
});

describe("stateless MCP transport", () => {
  test("initializes without issuing a session ID", async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const dataLine = (await response.text()).split("\n").find((line) => line.startsWith("data: "));
    expect(dataLine).toBeDefined();
    expect(JSON.parse(dataLine!.slice("data: ".length)).result.serverInfo.name).toBe("doaj-discovery-mcp");
  });

  test("limits public MCP bursts and returns retry information", async () => {
    const server = createHttpServer(
      loadConfig({ ENABLE_CACHE: "false", RATE_LIMIT_MAX_REQUESTS: "1", RATE_LIMIT_WINDOW_SECONDS: "60" })
    );
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const request = {
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    };

    const send = () =>
      fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...request })
      });

    expect((await send()).status).toBe(200);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toEqual({ error: "rate_limited", retryAfterSeconds: 60 });
  });
});
