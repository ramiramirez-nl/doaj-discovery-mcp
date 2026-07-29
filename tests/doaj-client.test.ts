import { afterEach, describe, expect, test, vi } from "vitest";

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
});
