// FiberSteel mode, the optional staff demo: from the public site's mode switch through each section. Sample data is
// generated fresh in this browser. No imports: the kit loads this file from a work folder. bin/fibersteel-video.sh
// sets FS_VIDEO_BASE_URL.
const base = process.env.FS_VIDEO_BASE_URL ?? 'http://127.0.0.1:4398';

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

const top = async (page) => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(500);
};

/** A section from the sidebar, then wait for its page */
async function section(page, click, label, ready) {
  await top(page);
  await click(page.locator('.sidebar__link', { hasText: label }), { after: 0.3, zoom: false });
  if (ready) await page.waitForSelector(ready, { timeout: 30000 });
  await page.waitForTimeout(700);
}

export default {
  baseURL: base,
  start: '/fibersteel/',
  viewport: { width: 1600, height: 900 },
  // Not signed in, but the welcome card already dismissed
  login: async ({ page }) => {
    await page.goto(`${base}/fibersteel/robots.txt`);
    await page.evaluate(() =>
      localStorage.setItem('fs-office-ui', JSON.stringify({ signedIn: false, userId: 'dean', store: 'all', jobsView: 'board', range: '90d', welcomeDismissed: true, tried: [] })),
    );
  },
  ready: async ({ page }) => {
    await page.waitForSelector('.mode-switch [data-mode-office]');
  },
  scenes: {
    switch: async ({ page, click, hover, pause }) => {
      // The public site first, with the switch in its corner
      await pause(1.6);
      await hover('.mode-switch [data-mode-office]');
      await pause(1.2);
      await click('.mode-switch [data-mode-office]', { after: 0.4 });
      await page.waitForSelector('.profile-option', { timeout: 60000 });
      await page.waitForTimeout(900);
      // "It's purely a demo…": the profile picker says so too
      await hover('.signin__lead');
    },
    profiles: async ({ page, hover }) => {
      await hover(page.locator('.profile-option', { hasText: 'Jesse' }));
      await page.waitForTimeout(500);
      await hover(page.locator('.profile-option', { hasText: 'Travis' }));
      await page.waitForTimeout(500);
      await hover(page.locator('.profile-option', { hasText: 'Dean' }));
    },
    dashboard: async ({ page, click, scroll }) => {
      await click(page.locator('.profile-option', { hasText: 'Dean' }), { after: 0.4 });
      await page.waitForSelector('[data-page-title]', { timeout: 60000 });
      await page.waitForTimeout(1600);
      await scroll(450, 1.6);
      await page.waitForTimeout(800);
    },
    inbox: async ({ page, click, hover }) => {
      await section(page, click, 'Inbox', '.inbox-row');
      await hover('.inbox-row >> nth=0');
      await page.waitForTimeout(500);
      await hover('.inbox-row >> nth=1');
    },
    lead: async ({ page, click }) => {
      // The newest request: a quote straight from the website's calculator
      await click('.inbox-row >> nth=0', { after: 1.2 });
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('main *')].find((e) => e.children.length === 0 && /FiberSteel’s formula/.test(e.textContent ?? ''));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      await page.waitForTimeout(1200);
    },
    jobs: async ({ page, click }) => {
      await section(page, click, 'Jobs & schedule', '.board');
      await page.waitForTimeout(500);
      await scrollTo(page, '.board', 60, 1300);
    },
    schedule: async ({ page, click }) => {
      await top(page);
      await click(page.locator('.segmented button', { hasText: 'Schedule' }), { after: 1.8 });
    },
    // Silent: open a customer with more than one lift (their page has the most to show)
    'to-customers': async ({ page, click }) => {
      await section(page, click, 'Customers & lifts', 'tbody tr');
      const row = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].findIndex((tr) => [...tr.querySelectorAll('td')].some((td) => /^[2-9] lifts/.test(td.textContent?.trim() ?? ''))));
      await click(`tbody tr >> nth=${Math.max(0, row)}`, { after: 0.6 });
      await page.waitForSelector('#cust-tab-lifts');
    },
    customers: async ({ page, click }) => {
      await click('#cust-tab-lifts', { after: 0.6 });
      await scrollTo(page, '#cust-tab-lifts', 80, 1800);
    },
    warranty: async ({ page, click }) => {
      await section(page, click, 'Warranty', '#warranty-tab-claims');
      await page.waitForTimeout(800);
      await click('#warranty-tab-coverage', { after: 1.4 });
    },
    inventory: async ({ page, click }) => {
      await section(page, click, 'Inventory', '#inv-tab-lifts');
      await click('#inv-tab-lifts', { after: 1 });
      await scrollTo(page, '#inv-tab-lifts', 80, 1600);
    },
    dealers: async ({ page, click }) => {
      await section(page, click, 'Dealers', '#dealers-tab-orders');
      await page.waitForTimeout(900);
      await click('#dealers-tab-orders', { after: 1.4 });
    },
    accounting: async ({ page, click, scroll }) => {
      await section(page, click, 'Accounting', '[data-page-title]');
      await scroll(350, 1.3);
    },
    analytics: async ({ page, click }) => {
      await section(page, click, 'Analytics', '#report-tab-crews');
      await click('#report-tab-crews', { after: 2.2 });
      await click('#report-tab-service', { after: 1.6 });
    },
    website: async ({ page, click, hover }) => {
      await section(page, click, 'Website', '.installs-tab');
      await hover('.showcase-card');
      await page.waitForTimeout(700);
      await click('#web-tab-used', { after: 1.2 });
    },
    close: async ({ page, click }) => {
      await top(page);
      await click(page.locator('.sidebar__link', { hasText: 'Dashboard' }), { after: 0.6, zoom: false });
      await page.waitForTimeout(800);
    },
  },
};
