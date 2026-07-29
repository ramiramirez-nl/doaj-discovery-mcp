export type UnknownRecord = Record<string, unknown>;

export interface AppConfig {
  port: number;
  doajApiBaseUrl: string;
  doajRequestTimeoutMs: number;
  rateLimitMaxRequests: number;
  rateLimitWindowSeconds: number;
  maxRequestBodyBytes: number;
  enableCache: boolean;
  cacheDir: string;
  cacheTtlSeconds: number;
  maxResultsDefault: number;
  maxResultsLimit: number;
  trustProxy: boolean;
  buildSha: string;
  deploymentBaseUrl?: string;
}

export interface NormalizedJournal {
  id: string;
  title: string;
  issns: string[];
  country?: string;
  countryCode?: string;
  publisher?: string;
  languages: string[];
  languageCodes: string[];
  subjects: string[];
  keywords: string[];
  licenses: string[];
  hasApc?: boolean;
  url?: string;
  doajUrl?: string;
}

export interface NormalizedArticle {
  id: string;
  title: string;
  abstract?: string;
  authors: string[];
  journalTitle?: string;
  journalIssns: string[];
  country?: string;
  countryCode?: string;
  languages: string[];
  languageCodes: string[];
  keywords: string[];
  subjects: string[];
  publishedYear?: number;
  doi?: string;
  doajUrl?: string;
  links: Array<{ url: string; type?: string }>;
}

export type SearchableRecord = {
  id: string;
  title?: string;
  abstract?: string;
  keywords?: string[];
  subjects?: string[];
  country?: string;
  countryCode?: string;
  languages?: string[];
  languageCodes?: string[];
  licenses?: string[];
  hasApc?: boolean;
  journalTitle?: string;
};

export interface QueryPreferences {
  detectedLanguage?: string;
  preferredLanguages: string[];
  preferredCountries: string[];
}

export interface RankedRecord<T extends SearchableRecord> {
  record: T;
  score: number;
  reasons: string[];
}

export interface DoajSearchResult<T> {
  records: T[];
  total?: number;
  warnings: string[];
}
