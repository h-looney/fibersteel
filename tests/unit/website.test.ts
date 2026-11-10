/**
 * FiberSteel mode → Website: the checks before an install, a used-lift listing or a dealer goes on the public site,
 * what counts as a change waiting for the next publish (simulated), and what the public pages are handed to preview.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { installProblems, isInstallPending, siteInstalls, storyParagraphs, tidyInstall } from '../../src/office/pages/website/installs.ts';
import { isUsedPending, sampleUsed, siteUsed, usedFromSample, usedProblems } from '../../src/office/pages/website/used.ts';
import { baseDealer, dealerFromBase, dealerProblems, isDealerPending, siteDealers } from '../../src/office/pages/website/dealerList.ts';
import type { DealerListing, InstallPost, UsedListing } from '../../src/office/data/types.ts';

const post = (patch: Partial<InstallPost> = {}): InstallPost => ({
  id: 'INS-1',
  title: '14,000 lb back-in lift with walk boards',
  summary: 'Set up for back-in docking in a wide slip.',
  story: 'The boat backs in.\n\nWalk boards went down both sides.',
  kind: 'performance',
  size: '14000',
  boat: '30 ft cruiser',
  slip: '16 ft wide slip',
  docking: 'Back-in',
  town: 'Osage Beach',
  completed: '2026-10',
  built: ['14,000 lb lift', 'Walk boards on both sides'],
  featured: false,
  status: 'published',
  consent: true,
  by: 'dean',
  at: '2026-11-10T09:00',
  ...patch,
});
const photo = { alt: 'The lift on the water' };

describe('installs posted in FiberSteel mode', () => {
  it('needs the town only, a past month, a photo with a description and the owners’ yes', () => {
    assert.deepEqual(installProblems(post(), [photo], '2026-11'), []);
    assert.ok(installProblems(post({ town: '123 Lake Rd, Osage Beach' }), [photo], '2026-11').some((p) => /Only the town/.test(p)));
    assert.ok(installProblems(post({ completed: '2026-12' }), [photo], '2026-11').some((p) => /future/.test(p)));
    assert.ok(installProblems(post(), [], '2026-11').some((p) => /photo/.test(p)));
    assert.ok(installProblems(post(), [{ alt: ' ' }], '2026-11').some((p) => /Describe photo 1/.test(p)));
    assert.ok(installProblems(post({ consent: false }), [photo], '2026-11').some((p) => /said yes/.test(p)));
  });

  it('lets a draft wait for its photos', () => {
    assert.deepEqual(installProblems(post({ status: 'draft', summary: '', story: '', consent: false }), [], '2026-11'), []);
    assert.equal(installProblems(post({ status: 'draft', title: '', size: undefined }), [], '2026-11').length, 1);
  });

  it('counts what would change the site as waiting for the next publish', () => {
    const p = post();
    assert.equal(isInstallPending(p, undefined), true, 'a new published post goes up');
    assert.equal(isInstallPending(post({ status: 'draft' }), undefined), false, 'a new draft changes nothing');
    assert.equal(isInstallPending(p, structuredClone(p)), false);
    assert.equal(isInstallPending(post({ title: 'New title' }), p), true);
    assert.equal(isInstallPending(undefined, p), true, 'taken down');
  });

  it('hands the public pages only the published posts, with the lake and the size name', () => {
    const site = siteInstalls({ a: post({ id: 'a' }), b: post({ id: 'b', status: 'draft' }) }, { a: [{ id: 'ph1', alt: '', width: 1600, height: 1200, by: 'dean', at: '' }] });
    assert.deepEqual(Object.keys(site), ['a']);
    assert.equal(site.a.sizeName, '14,000 lb lift');
    assert.equal(site.a.lake, 'Lake of the Ozarks');
    assert.equal(site.a.kindLabel, 'Performance & cruiser');
    assert.deepEqual(site.a.story, ['The boat backs in.', 'Walk boards went down both sides.']);
    assert.ok(site.a.photos[0].alt.length > 0, 'a photo without a description still gets one');
  });

  it('tidies what was typed', () => {
    const t = tidyInstall(post({ title: '  A title ', built: [' Walk boards ', '', '  '], slip: '  ' }));
    assert.equal(t.title, 'A title');
    assert.deepEqual(t.built, ['Walk boards']);
    assert.equal('slip' in t, false);
    assert.deepEqual(storyParagraphs('one\n\n\n two  lines\n'), ['one', 'two lines']);
  });
});

describe('used-lift listings', () => {
  const sample = usedFromSample(sampleUsed('U-101')!);
  const listing = (patch: Partial<UsedListing> = {}): UsedListing => ({ ...sample, by: 'dean', at: '', ...patch });

  it('treats a sample put back unchanged as nothing to publish', () => {
    assert.equal(isUsedPending(listing(), undefined, sample), false);
    assert.equal(isUsedPending(listing({ status: 'sold' }), undefined, sample), true);
    assert.equal(isUsedPending(listing({ removed: true }), undefined, sample), true);
  });

  it('shows no price unless FiberSteel switches it on', () => {
    const site = siteUsed({ 'U-101': listing({ price: 3900, showPrice: false }), 'USED-1': listing({ id: 'USED-1', replaces: undefined, price: 4100, showPrice: true }) }, {});
    assert.equal(site['U-101'].price, undefined);
    assert.equal(site['U-101'].replaces, 'U-101');
    assert.equal(site['USED-1'].price, 4100);
    assert.equal(site['USED-1'].sizeName, '8,000 lb lift');
  });

  it('asks for a photo of a new listing, and a price when one is shown', () => {
    const fresh = { ...sample, id: 'USED-1', replaces: undefined };
    assert.ok(usedProblems(fresh, [], false).some((p) => /photo/.test(p)));
    assert.deepEqual(usedProblems(sample, [], true), [], 'a sample keeps its stand-in photo');
    assert.ok(usedProblems({ ...sample, showPrice: true }, [], true).some((p) => /price/.test(p)));
  });
});

describe('the public dealer list', () => {
  const sullivan = dealerFromBase(baseDealer('sullivan-marina')!);
  const listing = (patch: Partial<DealerListing> = {}): DealerListing => ({ ...sullivan, by: 'dean', at: '', ...patch });

  it('starts from the dealers as the current site lists them', () => {
    assert.equal(isDealerPending(listing(), undefined), false);
    assert.equal(isDealerPending(listing({ phones: ['217-555-0100'] }), undefined), true);
    assert.equal(isDealerPending(listing({ hidden: true }), undefined), true);
  });

  it('checks phone numbers, the state and the website address', () => {
    assert.deepEqual(dealerProblems(sullivan), []);
    assert.ok(dealerProblems({ ...sullivan, phones: ['555-01'] }).some((p) => /10 digits/.test(p)));
    assert.ok(dealerProblems({ ...sullivan, state: 'Illinois' }).some((p) => /two-letter/.test(p)));
    assert.ok(dealerProblems({ ...sullivan, web: 'sullivanmarina' }).some((p) => /https/.test(p)));
  });

  it('keeps the approximate map spot of a dealer already on the list, and none for a new one', () => {
    const site = siteDealers({ 'sullivan-marina': listing({ note: 'Call ahead' }), 'DL-1': listing({ id: 'DL-1', isNew: true }) });
    assert.deepEqual(site['sullivan-marina'].geo, baseDealer('sullivan-marina')!.geo);
    assert.equal(site['DL-1'].geo, undefined);
    assert.equal(site['DL-1'].isNew, true);
  });
});
