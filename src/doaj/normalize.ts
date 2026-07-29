import type { NormalizedArticle, NormalizedJournal, UnknownRecord } from "../types.js";

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
};

const stringValue = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
};

const strings = (value: unknown): string[] =>
  asArray(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (isRecord(item)) {
        return (
          stringValue(item.name) ??
          stringValue(item.title) ??
          stringValue(item.type) ??
          stringValue(item.id)
        );
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));

const nested = (record: UnknownRecord): UnknownRecord => {
  const bibjson = record.bibjson;
  return isRecord(bibjson) ? bibjson : record;
};

const extractIssns = (data: UnknownRecord): string[] => {
  const direct = [...strings(data.issn), ...strings(data.eissn), ...strings(data.pissn)];
  const fromIdentifiers = asArray(data.identifier)
    .map((item) =>
      isRecord(item) ? (stringValue(item.id) ?? stringValue(item.value)) : stringValue(item)
    )
    .filter((item): item is string => Boolean(item));
  return [...new Set([...direct, ...fromIdentifiers])];
};

const extractSubjects = (data: UnknownRecord): string[] => [
  ...strings(data.subject),
  ...strings(data.subjects),
  ...asArray(data.subject)
    .flatMap((item) => (isRecord(item) ? strings(item.term ?? item.code) : []))
    .filter(Boolean)
];

const extractApc = (data: UnknownRecord): boolean | undefined => {
  const apc = data.apc;
  if (typeof apc === "boolean") return apc;
  if (isRecord(apc)) {
    if (typeof apc.has_apc === "boolean") return apc.has_apc;
    if (typeof apc.hasApc === "boolean") return apc.hasApc;
  }
  if (typeof data.has_apc === "boolean") return data.has_apc;
  return undefined;
};

export const normalizeJournal = (record: unknown): NormalizedJournal => {
  const root = isRecord(record) ? record : {};
  const data = nested(root);
  const id =
    stringValue(root.id) ?? stringValue(data.id) ?? stringValue(data.title) ?? "unknown-journal";
  const country = stringValue(data.country);
  const url = stringValue(data.url) ?? stringValue(data.homepage);

  const hasApc = extractApc(data);
  const normalized: NormalizedJournal = {
    id,
    title: stringValue(data.title) ?? "Untitled journal",
    issns: extractIssns(data),
    ...(country ? { country } : {}),
    languages: strings(data.language ?? data.languages),
    subjects: [...new Set(extractSubjects(data))],
    keywords: strings(data.keywords ?? data.keyword),
    licenses: strings(data.license ?? data.licenses),
    ...(url ? { url } : {})
  };
  if (hasApc !== undefined) normalized.hasApc = hasApc;
  return normalized;
};

const extractAuthors = (data: UnknownRecord): string[] =>
  asArray(data.author ?? data.authors)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (isRecord(item)) return stringValue(item.name) ?? stringValue(item.fullname);
      return undefined;
    })
    .filter((item): item is string => Boolean(item));

const extractLinks = (data: UnknownRecord): Array<{ url: string; type?: string }> =>
  asArray(data.link ?? data.links)
    .map((item) => {
      if (typeof item === "string") return { url: item };
      if (!isRecord(item)) return undefined;
      const url = stringValue(item.url) ?? stringValue(item.href);
      if (!url) return undefined;
      const type = stringValue(item.type);
      return type ? { url, type } : { url };
    })
    .filter((item): item is { url: string; type?: string } => Boolean(item));

export const normalizeArticle = (record: unknown): NormalizedArticle => {
  const root = isRecord(record) ? record : {};
  const data = nested(root);
  const journal = isRecord(data.journal) ? data.journal : {};
  const yearRaw = stringValue(data.year ?? data.published_date ?? data.publicationDate);
  const parsedYear = yearRaw ? Number.parseInt(yearRaw.slice(0, 4), 10) : undefined;
  const country = stringValue(journal.country ?? data.country);
  const abstract = stringValue(data.abstract);
  const journalTitle = stringValue(journal.title ?? data.journal_title);

  return {
    id:
      stringValue(root.id) ?? stringValue(data.id) ?? stringValue(data.title) ?? "unknown-article",
    title: stringValue(data.title) ?? "Untitled article",
    ...(abstract ? { abstract } : {}),
    authors: extractAuthors(data),
    ...(journalTitle ? { journalTitle } : {}),
    journalIssns: extractIssns(journal),
    ...(country ? { country } : {}),
    languages: strings(data.language ?? data.languages),
    keywords: strings(data.keywords ?? data.keyword),
    subjects: [...new Set(extractSubjects(data))],
    ...(parsedYear && Number.isFinite(parsedYear) ? { publishedYear: parsedYear } : {}),
    links: extractLinks(data)
  };
};

export const extractResults = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of ["results", "records", "data", "items"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export const extractTotal = (payload: unknown): number | undefined => {
  if (!isRecord(payload)) return undefined;
  const total = payload.total ?? payload.total_results ?? payload.count;
  return typeof total === "number" ? total : undefined;
};
