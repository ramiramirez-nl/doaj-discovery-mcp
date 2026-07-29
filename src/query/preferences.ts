import type { QueryPreferences } from "../types.js";
import { normalizeText } from "../search/text.js";

const COUNTRY_ALIASES: Record<string, string> = {
  netherlands: "Netherlands",
  turkey: "Turkey",
  turkiye: "Turkey",
  türkiye: "Turkey",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  usa: "United States",
  "united states": "United States",
  germany: "Germany",
  france: "France",
  brazil: "Brazil"
};

const LANGUAGE_ALIASES: Record<string, string> = {
  english: "English",
  turkish: "Turkish",
  türkçe: "Turkish",
  turkce: "Turkish",
  dutch: "Dutch",
  french: "French",
  german: "German",
  portuguese: "Portuguese",
  arabic: "Arabic",
  kurdish: "Kurdish"
};

export const analyzeQueryPreferences = (query: string): QueryPreferences => {
  const normalized = normalizeText(query);
  const preferredCountries = new Set<string>();
  const preferredLanguages = new Set<string>();

  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (normalized.includes(normalizeText(alias))) preferredCountries.add(country);
  }
  for (const [alias, language] of Object.entries(LANGUAGE_ALIASES)) {
    if (normalized.includes(normalizeText(alias))) preferredLanguages.add(language);
  }

  let detectedLanguage: string | undefined;
  if (/[ıİğĞüÜşŞöÖçÇ]/u.test(query) || normalized.includes("turkiye") || normalized.includes("dergi")) {
    detectedLanguage = "Turkish";
    preferredLanguages.add("Turkish");
    preferredCountries.add("Turkey");
  }

  return {
    ...(detectedLanguage ? { detectedLanguage } : {}),
    preferredLanguages: [...preferredLanguages],
    preferredCountries: [...preferredCountries],
    strictFilters: /\b(only|strictly|exclusively|must be|must publish)\b/i.test(query)
  };
};
