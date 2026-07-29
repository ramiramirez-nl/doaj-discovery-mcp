import { describe, expect, test } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("uses costless defaults and no OpenAI configuration", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.doajApiBaseUrl).toBe("https://doaj.org/api");
    expect(config.doajApiKey).toBeUndefined();
    expect(config.enableSemanticSearch).toBe(false);
    expect(config.semanticProvider).toBe("none");
    expect(Object.keys(config).some((key) => key.toLowerCase().includes("openai"))).toBe(false);
  });

  test("clamps default max results to configured limit", () => {
    const config = loadConfig({ MAX_RESULTS_DEFAULT: "50", MAX_RESULTS_LIMIT: "25" });

    expect(config.maxResultsDefault).toBe(25);
    expect(config.maxResultsLimit).toBe(25);
  });
});
