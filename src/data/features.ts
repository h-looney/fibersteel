/**
 * Parts of the public site that can be left out.
 *
 * Set one to false and rebuild: for `installs`, the install pages aren't built and the sitemap drops them, and
 * BaseLayout sets <html data-installs="off"> so global.css hides the links and sections that lead to them:
 *   [data-feature="installs"]       is hidden when it's off, and
 *   [data-feature-off="installs"]   is hidden when it's on (what shows instead).
 */
export type FeatureId = 'installs';

export const features: Record<FeatureId, boolean> = {
  /** Lifts we've installed: the installs showcase (src/data/installs.ts) */
  installs: true,
};

export const featureLabels: Record<FeatureId, string> = {
  installs: "Lifts we've installed",
};
