/**
 * Every address on the current GoDaddy site, and where it lives on the new one — so bookmarks, search results and
 * printed links keep working. Static hosts can't send server redirects, so each old address gets a tiny page
 * (src/pages/[...old].astro): a canonical link, a meta refresh and a visible link, marked noindex. On Cloudflare
 * these would become real 301 redirects in a _redirects file.
 */
export const redirects: { from: string; to: string }[] = [
  { from: '/contact-us', to: '/contact/' },
  { from: '/about-us', to: '/about/' },
  { from: '/warranty', to: '/warranty/' },
  { from: '/our-lift-sizes', to: '/lifts/sizes/' },
  { from: '/pwc-lifts', to: '/lifts/pwc/' },
  { from: '/v-bottom-%26-cat-hull-1', to: '/lifts/v-bottom-cat-hull/' },
  { from: '/pontoons-%26-tri-toons', to: '/lifts/pontoons-tri-toons/' },
  { from: '/perfomance-boats-cruisers', to: '/lifts/performance-cruisers/' },
  { from: '/large-boats-%26-cruisers', to: '/lifts/large-boats-cruisers/' },
  { from: '/front-mounted-lifts', to: '/lifts/front-mounted/' },
  { from: '/shallow-water-lifts', to: '/lifts/shallow-water/' },
  { from: '/remote-control-blowers', to: '/remotes/' },
  { from: '/remote-control-blowers-1', to: '/remotes/' },
  { from: '/blower-control-use-guide-1', to: '/owners/blower-guide/' },
  { from: '/dos-%26-donts', to: '/owners/dos-and-donts/' },
  { from: '/local-lake-info', to: '/lake-info/' },
  { from: '/lakefront-vrbo', to: '/lakefront-rental/' },
  { from: '/e-lux-bikes', to: '/e-lux-bikes/' },
  { from: '/used-lifts', to: '/used-lifts/' },
  { from: '/dealers', to: '/dealers/' },
  { from: '/dock-steps-1', to: '/dock-steps/' },
];

/** Old addresses that need their own redirect page (the ones whose new address differs) */
export const redirectPages = () =>
  redirects.filter((r) => `${decodeURIComponent(r.from)}/` !== r.to).map((r) => ({ ...r, path: decodeURIComponent(r.from).replace(/^\//, '') }));
