import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { DoajClient } from "../doaj/client.js";
import type { AppConfig, NormalizedArticle, NormalizedJournal } from "../types.js";
import { analyzeQueryPreferences } from "../query/preferences.js";
import { rankRecords } from "../search/rank.js";
import { explainDoajMetadata } from "./explain.js";

export const semanticFallbackWarning = (): string =>
  "Local vector semantic search is not enabled. Results are ranked by lexical relevance, synonym expansion, and DOAJ metadata.";

const discoveryWarning =
  "Discovery-only tool. Does not perform DOAJ editorial review, criteria checking, compliance checking, endogeny checking, or publishing decisions.";

const doajReadOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
} as const;

const localReadOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const;

const limitSchema = (config: AppConfig) =>
  z
    .number()
    .int()
    .positive()
    .max(config.maxResultsLimit)
    .optional()
    .default(config.maxResultsDefault);

const format = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
});

export const registerDiscoveryTools = (
  server: McpServer,
  client: DoajClient,
  config: AppConfig
): void => {
  const baseInput = {
    query: z.string().min(2).max(4_000),
    limit: limitSchema(config),
    strict: z.boolean().optional().default(false)
  };

  server.registerTool(
    "search_doaj_journals",
    {
      title: "Search DOAJ journals",
      description: "Find DOAJ-indexed journals using lexical relevance and metadata preferences.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        ...baseInput,
        country: z.string().max(100).optional(),
        language: z.string().max(100).optional(),
        noApcOnly: z.boolean().optional().default(false),
        license: z.string().max(200).optional()
      }
    },
    async (input) => {
      const preferences = analyzeQueryPreferences(input.query);
      if (input.country) preferences.preferredCountries.unshift(input.country);
      if (input.language) preferences.preferredLanguages.unshift(input.language);
      const result = await client.searchJournals(input.query, { pageSize: input.limit });
      let records = result.records;
      if (input.noApcOnly || input.strict)
        records = records.filter((record) => record.hasApc === false);
      if (input.license) {
        records = records.filter((record) =>
          record.licenses.some((license) =>
            license.toLowerCase().includes(input.license!.toLowerCase())
          )
        );
      }
      const ranked = rankRecords<NormalizedJournal>(input.query, records, preferences).slice(
        0,
        input.limit
      );
      return format({ warning: discoveryWarning, warnings: result.warnings, results: ranked });
    }
  );

  server.registerTool(
    "search_doaj_articles",
    {
      title: "Search DOAJ articles",
      description: "Find DOAJ-indexed articles using lexical relevance and metadata preferences.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: baseInput
    },
    async (input) => {
      const preferences = analyzeQueryPreferences(input.query);
      const result = await client.searchArticles(input.query, { pageSize: input.limit });
      const ranked = rankRecords<NormalizedArticle>(input.query, result.records, preferences).slice(
        0,
        input.limit
      );
      return format({ warning: discoveryWarning, warnings: result.warnings, results: ranked });
    }
  );

  server.registerTool(
    "recommend_doaj_journals_for_manuscript",
    {
      title: "Recommend DOAJ journals for manuscript fit",
      description:
        "Suggest discovery candidates for a manuscript abstract or topic; not an acceptance prediction.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        abstract: z.string().min(20).max(12_000),
        title: z.string().max(500).optional(),
        limit: limitSchema(config),
        preferredLanguage: z.string().max(100).optional(),
        preferredCountry: z.string().max(100).optional(),
        noApcOnly: z.boolean().optional().default(false)
      }
    },
    async (input) => {
      const query = [input.title, input.abstract].filter(Boolean).join(" ");
      const preferences = analyzeQueryPreferences(query);
      if (input.preferredLanguage) preferences.preferredLanguages.unshift(input.preferredLanguage);
      if (input.preferredCountry) preferences.preferredCountries.unshift(input.preferredCountry);
      const result = await client.searchJournals(query, { pageSize: input.limit });
      const records = input.noApcOnly
        ? result.records.filter((record) => record.hasApc === false)
        : result.records;
      const ranked = rankRecords<NormalizedJournal>(query, records, preferences).slice(
        0,
        input.limit
      );
      return format({
        warning: `${discoveryWarning} Journal recommendations are manuscript-fit discovery candidates, not editorial decisions.`,
        warnings: result.warnings,
        results: ranked
      });
    }
  );

  server.registerTool(
    "find_diamond_oa_journals",
    {
      title: "Find diamond OA journals",
      description: "Find no-fee or diamond open-access DOAJ journals.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: baseInput
    },
    async (input) => {
      const query = `diamond oa no APC ${input.query}`;
      const preferences = analyzeQueryPreferences(input.query);
      const result = await client.searchJournals(query, { pageSize: input.limit });
      const ranked = rankRecords<NormalizedJournal>(
        query,
        result.records.filter((record) => record.hasApc === false),
        preferences
      ).slice(0, input.limit);
      return format({ warning: discoveryWarning, warnings: result.warnings, results: ranked });
    }
  );

  server.registerTool(
    "find_similar_doaj_articles",
    {
      title: "Find similar DOAJ articles",
      description: "Find similar articles using local lexical and metadata similarity.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        abstract: z.string().min(20).max(12_000),
        title: z.string().max(500).optional(),
        limit: limitSchema(config)
      }
    },
    async (input) => {
      const query = [input.title, input.abstract].filter(Boolean).join(" ");
      const result = await client.searchArticles(query, { pageSize: input.limit });
      const ranked = rankRecords<NormalizedArticle>(
        query,
        result.records,
        analyzeQueryPreferences(query)
      ).slice(0, input.limit);
      return format({
        warning: discoveryWarning,
        warnings: [semanticFallbackWarning(), ...result.warnings],
        results: ranked
      });
    }
  );

  server.registerTool(
    "explain_doaj_metadata",
    {
      title: "Explain DOAJ metadata",
      description:
        "Explain DOAJ metadata terms such as APC, license, language, ISSN, or diamond OA.",
      annotations: localReadOnlyAnnotations,
      inputSchema: { term: z.string().min(1).max(200) }
    },
    async (input) => format({ term: input.term, explanation: explainDoajMetadata(input.term) })
  );
};
