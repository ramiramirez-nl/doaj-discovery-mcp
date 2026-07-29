import { describe, expect, test } from "vitest";

import {
  buildFilterClauses,
  buildFreeTextClause,
  buildQueryLadder,
  composeQuery,
  escapeQuotedValue
} from "../src/doaj/query.js";

describe("buildQueryLadder", () => {
  const abstract =
    "Deep learning models for automated segmentation of cardiac magnetic resonance images have " +
    "improved substantially, yet generalisation across scanner vendors remains an open problem.";

  test("orders rungs from precise AND to broad OR", () => {
    const ladder = buildQueryLadder(abstract);

    expect(ladder.length).toBeGreaterThan(1);
    expect(ladder[0]).toContain(" AND ");
    expect(ladder[0]).not.toContain(" OR ");
    expect(ladder.at(-1)).toContain(" OR ");
    expect(ladder.at(-1)).not.toContain(" AND ");
  });

  test("narrows the AND width on each successive rung", () => {
    const ladder = buildQueryLadder(abstract);
    const andWidths = ladder
      .filter((rung) => rung.includes(" AND "))
      .map((rung) => rung.split(" AND ").length);

    expect(andWidths).toEqual([...andWidths].sort((a, b) => b - a));
    expect(andWidths[0]).toBe(4);
  });

  test("precise mode yields a single AND rung with no OR fallback", () => {
    expect(buildQueryLadder(abstract, { mode: "precise" })).toHaveLength(1);
    expect(buildQueryLadder(abstract, { mode: "precise" })[0]).not.toContain(" OR ");
  });

  test("short queries do not produce wider AND rungs than they have terms", () => {
    const ladder = buildQueryLadder("syriac studies");
    expect(ladder[0]).toBe("syriac AND studies");
  });

  test("falls back to open access for punctuation-only input", () => {
    expect(buildQueryLadder("...")).toEqual(["open access"]);
  });
});

describe("buildFreeTextClause", () => {
  test("OR-joins long free text instead of producing an unsatisfiable AND chain", () => {
    const abstract =
      "This study examines the transmission of Syriac liturgical manuscripts in the " +
      "Ottoman period, focusing on scribal practices in Tur Abdin monasteries between " +
      "1500 and 1900, using paleographic analysis and colophon evidence.";
    const result = buildFreeTextClause(abstract);

    expect(result).not.toContain(" AND ");
    expect(result).toContain(" OR ");
  });

  test("AND-joins short precise queries", () => {
    const result = buildFreeTextClause("syriac studies");
    expect(result).toBe("syriac AND studies");
  });

  test("forces AND mode when precise mode is requested", () => {
    const result = buildFreeTextClause("open access medicine dentistry astrophysics zoology", {
      mode: "precise"
    });
    expect(result.split(" AND ")).toHaveLength(6);
  });

  test("caps recall mode to maxTerms", () => {
    const words = Array.from({ length: 30 }, (_, i) => `term${i}`).join(" ");
    const result = buildFreeTextClause(words, { mode: "recall", maxTerms: 5 });
    expect(result.split(" OR ")).toHaveLength(5);
  });

  test("drops stopwords", () => {
    const result = buildFreeTextClause("the study of medicine and dentistry", { mode: "precise" });
    expect(result).not.toContain(" the ");
    expect(result.toLowerCase()).not.toMatch(/\bstudy\b/);
  });

  test("falls back to open access for punctuation-only input", () => {
    expect(buildFreeTextClause("...")).toBe("open access");
  });
});

describe("escapeQuotedValue", () => {
  test("escapes embedded quotes and backslashes", () => {
    expect(escapeQuotedValue('CC "BY"')).toBe('CC \\"BY\\"');
    expect(escapeQuotedValue("a\\b")).toBe("a\\\\b");
  });
});

describe("buildFilterClauses", () => {
  test("builds a no-APC field filter", () => {
    expect(buildFilterClauses({ hasApc: false }, "journal")).toEqual(["bibjson.apc.has_apc:false"]);
  });

  test("builds a quoted license filter", () => {
    expect(buildFilterClauses({ license: "CC BY" }, "journal")).toEqual([
      'bibjson.license.type:"CC BY"'
    ]);
  });

  test("uses the publisher country field for journals", () => {
    expect(buildFilterClauses({ countryCode: "tr" }, "journal")).toEqual([
      "bibjson.publisher.country:TR"
    ]);
  });

  test("uses the journal country field for articles", () => {
    expect(buildFilterClauses({ countryCode: "us" }, "article")).toEqual([
      "bibjson.journal.country:US"
    ]);
  });

  test("returns no clauses when no filters are set", () => {
    expect(buildFilterClauses({}, "journal")).toEqual([]);
  });
});

describe("composeQuery", () => {
  test("wraps free text and ANDs filter clauses", () => {
    expect(composeQuery("a OR b", ["bibjson.apc.has_apc:false"])).toBe(
      "(a OR b) AND bibjson.apc.has_apc:false"
    );
  });

  test("returns free text unchanged when there are no filters", () => {
    expect(composeQuery("a OR b", [])).toBe("a OR b");
  });
});
