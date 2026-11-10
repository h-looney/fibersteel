/** Base path without a trailing slash: '' at the site root, '/fibersteel' when hosted in a subfolder (e.g. GitHub Pages). */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefixes a root-relative path like '/contact/' with the base path; other URLs pass through unchanged. */
export const withBase = (path: string) => (/^\/(?!\/)/.test(path) ? base + path : path);
