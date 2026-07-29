import { describe, expect, test } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("uses costless defaults and no OpenAI configuration", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.doajApiBaseUrl).toBe("https://doaj.org/api");
    expect("doajApiKey" in config).toBe(false);
    expect(config.doajRequestTimeoutMs).toBe(10_000);
    expect(config.rateLimitMaxRequests).toBe(120);
    expect(config.rateLimitWindowSeconds).toBe(60);
    expect(config.maxRequestBodyBytes).toBe(100_000);
    expect(config.enableSemanticSearch).toBe(false);
    expect(config.semanticProvider).toBe("none");
    expect(Object.keys(config).some((key) => key.toLowerCase().includes("openai"))).toBe(false);
  });

  test("clamps default max results to configured limit", () => {
    const config = loadConfig({ MAX_RESULTS_DEFAULT: "50", MAX_RESULTS_LIMIT: "25" });

    expect(config.maxResultsDefault).toBe(25);
    expect(config.maxResultsLimit).toBe(25);
  });

  test("ignores DOAJ API keys and clamps request timeout", () => {
    const config = loadConfig({ DOAJ_API_KEY: "not-used", DOAJ_REQUEST_TIMEOUT_MS: "500" });

    expect("doajApiKey" in config).toBe(false);
    expect(config.doajRequestTimeoutMs).toBe(1_000);
  });
});
