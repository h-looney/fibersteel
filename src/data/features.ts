/**
 * Parts of the public site that FiberSteel mode can switch on and off.
 *
 * `features` holds what the site is built with. In production, flipping a switch in FiberSteel mode (Website →
 * Installs, or Settings → Website) would save it here and redeploy: a switched-off part isn't built at all. In this
 * concept the switch is kept in the visitor's own browser (localStorage, FEATURES_KEY) and the pages hide switched-off
 * parts there: an inline script in BaseLayout sets <html data-installs="on|off"> before the page draws, and
 * global.css hides
 *   [data-feature="installs"]       when it's off, and
 *   [data-feature-off="installs"]   when it's on (what shows instead).
 */
export type FeatureId = 'installs';

export const FEATURES_KEY = 'fs-site-features';

export const features: Record<FeatureId, boolean> = {
  /** Lifts we've installed: the installs showcase (src/data/installs.ts) */
  installs: true,
};

export const featureLabels: Record<FeatureId, string> = {
  installs: "Lifts we've installed",
};
