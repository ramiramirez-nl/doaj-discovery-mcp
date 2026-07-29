import type { AppConfig } from "./types.js";

const readNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const readLogLevel = (value: string | undefined): AppConfig["logLevel"] => {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") return value;
  return "info";
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const maxResultsLimit = Math.max(1, readNumber(env.MAX_RESULTS_LIMIT, 25));
  const requestedDefault = Math.max(1, readNumber(env.MAX_RESULTS_DEFAULT, 10));
  const doajApiKey = env.DOAJ_API_KEY?.trim() || undefined;
  const deploymentBaseUrl = env.DEPLOYMENT_BASE_URL?.trim() || undefined;

  return {
    port: readNumber(env.PORT, 3000),
    doajApiBaseUrl: env.DOAJ_API_BASE_URL || "https://doaj.org/api",
    ...(doajApiKey ? { doajApiKey } : {}),
    enableCache: readBoolean(env.ENABLE_CACHE, true),
    cacheDir: env.CACHE_DIR || ".cache/doaj",
    cacheTtlSeconds: Math.max(0, readNumber(env.CACHE_TTL_SECONDS, 86_400)),
    enableSemanticSearch: readBoolean(env.ENABLE_SEMANTIC_SEARCH, false),
    semanticProvider: env.SEMANTIC_PROVIDER === "local" ? "local" : "none",
    maxResultsDefault: Math.min(requestedDefault, maxResultsLimit),
    maxResultsLimit,
    logLevel: readLogLevel(env.LOG_LEVEL),
    ...(deploymentBaseUrl ? { deploymentBaseUrl } : {})
  };
};
