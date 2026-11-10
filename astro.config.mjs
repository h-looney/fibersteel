// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  // Used for canonical URLs, Open Graph tags and structured data. Preview hosts override it (and `base`)
  // with CLI flags, e.g. GitHub Pages: npm run build -- --site https://<user>.github.io --base /<repo>
  site: 'https://lakeboatlifts.com',
  trailingSlash: 'ignore',
  // Preact powers FiberSteel mode (/office/), the optional staff demo. The public pages ship no framework JavaScript.
  integrations: [preact()],
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
