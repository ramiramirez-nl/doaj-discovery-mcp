import { describe, expect, test, vi } from "vitest";

import { explainDoajMetadata } from "../src/tools/explain.js";
import { semanticFallbackWarning } from "../src/tools/register.js";
import { createMcpServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { DoajClient } from "../src/doaj/client.js";

const EXPECTED_TOOL_COUNT = 8;

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

    expect(Object.keys(tools)).toHaveLength(EXPECTED_TOOL_COUNT);
    for (const tool of Object.values(tools)) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      });
    }
  });
});

describe("tool handlers end-to-end (fake DOAJ client)", () => {
  const jsonResponse = (payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  const fakeJournalPayload = {
    total: 1,
    results: [
      {
        id: "journal-1",
        bibjson: {
          title: "Journal of No-Fee Medicine",
          eissn: "1000-0001",
          apc: { has_apc: false },
          publisher: { name: "Example Press", country: "NL" },
          language: ["EN"],
          license: [{ type: "CC BY" }]
        }
      }
    ]
  };

  const fakeArticlePayload = {
    total: 1,
    results: [
      {
        id: "article-1",
        bibjson: {
          title: "A study on scribal practices",
          abstract: "Ottoman-period Syriac manuscript transmission.",
          journal: { title: "History Quarterly", country: "US", issns: ["2000-0002"] },
          identifier: [{ id: "10.1234/hq.1", type: "doi" }]
        }
      }
    ]
  };

  const registeredHandlers = async (fetchImpl: (url: URL) => Promise<Response>) => {
    vi.stubGlobal("fetch", vi.fn(fetchImpl));
    const config = loadConfig({ ENABLE_CACHE: "false" });
    const client = new DoajClient(config);
    const server = createMcpServer(client, config);
    const tools = (
      server as unknown as {
        _registeredTools: Record<string, { handler: (input: unknown) => Promise<unknown> }>;
      }
    )._registeredTools;
    return tools;
  };

  test("find_diamond_oa_journals returns results for a plain-language query", async () => {
    const tools = await registeredHandlers(async () => jsonResponse(fakeJournalPayload));
    const response = (await tools.find_diamond_oa_journals!.handler({
      query: "medicine",
      limit: 5,
      strict: false
    })) as { content: Array<{ text: string }> };

    const body = JSON.parse(response.content[0]!.text);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].record.title).toBe("Journal of No-Fee Medicine");
    vi.unstubAllGlobals();
  });

  test("recommend_doaj_journals_for_manuscript returns results for a real abstract", async () => {
    const tools = await registeredHandlers(async () => jsonResponse(fakeJournalPayload));
    const response = (await tools.recommend_doaj_journals_for_manuscript!.handler({
      title: "Scribal networks in Tur Abdin",
      abstract:
        "This study examines the transmission of Syriac liturgical manuscripts in the Ottoman period, focusing on scribal practices in Tur Abdin monasteries.",
      limit: 5,
      noApcOnly: false
    })) as { content: Array<{ text: string }> };

    const body = JSON.parse(response.content[0]!.text);
    expect(body.results).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  test("find_similar_doaj_articles returns results for a real abstract", async () => {
    const tools = await registeredHandlers(async () => jsonResponse(fakeArticlePayload));
    const response = (await tools.find_similar_doaj_articles!.handler({
      abstract:
        "Deep learning models for automated segmentation of cardiac magnetic resonance images.",
      limit: 5
    })) as { content: Array<{ text: string }> };

    const body = JSON.parse(response.content[0]!.text);
    expect(body.results).toHaveLength(1);
    expect(body.warnings).toContain(semanticFallbackWarning());
    vi.unstubAllGlobals();
  });

  test("get_doaj_journal_by_issn queries both eissn and pissn", async () => {
    let capturedUrl: URL | undefined;
    const tools = await registeredHandlers(async (url) => {
      capturedUrl = url;
      return jsonResponse(fakeJournalPayload);
    });
    await tools.get_doaj_journal_by_issn!.handler({ issn: "1000-0001" });

    expect(decodeURIComponent(capturedUrl!.pathname)).toContain('bibjson.eissn:"1000-0001"');
    expect(decodeURIComponent(capturedUrl!.pathname)).toContain('bibjson.pissn:"1000-0001"');
    vi.unstubAllGlobals();
  });

  test("get_doaj_article_by_doi queries the doi field", async () => {
    let capturedUrl: URL | undefined;
    const tools = await registeredHandlers(async (url) => {
      capturedUrl = url;
      return jsonResponse(fakeArticlePayload);
    });
    await tools.get_doaj_article_by_doi!.handler({ doi: "10.1234/hq.1" });

    expect(decodeURIComponent(capturedUrl!.pathname)).toContain('doi:"10.1234/hq.1"');
    vi.unstubAllGlobals();
  });
});
