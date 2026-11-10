/**
 * The honesty rules in the data:
 *   - every photo file is registered (alt text, FiberSteel's caption, source page) and every registered photo exists;
 *   - every photo the data names exists; no other brand's image or a customer's name in a file name;
 *   - installs and used lifts are labelled samples, with no invented quotes, reviews or prices;
 *   - prices only where the current site shows them; every old GoDaddy page has a new home.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { dealers } from '../../src/data/dealers.ts';
import { installs } from '../../src/data/installs.ts';
import { liftTypes, parts } from '../../src/data/lifts.ts';
import { admiral, dockSteps } from '../../src/data/products.ts';
import { redirects } from '../../src/data/redirects.ts';
import { sources } from '../../src/data/sources.ts';
import { usedLifts } from '../../src/data/usedLifts.ts';
import { videos } from '../../src/data/ownerHelp.ts';

const PHOTOS = 'src/assets/photos';
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const photoFiles = files(PHOTOS).map((f) => relative(PHOTOS, f).replace(/\.jpg$/, ''));
// photos.ts uses import.meta.glob, so read its entries as text rather than importing it
const photoSrc = readFileSync('src/data/photos.ts', 'utf8');
const str = `(?:'([^']*)'|"([^"]*)")`;
const entry = new RegExp(`^\\s+'([a-z]+\\/[a-z0-9-]+)': \\{ alt: ${str}(?:, caption: ${str})?, source: '([a-zA-Z]+)'`, 'gm');
const registered = [...photoSrc.matchAll(entry)].map((m) => ({ id: m[1], alt: m[2] ?? m[3], caption: m[4] ?? m[5], source: m[6] }));

describe('photos', () => {
  it('every file is registered, and every registered photo has a file', () => {
    const ids = registered.map((r) => r.id);
    assert.deepEqual(photoFiles.filter((f) => !ids.includes(f)), [], 'files without an entry in src/data/photos.ts');
    assert.deepEqual(ids.filter((id) => !photoFiles.includes(id)), [], 'entries without a file');
    assert.equal(new Set(ids).size, ids.length, 'duplicate photo ids');
  });

  it('every photo has alt text and a known source page', () => {
    for (const r of registered) {
      assert.ok(r.alt.length >= 12, `${r.id}: alt text too short`);
      assert.ok(r.source in sources, `${r.id}: unknown source ${r.source}`);
    }
  });

  it('every photo the data names exists', () => {
    const named = [
      ...liftTypes.flatMap((t) => [t.hero, ...t.gallery, ...t.options.map((o) => o.photo).filter((x): x is string => !!x)]),
      ...installs.flatMap((i) => i.photos),
      ...usedLifts.map((u) => u.photo),
      ...parts.map((p) => p.photo),
      ...admiral.photos,
      ...dockSteps.photos,
      ...videos.map((v) => v.poster),
    ];
    const missing = [...new Set(named)].filter((id) => !photoFiles.includes(id));
    assert.deepEqual(missing, []);
  });

  it('no file name carries a customer name or another brand’s image', () => {
    // The originals' names included owners' names; the concept's files are renamed by what they show
    for (const f of photoFiles) assert.doesNotMatch(f, /brown|bonomo|sikinger|johnson|black|cross|palmer|admiral-logo|wave-armor|elux|istock|ameren/i, f);
  });
});

describe('sample data', () => {
  it('every install is a labelled sample, with no quote or rating', () => {
    for (const i of installs) {
      assert.equal(i.sample, true, `${i.slug} must be marked sample`);
      assert.ok(!('quote' in i) && !('rating' in i), `${i.slug}: no invented quotes or ratings`);
      assert.doesNotMatch(i.town, /\d/, `${i.slug}: the town only, never a street`);
      assert.match(i.month, /^\d{4}-(0[1-9]|1[0-2])$/);
    }
  });

  it('every used lift is a labelled sample with no price', () => {
    for (const u of usedLifts) {
      assert.equal(u.sample, true);
      assert.ok(!('price' in u), `${u.id}: the current site shows no used-lift prices`);
    }
  });

  it('dealers are listed as businesses, without staff names', () => {
    const text = JSON.stringify(dealers);
    assert.doesNotMatch(text, /Utley|McDowell|Brian Cook|Mgr\./);
    for (const d of dealers) assert.ok(d.phones.length > 0, `${d.id}: no phone`);
  });
});

describe('prices', () => {
  it('only the prices the current site shows', () => {
    assert.deepEqual(
      admiral.prices.map((p) => p.price),
      [2345, 2520, 2785, 2985, 2785],
    );
    assert.equal(admiral.install.price, 200);
    assert.deepEqual(
      dockSteps.prices.map((p) => p.price),
      [2195, 2350, 200, 550],
    );
  });
});

describe('old addresses', () => {
  it('every page of the current site has a new home', () => {
    const old = [
      '/contact-us', '/about-us', '/warranty', '/our-lift-sizes', '/pwc-lifts', '/v-bottom-%26-cat-hull-1', '/pontoons-%26-tri-toons',
      '/perfomance-boats-cruisers', '/large-boats-%26-cruisers', '/remote-control-blowers-1', '/front-mounted-lifts', '/shallow-water-lifts',
      '/remote-control-blowers', '/blower-control-use-guide-1', '/dos-%26-donts', '/local-lake-info', '/lakefront-vrbo', '/e-lux-bikes',
      '/used-lifts', '/dealers', '/dock-steps-1',
    ];
    assert.equal(old.length, 21); // + the home page = the 22 pages in the current sitemap
    const from = redirects.map((r) => r.from);
    assert.deepEqual(old.filter((o) => !from.includes(o)), []);
    for (const r of redirects) assert.match(r.to, /^\/[a-z0-9/-]*\/$/, `${r.from} → ${r.to}`);
  });
});
