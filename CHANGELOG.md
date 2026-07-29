# Changelog

## Unreleased

### Added

- Brand mark: an open padlock, the conventional open-access signal, in DOAJ's published
  `--grapefruit` (`#FD5A3B`). Served at `/icon.svg` and used as the favicon, the landing-page
  header mark, and the README logo. The mark is original and geometric; it does not reproduce
  DOAJ's logo, and the independence notice is unchanged.
- `serverInfo` now advertises `icons`, `title`, `description` and `websiteUrl`, so MCP clients can
  show the icon and a summary beside the server in their connector list.

### Fixed

- `img-src 'self'` added to the content security policy. `default-src 'none'` had no image
  directive, so a favicon would have been blocked outright.

## 0.3.0-beta.1 - 2026-07-29

### Fixed

- **Queries no longer return zero results.** The DOAJ API applies an implicit `AND` across every
  space-separated term, so the previous 480-character token-joining strategy produced
  unsatisfiable queries. `recommend_doaj_journals_for_manuscript`, `find_similar_doaj_articles`,
  and `find_diamond_oa_journals` returned empty results for every realistic input.
- **Queries use progressive relaxation instead of a single strategy.** A flat `OR` of every term
  always returns something but matches millions of records, making DOAJ's own relevance ranking
  meaningless — for a cardiac-MRI abstract the top hits were papers on fish stocks and
  tribology. Searches now walk rungs from an `AND` of the leading content terms down to a broad
  `OR`, stopping at the first rung that matches, so precise results are preferred and broad
  recall is only the last resort. Stopwords are removed and Elasticsearch reserved characters
  are escaped.
- **Loose matches are labelled as such.** When only the broadest rung matched, the response says
  so, instead of presenting weakly related journals as recommendations.
- **Ranking weights term specificity.** Candidate scoring now applies inverse document frequency
  across the fetched pool, so a record matching one common term no longer outranks a record
  matching the distinctive ones.
- **`find_diamond_oa_journals` no longer poisons its own query.** It previously prefixed
  `"diamond oa no APC "` into the search terms; it now applies the `bibjson.apc.has_apc:false`
  field filter.
- **Metadata that was silently dropped is now returned.** The normalizer read paths that do not
  exist in DOAJ responses. Journal `country` (from `bibjson.publisher.country`), `publisher`,
  and `url` (from `bibjson.ref.journal`) were always missing; article `journalIssns` (from
  `bibjson.journal.issns`), `doi`, and languages were always empty.
- **Country and language ranking bonuses now apply.** DOAJ stores ISO-3166-1 alpha-2 and
  ISO-639-1 codes (`"NL"`, `"EN"`); preferences were compared against full names, so the
  bonuses never fired.
- **Filters are applied by DOAJ, not on a truncated page.** `country`, `language`, `license`, and
  `noApcOnly` are translated into DOAJ field filters, and the candidate pool fetched before
  local ranking now scales with `limit` instead of equalling it.
- Retry with exponential backoff and `Retry-After` support for `429` and `5xx` responses; a
  persistent `429` no longer reports two overlapping warnings.
- `pageSize` is clamped to the DOAJ-documented maximum of 100.

### Added

- `get_doaj_journal_by_issn` and `get_doaj_article_by_doi` tools.
- stdio transport (`npm run dev:stdio`) and a `bin` entry, for local MCP clients.
- `total`, `returned`, and the effective DOAJ query in every search tool response.
- Opt-in live DOAJ integration tests (`DOAJ_LIVE_TEST=1 npm test`) that guard against
  syntactically valid queries silently returning nothing.
- End-to-end tool-handler tests; previously only tool annotations were asserted.

### Changed

- `strict` now means "precise AND matching" instead of silently filtering to no-APC journals.
- Rate-limiter eviction is least-recently-started rather than first-inserted.
- Minimum supported Node version relaxed to 22.

## 0.2.0-beta.1 - 2026-07-29

- Published the free, unofficial Cloud Run beta with direct remote MCP onboarding.
- Bounded long DOAJ queries and isolated network, invalid-response, and optional-cache failures.
- Added strict HTTP method, media-type, body-size, rate-limit, and security-header handling.
- Fixed empty DOAJ result envelopes being normalized as fake records.
- Removed dormant semantic-search settings and unused compatibility files.
- Added verification-gated deployment, container hardening, and live smoke checks.
- Clarified privacy, client availability, cost controls, and project independence.

## 0.1.0

- Added six read-only DOAJ journal and article discovery tools.
- Added stateless Streamable HTTP MCP transport.
- Added public landing, health, and privacy routes.
- Added bounded inputs, read-only tool annotations, and in-memory rate limiting.
