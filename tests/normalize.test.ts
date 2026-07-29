import { describe, expect, test } from "vitest";

import { normalizeArticle, normalizeJournal } from "../src/doaj/normalize.js";

describe("DOAJ normalization", () => {
  test("extracts journal fields from real DOAJ API record shape", () => {
    const journal = normalizeJournal({
      id: "journal-1",
      bibjson: {
        title: "Journal of Digital Archives",
        eissn: "8765-4321",
        pissn: "1234-5678",
        publisher: { name: "Test University Press", country: "NL" },
        language: ["EN", "NL"],
        keywords: ["archives", "digital humanities"],
        subject: [{ code: "Z", scheme: "LCC", term: "Archives" }],
        license: [{ type: "CC BY" }],
        apc: { has_apc: false },
        ref: { journal: "https://example.org/journal-home" }
      }
    });

    expect(journal.title).toBe("Journal of Digital Archives");
    expect(journal.issns).toEqual(expect.arrayContaining(["8765-4321", "1234-5678"]));
    expect(journal.countryCode).toBe("NL");
    expect(journal.country).toBe("Netherlands");
    expect(journal.publisher).toBe("Test University Press");
    expect(journal.languageCodes).toEqual(["EN", "NL"]);
    expect(journal.languages).toEqual(["English", "Dutch"]);
    expect(journal.subjects).toEqual(["Archives"]);
    expect(journal.hasApc).toBe(false);
    expect(journal.licenses).toEqual(["CC BY"]);
    expect(journal.url).toBe("https://example.org/journal-home");
    expect(journal.doajUrl).toBe("https://doaj.org/toc/8765-4321");
  });

  test("falls back gracefully when publisher/language/license are absent", () => {
    const journal = normalizeJournal({
      id: "journal-2",
      bibjson: { title: "Minimal Journal" }
    });

    expect(journal.title).toBe("Minimal Journal");
    expect(journal.country).toBeUndefined();
    expect(journal.publisher).toBeUndefined();
    expect(journal.languages).toEqual([]);
    expect(journal.url).toBeUndefined();
  });

  test("extracts article fields from real DOAJ API record shape", () => {
    const article = normalizeArticle({
      id: "article-1",
      bibjson: {
        title: "Kurdish language education in open access",
        abstract: "A study of Kurdish language education.",
        year: "2025",
        journal: {
          title: "Education Studies",
          country: "TR",
          issns: ["1111-2222"],
          language: ["EN"]
        },
        author: [{ name: "A. Scholar" }],
        link: [{ url: "https://example.org/article", type: "fulltext" }],
        identifier: [{ id: "10.1234/edu.2025.001", type: "doi" }],
        keywords: ["Kurdish", "education"]
      }
    });

    expect(article.title).toContain("Kurdish");
    expect(article.journalTitle).toBe("Education Studies");
    expect(article.journalIssns).toEqual(["1111-2222"]);
    expect(article.countryCode).toBe("TR");
    expect(article.country).toBe("Turkey");
    expect(article.languages).toEqual(["English"]);
    expect(article.authors).toEqual(["A. Scholar"]);
    expect(article.links[0]?.url).toBe("https://example.org/article");
    expect(article.publishedYear).toBe(2025);
    expect(article.doi).toBe("10.1234/edu.2025.001");
    expect(article.doajUrl).toBe("https://doaj.org/article/article-1");
  });

  test("does not fabricate fields that are absent from the source record", () => {
    const article = normalizeArticle({
      id: "article-2",
      bibjson: { title: "Untitled Study" }
    });

    expect(article.doi).toBeUndefined();
    expect(article.country).toBeUndefined();
    expect(article.journalIssns).toEqual([]);
  });
});
