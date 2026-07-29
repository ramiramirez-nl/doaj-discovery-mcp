/**
 * Brand mark: an open padlock, the conventional signal for open access.
 *
 * The palette is taken from DOAJ's own published brand tokens (`--grapefruit: #FD5A3B`) so the
 * service reads as belonging to the open-access ecosystem. The mark itself is original and
 * geometric — it deliberately does not reproduce or imitate DOAJ's logo, and this project is not
 * affiliated with DOAJ. See the independence notice on the landing page and in the README.
 */
export const BRAND_GRAPEFRUIT = "#FD5A3B";

export const ICON_PATH = "/icon.svg";

/** Standalone icon document, served at ICON_PATH and referenced as the favicon. */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-labelledby="t">
  <title id="t">DOAJ Discovery MCP</title>
  <rect width="48" height="48" rx="11" fill="${BRAND_GRAPEFRUIT}"/>
  <path d="M18 22v-4.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <rect x="11" y="22" width="20" height="15" rx="3.6" fill="#fff"/>
</svg>
`;

/**
 * Inline variant for the page header. Inlined rather than an <img> so it needs no image request,
 * and marked aria-hidden because the adjacent <h1> already names the service.
 */
export const inlineIconMarkup = (size: number): string =>
  `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">` +
  `<rect width="48" height="48" rx="11" fill="${BRAND_GRAPEFRUIT}"/>` +
  `<path d="M18 22v-4.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` +
  `<rect x="11" y="22" width="20" height="15" rx="3.6" fill="#fff"/>` +
  `</svg>`;
