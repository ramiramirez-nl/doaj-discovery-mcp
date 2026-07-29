import { describe, expect, test } from "vitest";

import { buildDoajQuery } from "../src/search/text.js";

describe("buildDoajQuery", () => {
  test("keeps useful unique terms within the character budget", () => {
    const input = `Climate economics and adaptation ${"regional resilience policy ".repeat(100)}`;
    const result = buildDoajQuery(input, 80);

    expect(result).toContain("climate");
    expect(result).toContain("economics");
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.split(" ").filter((term) => term === "regional")).toHaveLength(1);
  });

  test("returns a useful fallback for punctuation-only input", () => {
    expect(buildDoajQuery("...")).toBe("open access");
  });
});
