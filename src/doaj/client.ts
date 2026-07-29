import { createCacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import { buildDoajQuery } from "../search/text.js";
import type {
  AppConfig,
  DoajSearchResult,
  NormalizedArticle,
  NormalizedJournal
} from "../types.js";
import { extractResults, extractTotal, normalizeArticle, normalizeJournal } from "./normalize.js";

interface SearchOptions {
  page?: number;
  pageSize?: number;
}

const hasResultCollection = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  return ["results", "records", "data", "items"].some((key) => Array.isArray(record[key]));
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

  async fetchJournal(id: string): Promise<DoajSearchResult<NormalizedJournal>> {
    return this.fetchOne(`journals/${encodeURIComponent(id)}`, normalizeJournal);
  }

  async fetchArticle(id: string): Promise<DoajSearchResult<NormalizedArticle>> {
    return this.fetchOne(`articles/${encodeURIComponent(id)}`, normalizeArticle);
  }

  private async search<T>(
    path: string,
    query: string,
    options: SearchOptions,
    normalize: (record: unknown) => T
  ): Promise<DoajSearchResult<T>> {
    const boundedQuery = buildDoajQuery(query);
    const url = new URL(
      `${this.config.doajApiBaseUrl.replace(/\/$/, "")}/${path}/${encodeURIComponent(boundedQuery)}`
    );
    if (options.page) url.searchParams.set("page", String(options.page));
    if (options.pageSize) url.searchParams.set("pageSize", String(options.pageSize));
    return this.request(url, normalize);
  }

  private async fetchOne<T>(
    path: string,
    normalize: (record: unknown) => T
  ): Promise<DoajSearchResult<T>> {
    const url = new URL(`${this.config.doajApiBaseUrl.replace(/\/$/, "")}/${path}`);
    return this.request(url, (record) => normalize(record));
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

    const headers: Record<string, string> = { accept: "application/json" };
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.config.doajRequestTimeoutMs)
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? "DOAJ request timed out. Try again later."
          : "DOAJ request failed. Try again later.";
      return { records: [], warnings: [message] };
    }
    const warnings: string[] = [];
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      warnings.push(
        `DOAJ rate limit reached.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ""}`
      );
    }
    if (!response.ok) {
      return { records: [], warnings: [...warnings, `DOAJ API returned HTTP ${response.status}.`] };
    }

    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      return {
        records: [],
        warnings: ["DOAJ returned an invalid response. Try again later."]
      };
    }

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      return {
        records: [],
        warnings: ["DOAJ returned an invalid response. Try again later."]
      };
    }
    const results = extractResults(payload);
    const sourceRecords = hasResultCollection(payload) ? results : [payload];
    const total = extractTotal(payload);
    const result: DoajSearchResult<T> = {
      records: sourceRecords.map(normalize),
      warnings
    };
    if (total !== undefined) result.total = total;

    if (this.config.enableCache && this.cache) {
      try {
        await this.cache.set(key, result, {
          ttlSeconds: this.config.cacheTtlSeconds,
          source: "doaj-api",
          payloadVersion: 1
        });
      } catch {
        // Cache availability must not affect discovery.
      }
    }
    return result;
  }
}
