/**
 * Browser-test helpers: one headless Chromium, pages with every external request stubbed (no network), console-error
 * collection, axe-core checks, a sideways-scroll check and FiberSteel mode sign-in.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer-core';

/**
 * The browser to test with: CHROME_PATH if set, then Playwright's own Chromium (~/.cache/ms-playwright — a separate,
 * signed-out browser, never anyone's everyday Chrome profile), then a system Chromium/Chrome. Each run uses a fresh
 * temporary profile either way.
 */
export function findChrome(): string | undefined {
  const playwright = join(homedir(), '.cache', 'ms-playwright');
  const fromPlaywright = existsSync(playwright)
    ? readdirSync(playwright)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
        .flatMap((d) => [join(playwright, d, 'chrome-linux64', 'chrome'), join(playwright, d, 'chrome-linux', 'chrome')])
    : [];
  return [process.env.CHROME_PATH, ...fromPlaywright, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(
    (p): p is string => !!p && existsSync(p),
  );
}

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Results {
  passed: string[];
  failed: { name: string; error: string }[];
  consoleErrors: string[];
}
export const results: Results = { passed: [], failed: [], consoleErrors: [] };

const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;

export async function test(name: string, fn: () => Promise<void>) {
  if (only && !only.test(name)) return;
  const started = Date.now();
  try {
    await Promise.race([fn(), sleep(90_000).then(() => Promise.reject(new Error('timed out after 90 s')))]);
    results.passed.push(name);
    console.log(`  ✓ ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    results.failed.push({ name, error });
    console.log(`  ✗ ${name}\n      ${error.split('\n').join('\n      ')}`);
  }
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let browser: Browser | null = null;
export async function launch(): Promise<Browser> {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('Chromium not found — install Playwright’s browser or set CHROME_PATH');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--force-prefers-reduced-motion', '--disable-dev-shm-usage'] });
  return browser;
}
export const closeBrowser = () => browser?.close();

export interface TestPage {
  page: Page;
  /** External main-frame navigations the page tried (stubbed, never fetched) */
  navigations: string[];
  /** Other third-party requests the page made (stubbed, never fetched) */
  external: string[];
  errors: string[];
}

/** A page in its own context (fresh storage) unless one is passed. External requests never leave the machine. */
export async function open(opts: { context?: BrowserContext; width?: number; js?: boolean; label?: string } = {}): Promise<TestPage> {
  const context = opts.context ?? (await browser!.createBrowserContext());
  const page = await context.newPage();
  await page.setViewport({ width: opts.width ?? 1440, height: 900 });
  if (opts.js === false) await page.setJavaScriptEnabled(false);
  const navigations: string[] = [];
  const external: string[] = [];
  const errors: string[] = [];
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    // Chrome asks the origin root for /favicon.ico on pages that don't name one (robots.txt): not part of the site
    if (u.pathname === '/favicon.ico') return void req.respond({ status: 204, body: '' });
    if (u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return void req.continue();
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      navigations.push(req.url());
      return void req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="en"><title>External site (test stub)</title><h1>External site</h1></html>' });
    }
    external.push(req.url());
    if (req.resourceType() === 'image') return void req.respond({ status: 200, contentType: 'image/gif', body: GIF });
    return void req.respond({ status: 204, body: '' });
  });
  const label = opts.label ?? '';
  page.on('console', (m) => {
    // The not-found page is meant to answer 404
    if (m.type() === 'error' && /status of 404/.test(m.text()) && /\/does-not-exist\//.test(page.url())) return;
    if (m.type() === 'error') {
      const text = `${label} ${page.url()}: ${m.text()}`;
      errors.push(text);
      results.consoleErrors.push(text);
    }
  });
  page.on('pageerror', (e) => {
    const text = `${label} ${page.url()}: PAGE ERROR ${(e as Error).message}`;
    errors.push(text);
    results.consoleErrors.push(text);
  });
  return { page, navigations, external, errors };
}

export async function goto(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 });
  return res;
}

/** axe-core: no violations (reveal-on-scroll content is shown first so colors are final). */
export async function axe(page: Page, where: string) {
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-visible')));
  await sleep(250);
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[]; failureSummary?: string }[] }[] }> } }).axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.impact} ${v.id}: ${v.help}\n${v.nodes
      .slice(0, 4)
      .map((n) => `   - ${n.target.join(' ')} ${(n.failureSummary ?? '').split('\n').slice(1, 3).join(' ')}`)
      .join('\n')}`);
  });
  assert(violations.length === 0, `axe found ${violations.length} problem(s) on ${where}:\n${violations.join('\n')}`);
}

/** No sideways scrolling: the page is never wider than the viewport. */
export async function noSideScroll(page: Page, where: string) {
  const r = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width && b.right > w + 1 && getComputedStyle(e).position !== 'fixed';
      })
      .slice(0, 6)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (${Math.round(e.getBoundingClientRect().right)}px)`);
    return { w, sw, wide };
  });
  assert(r.sw <= r.w + 1, `${where} scrolls sideways at ${r.w}px (content is ${r.sw}px): ${r.wide.join(', ')}`);
}

/** Tab through the page and return what got focus (text or aria-label, plus href) */
export async function tabStops(page: Page, max = 80): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  const stops: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return '';
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        return `${el.tagName.toLowerCase()}|${name}|${el.getAttribute('href') ?? ''}`;
      }),
    );
  }
  return stops;
}

/** Sign in to FiberSteel mode as a demo profile (the sign-in screen stores the same thing). */
export async function signIn(page: Page, origin: string, userId: string) {
  await page.goto(`${origin}/fibersteel/robots.txt`);
  await page.evaluate((id) => {
    localStorage.setItem('fs-office-ui', JSON.stringify({ signedIn: true, userId: id, jobsView: 'board', range: '90d', welcomeDismissed: true, tried: [] }));
  }, userId);
}

export async function officeReady(page: Page) {
  await page.waitForSelector('[data-page-title]', { timeout: 30_000 });
  await sleep(300);
}
