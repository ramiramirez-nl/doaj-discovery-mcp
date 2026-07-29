import { tokenize } from "../search/text.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "with",
  "this",
  "that",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "by",
  "as",
  "at",
  "from",
  "it",
  "its",
  "we",
  "our",
  "study",
  "paper",
  "article",
  "research",
  "using",
  "based",
  "results",
  "analysis",
  "between",
  "among",
  "within",
  "bir",
  "bu",
  "ve",
  "ile",
  "icin",
  "için",
  "gibi",
  "olan",
  "olarak",
  "de",
  "da",
  "mi",
  "mu",
  "ki"
]);

export const escapeQuotedValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export type FreeTextMode = "precise" | "recall";

export interface FreeTextOptions {
  mode?: FreeTextMode;
  maxTerms?: number;
}

export const contentTerms = (text: string): string[] => [
  ...new Set(tokenize(text).filter((token) => !STOPWORDS.has(token)))
];

/**
 * DOAJ's search API defaults to an AND operator across all space-separated terms.
 * Long free text (abstracts, multi-concept queries) must be OR-joined or it matches
 * zero records; short, deliberate queries should stay AND-joined for precision.
 */
export const buildFreeTextClause = (text: string, options: FreeTextOptions = {}): string => {
  const maxTerms = Math.max(1, options.maxTerms ?? 12);
  const tokens = contentTerms(text);
  if (tokens.length === 0) return "open access";

  const mode = options.mode ?? (tokens.length <= 4 ? "precise" : "recall");
  const selected = mode === "precise" ? tokens : tokens.slice(0, maxTerms);
  const joiner = mode === "precise" ? " AND " : " OR ";
  return selected.join(joiner);
};

/**
 * Progressive relaxation rungs, most precise first.
 *
 * An `AND` of a few content terms is selective enough that DOAJ's own relevance ranking is
 * meaningful, but it returns nothing for niche topics. A flat `OR` of every term always returns
 * something, but over a wide corpus it matches millions of records and the top hits are
 * unrelated. Callers walk these rungs and stop at the first one that yields records, so precise
 * results are preferred and broad recall is only the last resort.
 */
export const buildQueryLadder = (text: string, options: FreeTextOptions = {}): string[] => {
  const maxTerms = Math.max(1, options.maxTerms ?? 12);
  const tokens = contentTerms(text);
  if (tokens.length === 0) return ["open access"];
  if (options.mode === "precise") return [tokens.join(" AND ")];

  const rungs: string[] = [];
  const andWidths = [4, 3, 2].filter((width) => width <= tokens.length);
  for (const width of andWidths) rungs.push(tokens.slice(0, width).join(" AND "));
  rungs.push(tokens.slice(0, maxTerms).join(" OR "));
  return [...new Set(rungs)];
};

export type FilterTarget = "journal" | "article";

export interface DoajFilters {
  hasApc?: boolean;
  license?: string;
  countryCode?: string;
  languageCode?: string;
}

const FILTER_FIELDS: Record<FilterTarget, { country: string; language: string }> = {
  journal: { country: "bibjson.publisher.country", language: "bibjson.language" },
  article: { country: "bibjson.journal.country", language: "bibjson.journal.language" }
};

export const buildFilterClauses = (filters: DoajFilters, target: FilterTarget): string[] => {
  const clauses: string[] = [];
  if (filters.hasApc === false) clauses.push("bibjson.apc.has_apc:false");
  if (filters.license) {
    clauses.push(`bibjson.license.type:"${escapeQuotedValue(filters.license)}"`);
  }
  if (filters.countryCode) {
    clauses.push(`${FILTER_FIELDS[target].country}:${filters.countryCode.toUpperCase()}`);
  }
  if (filters.languageCode) {
    clauses.push(`${FILTER_FIELDS[target].language}:${filters.languageCode.toUpperCase()}`);
  }
  return clauses;
};

export const composeQuery = (freeText: string, filterClauses: string[]): string => {
  if (filterClauses.length === 0) return freeText;
  return `(${freeText}) AND ${filterClauses.join(" AND ")}`;
};
