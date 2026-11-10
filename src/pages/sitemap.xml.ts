import type { APIRoute } from 'astro';
import { features } from '../data/features';
import { installs } from '../data/installs';
import { liftTypes, liftTypeHref } from '../data/lifts';
import { withBase } from '../scripts/url';

/** Simple XML sitemap generated at build time — no extra dependencies. Old-address redirect pages are never listed. */
export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/',
    '/lifts/',
    ...liftTypes.map((t) => liftTypeHref(t.slug)),
    '/lifts/sizes/',
    '/quote/',
    // Lifts we've installed and each install, while the showcase is switched on (src/data/features.ts)
    ...(features.installs ? ['/installs/', ...installs.map((i) => `/installs/${i.slug}/`)] : []),
    '/remotes/',
    '/dock-steps/',
    '/used-lifts/',
    '/dealers/',
    '/dealers/become-a-dealer/',
    '/owners/',
    '/service/',
    '/warranty/',
    '/warranty/register/',
    '/owners/blower-guide/',
    '/owners/dos-and-donts/',
    '/about/',
    '/contact/',
    '/lake-info/',
    '/lakefront-rental/',
    '/e-lux-bikes/',
    '/privacy/',
  ];

  const urls = paths.map((p) => `  <url><loc>${new URL(withBase(p), site).toString()}</loc></url>`).join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
