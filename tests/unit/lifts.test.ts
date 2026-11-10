/**
 * FiberSteel's lift-size formula (home page): dry weight + fuel (7 lb a gallon) + 2,000 lb for boats up to 30 ft
 * (3,000 lb for larger boats) — and the standard size that covers the result.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { boatSizes, estimateLiftSize, formula, getSize, liftSizes, liftTypes, quoteChecklist } from '../../src/data/lifts.ts';

describe('lift-size formula', () => {
  it('matches the home page: dry + 7 lb/gal + 2,000 lb up to 30 ft', () => {
    const e = estimateLiftSize(4200, 50, 24);
    assert.equal(e.fuelWeight, 350);
    assert.equal(e.allowance, 2000);
    assert.equal(e.needed, 6550);
    assert.equal(e.size?.id, '6800');
  });

  it('a 30 ft boat still gets 2,000 lb; over 30 ft gets 3,000 lb', () => {
    assert.equal(estimateLiftSize(5000, 0, 30).allowance, 2000);
    assert.equal(estimateLiftSize(5000, 0, 30.5).allowance, 3000);
    assert.equal(estimateLiftSize(9000, 100, 32).needed, 9000 + 700 + 3000);
  });

  it('picks the smallest standard size that covers it, exactly at the edge too', () => {
    assert.equal(estimateLiftSize(2800, 0, 20).size?.id, '4800'); // 4,800 exactly
    assert.equal(estimateLiftSize(2801, 0, 20).size?.id, '6800');
    assert.equal(estimateLiftSize(13000, 200, 40).size?.id, '20000'); // 17,400
  });

  it('beyond 24,000 lb there is no standard size (call about a custom lift)', () => {
    assert.equal(estimateLiftSize(20000, 300, 45).size, null);
  });

  it('ignores negative or missing numbers', () => {
    assert.equal(estimateLiftSize(4000, -10, 20).fuelWeight, 0);
  });

  it('uses the constants the home page states', () => {
    assert.deepEqual(
      { fuel: formula.fuelLbPerGallon, small: formula.allowanceUpTo30ft, large: formula.allowanceOver30ft, cutoff: formula.lengthCutoffFt },
      { fuel: 7, small: 2000, large: 3000, cutoff: 30 },
    );
  });
});

describe('lift sizes and types', () => {
  it('the boat sizes are the ones FiberSteel lists, smallest first', () => {
    assert.deepEqual(
      boatSizes.map((s) => s.capacity),
      [4800, 6800, 8000, 10000, 12000, 14000, 16000, 20000, 24000],
    );
  });

  it('every size and type fact names the page it came from', () => {
    for (const s of liftSizes) for (const f of s.facts) assert.ok(f.src, `${s.id}: "${f.text}" has no source`);
    for (const t of liftTypes) {
      assert.ok(t.tagline.src, `${t.slug}: tagline has no source`);
      for (const o of t.options) assert.ok(o.src, `${t.slug}: option "${o.title}" has no source`);
    }
  });

  it('every lift type lists only sizes that exist, and links its old address', () => {
    for (const t of liftTypes) {
      for (const id of t.sizes) assert.ok(getSize(id), `${t.slug}: unknown size ${id}`);
      assert.match(t.oldPath, /^\/[a-z0-9%-]+$/);
    }
  });

  it('no lift has a price (the current site shows none)', () => {
    const text = JSON.stringify({ liftSizes, liftTypes });
    assert.doesNotMatch(text, /\$\s?\d/);
  });

  it('the quote checklist is what the home page asks for', () => {
    assert.equal(quoteChecklist.length, 5);
    assert.ok(quoteChecklist.every((f) => f.src === 'home'));
  });
});
