/**
 * Checks on the built site (run after `npm run build`; the deploy runs it before publishing):
 *   - every page has a title, a description, a canonical link, one h1, lang="en", and the preview noindex guard
 *   - every internal link and image points at something that exists (links written with withBase())
 *   - every <img> has alt text; no image is hotlinked from FiberSteel's current GoDaddy site
 *   - structured data parses; the sitemap lists only pages that exist, and never the old-address redirect pages
 *   - every old GoDaddy address has a redirect page that sends people to a page that exists
 *   - no HMI or fireplace wording left behind, in pages or scripts; prices only on the pages that show them on the current site
 * DIST overrides the build folder (default: dist).
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { redirects } from '../../src/data/redirects.ts';

const DIST = process.env.DIST ?? 'dist';
assert.ok(existsSync(join(DIST, 'index.html')), `No build in ${DIST}/ — run npm run build first`);

/** The base path the site was built for, read from the home page ('' at the root, '/fibersteel' on GitHub Pages) */
const BASE = (readFileSync(join(DIST, 'index.html'), 'utf8').match(/<link rel="icon" href="([^"]*)\/favicon\.svg"/)?.[1] ?? '').replace(/\/$/, '');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

const redirectDirs = new Set(redirects.map((r) => decodeURIComponent(r.from).replace(/^\//, '')));
const all = htmlFiles(DIST);
const isRedirect = (f: string) => redirectDirs.has(relative(DIST, f).replace(/\/index\.html$/, '')) && !['warranty', 'used-lifts', 'dealers', 'e-lux-bikes'].includes(relative(DIST, f).replace(/\/index\.html$/, ''));
const isOffice = (f: string) => relative(DIST, f).startsWith('office/');
const pages = all.filter((f) => !isRedirect(f) && !isOffice(f));
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => relative(DIST, f);

const pathOf = (href: string) => href.replace(/[?#].*$/, '');
const fileFor = (sitePath: string) => {
  const r = decodeURIComponent(pathOf(sitePath)).replace(new RegExp(`^${BASE}`), '').replace(/^\//, '');
  return r.endsWith('/') || r === '' ? join(DIST, r, 'index.html') : existsSync(join(DIST, r)) ? join(DIST, r) : join(DIST, r, 'index.html');
};

describe(`built site in ${DIST}/ (base "${BASE || '/'}")`, () => {
  it('has the pages', () => {
    for (const p of ['/', '/lifts/', '/lifts/sizes/', '/lifts/pwc/', '/quote/', '/installs/', '/remotes/', '/dock-steps/', '/used-lifts/', '/dealers/', '/dealers/become-a-dealer/', '/owners/', '/service/', '/warranty/', '/warranty/register/', '/owners/blower-guide/', '/owners/dos-and-donts/', '/about/', '/contact/', '/lake-info/', '/lakefront-rental/', '/e-lux-bikes/', '/privacy/', '/404.html', '/sitemap.xml', '/robots.txt'])
      assert.ok(existsSync(fileFor(`${BASE}${p}`)), `missing ${p}`);
  });

  it('every page has a title, description, canonical, one h1 and lang="en"', () => {
    for (const f of pages) {
      const html = read(f);
      assert.match(html, /<html lang="en"/, `${rel(f)}: lang`);
      assert.match(html, /<title>[^<]{8,}<\/title>/, `${rel(f)}: title`);
      assert.match(html, /<meta name="description" content="[^"]{30,}"/, `${rel(f)}: description`);
      assert.match(html, /<link rel="canonical" href="https?:\/\/[^"]+"/, `${rel(f)}: canonical`);
      assert.equal(html.match(/<h1[\s>]/g)?.length ?? 0, 1, `${rel(f)}: exactly one <h1>`);
    }
  });

  it('pages served from another domain add noindex (the preview guard), and 404 is noindex outright', () => {
    for (const f of pages) {
      const html = read(f);
      if (rel(f) === '404.html' || rel(f).startsWith('installs/preview')) assert.match(html, /<meta name="robots" content="noindex"/, rel(f));
      else assert.match(html, /liveHost/, `${rel(f)}: no preview noindex guard`);
    }
  });

  it('every internal link and asset points at something that exists', () => {
    const missing = new Set<string>();
    for (const f of [...pages, ...all.filter(isRedirect)]) {
      const html = read(f);
      for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
        const u = m[1].replace(/&amp;/g, '&');
        if (!u.startsWith('/') || u.startsWith('//')) continue;
        if (pathOf(u).startsWith(`${BASE}/office/`)) continue; // FiberSteel mode (built in phase 3)
        if (!u.startsWith(`${BASE}/`) && BASE) missing.add(`${rel(f)}: ${u} (not under ${BASE}/ — use withBase())`);
        else if (!existsSync(fileFor(u))) missing.add(`${rel(f)}: ${u}`);
      }
      for (const m of html.matchAll(/\ssrcset="([^"]+)"/g))
        for (const part of m[1].split(',')) {
          const u = part.trim().split(/\s+/)[0];
          if (u.startsWith('/') && !existsSync(fileFor(u))) missing.add(`${rel(f)}: ${u}`);
        }
    }
    assert.deepEqual([...missing], []);
  });

  it('every image has alt text, and nothing is hotlinked from the current GoDaddy site', () => {
    for (const f of pages) {
      const html = read(f);
      for (const m of html.matchAll(/<img\b[^>]*>/g)) assert.match(m[0], /\salt(="|[\s>])/, `${rel(f)}: <img> without alt: ${m[0].slice(0, 120)}`);
      assert.doesNotMatch(html, /wsimg\.com|isteam\//, `${rel(f)}: links an image on GoDaddy's servers`);
    }
  });

  it('structured data parses on every page', () => {
    for (const f of pages)
      for (const m of read(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(m[1]), `${rel(f)}: bad JSON-LD`);
    const home = read(join(DIST, 'index.html'));
    assert.match(home, /"@type":"LocalBusiness"/);
    assert.match(home, /"telephone":"\+1-573-346-3088"/);
  });

  it('the sitemap lists pages that exist, never redirect or office pages', () => {
    const xml = read(join(DIST, 'sitemap.xml'));
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    assert.ok(locs.length >= 25);
    for (const p of locs) {
      assert.ok(existsSync(fileFor(p)), `sitemap lists ${p}, which doesn't exist`);
      assert.ok(!isRedirect(fileFor(p)) && !p.includes('/office/'), `sitemap lists ${p}`);
    }
    assert.match(read(join(DIST, 'robots.txt')), /Disallow: \/office\//);
  });

  it('every old GoDaddy address sends people to a page that exists', () => {
    for (const r of redirects) {
      const f = join(DIST, decodeURIComponent(r.from).replace(/^\//, ''), 'index.html');
      assert.ok(existsSync(f), `no page at the old address ${r.from}`);
      assert.ok(existsSync(fileFor(`${BASE}${r.to}`)), `${r.from} → ${r.to}, which doesn't exist`);
      if (isRedirect(f)) {
        const html = read(f);
        assert.match(html, /<meta name="robots" content="noindex"/, r.from);
        assert.match(html, new RegExp(`<meta http-equiv="refresh" content="0; url=${BASE}${r.to.replace(/[/]/g, '\\/')}"`), r.from);
        assert.match(html, /location\.replace/, r.from);
      }
    }
  });

  it('no HMI or fireplace wording is left behind', () => {
    const words = /\bHMI\b|hmifireplace|fireplace|hearth|\bstoves?\b|Osage Beach showroom|Nixa|Fraunces|Vermont Castings|Heat & Glo/i;
    for (const f of all) {
      const text = read(f).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
      const hit = text.match(words);
      assert.ok(!hit, `${rel(f)}: "${hit?.[0]}"`);
    }
  });

  it('no HMI or fireplace wording in the scripts either (FiberSteel mode’s screens live there)', () => {
    const words = /\bHMI\b|hmifireplace|fireplace|hearth|\bstoves?\b|Osage Beach showroom|Nixa|Vermont Castings|Heat & Glo|chimney|pellet|firebox|hmi-last|hmi-office/i;
    const astro = join(DIST, '_astro');
    const scripts = existsSync(astro) ? readdirSync(astro).filter((n) => n.endsWith('.js')) : [];
    assert.ok(scripts.length > 0, 'no scripts in the build');
    for (const name of scripts) {
      const hit = readFileSync(join(astro, name), 'utf8').match(words);
      assert.ok(!hit, `_astro/${name}: "${hit?.[0]}"`);
    }
  });

  it('always writes "FiberSteel" (never FIBERSTEEL or Fibersteel) in what visitors read', () => {
    for (const f of pages) {
      const text = read(f).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
      assert.doesNotMatch(text, /FIBERSTEEL|Fibersteel|Fiber Steel/, rel(f));
    }
  });

  it('shows prices only on pages whose topic has a price on the current site', () => {
    // Admiral remotes, the remote install fee, dock steps, the $95 service fee (warranty)
    const allowed = new Set(['index.html', 'remotes/index.html', 'dock-steps/index.html', 'warranty/index.html', 'service/index.html', 'owners/index.html', 'lifts/index.html', 'lifts/sizes/index.html']);
    for (const f of pages) {
      const text = read(f).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
      const price = text.match(/\$\s?\d[\d,]*/);
      if (price) assert.ok(allowed.has(rel(f)), `${rel(f)} shows a price (${price[0]})`);
    }
  });
});
