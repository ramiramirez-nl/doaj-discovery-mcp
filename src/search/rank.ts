import type { QueryPreferences, RankedRecord, SearchableRecord } from "../types.js";
import { expandedQueryText } from "./synonyms.js";
import { normalizeText, tokenize } from "./text.js";

const fieldText = (record: SearchableRecord): Record<string, string> => ({
  title: record.title ?? "",
  abstract: record.abstract ?? "",
  keywords: (record.keywords ?? []).join(" "),
  subjects: (record.subjects ?? []).join(" "),
  journalTitle: record.journalTitle ?? "",
  country: record.country ?? "",
  languages: (record.languages ?? []).join(" "),
  licenses: (record.licenses ?? []).join(" ")
});

const weights: Record<string, number> = {
  title: 4,
  keywords: 3,
  subjects: 2.5,
  abstract: 1.4,
  journalTitle: 1.5,
  country: 0.8,
  languages: 0.8,
  licenses: 0.8
};

export const rankRecords = <T extends SearchableRecord>(
  query: string,
  records: T[],
  preferences: Partial<QueryPreferences> = {}
): Array<RankedRecord<T>> => {
  const queryTokens = tokenize(expandedQueryText(query));
  const uniqueTokens = [...new Set(queryTokens)];
  const phrase = normalizeText(query);
  const wantsNoFee = /\b(diamond|no apc|no fee|no publication fee|no author fee)\b/i.test(
    expandedQueryText(query)
  );

  return records
    .map((record) => {
      let score = 0;
      const reasons: string[] = [];
      const fields = fieldText(record);

      for (const [field, value] of Object.entries(fields)) {
        const normalized = normalizeText(value);
        const tokens = tokenize(value);
        if (!normalized) continue;
        const lengthNorm = Math.sqrt(tokens.length + 1);
        const matches = uniqueTokens.filter((token) => tokens.includes(token)).length;
        if (matches > 0) {
          score += (matches / lengthNorm) * (weights[field] ?? 1);
          reasons.push(`${field} match`);
        }
        if (phrase && normalized.includes(phrase)) {
          score += 5 * (weights[field] ?? 1);
          reasons.push(`${field} phrase`);
        }
      }

      if (wantsNoFee && record.hasApc === false) {
        score += 8;
        reasons.push("no APC");
      }

      for (const language of preferences.preferredLanguages ?? []) {
        if (
          (record.languages ?? []).some((item) => normalizeText(item) === normalizeText(language))
        ) {
          score += 4;
          reasons.push(`language ${language}`);
        }
      }

      for (const country of preferences.preferredCountries ?? []) {
        if (record.country && normalizeText(record.country) === normalizeText(country)) {
          score += 4;
          reasons.push(`country ${country}`);
        }
      }

      return { record, score, reasons: [...new Set(reasons)] };
    })
    .sort((a, b) => b.score - a.score);
};
