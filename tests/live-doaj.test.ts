import { describe, expect, test } from "vitest";

import { DoajClient } from "../src/doaj/client.js";
import {
  buildFilterClauses,
  buildFreeTextClause,
  buildQueryLadder,
  composeQuery
} from "../src/doaj/query.js";
import { loadConfig } from "../src/config.js";

/**
 * Hits the real DOAJ API. Skipped by default so CI stays hermetic; this is the
 * regression guard for the exact failure class that shipped previously — queries
 * that are syntactically valid but return zero DOAJ results in production.
 * Run with: DOAJ_LIVE_TEST=1 npm test
 */
const describeLive = process.env.DOAJ_LIVE_TEST ? describe : describe.skip;

describeLive("live DOAJ API", () => {
  const client = new DoajClient(loadConfig({ ENABLE_CACHE: "false" }));

  test("a real manuscript abstract returns non-empty journal recommendations", async () => {
    const abstract =
      "This study examines the transmission of Syriac liturgical manuscripts in the Ottoman " +
      "period, focusing on scribal practices in Tur Abdin monasteries between 1500 and 1900, " +
      "using paleographic analysis and colophon evidence to reconstruct networks of copying " +
      "and patronage across monastic centres.";
    const freeText = buildFreeTextClause(abstract);
    const result = await client.searchJournals(freeText, { pageSize: 25 });

    expect(result.records.length).toBeGreaterThan(0);
  }, 20_000);

  test("diamond OA field filter returns non-empty results", async () => {
    const freeText = buildFreeTextClause("medicine");
    const filters = buildFilterClauses({ hasApc: false }, "journal");
    const query = composeQuery(freeText, filters);
    const result = await client.searchJournals(query, { pageSize: 25 });

    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records.every((record) => record.hasApc === false)).toBe(true);
  }, 20_000);

  test("a real abstract returns non-empty similar-article results", async () => {
    const abstract =
      "Deep learning models for automated segmentation of cardiac magnetic resonance images " +
      "have improved substantially, yet generalisation across scanner vendors remains an open " +
      "problem in clinical practice.";
    const freeText = buildFreeTextClause(abstract);
    const result = await client.searchArticles(freeText, { pageSize: 25 });

    expect(result.records.length).toBeGreaterThan(0);
  }, 20_000);

  test("the most precise ladder rung that matches is more selective than the OR fallback", async () => {
    const abstract =
      "Deep learning models for automated segmentation of cardiac magnetic resonance images have " +
      "improved substantially, yet generalisation across scanner vendors remains an open problem " +
      "in clinical practice.";
    const ladder = buildQueryLadder(abstract);

    const firstMatching = await (async () => {
      for (const rung of ladder) {
        const result = await client.searchArticles(rung, { pageSize: 5 });
        if (result.records.length > 0) return { rung, total: result.total ?? 0 };
      }
      return undefined;
    })();
    const broadest = await client.searchArticles(ladder.at(-1)!, { pageSize: 5 });

    expect(firstMatching).toBeDefined();
    expect(firstMatching!.rung).toContain(" AND ");
    // The precise rung must narrow the candidate space, not merely return something.
    expect(firstMatching!.total).toBeLessThan(broadest.total ?? Number.POSITIVE_INFINITY);
  }, 40_000);

  test("country and language filters resolve to non-empty results", async () => {
    const freeText = buildFreeTextClause("dergi");
    const filters = buildFilterClauses({ countryCode: "TR", languageCode: "TR" }, "journal");
    const query = composeQuery(freeText, filters);
    const result = await client.searchJournals(query, { pageSize: 25 });

    expect(result.records.length).toBeGreaterThan(0);
  }, 20_000);
});
