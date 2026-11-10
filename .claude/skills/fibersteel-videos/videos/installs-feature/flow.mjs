// "Lifts we've installed": the showcase on the public site, posting one from a finished job in FiberSteel mode, and the
// on/off switch. No imports: the kit loads this file from a work folder. bin/fibersteel-video.sh sets
// FS_VIDEO_BASE_URL and FS_VIDEO_REPO.
const base = process.env.FS_VIDEO_BASE_URL ?? 'http://127.0.0.1:4398';
const repo = process.env.FS_VIDEO_REPO ?? process.cwd();
/** The photo "taken at the walk-through": a stand-in from FiberSteel's own photos on the site, matched to the boat */
const photoFor = (boat) => {
  const b = boat.toLowerCase();
  const file = /pontoon|toon/.test(b)
    ? 'pontoon/6800-flat-deck.jpg'
    : /watercraft|pwc/.test(b)
      ? 'pwc/single-pwc.jpg'
      : /cruiser|yacht/.test(b)
        ? 'large/16000-straight-pull-in.jpg'
        : /cuddy|performance|center console/.test(b)
          ? 'performance/14000-back-in-offset.jpg'
          : 'vbottom/10000-lift.jpg';
  return `${repo}/src/assets/photos/${file}`;
};

/** The demo's Public/FiberSteel mode pill isn't part of the real site, and covers the bottom-left corner: hide it */
const HIDE_DEMO_PILL = '.mode-switch{display:none!important}';

/** Smooth-scroll the window so the index-th match sits `offset` px from the top (FiberSteel mode scrolls the window) */
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

const field = (page, label, tag = 'input') => page.locator('.install-editor label.field', { hasText: label }).locator(tag);

export default {
  baseURL: base,
  start: '/fibersteel/installs/',
  viewport: { width: 1600, height: 900 },
  // Signed in as Dean (full access), off camera; the demo data is generated fresh in this browser first
  login: async ({ page }) => {
    await page.goto(`${base}/fibersteel/robots.txt`);
    await page.evaluate(() =>
      localStorage.setItem('fs-office-ui', JSON.stringify({ signedIn: true, userId: 'dean', store: 'all', jobsView: 'board', range: '90d', welcomeDismissed: true, tried: [] })),
    );
    await page.goto(`${base}/fibersteel/office/website/`);
    await page.waitForSelector('.installs-tab', { timeout: 60000 });
  },
  ready: async ({ page }) => {
    await page.context().addInitScript((css) => {
      const add = () => document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
      if (document.head) add();
      else document.addEventListener('DOMContentLoaded', add);
    }, HIDE_DEMO_PILL);
    await page.addStyleTag({ content: HIDE_DEMO_PILL });
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
    'over-time': async ({ page, hover }) => {
      await go(page, '/installs/', '.install-grid__item');
      await scrollTo(page, '[data-install-cards]', 150, 1100);
      await hover('.install-card >> nth=2');
    },
    'fs-mode': async ({ page, hover, pause }) => {
      await go(page, '/office/website/', '.installs-tab');
      // "…uploaded and managed by FiberSteel's staff": the switch card, then "Post an install"
      await hover('.showcase-card');
      await pause(0.8);
      await scrollTo(page, '.install-jobs', 220, 1100);
      // "…recently finished install jobs, ready to post"
      await hover('.install-jobs__row >> nth=0');
    },
    'from-job': async ({ page, click }) => {
      await click(page.locator('.install-jobs__row').first().locator('button', { hasText: 'Post it' }), { after: 1 });
      await page.waitForSelector('.install-editor');
      await page.waitForTimeout(400);
      await scrollTo(page, '.install-editor .card', 90, 1400, 1);
    },
    write: async ({ page, type }) => {
      const summary = field(page, 'One-line summary');
      await summary.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await type(summary, 'A lift set up for the way this boat docks, with the bunks set for its hull.', { delay: 16, after: 0.1 });
    },
    story: async ({ page, type }) => {
      const story = field(page, 'The job, in a few lines', 'textarea');
      await type(story, 'The owners wanted the boat out of the water between weekends. The crew set the bunks for the hull and walked them through the blower controls.', { delay: 9, after: 0.1 });
    },
    photo: async ({ page, type }) => {
      await scrollTo(page, '.install-editor .photo-drop', 160, 900);
      const boat = await field(page, 'The boat').inputValue();
      await page.setInputFiles('.install-editor input[type=file]', photoFor(boat));
      await page.waitForSelector('.install-editor .photo-row img', { timeout: 20000 });
      await page.waitForTimeout(600);
      const alt = page.locator('.install-editor .photo-row input.input').first();
      await alt.fill('');
      await type(alt, 'The finished lift in its slip, with the bunks set for the boat', { delay: 18 });
    },
    consent: async ({ page, click }) => {
      await scrollTo(page, '.install-publish', 200, 900);
      await click(page.locator('.install-publish .switch-row', { hasText: 'Feature it on the home page' }).locator('button'), { after: 0.6 });
      await click('.install-consent .check', { after: 0.8 });
    },
    publish: async ({ page, click }) => {
      await click(page.locator('.listing-editor__foot button', { hasText: 'Save install' }), { after: 1.2 });
      await page.waitForSelector('.web-pending');
      await click(page.locator('.web-pending button', { hasText: 'Publish now' }), { after: 1.4 });
      // The simulated publish writes to this browser's storage: let it finish before leaving the page
      await page.waitForSelector('.web-pending', { state: 'detached' });
      await page.waitForTimeout(800);
    },
    'on-site': async ({ page, hover }) => {
      await go(page, '/installs/', '.install-grid__item[data-preview] img');
      await scrollTo(page, '[data-install-cards]', 150, 1100);
      await hover('.install-grid__item[data-preview] .install-card');
      await page.waitForTimeout(700);
      await go(page, '/', '[data-install-grid="featured"] .install-grid__item[data-preview] img');
      await scrollTo(page, '[data-install-grid="featured"]', 260, 1200);
      await hover('[data-install-grid="featured"] .install-grid__item[data-preview] .install-card');
    },
    'switch-off': async ({ page, click }) => {
      await go(page, '/office/website/', '.showcase-card');
      await page.waitForTimeout(600);
      const sw = page.locator('.showcase-card button[role="switch"]');
      if ((await sw.getAttribute('aria-checked')) === 'true') await click(sw, { after: 1.4 });
      await page.waitForTimeout(400);
    },
    'off-site': async ({ page, hover }) => {
      await go(page, '/lifts/large-boats-cruisers/', 'h1');
      await page.waitForTimeout(900);
      await scrollTo(page, '#sizes', 110, 1300);
      await scrollTo(page, 'body', 0, 900);
      await hover('.primary-nav');
    },
    'switch-on': async ({ page, click }) => {
      await go(page, '/office/website/', '.showcase-card');
      const sw = page.locator('.showcase-card button[role="switch"]');
      if ((await sw.getAttribute('aria-checked')) !== 'true') await click(sw, { after: 0.5 });
      await go(page, '/installs/', '.install-grid__item');
      await page.waitForTimeout(300);
    },
  },
};
