/**
 * Used lifts for sale. The rules come from FiberSteel's current Used Lifts page; THE LISTINGS ARE SAMPLES
 * (the current page had no live listing with details on 2026-11-10). The sizes and builds are real FiberSteel sizes
 * from src/data/lifts.ts; everything else in a listing — condition, extras, status — is made up and marked
 * "Sample", and the photos are stand-ins from FiberSteel's site. No prices: the current page shows none ("$").
 * Real listings are added by FiberSteel over time, or managed in FiberSteel mode.
 */
export const usedRules = [
  "Used lifts are first come, first served, and must be paid in full for ownership. All sales final.",
  'Listings are updated as soon as possible for availability and information, and are subject to change without notice. Call for updates.',
  "We do not install used lifts outside of the Lake of the Ozarks.",
];

export interface UsedLift {
  id: string;
  size: string;
  title: string;
  condition: string;
  includes: string[];
  status: 'available' | 'pending' | 'sold';
  photo: string;
  sample: true;
}

export const usedLifts: UsedLift[] = [
  {
    id: 'U-101',
    size: '8000',
    title: 'Used 8,000 lb lift with V-bunks',
    condition: 'Sample listing: traded in after an upgrade to a bigger lift.',
    includes: ['V-bunks', 'Single-valve blower box'],
    status: 'available',
    photo: 'shallow/8000-shallow-3',
    sample: true,
  },
  {
    id: 'U-102',
    size: '6800',
    title: 'Used 6,800 lb pontoon lift',
    condition: 'Sample listing: pontoon bunks, ready for a new home.',
    includes: ['Pontoon bunks'],
    status: 'available',
    photo: 'pontoon/6800-pontoon-bunks',
    sample: true,
  },
  {
    id: 'U-103',
    size: '14000',
    title: 'Used 14,000 lb lift',
    condition: 'Sample listing: 6 arms, 3 axles, 2 poly tanks.',
    includes: ['V-bunks', 'Double-valve blower box'],
    status: 'pending',
    photo: 'performance/16000-lift',
    sample: true,
  },
  {
    id: 'U-104',
    size: 'pwc-single',
    title: 'Used single PWC lift',
    condition: 'Sample listing.',
    includes: ['Walk boards'],
    status: 'sold',
    photo: 'pwc/single-pwc',
    sample: true,
  },
];

export const statusLabel: Record<UsedLift['status'], string> = {
  available: 'Available',
  pending: 'Sale pending',
  sold: 'Sold',
};
