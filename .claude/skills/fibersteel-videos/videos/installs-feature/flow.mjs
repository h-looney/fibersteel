// "Lifts we've installed": the showcase on the public site, its filters, an install page, the lift and home pages, and
// how the site looks while the showcase is left off. No imports: the kit loads this file from a work folder.
// bin/fibersteel-video.sh sets FS_VIDEO_BASE_URL.
const base = process.env.FS_VIDEO_BASE_URL ?? 'http://127.0.0.1:4398';

/** The forms' concept-demo note isn't part of the real site (none is opened here, but keep it hidden like the tour) */
const HIDE_DEMO_EXTRAS = '[data-demo-note]{display:none!important}';

/**
 * "The showcase can stay off": while this is true, pages are served exactly as a build with `installs: false`
 * (src/data/features.ts) marks them, <html data-installs="off">, so the site's own CSS hides the showcase.
 */
let installsOff = false;

/** Smooth-scroll the window so the index-th match sits `offset` px from the top */
async function scrollTo(page, selector, offset = 96, ms = 1100, index = 0) {
  await page.evaluate(
    ([s, o, i]) => {
      const el = document.querySelectorAll(s)[i];
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - o, behavior: 'smooth' });
    },
    [selector, offset, index],
  );
  await page.waitForTimeout(ms);
}

async function go(page, path, ready) {
  await page.goto(`${base}/fibersteel${path}`, { waitUntil: 'load' });
  if (ready) await page.waitForSelector(ready, { timeout: 30000 });
  await page.waitForTimeout(500);
}

export default {
  baseURL: base,
  start: '/fibersteel/installs/',
  viewport: { width: 1600, height: 900 },
  ready: async ({ page }) => {
    await page.context().addInitScript((css) => {
      const add = () => document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
      if (document.head) add();
      else document.addEventListener('DOMContentLoaded', add);
    }, HIDE_DEMO_EXTRAS);
    await page.addStyleTag({ content: HIDE_DEMO_EXTRAS });
    await page.route('**/*', async (route) => {
      if (!installsOff || route.request().resourceType() !== 'document') return route.continue();
      const res = await route.fetch();
      const body = (await res.text()).replace('<html lang="en" data-installs="on"', '<html lang="en" data-installs="off"');
      await route.fulfill({ response: res, body });
    });
    await page.waitForSelector('.install-grid__item');
  },
  scenes: {
    'our-installs': async ({ page, pause, hover }) => {
      await pause(1.5);
      await scrollTo(page, '[data-install-cards]', 150, 1500);
      await hover('.install-card >> nth=0');
      await pause(0.8);
      await hover('.install-card >> nth=1');
    },
    filter: async ({ click }) => {
      await click('[data-filter="kind"][data-value="pontoon"]', { after: 0.9 });
      await click('[data-filter="kind"][data-value="all"]', { after: 0.2 });
      // Left on "Back-in": the next scene opens the first back-in install
      await click('[data-filter="docking"][data-value="Back-in"]', { after: 0.6 });
    },
    install: async ({ page, click }) => {
      await click('.install-grid__item:not([hidden]) .install-card a.card__link >> nth=0', { after: 1.2 });
      await page.waitForSelector('h1');
      await page.waitForTimeout(600);
      await scrollTo(page, 'main h2', 110, 1500);
    },
    'lift-page': async ({ page }) => {
      await go(page, '/lifts/large-boats-cruisers/', '#installs');
      await page.waitForTimeout(700);
      await scrollTo(page, '#installs', 110, 1700);
    },
    'home-page': async ({ page, hover }) => {
      await go(page, '/', '#installs .install-grid__item img');
      await scrollTo(page, '#installs', 90, 1500);
      await hover('#installs .install-card >> nth=0');
    },
    'over-time': async ({ page, hover }) => {
      await go(page, '/installs/', '.install-grid__item');
      await scrollTo(page, '[data-install-cards]', 150, 1100);
      // "…shows the town, never the address": the town and month on a card
      await hover('.install-card >> nth=2');
    },
    'left-off': async ({ page, hover }) => {
      installsOff = true;
      await go(page, '/lifts/large-boats-cruisers/', 'html[data-installs="off"] h1');
      await page.waitForTimeout(2400);
      // "The lift pages simply skip it": where the installs were (after "how it's set up"), the photos come straight on
      await scrollTo(page, '#photos', 420, 2000);
      await page.waitForTimeout(2500);
      await scrollTo(page, 'body', 0, 900);
      // "…and Our installs leaves the menu"
      await hover('.primary-nav');
    },
    'back-on': async ({ page }) => {
      installsOff = false;
      await go(page, '/installs/', 'html[data-installs="on"] .install-grid__item');
      await page.waitForTimeout(300);
    },
  },
};
