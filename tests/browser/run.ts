/**
 * Browser tests — `npm run test:browser` (after `npm run build -- --site https://h-looney.github.io --base /fibersteel`).
 *
 * Serves the build under /fibersteel like GitHub Pages and drives headless Chromium (Playwright's own, or CHROME_PATH —
 * see harness.ts):
 *   - every public page: axe-clean at 1440 px and 390 px, no console errors, no sideways scroll on a phone, and no
 *     request to anyone else's server until the visitor asks (maps, videos)
 *   - the lift size calculator and its hand-off to the quote form; the quote form's steps, checks and confirmation
 *   - the other forms (service, warranty registration, dealer inquiry, contact), each saying nothing was sent
 *   - installs filters, and what hides when the showcase is switched off; the dealer locator (state filter, distance sort)
 *   - old GoDaddy addresses redirect; the photo viewer and the phone menu and call sheet work by keyboard and touch
 *
 * No request leaves the machine: external navigations and assets are stubbed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, axe, closeBrowser, goto, launch, noSideScroll, open, results, sleep, test } from './harness.ts';
import { serve } from './server.ts';

const DIST = process.env.DIST ?? 'dist';
assert(existsSync(join(DIST, 'index.html')) && readFileSync(join(DIST, 'index.html'), 'utf8').includes('/fibersteel/favicon.svg'), `Build ${DIST}/ first with --base /fibersteel`);

const PORT = Number(process.env.TEST_PORT ?? 4517);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const url = (p: string) => `${ORIGIN}/fibersteel${p}`;

const PUBLIC_PAGES = [
  '/',
  '/lifts/',
  '/lifts/pwc/',
  '/lifts/v-bottom-cat-hull/',
  '/lifts/pontoons-tri-toons/',
  '/lifts/performance-cruisers/',
  '/lifts/large-boats-cruisers/',
  '/lifts/front-mounted/',
  '/lifts/shallow-water/',
  '/lifts/sizes/',
  '/quote/',
  '/installs/',
  '/installs/chris-craft-24000-back-in/',
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
  '/does-not-exist/',
];

const server = await serve(DIST, '/fibersteel', PORT);
await launch();
console.log(`Browser tests against ${DIST}/ at ${ORIGIN}/fibersteel/`);

/* ---------- Every page ---------- */

for (const width of [1440, 390]) {
  await test(`every public page at ${width} px: axe-clean, no console errors${width === 390 ? ', no sideways scroll' : ''}, no third-party requests on load`, async () => {
    const t = await open({ width, label: `${width}px` });
    try {
      for (const p of PUBLIC_PAGES) {
        await goto(t.page, url(p));
        await axe(t.page, `${p} at ${width}px`);
        if (width === 390) await noSideScroll(t.page, p);
        assert(t.external.length === 0, `${p} requested other servers on load: ${t.external.slice(0, 4).join(', ')}`);
      }
      assert(t.errors.length === 0, `console errors:\n${t.errors.join('\n')}`);
    } finally {
      await t.page.close();
    }
  });
}

await test('every page has exactly one main landmark, a skip link and the open/closed status', async () => {
  const t = await open();
  for (const p of ['/', '/lifts/sizes/', '/quote/', '/dealers/']) {
    await goto(t.page, url(p));
    const r = await t.page.evaluate(() => ({
      main: document.querySelectorAll('main').length,
      skip: !!document.querySelector('a.skip-link[href="#main"]'),
      status: document.querySelector('[data-open-status] .status__text')?.textContent ?? '',
      state: (document.querySelector('[data-open-status]') as HTMLElement | null)?.dataset.state ?? '',
    }));
    assert(r.main === 1 && r.skip, `${p}: landmarks`);
    assert(['open', 'closed', 'appointment'].includes(r.state) && /Open now|Closing soon|Closed|By appointment/.test(r.status), `${p}: status "${r.status}"`);
  }
  await t.page.close();
});

/* ---------- Lift size calculator → quote ---------- */

await test('the calculator works out FiberSteel’s formula and hands the numbers to the quote form', async () => {
  const t = await open();
  const { page } = t;
  await goto(page, url('/lifts/sizes/'));
  await page.type('#calculator input[name="dry"]', '4200');
  await page.type('#calculator input[name="fuel"]', '50');
  await page.type('#calculator input[name="length"]', '24');
  const out = await page.$eval('#calculator', (el) => ({
    math: el.querySelector('[data-calc-math]')?.textContent ?? '',
    size: el.querySelector('[data-calc-size]')?.textContent ?? '',
    href: (el.querySelector('[data-calc-quote]') as HTMLAnchorElement).href,
  }));
  assert(out.math.includes('= 6,550 lb'), `math: ${out.math}`);
  assert(out.size === '6,800 lb lift', `size: ${out.size}`);
  assert(/\/quote\/\?dry=4200&fuel=50&length=24$/.test(out.href), out.href);
  // Over 30 ft: 3,000 lb
  await page.$eval('#calculator input[name="length"]', (el) => ((el as HTMLInputElement).value = ''));
  await page.type('#calculator input[name="length"]', '32');
  assert((await page.$eval('#calculator [data-calc-math]', (e) => e.textContent ?? '')).includes('3,000 lb for a boat over 30 ft'), 'over-30 allowance');
  // PWC
  await page.click('#calculator input[value="pwc"]');
  assert(await page.$eval('#calculator [data-calc-pwc]', (e) => !(e as HTMLElement).hidden), 'PWC options show');
  // Hand-off
  await page.click('#calculator input[value="boat"]');
  await goto(page, out.href);
  const q = await page.evaluate(() => ({
    dry: (document.querySelector('input[name="dryWeight"]') as HTMLInputElement).value,
    note: !(document.querySelector('[data-from-calc]') as HTMLElement).hidden,
    estimate: document.querySelector('[data-estimate-size]')?.textContent ?? '',
    boat: (document.querySelector('input[name="boatType"]:checked') as HTMLInputElement | null)?.value,
  }));
  assert(q.dry === '4200' && q.note && q.estimate.includes('6,800 lb lift') && q.boat === 'v-bottom', JSON.stringify(q));
  await page.close();
});

/* ---------- The quote form ---------- */

await test('quote form: checks each step, needs a phone or an email, then confirms (and says the demo sent nothing)', async () => {
  const t = await open();
  const { page } = t;
  await goto(page, url('/quote/?type=pontoon'));
  // ?type=pontoon pre-selects the boat
  assert(await page.$eval('input[name="boatType"][value="pontoon"]', (e) => (e as HTMLInputElement).checked), 'pontoon pre-selected');
  await page.click('input[name="boatType"][value="v-bottom"]');
  await page.type('input[name="brand"]', 'Sample Boats');
  await page.type('input[name="length"]', '22');
  await page.type('input[name="dryWeight"]', '3000');
  assert((await page.$eval('[data-estimate-size]', (e) => e.textContent ?? '')).includes('6,800 lb lift'), 'live estimate');
  await page.click('[data-panel="0"] [data-next]');
  await page.waitForSelector('[data-panel="1"]:not([hidden])');
  await page.type('input[name="slipWidth"]', '12');
  await page.type('input[name="slipLength"]', '28');
  await page.click('input[name="water"][value="shallow"]');
  assert(await page.$eval('[data-shallow-note]', (e) => !(e as HTMLElement).hidden), 'shallow note');
  await page.select('select[name="area"]', 'other');
  assert(await page.$eval('[data-area-note]', (e) => !(e as HTMLElement).hidden), 'dealer note');
  await page.click('[data-panel="1"] [data-next]');
  await page.waitForSelector('[data-panel="2"]:not([hidden])');
  // Name, but neither phone nor email: refused
  await page.type('input[name="name"]', 'Jordan Example');
  await page.click('[data-submit]');
  await sleep(200);
  assert(await page.$eval('input[name="email"]', (e) => e.getAttribute('aria-invalid') === 'true'), 'phone-or-email check');
  await page.type('input[name="email"]', 'jordan@example.com');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-done]:not([hidden])', { timeout: 10_000 });
  const done = await page.evaluate(() => ({
    title: document.querySelector('[data-done-title]')?.textContent,
    summary: document.querySelector('[data-summary]')?.textContent ?? '',
    text: document.querySelector('[data-done]')?.textContent?.replace(/\s+/g, ' ') ?? '',
    note: (document.querySelector('[data-demo-note]') as HTMLElement).hidden ? '' : document.querySelector('[data-demo-note]')?.textContent?.replace(/\s+/g, ' ') ?? '',
    links: [...document.querySelectorAll('[data-done] a')].map((a) => a.getAttribute('href')),
  }));
  assert(done.title === 'Thank you, Jordan!', `title: ${done.title}`);
  assert(done.summary.includes('Sample Boats') && done.summary.includes('12 × 28 ft'), done.summary);
  assert(/Call us at \(573\) 346-3088/.test(done.text), `confirmation: ${done.text}`);
  assert(/nothing was sent/.test(done.note) && /emailed to the address FiberSteel chooses/.test(done.note), `demo note: ${done.note}`);
  assert(done.links.every((h) => !/office/.test(h ?? '')), `links: ${done.links}`);
  assert(t.external.length === 0, `the form sent something: ${t.external.join(', ')}`);
  await axe(page, 'quote confirmation');
  await page.close();
});

/* ---------- The other forms ---------- */

await test('service, warranty, dealer and contact forms check their fields and confirm', async () => {
  const t = await open();
  const { page } = t;
  const demoNote = () => page.$eval('[data-demo-note]', (e) => !(e as HTMLElement).hidden && /nothing was sent/.test(e.textContent ?? ''));
  await goto(page, url('/service/'));
  await page.click('[data-submit]');
  await sleep(150);
  assert(await page.$eval('[data-required-group]:has(input[name="problem"])', (e) => 'invalid' in (e as HTMLElement).dataset), 'a problem is required');
  await page.click('input[name="problem"][value="wont-raise"]');
  await page.type('textarea[name="description"]', 'The lift raises slowly on one side.');
  await page.type('input[name="location"]', 'Gravois arm');
  await page.type('input[name="name"]', 'Avery Example');
  await page.type('input[name="phone"]', '573-555-0142');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-done]:not([hidden])', { timeout: 10_000 });
  assert((await page.$eval('[data-done-title]', (e) => e.textContent)) === 'Thank you, Avery!', 'service done');
  assert(await demoNote(), 'service: demo note');

  await goto(page, url('/warranty/register/'));
  await page.select('select[name="liftSize"]', '10000');
  await page.$eval('input[name="installDate"]', (e) => ((e as HTMLInputElement).value = '2026-05-15'));
  await page.type('input[name="location"]', 'Linn Creek');
  await page.type('input[name="name"]', 'Casey Example');
  await page.type('input[name="email"]', 'casey@example.com');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-done]:not([hidden])', { timeout: 10_000 });
  assert((await page.$eval('[data-done-title]', (e) => e.textContent)) === 'You’re registered, Casey!', 'warranty done');
  assert(await demoNote(), 'warranty: demo note');

  await goto(page, url('/dealers/become-a-dealer/'));
  await page.type('input[name="business"]', 'Sample Marina');
  await page.type('input[name="name"]', 'Riley Example');
  await page.type('input[name="email"]', 'riley@example.com');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-done]:not([hidden])', { timeout: 10_000 });
  assert(await demoNote(), 'dealer: demo note');

  await goto(page, url('/contact/'));
  await page.type('input[name="name"]', 'Sam Example');
  await page.type('input[name="email"]', 'sam@example.com');
  await page.type('textarea[name="message"]', 'Do you have a used 8,000 lb lift?');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-done]:not([hidden])', { timeout: 10_000 });
  assert(await demoNote(), 'contact: demo note');

  assert(t.external.length === 0, `a form sent something: ${t.external.join(', ')}`);
  assert(t.errors.length === 0, t.errors.join('\n'));
  await page.close();
});

/* ---------- Installs ---------- */

await test('installs: filters, ?kind= opens on one, and what hides when the showcase is switched off', async () => {
  const t = await open();
  const { page } = t;
  await goto(page, url('/installs/'));
  const total = await page.$$eval('.install-grid__item', (els) => els.length);
  await page.click('[data-filter="kind"][data-value="pontoon"]');
  const shown = await page.$$eval('.install-grid__item:not([hidden])', (els) => els.map((e) => (e as HTMLElement).dataset.kind));
  assert(shown.length >= 1 && shown.every((k) => k === 'pontoon') && shown.length < total, `shown: ${shown}`);
  assert(page.url().includes('kind=pontoon'), 'URL keeps the filter');
  await goto(page, url('/installs/?docking=Back-in'));
  const docking = await page.$$eval('.install-grid__item:not([hidden])', (els) => els.map((e) => (e as HTMLElement).dataset.docking));
  assert(docking.length >= 1 && docking.every((d) => d === 'Back-in'), `docking: ${docking}`);
  // Every card says it's a sample
  assert(await page.$$eval('.install-card', (cards) => cards.every((c) => /Sample install/.test(c.textContent ?? ''))), 'sample flags');
  // Built with the showcase on (src/data/features.ts); built with it off, <html data-installs="off"> hides it
  await goto(page, url('/'));
  assert((await page.evaluate(() => document.documentElement.dataset.installs)) === 'on', 'built with installs on');
  const off = await page.evaluate(() => {
    document.documentElement.dataset.installs = 'off';
    return {
      section: getComputedStyle(document.querySelector('#installs')!).display,
      nav: getComputedStyle(document.querySelector('.primary-nav [data-feature="installs"]')!).display,
    };
  });
  assert(off.section === 'none' && off.nav === 'none', JSON.stringify(off));
  await goto(page, url('/installs/'));
  assert(await page.$eval('.feature-off', (e) => getComputedStyle(e).display === 'none'), 'no notice while on');
  const notice = await page.evaluate(() => {
    document.documentElement.dataset.installs = 'off';
    const e = document.querySelector<HTMLElement>('.feature-off')!;
    return getComputedStyle(e).display !== 'none' ? e.textContent?.replace(/\s+/g, ' ').trim() ?? '' : '';
  });
  assert(/isn’t on the site right now/.test(notice) && /call us/.test(notice), `switched-off notice: ${notice}`);
  await page.close();
});

/* ---------- Dealers ---------- */

await test('dealer locator: state filter, and sort by distance (computed in the browser)', async () => {
  const t = await open();
  const { page } = t;
  await page.browserContext().setPermission(ORIGIN, { permission: { name: 'geolocation' }, state: 'granted' });
  await goto(page, url('/dealers/'));
  await page.click('[data-state="IA"]');
  const iowa = await page.$$eval('[data-dealer]:not([hidden])', (els) => els.map((e) => (e as HTMLElement).dataset.state));
  assert(iowa.length >= 2 && iowa.filter((s) => s !== 'MO').every((s) => s === 'IA'), `Iowa: ${iowa}`);
  assert(page.url().includes('state=IA'), 'URL keeps the state');
  await page.click('[data-state="all"]');
  // From Findlay, Illinois: Findlay Marina first
  await page.setGeolocation({ latitude: 39.52, longitude: -88.75 });
  await page.click('[data-near-me]');
  await page.waitForFunction(() => !(document.querySelector('[data-dist]') as HTMLElement).hidden, { timeout: 10_000 });
  const first = await page.$eval('[data-dealer-list] > li', (e) => (e as HTMLElement).dataset.dealer);
  assert(first === 'findlay-marina', `nearest: ${first}`);
  assert(t.external.length === 0, `the location left the browser: ${t.external.join(', ')}`);
  await page.close();
});

/* ---------- Old addresses, photo viewer, phone menus ---------- */

await test('old GoDaddy addresses land on their new pages', async () => {
  const t = await open();
  for (const [from, to] of [
    ['/pwc-lifts/', '/fibersteel/lifts/pwc/'],
    ['/v-bottom-%26-cat-hull-1/', '/fibersteel/lifts/v-bottom-cat-hull/'],
    ['/remote-control-blowers-1/', '/fibersteel/remotes/'],
    ['/dock-steps-1/', '/fibersteel/dock-steps/'],
    ['/contact-us', '/fibersteel/contact/'],
  ]) {
    await goto(t.page, url(from));
    await t.page.waitForFunction((p) => location.pathname === p, { timeout: 10_000 }, to);
  }
  await t.page.close();
});

await test('photo viewer opens a larger photo, moves with the arrow keys and returns focus on Escape', async () => {
  const t = await open();
  const { page } = t;
  await goto(page, url('/lifts/pwc/'));
  const first = '#gallery [data-full]';
  await page.focus(first);
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-photo-viewer][open]');
  const a = await page.$eval('[data-viewer-count]', (e) => e.textContent);
  await page.keyboard.press('ArrowRight');
  const b = await page.$eval('[data-viewer-count]', (e) => e.textContent);
  assert(a?.startsWith('1 of') && b?.startsWith('2 of'), `${a} → ${b}`);
  await axe(page, 'photo viewer');
  await page.keyboard.press('Escape');
  await sleep(150);
  assert(await page.evaluate((s) => document.activeElement === document.querySelector(s), first), 'focus returns to the photo');
  await page.close();
});

await test('on a phone: the menu drawer and the call sheet open, and calling offers both lines', async () => {
  const t = await open({ width: 390 });
  const { page } = t;
  await goto(page, url('/'));
  await page.click('[data-drawer-open]');
  await page.waitForSelector('#site-drawer[open]');
  await axe(page, 'open drawer');
  await page.click('[data-drawer-close]');
  await page.click('[popovertarget="call-sheet"]');
  await page.waitForSelector('#call-sheet:popover-open');
  const lines = await page.$$eval('#call-sheet a[href^="tel:"]', (as) => as.map((a) => a.getAttribute('href')));
  assert(JSON.stringify(lines) === JSON.stringify(['tel:+15733463088', 'tel:+15733469688']), `lines: ${lines}`);
  await page.close();
});

await test('videos and the map load only when asked', async () => {
  const t = await open();
  const { page } = t;
  await goto(page, url('/contact/'));
  assert(!(await page.$('iframe')), 'no map iframe before asking');
  await page.click('[data-lazy-map] button');
  await page.waitForSelector('[data-lazy-map] iframe');
  await goto(page, url('/about/'));
  assert(!(await page.$('iframe')), 'no video iframe before asking');
  await page.click('[data-lite-video] .lite-video__play');
  await page.waitForSelector('[data-lite-video] iframe[src*="youtube-nocookie.com"]');
  await page.close();
});

await closeBrowser();
server.close();

console.log(`\n${results.passed.length} passed, ${results.failed.length} failed`);
if (results.failed.length) {
  for (const f of results.failed) console.log(`  ✗ ${f.name}\n      ${f.error.split('\n').join('\n      ')}`);
  process.exit(1);
}
