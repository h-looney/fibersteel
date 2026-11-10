/**
 * FiberSteel mode browser tests (run from run.ts when the build includes /office/).
 *   - the public site's "FiberSteel mode" switch opens the profile picker, which says early that it's a demo
 *   - every section loads for the full-access profile: axe-clean at 1440 and 390 px, no sideways scroll, no console
 *     errors, no third-party requests, and the demo note comes before the page itself
 *   - a crew profile starts on My day and sees only its own sections
 *   - a quote submitted on the public site arrives in the inbox, with FiberSteel's formula worked out
 */
import type { Page } from 'puppeteer-core';
import { assert, axe, goto, noSideScroll, officeReady, open, signIn, sleep, test } from './harness.ts';

/** Click the first enabled button or link (within `sel`) whose text includes `text` */
async function clickText(page: Page, text: string, sel = 'button, a') {
  const ok = await page.evaluate(
    (text, sel) => {
      const el = [...document.querySelectorAll<HTMLButtonElement>(sel)].find((b) => b.textContent?.includes(text) && !b.disabled);
      el?.scrollIntoView({ block: 'center' });
      el?.click();
      return !!el;
    },
    text,
    sel,
  );
  assert(ok, `nothing to click called “${text}”`);
  await sleep(350);
}
const mainText = (page: Page) => page.evaluate(() => document.querySelector('main')?.textContent ?? '');

const SECTIONS = ['', 'my-day/', 'inbox/', 'jobs/', 'customers/', 'warranty/', 'inventory/', 'dealers/', 'accounting/', 'analytics/', 'website/', 'settings/'];

const pageTitle = (page: Page) => page.$eval('[data-page-title]', (h) => h.textContent?.trim());
const signedInAs = (page: Page) =>
  page.waitForFunction(() => document.querySelector('.user-btn__name'), { polling: 100, timeout: 15_000 }).then(() => page.$eval('.user-btn__name', (n) => n.textContent?.trim()));

async function pickProfile(page: Page, name: string) {
  for (const b of await page.$$('.profile-option')) if ((await b.$eval('.profile-option__name', (el) => el.textContent ?? '')).startsWith(name)) return void (await b.click());
  throw new Error(`no profile called ${name}`);
}

export async function officeTests({ ORIGIN, url }: { ORIGIN: string; url: (p: string) => string }) {
  console.log('\nFiberSteel mode');

  await test('the public “FiberSteel mode” switch opens the profile picker, which says early that it’s a demo', async () => {
    const t = await open();
    await goto(t.page, url('/lifts/'));
    const href = await t.page.$eval('[data-mode-office]', (a) => a.getAttribute('href'));
    assert(href === '/fibersteel/office/?signin', `the switch points at ${href}`);
    await Promise.all([t.page.waitForNavigation({ waitUntil: 'networkidle0' }), t.page.click('[data-mode-office]')]);
    await officeReady(t.page);
    assert((await pageTitle(t.page)) === 'Try FiberSteel mode', `shows “${await pageTitle(t.page)}”, not the profile picker`);
    const lead = await t.page.$eval('.signin__lead', (p) => p.textContent ?? '');
    assert(/purely a demo/i.test(lead) && /customized/i.test(lead), `the picker doesn’t say it’s a customizable demo: ${lead}`);
    assert((await t.page.evaluate(() => location.pathname + location.search)) === '/fibersteel/office/', 'the ?signin flag stayed in the address');
    await axe(t.page, 'sign-in screen');
    await pickProfile(t.page, 'Dean');
    assert((await signedInAs(t.page)) === 'Dean', 'not signed in as Dean');
    // The dashboard greets the profile ("Good afternoon, Dean")
    assert(/^Good (morning|afternoon|evening), Dean$/.test((await pageTitle(t.page)) ?? '') && (await t.page.evaluate(() => location.pathname)) === '/fibersteel/office/', `opened “${await pageTitle(t.page)}” instead of the dashboard`);
    await t.page.reload({ waitUntil: 'networkidle0' });
    await officeReady(t.page);
    assert((await signedInAs(t.page)) === 'Dean', 'a reload signed out');
    // …and "Public" goes back to where the visitor was
    const back = await t.page.$eval('.mode-toggle a', (a) => a.getAttribute('href'));
    assert(back === '/fibersteel/lifts/', `“Public” points at ${back}`);
    await t.page.close();
  });

  for (const width of [1440, 390]) {
    await test(`every section loads for Dean at ${width} px: axe-clean, demo note first, no console errors${width === 390 ? ', no sideways scroll' : ''}, nothing sent anywhere`, async () => {
      const t = await open({ width, label: `office ${width}px` });
      await signIn(t.page, ORIGIN, 'dean');
      for (const s of SECTIONS) {
        await goto(t.page, url(`/office/${s}`));
        await officeReady(t.page);
        const note = await t.page.evaluate(() => {
          const n = document.querySelector('.demo-note');
          const main = document.querySelector('main');
          return {
            text: n?.textContent ?? '',
            visible: !!n?.getClientRects().length,
            first: !!n && !!main && !!(n.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
          };
        });
        assert(note.visible && note.first && /purely a demo/i.test(note.text) && /customized/i.test(note.text), `/office/${s}: no demo note before the page (${JSON.stringify(note)})`);
        if (width === 390) await noSideScroll(t.page, `/office/${s}`);
        await axe(t.page, `/office/${s} (${width} px)`);
      }
      assert(t.external.length === 0, `FiberSteel mode requested other servers: ${t.external.slice(0, 4).join(', ')}`);
      assert(t.errors.length === 0, `console errors:\n${t.errors.join('\n')}`);
      await t.page.close();
    });
  }

  await test('a crew profile starts on My day and sees only its own sections', async () => {
    const t = await open({ width: 390 });
    await goto(t.page, url('/office/accounting/?signin'));
    await officeReady(t.page);
    await pickProfile(t.page, 'Jesse');
    assert((await signedInAs(t.page)) === 'Jesse', 'not signed in as Jesse');
    await t.page.waitForFunction(() => location.pathname === '/fibersteel/office/my-day/', { polling: 100, timeout: 10_000 });
    await goto(t.page, url('/office/accounting/'));
    await officeReady(t.page);
    const blocked = await t.page.evaluate(() => document.querySelector('main')?.textContent ?? '');
    assert(/not part of this role/i.test(blocked), 'Accounting opened for a crew profile');
    await axe(t.page, 'a section outside the role (390 px)');
    await t.page.close();
  });

  await test('a quote sent from the public site arrives in the inbox, with FiberSteel’s formula worked out', async () => {
    const t = await open();
    await signIn(t.page, ORIGIN, 'dean');
    // The calculator's hand-off fills the boat; the visitor adds the slip and contact details
    await goto(t.page, url('/quote/?dry=4200&fuel=50&length=24'));
    const name = `Test Visitor ${Date.now().toString(36)}`;
    await t.page.click('input[name="boatType"][value="v-bottom"]');
    await t.page.click('[data-panel="0"] [data-next]');
    await t.page.waitForSelector('[data-panel="1"]:not([hidden])');
    await t.page.type('input[name="slipWidth"]', '12');
    await t.page.type('input[name="slipLength"]', '28');
    await t.page.click('[data-panel="1"] [data-next]');
    await t.page.waitForSelector('[data-panel="2"]:not([hidden])');
    await t.page.type('input[name="name"]', name);
    await t.page.type('input[name="email"]', 'visitor@example.com');
    await t.page.click('[data-submit]');
    await t.page.waitForSelector('[data-done]:not([hidden])', { timeout: 10_000 });
    const link = await t.page.$eval('[data-office-link]', (a) => a.getAttribute('href'));
    assert(/\/fibersteel\/office\/inbox\/\?ref=W/.test(link ?? ''), `the hand-off link is ${link}`);

    await goto(t.page, url('/office/inbox/'));
    await officeReady(t.page);
    await t.page.waitForFunction((n) => document.querySelector('main')?.textContent?.includes(n), { polling: 200, timeout: 15_000 }, name);
    const lead = await t.page.evaluate((n) => {
      const links = [...document.querySelectorAll<HTMLElement>('main a, main button')].filter((e) => e.textContent?.includes(n));
      links[0]?.click();
      return links.length;
    }, name);
    assert(lead > 0, 'the request isn’t in the inbox');
    await t.page.waitForFunction(() => /FiberSteel’s formula/.test(document.querySelector('main')?.textContent ?? ''), { polling: 200, timeout: 10_000 });
    const text = await t.page.evaluate(() => document.querySelector('main')?.textContent ?? '');
    assert(/6,800 lb/.test(text), 'the formula’s 6,800 lb suggestion isn’t shown');
    await axe(t.page, 'a website quote in the inbox');
    await t.page.close();
  });

  await test('a warranty registration from the website registers the lift and closes the request', async () => {
    const t = await open();
    await signIn(t.page, ORIGIN, 'dean');
    await goto(t.page, url('/office/inbox/?kind=warranty'));
    await officeReady(t.page);
    await t.page.click('.inbox-row');
    await sleep(400);
    const hasMatch = await t.page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Register this lift')));
    await clickText(t.page, hasMatch ? 'Register this lift' : 'register it');
    await t.page.waitForFunction(() => /serial/i.test(document.querySelector('.lead-registered')?.textContent ?? ''), { polling: 200, timeout: 10_000 });
    const text = await mainText(t.page);
    assert(/REG-/.test(text), 'no registration number shown');
    await axe(t.page, 'a registered warranty request');
    await t.page.close();
  });

  await test('finishing an install puts the lift on the customer’s record and offers it for the website', async () => {
    const t = await open();
    await signIn(t.page, ORIGIN, 'dean');
    // An install that's on the water now, or the next one booked
    let opened = false;
    for (const status of ['in-progress', 'scheduled']) {
      await goto(t.page, url(`/office/jobs/?view=list&status=${status}`));
      await officeReady(t.page);
      opened = await t.page.evaluate(() => {
        const link = [...document.querySelectorAll('tbody tr')].find((r) => /Install/.test(r.textContent ?? ''))?.querySelector('a');
        link?.click();
        return !!link;
      });
      if (opened) break;
    }
    assert(opened, 'no open install job');
    await sleep(500);
    if (await t.page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Start job'))) await clickText(t.page, 'Start job');
    await clickText(t.page, 'Mark complete');
    await clickText(t.page, 'Mark complete', 'dialog button');
    await t.page.waitForFunction(() => /The lift that went in/.test(document.querySelector('main')?.textContent ?? ''), { polling: 200, timeout: 10_000 });
    const job = await t.page.evaluate(() => new URLSearchParams(location.search).get('id'));
    const serial = await t.page.evaluate(() => /FS\d{6}/.exec(document.querySelector('main')?.textContent ?? '')?.[0]);
    assert(serial, 'the new lift has no serial on the job');
    // …on the customer's record
    await t.page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('main a')].find((a) => a.href.includes('/office/customers/?id='))?.click());
    await t.page.waitForFunction((s) => document.querySelector('main')?.textContent?.includes(s), { polling: 200, timeout: 10_000 }, serial);
    // …and on the Website's list of installs to post
    await goto(t.page, url('/office/website/'));
    await officeReady(t.page);
    assert((await mainText(t.page)).includes(job!), `${job} isn’t offered for the website`);
    await t.page.close();
  });

  await test('shipping a ready dealer order invoices the dealer', async () => {
    const t = await open();
    await signIn(t.page, ORIGIN, 'dean');
    await goto(t.page, url('/office/dealers/?tab=orders'));
    await officeReady(t.page);
    const order = await t.page.evaluate(
      () =>
        new Promise<string | undefined>((resolve) => {
          const req = indexedDB.open('fs-office');
          req.onsuccess = () => {
            const get = req.result.transaction('state').objectStore('state').get('db');
            get.onsuccess = () => resolve((get.result.dealerOrders as { id: string; status: string }[]).find((o) => o.status === 'ready')?.id);
          };
        }),
    );
    assert(order, 'no dealer order ready to ship');
    await goto(t.page, url(`/office/dealers/?tab=orders&id=${order}`));
    await officeReady(t.page);
    await t.page.waitForSelector('dialog[open]');
    // Freight ships; pickups and deliveries hand over
    const label = await t.page.evaluate(() => ['Mark shipped', 'Mark picked up', 'Mark delivered'].find((l) => [...document.querySelectorAll('dialog[open] button')].some((b) => b.textContent?.includes(l))));
    assert(label, 'no ship or hand-over button on a ready order');
    await clickText(t.page, label, 'dialog button');
    await t.page.waitForFunction(() => /INV-\d+/.test(document.querySelector('dialog[open]')?.textContent ?? ''), { polling: 200, timeout: 10_000 });
    await axe(t.page, 'a shipped dealer order');
    await t.page.close();
  });

  await test('a used-lift change published in FiberSteel mode shows on the public page as a preview', async () => {
    const t = await open();
    await signIn(t.page, ORIGIN, 'dean');
    await goto(t.page, url('/office/website/?tab=used&listing=U-102'));
    await officeReady(t.page);
    await t.page.waitForSelector('.used-editor');
    await clickText(t.page, 'Sold', '.segmented button');
    await clickText(t.page, 'Save listing');
    await goto(t.page, url('/office/website/?tab=publish'));
    await officeReady(t.page);
    await clickText(t.page, 'Publish now (simulated)');
    await sleep(800);
    await goto(t.page, url('/used-lifts/'));
    await t.page.waitForFunction(() => document.querySelectorAll('.install-card__flag--preview').length > 0, { polling: 200, timeout: 10_000 });
    const flags = await t.page.$$eval('.install-card__flag--preview', (f) => f.map((x) => x.textContent?.trim()));
    assert(flags.every((f) => /Preview/.test(f ?? '')), `preview flags: ${flags.join(' | ')}`);
    await axe(t.page, '/used-lifts/ with a preview');
    assert(t.external.length === 0, `requested other servers: ${t.external.join(', ')}`);
    await t.page.close();
  });

  await test('Analytics: invented figures never sit next to a real lift, product or brand, and never rate Dean', async () => {
    const t = await open();
    await signIn(t.page, ORIGIN, 'dean');
    // FiberSteel's real lifts and products, and other makers' brands (components have generic names), from the demo's data
    await goto(t.page, url('/office/analytics/'));
    await officeReady(t.page);
    const items = await t.page.evaluate(
      () =>
        new Promise<{ name: string; brand: string }[]>((resolve, reject) => {
          const req = indexedDB.open('fs-office');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const get = req.result.transaction('state').objectStore('state').get('db');
            get.onsuccess = () => resolve((get.result.items as { name: string; brand: string; kind: string }[]).filter((i) => i.kind !== 'component'));
            get.onerror = () => reject(get.error);
          };
        }),
    );
    assert(items.length > 10, 'couldn’t read the catalog');
    const names = [...new Set([...items.map((i) => i.name), ...items.map((i) => i.brand).filter((b) => b !== 'FiberSteel')])].filter((n) => n.length > 3);
    const pattern = new RegExp(`(^|[^A-Za-z0-9,])(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})([^A-Za-z]|$)`);
    for (const report of ['sizes', 'inventory', 'service']) {
      await goto(t.page, url(`/office/analytics/?report=${report}`));
      await officeReady(t.page);
      await t.page.waitForSelector('.report');
      const text = await t.page.$eval('.report', (r) => r.textContent ?? '');
      const found = text.match(pattern);
      assert(!found, `${report} shows “${found?.[2]}” next to invented figures`);
      if (report === 'sizes') assert(/stand-in/i.test(text), 'Sizes sold doesn’t say its names are stand-ins');
    }
    await goto(t.page, url('/office/analytics/?report=crews'));
    await officeReady(t.page);
    await t.page.waitForSelector('.report');
    assert(!/\bDean\b/.test(await t.page.$eval('.report', (r) => r.textContent ?? '')), 'the crews report names Dean');
    await t.page.close();
  });
}
