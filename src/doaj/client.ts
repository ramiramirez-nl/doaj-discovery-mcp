import { createCacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import type {
  AppConfig,
  DoajSearchResult,
  NormalizedArticle,
  NormalizedJournal
} from "../types.js";
import { extractResults, extractTotal, normalizeArticle, normalizeJournal } from "./normalize.js";

const MAX_PAGE_SIZE = 100;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 300;

export interface SearchOptions {
  page?: number;
  pageSize?: number;
  sort?: string;
}

const hasResultCollection = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  return ["results", "records", "data", "items"].some((key) => Array.isArray(record[key]));
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number.parseFloat(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
};

export class DoajClient {
  constructor(
    private readonly config: AppConfig,
    private readonly cache?: CacheStore
  ) {}

  searchJournals(
    query: string,
    options: SearchOptions = {}
  ): Promise<DoajSearchResult<NormalizedJournal>> {
    return this.search("search/journals", query, options, normalizeJournal);
  }

  searchArticles(
    query: string,
    options: SearchOptions = {}
  ): Promise<DoajSearchResult<NormalizedArticle>> {
    return this.search("search/articles", query, options, normalizeArticle);
  }

  private search<T>(
    path: string,
    query: string,
    options: SearchOptions,
    normalize: (record: unknown) => T
  ): Promise<DoajSearchResult<T>> {
    const url = new URL(
      `${this.config.doajApiBaseUrl.replace(/\/$/, "")}/${path}/${encodeURIComponent(query)}`
    );
    const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
    url.searchParams.set("pageSize", String(pageSize));
    if (options.page) url.searchParams.set("page", String(options.page));
    if (options.sort) url.searchParams.set("sort", options.sort);
    return this.request(url, normalize);
  }

  private async request<T>(
    url: URL,
    normalize: (record: unknown) => T
  ): Promise<DoajSearchResult<T>> {
    const key = createCacheKey("doaj-api", url.toString());
    if (this.config.enableCache && this.cache) {
      try {
        const cached = await this.cache.get<DoajSearchResult<T>>(key);
        if (cached) return cached.payload;
      } catch {
        // Cache availability must not affect discovery.
      }
    }

    const result = await this.fetchWithRetry(url);

    if (result.records === undefined) {
      return { records: [], warnings: result.warnings };
    }

    const finalResult: DoajSearchResult<T> = {
      records: result.records.map(normalize),
      warnings: result.warnings
    };
    if (result.total !== undefined) finalResult.total = result.total;

    if (this.config.enableCache && this.cache) {
      try {
        await this.cache.set(key, finalResult, {
          ttlSeconds: this.config.cacheTtlSeconds,
          source: "doaj-api",
          payloadVersion: 1
        });
      } catch {
        // Cache availability must not affect discovery.
      }
    }
    return finalResult;
  }

  private async fetchWithRetry(
    url: URL
  ): Promise<{ records?: unknown[]; total?: number; warnings: string[] }> {
    let lastWarnings: string[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(this.config.doajRequestTimeoutMs)
        });
      } catch (error) {
        const message =
          error instanceof Error && error.name === "TimeoutError"
            ? "DOAJ request timed out. Try again later."
            : "DOAJ request failed. Try again later.";
        lastWarnings = [message];
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 100);
          continue;
        }
        return { warnings: lastWarnings };
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        const retryAfterSeconds = response.headers.get("retry-after");
        lastWarnings = [
          response.status === 429
            ? `DOAJ rate limit reached.${retryAfterSeconds ? ` Retry after ${retryAfterSeconds} seconds.` : ""}`
            : `DOAJ API returned HTTP ${response.status}.`
        ];
        if (attempt < MAX_RETRIES) {
          await sleep(retryAfterMs ?? BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 100);
          continue;
        }
        return { warnings: lastWarnings };
      }

      if (!response.ok) {
        return { warnings: [`DOAJ API returned HTTP ${response.status}.`] };
      }

      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().includes("application/json")) {
        return { warnings: ["DOAJ returned an invalid response. Try again later."] };
      }

      let payload: unknown;
      try {
        payload = (await response.json()) as unknown;
      } catch {
        return { warnings: ["DOAJ returned an invalid response. Try again later."] };
      }

      const results = extractResults(payload);
      const records = hasResultCollection(payload) ? results : [payload];
      const total = extractTotal(payload);
      return { records, ...(total !== undefined ? { total } : {}), warnings: [] };
    }

    return { warnings: lastWarnings };
  }
}
