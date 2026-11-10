/**
 * "Lifts we've installed" — the installs showcase: FiberSteel's own lifts on the water, with the photo, the size,
 * the boat, the slip and what was built for it.
 *
 * THE INSTALLS HERE ARE SAMPLES. The photos and each "built for it" fact come from FiberSteel's current site (its
 * captions); the town, the month and the write-up are made up for this concept, and every card and page says
 * "Sample". Never present them as FiberSteel's real jobs. Real installs replace them, added over time from
 * FiberSteel's photos of finished jobs. No invented quotes, ratings or reviews.
 */
import type { SourceKey } from './sources';

export type InstallKind = 'pwc' | 'v-bottom' | 'pontoon' | 'performance' | 'large' | 'front' | 'shallow' | 'dock-steps';

export const installKinds: { id: InstallKind; label: string }[] = [
  { id: 'pwc', label: 'PWC' },
  { id: 'v-bottom', label: 'V-bottom & cat-hull' },
  { id: 'pontoon', label: 'Pontoon & tri-toon' },
  { id: 'performance', label: 'Performance & cruiser' },
  { id: 'large', label: 'Large boat' },
  { id: 'front', label: 'Front-mounted' },
  { id: 'shallow', label: 'Shallow water' },
  { id: 'dock-steps', label: 'Dock steps' },
];

export interface Install {
  slug: string;
  title: string;
  kind: InstallKind;
  /** A size id from src/data/lifts.ts, or null (dock steps) */
  size: string | null;
  /** The boat, as FiberSteel's caption names it (or a general description) */
  boat: string;
  slip?: string;
  docking?: 'Back-in' | 'Straight pull-in';
  /** Sample: made up for the concept (real installs show the town, never the street) */
  town: string;
  /** Sample: made up (YYYY-MM) */
  month: string;
  /** Sample write-up, built only on the caption's facts */
  story: string;
  /** "What we built": the caption's facts */
  built: string[];
  photos: string[];
  /** Where the facts came from */
  src: SourceKey;
  featured?: boolean;
  sample: true;
}

export const installs: Install[] = [
  {
    slug: 'chris-craft-24000-back-in',
    title: 'A 24,000 lb back-in lift for a Chris-Craft',
    kind: 'large',
    size: '24000',
    boat: 'Chris-Craft',
    slip: '16 ft wide slip',
    docking: 'Back-in',
    town: 'Lake Ozark',
    month: '2026-06',
    story: 'A big boat in a 16 ft wide slip, docked stern-first: the 24,000 lb lift went in as a back-in.',
    built: ['24,000 lb lift', 'Installed as a back-in', 'In a 16 ft wide slip'],
    photos: ['large/24000-chris-craft-back-in', 'large/24000-chris-craft-2'],
    src: 'performance',
    featured: true,
    sample: true,
  },
  {
    slug: 'back-in-14000-walkboards',
    title: '14,000 lb back-in lift with walkboards on both sides',
    kind: 'performance',
    size: '14000',
    boat: 'Performance boat',
    slip: '16 ft wide slip',
    docking: 'Back-in',
    town: 'Osage Beach',
    month: '2026-08',
    story: 'Set up for back-in docking in a wide slip, with premium walkboards down both sides for easy boarding and an Admiral remote on the dock.',
    built: ['14,000 lb lift', 'Set up for back-in docking', 'Premium walkboards on both sides', 'Admiral remote control blower system'],
    photos: ['performance/14000-back-in-walkboards'],
    src: 'performance',
    featured: true,
    sample: true,
  },
  {
    slug: 'manitou-tritoon-low-center',
    title: 'A tri-toon lift for a lower center pontoon',
    kind: 'pontoon',
    size: null,
    boat: 'Manitou tri-toon',
    town: 'Sunrise Beach',
    month: '2026-05',
    story: 'This tri-toon’s center pontoon sits 5.25 inches lower than the outer two, so the bunks were built to match.',
    built: ['Tri-toon bunks', 'Center bunk set 5.25 in. lower, for the Manitou’s deeper center pontoon'],
    photos: ['pontoon/manitou-tritoon-bunks', 'pontoon/tritoon-low-center'],
    src: 'pontoon',
    featured: true,
    sample: true,
  },
  {
    slug: 'nor-tech-24000-narrow-slip',
    title: 'A 53 ft Nor-Tech in a 14 ft slip',
    kind: 'large',
    size: '24000',
    boat: '53 ft Nor-Tech',
    slip: '14 ft wide slip',
    town: 'Lake Ozark',
    month: '2025-09',
    story: 'A 53-footer in a narrow slip: the boat rides on a 24,000 lb lift in a 14 ft wide slip.',
    built: ['24,000 lb lift', 'In a 14 ft wide slip'],
    photos: ['large/24000-nor-tech'],
    src: 'large',
    sample: true,
  },
  {
    slug: 'custom-20000-12ft-slip',
    title: 'A 20,000 lb lift custom fitted to a 12 ft slip',
    kind: 'performance',
    size: '20000',
    boat: 'Cruiser',
    slip: '12 ft wide slip',
    docking: 'Back-in',
    town: 'Camdenton',
    month: '2025-07',
    story: 'A very tight squeeze: the lift was custom fitted to a 12 ft wide slip, with extra-long lift arms for back-in docking.',
    built: ['20,000 lb lift', 'Custom fitted to a 12 ft wide slip', 'Extra-long back-in lift arms'],
    photos: ['performance/20000-12ft-slip'],
    src: 'performance',
    sample: true,
  },
  {
    slug: 'lift-guides-16000',
    title: '16,000 lb straight pull-in with lift guides',
    kind: 'large',
    size: '16000',
    boat: 'Cruiser',
    slip: '14 ft wide slip',
    docking: 'Straight pull-in',
    town: 'Linn Creek',
    month: '2025-10',
    story: 'A 16,000 lb lift that the boat pulls straight onto, in a 14 ft wide slip, with FiberSteel lift guides.',
    built: ['16,000 lb lift', 'Installed as a straight pull-in', 'FiberSteel lift guides', 'In a 14 ft wide slip'],
    photos: ['large/16000-lift-guides'],
    src: 'large',
    sample: true,
  },
  {
    slug: 'chris-craft-corsair-16000',
    title: '16,000 lb lift for a 28 ft Chris-Craft Corsair',
    kind: 'v-bottom',
    size: '16000',
    boat: '28 ft Chris-Craft Corsair',
    town: 'Laurie',
    month: '2026-04',
    story: 'A 28-footer, but a very heavy boat for its size — so it rides on a 16,000 lb lift.',
    built: ['16,000 lb lift', 'Sized for a heavy 28 ft boat'],
    photos: ['vbottom/16000-chris-craft-corsair'],
    src: 'vbottom',
    sample: true,
  },
  {
    slug: 'ski-boat-tall-bunks-8000',
    title: 'Extra-tall bunks for an inboard ski boat',
    kind: 'v-bottom',
    size: '8000',
    boat: 'Inboard-drive ski boat',
    town: 'Gravois Mills',
    month: '2026-03',
    story: 'An inboard drive needs room under the hull, so this 8,000 lb lift got extra-tall bunks.',
    built: ['8,000 lb lift', 'Extra-tall bunks for the inboard drive'],
    photos: ['vbottom/8000-tall-bunks-ski-boat'],
    src: 'vbottom',
    sample: true,
  },
  {
    slug: 'shallow-water-8000',
    title: 'An 8,000 lb shallow-water lift',
    kind: 'shallow',
    size: '8000',
    boat: 'V-bottom boat',
    town: 'Rocky Mount',
    month: '2025-11',
    story: 'Shallow water at the dock, so FiberSteel special-built the lift with 20 inch deep tanks.',
    built: ['Special-built 8,000 lb shallow-water lift', '20 inch deep tanks', 'V-bunks'],
    photos: ['shallow/8000-shallow-v-bunks', 'shallow/8000-shallow-bow'],
    src: 'shallow',
    sample: true,
  },
  {
    slug: 'twin-pwc-set',
    title: 'A twin PWC set, each lift run on its own',
    kind: 'pwc',
    size: 'pwc-twin',
    boat: 'Two personal watercraft',
    town: 'Four Seasons',
    month: '2026-05',
    story: 'Two watercraft side by side. Each lift raises and lowers on its own, from a single blower controller box on the dock.',
    built: ['Twin PWC lift set', 'Each lift operated independently', 'One blower controller box'],
    photos: ['pwc/twin-set', 'pwc/twin-set-2'],
    src: 'pwc',
    sample: true,
  },
  {
    slug: 'catamaran-front-mounted',
    title: 'A front-mounted lift for a small catamaran',
    kind: 'front',
    size: null,
    boat: 'Small catamaran sailboat',
    town: 'Climax Springs',
    month: '2025-08',
    story: 'Not every boat is a powerboat. This small catamaran sailboat rides on a custom front-mounted lift with a 2,000 lb poly tank.',
    built: ['Custom front-mounted lift', '2,000 lb poly tank'],
    photos: ['front/catamaran-sailboat'],
    src: 'front',
    sample: true,
  },
  {
    slug: 'dock-steps-pier',
    title: 'Dock steps on a pier-style dock',
    kind: 'dock-steps',
    size: null,
    boat: '—',
    town: 'Sunrise Beach',
    month: '2026-06',
    story: 'Self-raising floating dock steps make it easy to get in and out of the water — much easier than an old vertical dock ladder.',
    built: ['Self-raising floating dock steps', 'Mounted on a pier-style dock'],
    photos: ['docksteps/pier-dock'],
    src: 'dockSteps',
    sample: true,
  },
];

export const getInstall = (slug: string) => installs.find((i) => i.slug === slug);
export const kindLabel = (kind: InstallKind) => installKinds.find((k) => k.id === kind)?.label ?? kind;

/** "2026-06" → "June 2026" */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/** Which lift-type page shows which install kinds */
export const kindsForType: Record<string, InstallKind[]> = {
  pwc: ['pwc'],
  'v-bottom-cat-hull': ['v-bottom'],
  'pontoons-tri-toons': ['pontoon'],
  'performance-cruisers': ['performance'],
  'large-boats-cruisers': ['large'],
  'front-mounted': ['front'],
  'shallow-water': ['shallow'],
};
