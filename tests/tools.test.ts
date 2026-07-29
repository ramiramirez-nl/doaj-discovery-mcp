import { describe, expect, test } from "vitest";

import { explainDoajMetadata } from "../src/tools/explain.js";
import { semanticFallbackWarning } from "../src/tools/register.js";

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
});
