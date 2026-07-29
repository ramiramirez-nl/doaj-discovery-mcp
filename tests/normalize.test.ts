import { describe, expect, test } from "vitest";

import { normalizeArticle, normalizeJournal } from "../src/doaj/normalize.js";

describe("DOAJ normalization", () => {
  test("extracts journal fields from nested and variant metadata", () => {
    const journal = normalizeJournal({
      id: "journal-1",
      bibjson: {
        title: "Journal of Digital Archives",
        identifier: [
          { type: "pissn", id: "1234-5678" },
          { type: "eissn", id: "8765-4321" }
        ],
        country: "Netherlands",
        language: ["English", "Dutch"],
        keywords: ["archives", "digital humanities"],
        license: [{ type: "CC BY" }],
        apc: { has_apc: false }
      }
    });

    expect(journal.title).toBe("Journal of Digital Archives");
    expect(journal.issns).toEqual(["1234-5678", "8765-4321"]);
    expect(journal.country).toBe("Netherlands");
    expect(journal.languages).toEqual(["English", "Dutch"]);
    expect(journal.hasApc).toBe(false);
    expect(journal.licenses).toEqual(["CC BY"]);
  });

  test("extracts article fields defensively", () => {
    const article = normalizeArticle({
      id: "article-1",
      bibjson: {
        title: "Kurdish language education in open access",
        abstract: "A study of Kurdish language education.",
        year: "2025",
        journal: { title: "Education Studies", country: "Turkey" },
        author: [{ name: "A. Scholar" }],
        link: [{ url: "https://example.org/article", type: "fulltext" }],
        keywords: ["Kurdish", "education"],
        language: ["English"]
      }
    });

    expect(article.title).toContain("Kurdish");
    expect(article.journalTitle).toBe("Education Studies");
    expect(article.authors).toEqual(["A. Scholar"]);
    expect(article.links[0]?.url).toBe("https://example.org/article");
    expect(article.publishedYear).toBe(2025);
  });
});
