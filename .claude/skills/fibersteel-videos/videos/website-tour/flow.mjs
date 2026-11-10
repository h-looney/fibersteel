// The public website: the lift and quote path first, then the pages owners know from the current site. Recorded
// against a local build (or --live). No imports: the kit loads this file from a work folder. FS_VIDEO_BASE_URL is set
// by bin/fibersteel-video.sh. Nothing that leaves the concept site is ever clicked (dealer sites, the Vrbo listing,
// Google Maps, tel: and mailto: links) — the flow points at them instead.
const base = process.env.FS_VIDEO_BASE_URL ?? 'http://127.0.0.1:4398';

/** The note after a form is sent ("Concept demo: nothing was sent…") isn't part of the real site, which emails each
 *  request to the address FiberSteel chooses (and the narration says so): hide it */
const HIDE_DEMO_EXTRAS = '[data-demo-note]{display:none!important}';

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

/** Navigate and wait for the page to settle (reveal animations need a moment) */
async function go(page, path, ready) {
  await page.goto(`${base}/fibersteel${path}`, { waitUntil: 'load' });
  if (ready) await page.waitForSelector(ready, { timeout: 30000 });
  await page.waitForTimeout(500);
}

const menu = (page, label) => page.locator('.primary-nav [data-nav-trigger]', { hasText: label });

export default {
  baseURL: base,
  start: '/fibersteel/',
  viewport: { width: 1600, height: 900 },
  ready: async ({ page }) => {
    await page.context().addInitScript((css) => {
      const add = () => document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
      if (document.head) add();
      else document.addEventListener('DOMContentLoaded', add);
    }, HIDE_DEMO_EXTRAS);
    await page.addStyleTag({ content: HIDE_DEMO_EXTRAS });
    await page.waitForSelector('.hero');
  },
  scenes: {
    home: async ({ page, pause, hover }) => {
      await pause(1.2);
      // Both lines and the open/closed status, in the top bar
      await hover(page.locator('.topbar__phone').first());
      await pause(1.2);
      await hover('.hero .btn--sun');
      await pause(1);
    },
    'boat-types': async ({ page, hover }) => {
      await scrollTo(page, '#lifts', 90, 1600);
      await hover('#lifts a[href$="/lifts/pwc/"]');
      await page.waitForTimeout(700);
      await hover('#lifts a[href$="/lifts/pontoons-tri-toons/"]');
    },
    'lift-type': async ({ page, click }) => {
      await click('#lifts a[href$="/lifts/pontoons-tri-toons/"]', { after: 0.6 });
      await page.waitForSelector('#sizes');
      await page.waitForTimeout(1100);
      await scrollTo(page, '#sizes', 90, 1600);
      await scrollTo(page, '#options', 90, 1600);
    },
    sizes: async ({ page }) => {
      await go(page, '/lifts/sizes/', '#sizes');
      await page.waitForTimeout(400);
      await scrollTo(page, '#sizes', 90, 1300);
      // The bigger lifts: their arms, axles and poly tanks
      await scrollTo(page, '#size-10000', 140, 1600);
    },
    calculator: async ({ page, type, hover }) => {
      await scrollTo(page, '#calculator', 90, 1100);
      await type('#calculator input[name="dry"]', '4200', { delay: 60 });
      await type('#calculator input[name="fuel"]', '50', { delay: 60 });
      await type('#calculator input[name="length"]', '24', { delay: 60, after: 0.4 });
      await hover('#calculator [data-calc-math]');
      await page.waitForTimeout(900);
      await hover('#calculator [data-calc-size]');
    },
    quote: async ({ page, click, hover }) => {
      await click('#calculator [data-calc-quote]', { after: 0.6 });
      await page.waitForSelector('[data-from-calc]:not([hidden])', { timeout: 15000 });
      await scrollTo(page, '[data-panel="0"]', 170, 900);
      await hover('[data-from-calc]');
      await page.waitForTimeout(700);
      await click('label:has(input[name="boatType"][value="v-bottom"])', { after: 0.4 });
    },
    slip: async ({ page, click, type }) => {
      await click('[data-panel="0"] [data-next]', { after: 0.4 });
      await page.waitForSelector('[data-panel="1"]:not([hidden])');
      await type('[data-panel="1"] input[name="slipWidth"]', '12', { delay: 60 });
      await type('[data-panel="1"] input[name="slipLength"]', '28', { delay: 60 });
      await click('label:has(input[name="docking"][value="straight"])', { after: 0.3 });
    },
    contact: async ({ page, click, type }) => {
      await click('[data-panel="1"] [data-next]', { after: 0.3 });
      await page.waitForSelector('[data-panel="2"]:not([hidden])');
      await type('[data-panel="2"] input[name="name"]', 'Jordan Example', { delay: 18, after: 0.1 });
      await type('[data-panel="2"] input[name="email"]', 'jordan@example.com', { delay: 15, after: 0.2 });
    },
    sent: async ({ page, click, hover }) => {
      await click('[data-submit]', { after: 1 });
      await page.waitForSelector('[data-done]:not([hidden])');
      await hover('[data-done-title]');
    },
    // The rest of the site: the same topics as FiberSteel's current one, modernized
    familiar: async ({ page, hover, pause }) => {
      await scrollTo(page, 'body', 0, 600);
      await hover(menu(page, 'Owners'));
      await pause(1.1);
      await hover(menu(page, 'Dealers'));
      await pause(1.1);
      await hover(menu(page, 'About'));
      await pause(0.8);
    },
    remotes: async ({ page, hover }) => {
      await go(page, '/remotes/', 'h1');
      await page.waitForTimeout(800);
      await scrollTo(page, '.remotes__prices', 140, 1500);
      await hover('.remotes__prices .price-table');
    },
    'dock-steps': async ({ page }) => {
      await go(page, '/dock-steps/', 'h1');
      await page.waitForTimeout(1200);
      await scrollTo(page, 'main section:nth-of-type(2)', 90, 1500);
    },
    used: async ({ page, hover }) => {
      await go(page, '/used-lifts/', 'h1');
      await page.waitForTimeout(700);
      await scrollTo(page, '.sample-note', 140, 1300);
      await hover('.sample-note');
    },
    dealers: async ({ page, click, hover }) => {
      await go(page, '/dealers/', '[data-dealer]');
      await page.waitForTimeout(600);
      await scrollTo(page, '[data-state="all"]', 160, 1000);
      await click('[data-state="IA"]', { after: 1 });
      // Dealer websites and directions are pointed at, never opened (a card, not its links)
      await hover('[data-dealer]:not([hidden]) >> nth=1');
    },
    owners: async ({ page }) => {
      await go(page, '/owners/', 'h1');
      await page.waitForTimeout(1000);
      await scrollTo(page, 'main h2', 110, 1500);
    },
    warranty: async ({ page }) => {
      await go(page, '/warranty/', 'h1');
      await page.waitForTimeout(900);
      await scrollTo(page, 'main h2', 110, 1500);
    },
    'contact-page': async ({ page, hover }) => {
      await go(page, '/contact/', 'h1');
      await page.waitForTimeout(800);
      // Google Maps opens another site: pointed at, never clicked
      await hover(page.locator('main a', { hasText: 'Get directions' }).first());
      await page.waitForTimeout(700);
      await scrollTo(page, 'main h2', 110, 1300);
    },
    'side-topics': async ({ page, hover }) => {
      await scrollTo(page, 'footer', 0, 1400);
      await hover('footer a[href$="/lake-info/"]');
      await page.waitForTimeout(500);
      await hover('footer a[href$="/lakefront-rental/"]');
      await page.waitForTimeout(500);
      await hover('footer a[href$="/e-lux-bikes/"]');
    },
    close: async ({ page, pause }) => {
      await go(page, '/');
      await pause(1);
    },
  },
};
