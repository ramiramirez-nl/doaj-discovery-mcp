export type UnknownRecord = Record<string, unknown>;

export interface AppConfig {
  port: number;
  doajApiBaseUrl: string;
  doajRequestTimeoutMs: number;
  enableCache: boolean;
  cacheDir: string;
  cacheTtlSeconds: number;
  enableSemanticSearch: boolean;
  semanticProvider: "none" | "local";
  maxResultsDefault: number;
  maxResultsLimit: number;
  logLevel: "debug" | "info" | "warn" | "error";
  deploymentBaseUrl?: string;
}

export interface NormalizedJournal {
  id: string;
  title: string;
  issns: string[];
  country?: string;
  languages: string[];
  subjects: string[];
  keywords: string[];
  licenses: string[];
  hasApc?: boolean;
  url?: string;
  raw?: unknown;
}

export interface NormalizedArticle {
  id: string;
  title: string;
  abstract?: string;
  authors: string[];
  journalTitle?: string;
  journalIssns: string[];
  country?: string;
  languages: string[];
  keywords: string[];
  subjects: string[];
  publishedYear?: number;
  links: Array<{ url: string; type?: string }>;
  raw?: unknown;
}

export type SearchableRecord = {
  id: string;
  title?: string;
  abstract?: string;
  keywords?: string[];
  subjects?: string[];
  country?: string;
  languages?: string[];
  licenses?: string[];
  hasApc?: boolean;
  journalTitle?: string;
};

export interface QueryPreferences {
  detectedLanguage?: string;
  preferredLanguages: string[];
  preferredCountries: string[];
  strictFilters: boolean;
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

export interface DoajError {
  message: string;
  status?: number;
  retryAfterSeconds?: number;
}
