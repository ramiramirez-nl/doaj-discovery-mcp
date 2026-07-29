import type { NormalizedArticle, NormalizedJournal, UnknownRecord } from "../types.js";
import { countryCodeToName, languageCodeToName } from "./codes.js";

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
  const direct = [
    ...strings(data.issn),
    ...strings(data.eissn),
    ...strings(data.pissn),
    ...strings(data.issns)
  ];
  const fromIdentifiers = asArray(data.identifier)
    .map((item) =>
      isRecord(item) ? (stringValue(item.id) ?? stringValue(item.value)) : stringValue(item)
    )
    .filter((item): item is string => Boolean(item));
  return [...new Set([...direct, ...fromIdentifiers])];
};

const extractSubjects = (data: UnknownRecord): string[] =>
  asArray(data.subject ?? data.subjects)
    .flatMap((item) => (isRecord(item) ? strings(item.term ?? item.code) : strings(item)))
    .filter(Boolean);

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

const extractPublisherName = (data: UnknownRecord): string | undefined => {
  const publisher = data.publisher;
  if (typeof publisher === "string") return stringValue(publisher);
  if (isRecord(publisher)) return stringValue(publisher.name);
  return undefined;
};

const extractCountryCode = (data: UnknownRecord): string | undefined => {
  const publisher = data.publisher;
  if (isRecord(publisher) && stringValue(publisher.country)) return stringValue(publisher.country);
  return stringValue(data.country);
};

const extractJournalHomepage = (data: UnknownRecord): string | undefined => {
  const ref = data.ref;
  if (isRecord(ref)) {
    const url = stringValue(ref.journal) ?? stringValue(ref.oa_statement);
    if (url) return url;
  }
  return stringValue(data.url) ?? stringValue(data.homepage);
};

const extractLanguageCodes = (data: UnknownRecord): string[] =>
  strings(data.language ?? data.languages).map((code) => code.toUpperCase());

const resolveLanguageNames = (codes: string[]): string[] =>
  codes.map((code) => languageCodeToName(code) ?? code);

const extractIdentifierValue = (data: UnknownRecord, type: string): string | undefined => {
  const match = asArray(data.identifier).find(
    (item) => isRecord(item) && stringValue(item.type)?.toLowerCase() === type
  );
  return isRecord(match) ? stringValue(match.id) : undefined;
};

export const normalizeJournal = (record: unknown): NormalizedJournal => {
  const root = isRecord(record) ? record : {};
  const data = nested(root);
  const issns = extractIssns(data);
  const id =
    stringValue(root.id) ?? stringValue(data.id) ?? stringValue(data.title) ?? "unknown-journal";
  const countryCode = extractCountryCode(data);
  const country = countryCode ? (countryCodeToName(countryCode) ?? countryCode) : undefined;
  const publisher = extractPublisherName(data);
  const url = extractJournalHomepage(data);
  const languageCodes = extractLanguageCodes(data);

  const hasApc = extractApc(data);
  const normalized: NormalizedJournal = {
    id,
    title: stringValue(data.title) ?? "Untitled journal",
    issns,
    ...(country ? { country } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(publisher ? { publisher } : {}),
    languages: resolveLanguageNames(languageCodes),
    languageCodes,
    subjects: [...new Set(extractSubjects(data))],
    keywords: strings(data.keywords ?? data.keyword),
    licenses: strings(data.license ?? data.licenses),
    ...(url ? { url } : {}),
    ...(issns[0] ? { doajUrl: `https://doaj.org/toc/${issns[0]}` } : {})
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
  const countryCode = stringValue(journal.country) ?? extractCountryCode(data);
  const country = countryCode ? (countryCodeToName(countryCode) ?? countryCode) : undefined;
  const abstract = stringValue(data.abstract);
  const journalTitle = stringValue(journal.title ?? data.journal_title);
  const journalIssns = extractIssns(journal);
  const languageCodes = extractLanguageCodes(journal).length
    ? extractLanguageCodes(journal)
    : extractLanguageCodes(data);
  const doi = extractIdentifierValue(data, "doi");
  const articleId = stringValue(root.id) ?? stringValue(data.id) ?? stringValue(data.title);

  return {
    id: articleId ?? "unknown-article",
    title: stringValue(data.title) ?? "Untitled article",
    ...(abstract ? { abstract } : {}),
    authors: extractAuthors(data),
    ...(journalTitle ? { journalTitle } : {}),
    journalIssns,
    ...(country ? { country } : {}),
    ...(countryCode ? { countryCode } : {}),
    languages: resolveLanguageNames(languageCodes),
    languageCodes,
    keywords: strings(data.keywords ?? data.keyword),
    subjects: [...new Set(extractSubjects(data))],
    ...(parsedYear && Number.isFinite(parsedYear) ? { publishedYear: parsedYear } : {}),
    ...(doi ? { doi } : {}),
    ...(articleId ? { doajUrl: `https://doaj.org/article/${articleId}` } : {}),
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
