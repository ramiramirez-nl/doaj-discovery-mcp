const SYNONYMS: Record<string, string[]> = {
  "diamond oa": ["no APC", "no publication fee", "no author fee", "no article processing charge"],
  "open access": ["OA", "free access"],
  "syriac christianity": [
    "Syriac studies",
    "Assyrian Christianity",
    "Chaldean",
    "Aramaic",
    "Syriac Orthodox",
    "Church of the East"
  ],
  "scholarly publishing": ["open access publishing", "academic publishing", "journal publishing"],
  archives: ["archival studies", "digital archives", "manuscript archives"],
  kurdish: ["Kurmanji", "Sorani", "Kurdish language"]
};

import { normalizeText } from "./text.js";

export const expandSynonyms = (query: string): string[] => {
  const normalized = normalizeText(query);
  const expansions = new Set<string>();
  for (const [term, values] of Object.entries(SYNONYMS)) {
    if (normalized.includes(normalizeText(term))) {
      values.forEach((value) => expansions.add(value));
    }
  }
  return [...expansions];
};

export const expandedQueryText = (query: string): string => [query, ...expandSynonyms(query)].join(" ");
