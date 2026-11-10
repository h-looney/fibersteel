/**
 * Used-lift listings (Website → Used lifts): the sample listings the public page shows now (src/data/usedLifts.ts),
 * listings written or changed in FiberSteel mode, what's waiting for the next publish (simulated), and what the
 * public page previews once it's published. No photo or store imports, so Node can run this file.
 */
import type { SitePhoto, SiteUsedLift } from '../../bridge';
import type { PhotoMeta, UsedListing } from '../../data/types';
import { getSize } from '../../../data/lifts.ts';
import { usedLifts, usedRules, statusLabel, type UsedLift } from '../../../data/usedLifts.ts';
import { tidyRows } from './installs.ts';

export { usedRules, statusLabel };
export const sampleUsed = (id?: string): UsedLift | undefined => (id ? usedLifts.find((u) => u.id === id) : undefined);
export const sampleUsedLifts = usedLifts;
export const MAX_INCLUDES = 8;

/** What used listings usually say they come with */
export const COMMON_INCLUDES = ['V-bunks', 'Pontoon bunks', 'Tri-toon bunks', 'Walk boards', 'Single-valve blower box', 'Double-valve blower box', 'Lift guides'];

export type UsedDraft = Omit<UsedListing, 'by' | 'at'>;

/** A sample listing as the public page shows it now, in the editor's shape */
export const usedFromSample = (u: UsedLift): UsedDraft => ({
  id: u.id,
  title: u.title,
  size: u.size,
  condition: u.condition,
  includes: [...u.includes],
  status: u.status,
  showPrice: false,
  replaces: u.id,
});

/** Trimmed and tidied, as it's saved */
export function tidyUsed<T extends UsedDraft>(l: T): T {
  const out = { ...l, title: l.title.trim(), condition: l.condition.replace(/\s+/g, ' ').trim(), includes: tidyRows(l.includes) };
  if (!out.showPrice || !out.price) delete out.price;
  if (!out.removed) delete out.removed;
  return out;
}

/** What has to be fixed before a listing can be saved — each a message fit to show */
export function usedProblems(l: UsedDraft, photos: Pick<PhotoMeta, 'alt'>[], hasStandIn: boolean): string[] {
  const problems: string[] = [];
  if (!l.title.trim()) problems.push('Give it a title, e.g. “Used 10,000 lb lift with V-bunks”.');
  if (!l.size) problems.push('Pick the lift size.');
  if (!l.condition.trim()) problems.push('Say a line about its condition — what a buyer would ask first.');
  if (l.showPrice && !(Number(l.price) > 0)) problems.push('Enter the price, or switch “Show the price” off.');
  if (!photos.length && !hasStandIn && l.status !== 'sold') problems.push('Add a photo of the lift.');
  photos.forEach((ph, i) => {
    if (!ph.alt.trim()) problems.push(`Describe photo ${i + 1} — screen readers read it aloud.`);
  });
  return problems;
}

const sameRows = (a: string[], b: string[]) => a.length === b.length && a.every((r, i) => r === b[i]);

/** Same content: what the public page would show is identical */
export function sameUsed(a?: UsedDraft, b?: UsedDraft): boolean {
  if (!a || !b) return a === b;
  return (
    a.title === b.title &&
    a.size === b.size &&
    a.condition === b.condition &&
    a.status === b.status &&
    !!a.showPrice === !!b.showPrice &&
    (a.showPrice ? a.price === b.price : true) &&
    !!a.removed === !!b.removed &&
    sameRows(a.includes, b.includes)
  );
}

/**
 * Waiting for the next publish? `base` is the sample listing it replaces, as the public page shows it today. A listing
 * that was never published differs from the site unless it's the sample, unchanged.
 */
export function isUsedPending(post: UsedListing | undefined, live: UsedListing | undefined, base: UsedDraft | undefined): boolean {
  if (!post) return !!live;
  if (live) return !sameUsed(post, live);
  return base ? !sameUsed(post, base) : true;
}

/** What the public page shows after a publish (simulated) */
export function siteUsed(listings: Record<string, UsedListing>, photos: Record<string, PhotoMeta[]>): Record<string, SiteUsedLift> {
  return Object.fromEntries(
    Object.values(listings).map((l): [string, SiteUsedLift] => {
      const ph = photos[l.id]?.[0];
      const photo: SitePhoto | undefined = ph ? { id: ph.id, alt: ph.alt.trim() || l.title, width: ph.width, height: ph.height } : undefined;
      return [
        l.id,
        {
          id: l.id,
          title: l.title,
          size: l.size,
          sizeName: getSize(l.size)?.name ?? l.size,
          condition: l.condition,
          includes: [...l.includes],
          status: l.status,
          ...(l.showPrice && l.price ? { price: l.price } : {}),
          ...(photo ? { photo } : {}),
          ...(l.replaces ? { replaces: l.replaces } : {}),
          ...(l.removed ? { removed: true } : {}),
        },
      ];
    }),
  );
}
