import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { DoajClient } from "../doaj/client.js";
import { countryNameToCode, languageNameToCode } from "../doaj/codes.js";
import {
  buildFilterClauses,
  buildQueryLadder,
  composeQuery,
  escapeQuotedValue
} from "../doaj/query.js";
import type {
  AppConfig,
  DoajSearchResult,
  NormalizedArticle,
  NormalizedJournal
} from "../types.js";
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

/** Candidate pool fetched from DOAJ before local ranking/filtering; must exceed `limit`
 *  or ranking has nothing to sort and filters starve the result set. */
const candidatePoolSize = (limit: number): number => Math.min(100, Math.max(25, limit * 5));

const format = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
});

export const relaxedMatchWarning = (): string =>
  "No results matched all key terms together, so the query was broadened to match any of them. These results may be only loosely related to the topic.";

/**
 * Runs the progressive-relaxation rungs and returns the first that yields records, so a precise
 * `AND` result is always preferred over broad `OR` recall. Stops early on an upstream warning to
 * avoid hammering DOAJ when it is rate limiting or unavailable. When only the final broadest rung
 * produced anything, the caller is told the match was loose rather than being handed weak results
 * that look authoritative.
 */
const searchWithRelaxation = async <T>(
  queries: string[],
  search: (query: string) => Promise<DoajSearchResult<T>>
): Promise<{ result: DoajSearchResult<T>; query: string; relaxed: boolean }> => {
  let last: { result: DoajSearchResult<T>; query: string; relaxed: boolean } | undefined;
  for (const [index, query] of queries.entries()) {
    const result = await search(query);
    const relaxed = queries.length > 1 && index === queries.length - 1;
    last = { result, query, relaxed };
    if (result.records.length > 0 || result.warnings.length > 0) return last;
  }
  return last ?? { result: { records: [], warnings: [] }, query: queries[0] ?? "", relaxed: false };
};

const resolveCountryCode = (
  country: string | undefined,
  warnings: string[]
): string | undefined => {
  if (!country) return undefined;
  const code = countryNameToCode(country);
  if (!code) {
    warnings.push(
      `Could not resolve country "${country}" to a DOAJ country code; it was used for ranking only, not filtering.`
    );
  }
  return code;
};

const resolveLanguageCode = (
  language: string | undefined,
  warnings: string[]
): string | undefined => {
  if (!language) return undefined;
  const code = languageNameToCode(language);
  if (!code) {
    warnings.push(
      `Could not resolve language "${language}" to a DOAJ language code; it was used for ranking only, not filtering.`
    );
  }
  return code;
};

export const registerDiscoveryTools = (
  server: McpServer,
  client: DoajClient,
  config: AppConfig
): void => {
  const baseInput = {
    query: z
      .string()
      .min(2)
      .max(4_000)
      .describe(
        'Search text: keywords, a topic, or a short phrase (e.g. "diamond open access economics"). ' +
          "Longer text is automatically broadened if a narrow match returns nothing."
      ),
    limit: limitSchema(config).describe(
      `Maximum number of results to return (1-${config.maxResultsLimit}). Defaults to ${config.maxResultsDefault}.`
    ),
    strict: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, require every query term to match (AND) instead of relaxing to a broader OR " +
          "match when the strict search returns nothing. Use for a well-defined, narrow query."
      )
  };

  server.registerTool(
    "search_doaj_journals",
    {
      title: "Search DOAJ journals",
      description: "Find DOAJ-indexed journals using lexical relevance and metadata preferences.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        ...baseInput,
        country: z
          .string()
          .max(100)
          .optional()
          .describe(
            'Publisher country as a name, e.g. "Turkey" or "Brazil" (not an ISO code). Narrows ' +
              "results to that country when recognized; otherwise only affects ranking."
          ),
        language: z
          .string()
          .max(100)
          .optional()
          .describe(
            'Journal language as a name, e.g. "English" or "Turkish" (not an ISO code). Narrows ' +
              "results to that language when recognized; otherwise only affects ranking."
          ),
        noApcOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true, only return journals with no article processing charge (diamond/no-fee open access)."
          ),
        license: z
          .string()
          .max(200)
          .optional()
          .describe('License substring to filter by, e.g. "CC BY" or "CC BY-NC".')
      }
    },
    async (input) => {
      const preferences = analyzeQueryPreferences(input.query);
      if (input.country) preferences.preferredCountries.unshift(input.country);
      if (input.language) preferences.preferredLanguages.unshift(input.language);

      const resolutionWarnings: string[] = [];
      const countryCode = resolveCountryCode(input.country, resolutionWarnings);
      const languageCode = resolveLanguageCode(input.language, resolutionWarnings);

      const filters = buildFilterClauses(
        {
          ...(input.noApcOnly ? { hasApc: false as const } : {}),
          ...(countryCode ? { countryCode } : {}),
          ...(languageCode ? { languageCode } : {})
        },
        "journal"
      );
      const ladder = buildQueryLadder(input.query, {
        ...(input.strict ? { mode: "precise" as const } : {})
      }).map((freeText) => composeQuery(freeText, filters));

      const pool = candidatePoolSize(input.limit);
      const {
        result,
        query: effectiveQuery,
        relaxed
      } = await searchWithRelaxation(ladder, (query) =>
        client.searchJournals(query, { pageSize: pool })
      );
      let records = result.records;
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
      return format({
        warning: discoveryWarning,
        warnings: [
          ...resolutionWarnings,
          ...(relaxed ? [relaxedMatchWarning()] : []),
          ...result.warnings
        ],
        query: effectiveQuery,
        total: result.total,
        returned: ranked.length,
        results: ranked
      });
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
      const ladder = buildQueryLadder(input.query, {
        ...(input.strict ? { mode: "precise" as const } : {})
      });

      const pool = candidatePoolSize(input.limit);
      const {
        result,
        query: effectiveQuery,
        relaxed
      } = await searchWithRelaxation(ladder, (query) =>
        client.searchArticles(query, { pageSize: pool })
      );
      const ranked = rankRecords<NormalizedArticle>(input.query, result.records, preferences).slice(
        0,
        input.limit
      );
      return format({
        warning: discoveryWarning,
        warnings: [...(relaxed ? [relaxedMatchWarning()] : []), ...result.warnings],
        query: effectiveQuery,
        total: result.total,
        returned: ranked.length,
        results: ranked
      });
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
        abstract: z
          .string()
          .min(20)
          .max(12_000)
          .describe(
            "The manuscript's abstract or a description of its topic. Pass the full text, not keywords."
          ),
        title: z
          .string()
          .max(500)
          .optional()
          .describe(
            "The manuscript's title, if available. Improves matching alongside the abstract."
          ),
        limit: limitSchema(config).describe(
          `Maximum number of results to return (1-${config.maxResultsLimit}). Defaults to ${config.maxResultsDefault}.`
        ),
        preferredLanguage: z
          .string()
          .max(100)
          .optional()
          .describe('Preferred journal language as a name, e.g. "English" (not an ISO code).'),
        preferredCountry: z
          .string()
          .max(100)
          .optional()
          .describe('Preferred publisher country as a name, e.g. "Turkey" (not an ISO code).'),
        noApcOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, only recommend journals with no article processing charge.")
      }
    },
    async (input) => {
      const query = [input.title, input.abstract].filter(Boolean).join(" ");
      const preferences = analyzeQueryPreferences(query);
      if (input.preferredLanguage) preferences.preferredLanguages.unshift(input.preferredLanguage);
      if (input.preferredCountry) preferences.preferredCountries.unshift(input.preferredCountry);

      const resolutionWarnings: string[] = [];
      const countryCode = resolveCountryCode(input.preferredCountry, resolutionWarnings);
      const languageCode = resolveLanguageCode(input.preferredLanguage, resolutionWarnings);

      const filters = buildFilterClauses(
        {
          ...(input.noApcOnly ? { hasApc: false as const } : {}),
          ...(countryCode ? { countryCode } : {}),
          ...(languageCode ? { languageCode } : {})
        },
        "journal"
      );
      const ladder = buildQueryLadder(query).map((freeText) => composeQuery(freeText, filters));

      const pool = candidatePoolSize(input.limit);
      const {
        result,
        query: effectiveQuery,
        relaxed
      } = await searchWithRelaxation(ladder, (rung) =>
        client.searchJournals(rung, { pageSize: pool })
      );
      const ranked = rankRecords<NormalizedJournal>(query, result.records, preferences).slice(
        0,
        input.limit
      );
      return format({
        warning: `${discoveryWarning} Journal recommendations are manuscript-fit discovery candidates, not editorial decisions.`,
        warnings: [
          ...resolutionWarnings,
          ...(relaxed ? [relaxedMatchWarning()] : []),
          ...result.warnings
        ],
        query: effectiveQuery,
        total: result.total,
        returned: ranked.length,
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
      const preferences = analyzeQueryPreferences(input.query);
      const filters = buildFilterClauses({ hasApc: false }, "journal");
      const ladder = buildQueryLadder(input.query, {
        ...(input.strict ? { mode: "precise" as const } : {})
      }).map((freeText) => composeQuery(freeText, filters));

      const pool = candidatePoolSize(input.limit);
      const {
        result,
        query: effectiveQuery,
        relaxed
      } = await searchWithRelaxation(ladder, (query) =>
        client.searchJournals(query, { pageSize: pool })
      );
      const records = result.records.filter((record) => record.hasApc === false);
      const ranked = rankRecords<NormalizedJournal>(input.query, records, preferences).slice(
        0,
        input.limit
      );
      return format({
        warning: discoveryWarning,
        warnings: [...(relaxed ? [relaxedMatchWarning()] : []), ...result.warnings],
        query: effectiveQuery,
        total: result.total,
        returned: ranked.length,
        results: ranked
      });
    }
  );

  server.registerTool(
    "find_similar_doaj_articles",
    {
      title: "Find similar DOAJ articles",
      description: "Find similar articles using local lexical and metadata similarity.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        abstract: z
          .string()
          .min(20)
          .max(12_000)
          .describe(
            "The reference abstract or topic description to find similar articles for. Pass the full text, not keywords."
          ),
        title: z
          .string()
          .max(500)
          .optional()
          .describe(
            "The reference article's title, if available. Improves matching alongside the abstract."
          ),
        limit: limitSchema(config).describe(
          `Maximum number of results to return (1-${config.maxResultsLimit}). Defaults to ${config.maxResultsDefault}.`
        )
      }
    },
    async (input) => {
      const query = [input.title, input.abstract].filter(Boolean).join(" ");
      const ladder = buildQueryLadder(query);

      const pool = candidatePoolSize(input.limit);
      const {
        result,
        query: effectiveQuery,
        relaxed
      } = await searchWithRelaxation(ladder, (rung) =>
        client.searchArticles(rung, { pageSize: pool })
      );
      const ranked = rankRecords<NormalizedArticle>(
        query,
        result.records,
        analyzeQueryPreferences(query)
      ).slice(0, input.limit);
      return format({
        warning: discoveryWarning,
        warnings: [
          semanticFallbackWarning(),
          ...(relaxed ? [relaxedMatchWarning()] : []),
          ...result.warnings
        ],
        query: effectiveQuery,
        total: result.total,
        returned: ranked.length,
        results: ranked
      });
    }
  );

  server.registerTool(
    "get_doaj_journal_by_issn",
    {
      title: "Get DOAJ journal by ISSN",
      description: "Look up a single DOAJ-indexed journal by its print or electronic ISSN.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        issn: z
          .string()
          .min(8)
          .max(20)
          .describe(
            'The journal\'s print (pISSN) or electronic (eISSN) ISSN, e.g. "1234-5678". Either form is checked.'
          )
      }
    },
    async (input) => {
      const value = escapeQuotedValue(input.issn.trim());
      const query = `bibjson.eissn:"${value}" OR bibjson.pissn:"${value}"`;
      const result = await client.searchJournals(query, { pageSize: 3 });
      return format({
        warning: discoveryWarning,
        warnings: result.warnings,
        results: result.records
      });
    }
  );

  server.registerTool(
    "get_doaj_article_by_doi",
    {
      title: "Get DOAJ article by DOI",
      description: "Look up a single DOAJ-indexed article by its DOI.",
      annotations: doajReadOnlyAnnotations,
      inputSchema: {
        doi: z
          .string()
          .min(4)
          .max(300)
          .describe(
            'The article\'s DOI, e.g. "10.1234/example.2024.001", with or without a "https://doi.org/" prefix.'
          )
      }
    },
    async (input) => {
      const bareDoi = input.doi.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");
      const value = escapeQuotedValue(bareDoi);
      const query = `doi:"${value}"`;
      const result = await client.searchArticles(query, { pageSize: 3 });
      return format({
        warning: discoveryWarning,
        warnings: result.warnings,
        results: result.records
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
      inputSchema: {
        term: z
          .string()
          .min(1)
          .max(200)
          .describe(
            'The metadata term to explain, e.g. "APC", "diamond OA", "license", "ISSN", or "language".'
          )
      }
    },
    async (input) => format({ term: input.term, explanation: explainDoajMetadata(input.term) })
  );
};
