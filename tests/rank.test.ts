import { describe, expect, test } from "vitest";

import { rankRecords } from "../src/search/rank.js";
import { expandSynonyms } from "../src/search/synonyms.js";
import { normalizeText, tokenize } from "../src/search/text.js";

describe("lexical ranking", () => {
  test("normalizes case and diacritics", () => {
    expect(normalizeText("Syriac Chrístianity")).toBe("syriac christianity");
    expect(tokenize("Kurdish-language education")).toEqual(["kurdish", "language", "education"]);
  });

  test("expands synonyms conservatively", () => {
    const expanded = expandSynonyms("diamond oa journals");

    expect(expanded).toContain("no APC");
    expect(expanded).toContain("no article processing charge");
  });

  test("boosts phrase, fields, no-fee metadata, language, and country preferences", () => {
    const ranked = rankRecords(
      "diamond OA digital archives",
      [
        {
          id: "a",
          title: "Digital Archives Review",
          abstract: "Archival studies and manuscript archives.",
          keywords: ["archives"],
          country: "Netherlands",
          languages: ["English"],
          hasApc: false
        },
        {
          id: "b",
          title: "Paid Biology Journal",
          abstract: "Biology archive.",
          keywords: [],
          country: "Brazil",
          languages: ["Portuguese"],
          hasApc: true
        }
      ],
      { preferredLanguages: ["English"], preferredCountries: ["Netherlands"] }
    );

    expect(ranked[0]?.record.id).toBe("a");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});
