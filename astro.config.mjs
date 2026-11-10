// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Used for canonical URLs, Open Graph tags and structured data. Preview hosts override it (and `base`)
  // with CLI flags, e.g. GitHub Pages: npm run build -- --site https://<user>.github.io --base /<repo>
  site: 'https://lakeboatlifts.com',
  trailingSlash: 'ignore',
  // No UI framework: the pages ship only their own small scripts.
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
