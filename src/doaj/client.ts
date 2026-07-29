import { createCacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import type { AppConfig, DoajSearchResult, NormalizedArticle, NormalizedJournal } from "../types.js";
import { extractResults, extractTotal, normalizeArticle, normalizeJournal } from "./normalize.js";

interface SearchOptions {
  page?: number;
  pageSize?: number;
}

export class DoajClient {
  constructor(
    private readonly config: AppConfig,
    private readonly cache?: CacheStore
  ) {}

  searchJournals(query: string, options: SearchOptions = {}): Promise<DoajSearchResult<NormalizedJournal>> {
    return this.search("search/journals", query, options, normalizeJournal);
  }

  searchArticles(query: string, options: SearchOptions = {}): Promise<DoajSearchResult<NormalizedArticle>> {
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
    const url = new URL(`${this.config.doajApiBaseUrl.replace(/\/$/, "")}/${path}/${encodeURIComponent(query)}`);
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

  private async request<T>(url: URL, normalize: (record: unknown) => T): Promise<DoajSearchResult<T>> {
    const key = createCacheKey("doaj-api", url.toString());
    if (this.config.enableCache && this.cache) {
      const cached = await this.cache.get<DoajSearchResult<T>>(key);
      if (cached) return cached.payload;
    }

    const headers: Record<string, string> = { accept: "application/json" };
    if (this.config.doajApiKey) headers.authorization = `Bearer ${this.config.doajApiKey}`;

    const response = await fetch(url, { headers });
    const warnings: string[] = [];
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      warnings.push(`DOAJ rate limit reached.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ""}`);
    }
    if (!response.ok) {
      return { records: [], warnings: [...warnings, `DOAJ API returned HTTP ${response.status}.`] };
    }

    const payload = (await response.json()) as unknown;
    const results = extractResults(payload);
    const sourceRecords = results.length > 0 ? results : [payload];
    const total = extractTotal(payload);
    const result: DoajSearchResult<T> = {
      records: sourceRecords.map(normalize),
      warnings
    };
    if (total !== undefined) result.total = total;

    if (this.config.enableCache && this.cache) {
      await this.cache.set(key, result, {
        ttlSeconds: this.config.cacheTtlSeconds,
        source: "doaj-api",
        payloadVersion: 1
      });
    }
    return result;
  }
}
