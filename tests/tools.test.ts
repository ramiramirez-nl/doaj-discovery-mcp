import { describe, expect, test } from "vitest";

import { explainDoajMetadata } from "../src/tools/explain.js";
import { semanticFallbackWarning } from "../src/tools/register.js";
import { createMcpServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { DoajClient } from "../src/doaj/client.js";

describe("tools helpers", () => {
  test("explains APC metadata without editorial review", () => {
    const explanation = explainDoajMetadata("APC");

    expect(explanation).toContain("article processing charge");
    expect(explanation).toContain("discovery");
    expect(explanation).not.toContain("criteria checking");
  });

  test("returns lexical fallback warning for semantic-like requests", () => {
    expect(semanticFallbackWarning()).toBe(
      "Local vector semantic search is not enabled. Results are ranked by lexical relevance, synonym expansion, and DOAJ metadata."
    );
  });

  test("marks every tool as read-only", () => {
    const server = createMcpServer(
      new DoajClient(loadConfig({ ENABLE_CACHE: "false" })),
      loadConfig()
    );
    const tools = (
      server as unknown as {
        _registeredTools: Record<string, { annotations?: Record<string, boolean> }>;
      }
    )._registeredTools;

    expect(Object.keys(tools)).toHaveLength(6);
    for (const tool of Object.values(tools)) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      });
    }
  });
});
