export const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);

export const buildDoajQuery = (value: string, maxCharacters = 480): string => {
  const limit = Math.max(16, Math.floor(maxCharacters));
  const uniqueTokens = [...new Set(tokenize(value))];
  let query = "";

  for (const token of uniqueTokens) {
    const candidate = query ? `${query} ${token}` : token;
    if (candidate.length > limit) {
      if (!query) query = token.slice(0, limit);
      break;
    }
    query = candidate;
  }

  return query || "open access";
};
