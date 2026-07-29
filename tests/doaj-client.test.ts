import { afterEach, describe, expect, test, vi } from "vitest";

import type { CacheStore } from "../src/cache/store.js";
import { loadConfig } from "../src/config.js";
import { DoajClient } from "../src/doaj/client.js";

describe("DoajClient public requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uses public JSON requests without an authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
    await client.searchJournals("open access", { pageSize: 1 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(options.headers).toEqual({ accept: "application/json" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test("clamps pageSize to the DOAJ-documented maximum of 100", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 0, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
    await client.searchJournals("medicine", { pageSize: 500 });

    const [calledUrl] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.searchParams.get("pageSize")).toBe("100");
  });

  test("retries once on a 429 and succeeds on the following attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 0, results: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
    const result = await client.searchJournals("medicine");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.warnings).toEqual([]);
    expect(result.records).toEqual([]);
  });

  test("does not double-report warnings for a persistent 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
    const result = await client.searchJournals("medicine");

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("rate limit");
  });

  test("returns a safe warning for an invalid DOAJ response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>bad gateway</html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        })
      )
    );

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
    const result = await client.searchJournals("test");

    expect(result).toEqual({
      records: [],
      warnings: ["DOAJ returned an invalid response. Try again later."]
    });
  });

  test("continues when the optional cache is unavailable", async () => {
    const cache: CacheStore = {
      async get() {
        throw new Error("disk unavailable");
      },
      async set() {
        throw new Error("disk unavailable");
      },
      async delete() {},
      async clear() {}
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            total: 1,
            results: [{ id: "journal-1", bibjson: { title: "Test Journal" } }]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      )
    );

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "true" }), cache);
    const result = await client.searchJournals("test");

    expect(result.records[0]?.title).toBe("Test Journal");
    expect(result.total).toBe(1);
  });

  test("does not turn an empty search envelope into a fake record", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ total: 0, results: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));
    const result = await client.searchJournals("no matches");

    expect(result).toEqual({ records: [], total: 0, warnings: [] });
  });
});
