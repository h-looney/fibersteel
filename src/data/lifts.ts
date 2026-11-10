/**
 * FiberSteel's lifts: the sizes, the boat types they're built for, parts & features, and the lift-size formula.
 *
 * Specs are only what FiberSteel's current site states, each with the page it came from (`src`, keys of
 * src/data/sources.ts; read 2026-11-10). Nothing here is invented: where the site's pages disagree, the README's
 * "To confirm with FiberSteel" says so. No lift prices — the current site shows none.
 */
import type { SourceKey } from './sources';

export interface Fact {
  text: string;
  src: SourceKey;
}

export interface LiftSize {
  id: string;
  name: string;
  /** Rated lift in lb (for PWC lifts, the tank's rating) */
  capacity: number;
  group: 'pwc' | 'small' | 'mid' | 'large';
  /** Shown on the sizes table */
  summary: string;
  facts: Fact[];
}

export const sizeGroups = [
  { id: 'pwc', name: 'Personal watercraft (PWC) lifts', blurb: 'Call for help finding the proper size lift for your watercraft.', src: 'sizes' },
  { id: 'small', name: 'Boat lifts for most any boat up to about 5,700 lb dry weight', blurb: 'Fishing boats and ski boats with dry weights up to about 5,700 lb.', src: 'sizes' },
  { id: 'mid', name: 'Larger performance & cruiser lifts', blurb: 'Boats with dry weights up to about 7,200 lb.', src: 'sizes' },
  { id: 'large', name: "Larger cuddies, cruisers & offshore boats", blurb: 'Have questions, or an idea for a custom lift? Call and get answers.', src: 'sizes' },
] as const satisfies readonly { id: LiftSize['group']; name: string; blurb: string; src: SourceKey }[];

export const liftSizes: LiftSize[] = [
  {
    id: 'pwc-single',
    name: 'Single PWC lift',
    capacity: 1500,
    group: 'pwc',
    summary: 'One watercraft · air tank rated at 1,500 lb of lift',
    facts: [
      { text: 'A single personal watercraft lift with an air tank rated at 1,500 lb of lift', src: 'sizes' },
      { text: 'Walk boards on both sides', src: 'pwc' },
      { text: 'Bow-end poly float, so no drop chains or cables are needed', src: 'pwc' },
    ],
  },
  {
    id: 'pwc-twin',
    name: 'Twin PWC lift set',
    capacity: 1500,
    group: 'pwc',
    summary: 'Two single lifts side by side · one controller box runs each one on its own',
    facts: [
      { text: "Two single lifts mounted side by side, with one controller box to operate them individually", src: 'sizes' },
      { text: 'Normally comes with a single controller box equipped with a dual-valve blower', src: 'pwc' },
    ],
  },
  {
    id: 'pwc-double',
    name: 'Double PWC lift',
    capacity: 3700,
    group: 'pwc',
    summary: 'One big lift for two watercraft · 3,700 lb lift tank',
    facts: [{ text: 'One big lift that holds 2 watercraft, with a 3,700 lb lift tank', src: 'sizes' }],
  },
  {
    id: '4800',
    name: '4,800 lb lift',
    capacity: 4800,
    group: 'small',
    summary: 'Boats with dry weights up to about 3,200 lb',
    facts: [{ text: 'For boats with dry weights up to about 3,200 lb', src: 'sizes' }],
  },
  {
    id: '6800',
    name: '6,800 lb lift',
    capacity: 6800,
    group: 'small',
    summary: 'Boats with dry weights up to about 4,800 lb',
    facts: [{ text: 'For boats with dry weights up to about 4,800 lb', src: 'sizes' }],
  },
  {
    id: '8000',
    name: '8,000 lb lift',
    capacity: 8000,
    group: 'small',
    summary: 'Boats with dry weights up to about 5,500 lb',
    facts: [{ text: 'For boats with dry weights up to about 5,500 lb', src: 'sizes' }],
  },
  {
    id: '10000',
    name: '10,000 lb lift',
    capacity: 10000,
    group: 'mid',
    summary: '4 arms · 2 axles · 2 poly tanks',
    facts: [{ text: '4 arms, 2 axles, 2 poly tanks', src: 'sizes' }],
  },
  {
    id: '12000',
    name: '12,000 lb lift',
    capacity: 12000,
    group: 'mid',
    summary: '6 arms · 3 axles · 2 poly tanks',
    facts: [{ text: '6 arms, 3 axles, 2 poly tanks', src: 'sizes' }],
  },
  {
    id: '14000',
    name: '14,000 lb lift',
    capacity: 14000,
    group: 'mid',
    summary: '6 arms · 3 axles · 2 poly tanks',
    facts: [{ text: '6 arms, 3 axles, 2 poly tanks', src: 'sizes' }],
  },
  {
    id: '16000',
    name: '16,000 lb lift',
    capacity: 16000,
    group: 'large',
    summary: '6 arms · 3 axles · 2 poly tanks',
    facts: [{ text: '6 arms, 3 axles, 2 poly tanks', src: 'sizes' }],
  },
  {
    id: '20000',
    name: '20,000 lb lift',
    capacity: 20000,
    group: 'large',
    summary: '6 arms · 3 axles · 3 poly tanks',
    facts: [{ text: '6 arms, 3 axles, 3 poly tanks', src: 'sizes' }],
  },
  {
    id: '24000',
    name: '24,000 lb lift',
    capacity: 24000,
    group: 'large',
    summary: '8 arms · 4 axles · 3 poly tanks',
    facts: [{ text: '8 arms, 4 axles, 3 poly tanks', src: 'sizes' }],
  },
];

export const getSize = (id: string) => liftSizes.find((s) => s.id === id);
/** The boat-lift sizes (not PWC), smallest first: what the calculator recommends from */
export const boatSizes = liftSizes.filter((s) => s.group !== 'pwc').sort((a, b) => a.capacity - b.capacity);
export const lb = (n: number) => `${n.toLocaleString('en-US')} lb`;

/* ---------- The lift-size formula (home page) ---------- */

/**
 * "DRY WEIGHT + FUEL WEIGHT (7 lbs. per gallon) + 2,000 lbs. for boats up to 30 ft. long {add 3,000 lbs. for larger
 * boats} = Lift Size needed." Source: home page.
 */
export const formula = {
  fuelLbPerGallon: 7,
  allowanceUpTo30ft: 2000,
  allowanceOver30ft: 3000,
  lengthCutoffFt: 30,
  src: 'home' as SourceKey,
};

export interface SizeEstimate {
  dryWeight: number;
  fuelWeight: number;
  allowance: number;
  needed: number;
  /** The smallest standard FiberSteel size that covers it, or null if it's beyond 24,000 lb (call) */
  size: LiftSize | null;
}

/** The formula, exactly as FiberSteel's home page gives it. */
export function estimateLiftSize(dryWeight: number, fuelGallons: number, lengthFt: number): SizeEstimate {
  const fuelWeight = Math.round(Math.max(0, fuelGallons) * formula.fuelLbPerGallon);
  const allowance = lengthFt > formula.lengthCutoffFt ? formula.allowanceOver30ft : formula.allowanceUpTo30ft;
  const needed = Math.round(Math.max(0, dryWeight)) + fuelWeight + allowance;
  return { dryWeight, fuelWeight, allowance, needed, size: boatSizes.find((s) => s.capacity >= needed) ?? null };
}

/** What FiberSteel asks for to quote a lift (home page) */
export const quoteChecklist: Fact[] = [
  { text: "Your boat's brand", src: 'home' },
  { text: 'Its model', src: 'home' },
  { text: 'Its length', src: 'home' },
  { text: 'Its weight', src: 'home' },
  { text: "Your dock slip's size: width × length", src: 'home' },
];

/* ---------- Lifts by boat type ---------- */

export interface LiftType {
  slug: string;
  name: string;
  /** Short label for menus and chips */
  short: string;
  /** What FiberSteel's pages say about the lifts for this boat type (their facts) */
  tagline: Fact;
  /** Fresh copy for the page */
  intro: string;
  /** Sizes FiberSteel lists for this type */
  sizes: string[];
  sizeNote?: Fact;
  /** Ways the lift is built for the boat — each fact + a photo of it */
  options: { title: string; text: string; src: SourceKey; photo?: string }[];
  hero: string;
  gallery: string[];
  /** Old address on the GoDaddy site (redirects here) */
  oldPath: string;
  /** Pre-selects the quote form's boat type */
  quoteType: string;
}

export const liftTypes: LiftType[] = [
  {
    slug: 'pwc',
    name: 'PWC lifts',
    short: 'PWC',
    tagline: { text: 'For any size personal watercraft', src: 'home' },
    intro:
      'Drive on, raise it with the blower, and your watercraft rides high and dry beside the dock. Single lifts, twin sets that run each lift on its own, and double lifts for two watercraft.',
    sizes: ['pwc-single', 'pwc-twin', 'pwc-double'],
    options: [
      { title: 'Drive-on style', text: 'Just drive your watercraft right up on it.', src: 'pwc', photo: 'pwc/drive-on-down' },
      { title: 'Front mounted, almost anywhere', text: 'A front-mounted PWC lift can be mounted almost anywhere on a dock.', src: 'pwc', photo: 'pwc/front-mounted-pwc' },
      { title: 'Twin sets, run separately', text: "FiberSteel's exclusive twin set: each lift is operated on its own from a single blower controller box on your dock.", src: 'pwc', photo: 'pwc/twin-set' },
      { title: 'Strong dock brackets', text: 'Steel mounting brackets for a secure attachment to the frame of the dock.', src: 'pwc', photo: 'pwc/mounting-brackets' },
      { title: 'Economy double', text: 'An economy double lift with no front bow posts and less decking, built to hold 2 watercraft.', src: 'pwc', photo: 'pwc/economy-double' },
      { title: 'Narrow slips', text: 'PWC lifts can be customized to fit an extra-narrow dock slip.', src: 'pwc' },
    ],
    hero: 'pwc/twin-set-2',
    gallery: ['pwc/single-pwc', 'pwc/single-drive-on-up', 'pwc/double-pwc', 'pwc/double-bow-post', 'pwc/twin-set', 'front/pwc-set'],
    oldPath: '/pwc-lifts',
    quoteType: 'pwc',
  },
  {
    slug: 'v-bottom-cat-hull',
    name: 'V-bottom & cat-hull lifts',
    short: 'V-bottom & cat-hull',
    tagline: { text: 'Boat lifts for V-hull boats from about 4,800 lb to 24,000 lb lift sizes', src: 'vbottom' },
    intro:
      'Fishing boats, ski and wake boats, runabouts and cats: FiberSteel sets the bunks for your hull, from standard V-bunks to extra-tall bunks that clear an inboard drive.',
    sizes: ['4800', '6800', '8000', '10000', '12000', '14000', '16000', '20000', '24000'],
    sizeNote: { text: 'The home page lists 4,800, 6,800 and 8,000 lb; 10,000 to 16,000 lb; and 24,000 lb lifts for V-bottom and cat-hull boats.', src: 'home' },
    options: [
      { title: 'Extra-tall bunks for inboards', text: 'Extra-tall bunks lift inboard-drive ski boats clear.', src: 'vbottom', photo: 'vbottom/8000-tall-bunks-ski-boat' },
      { title: 'Lift guides', text: 'FiberSteel lift guides, here on a 16,000 lb lift.', src: 'vbottom', photo: 'vbottom/16000-with-guides' },
      { title: 'Walk boards', text: 'Lift-mounted double walk boards, or walk boards on posts.', src: 'vbottom', photo: 'vbottom/16000-14ft-double-walkboards' },
      { title: 'Offset in the slip', text: 'Lifts can be installed offset to one side of a wide slip.', src: 'vbottom', photo: 'vbottom/10000-16ft-offset' },
      { title: 'Cat-hull and stepped-hull bunks', text: 'Extra-tall bunks for cat hulls, and special stepped-hull bunks.', src: 'sizes' },
      { title: 'Combo bunks', text: 'COMBO bunks hold V-bottom boats and pontoons or tri-toons on the same lift.', src: 'vbottom', photo: 'pontoon/combo-bunks' },
    ],
    hero: 'vbottom/16000-chris-craft-corsair',
    gallery: ['vbottom/16000-with-guides', 'vbottom/10000-tall-bunks-ski-boat', 'vbottom/16000-post-walkboards', 'vbottom/14000-6-arm', 'vbottom/8000-lift', 'vbottom/10000-lift', 'vbottom/16000-12ft-slip', 'parts/bunk-brackets-v-bunks'],
    oldPath: '/v-bottom-%26-cat-hull-1',
    quoteType: 'v-bottom',
  },
  {
    slug: 'pontoons-tri-toons',
    name: 'Pontoon & tri-toon lifts',
    short: 'Pontoons & tri-toons',
    tagline: { text: 'Built for any size or type!', src: 'home' },
    intro:
      'Two tubes or three, deep center pontoon or flat deck: the bunks are built to the boat. Flat-deck and under-deck bunks, tri-toon bunks, extra-tall brackets and combo bunks.',
    sizes: ['6800'],
    sizeNote: { text: 'Pontoon lifts shown on the current site are 6,800 lb lifts; the home page says they are built for any size or type.', src: 'pontoon' },
    options: [
      { title: 'Flat-deck bunks', text: 'For most pontoons and tri-toons — and jon boats, paddle boats, canoes and kayaks.', src: 'pontoon', photo: 'pontoon/flat-deck-bunks' },
      { title: 'Under-deck bunks', text: 'Under-deck bunks for most pontoons and tri-toons.', src: 'pontoon', photo: 'pontoon/under-deck-bunks' },
      { title: 'A lower center pontoon', text: 'Some tri-toons have a larger or deeper center pontoon that needs special bunks — like Manitou tri-toons, whose center pontoon sits 5¼ in. lower.', src: 'pontoon', photo: 'pontoon/manitou-tritoon-bunks' },
      { title: 'Extra-tall bunks for narrow slips', text: 'Extra-tall tri-toon bunks for certain lifts in a narrow 10 ft wide slip.', src: 'pontoon' },
      { title: 'Combo bunks', text: 'A lift built with combo bunks holds pontoons, tri-toons, V-bottom, flat-hull, cat-hull and tri-hull boats.', src: 'pontoon', photo: 'pontoon/combo-bunks' },
      { title: 'Offset in the slip', text: 'Pontoon and tri-toon lifts can be offset in a 16 ft wide slip.', src: 'pontoon', photo: 'pontoon/offset-16ft-slip' },
    ],
    hero: 'pontoon/offset-16ft-slip',
    gallery: ['pontoon/6800-pontoon-bunks', 'pontoon/6800-flat-deck', 'pontoon/tritoon-lowering', 'pontoon/tritoon-low-center', 'pontoon/flat-deck-shallow', 'pontoon/tritoon-lift'],
    oldPath: '/pontoons-%26-tri-toons',
    quoteType: 'pontoon',
  },
  {
    slug: 'performance-cruisers',
    name: 'Performance boat & cruiser lifts',
    short: 'Performance & cruisers',
    tagline: { text: "'Back-in' docking, cat-hulls, stepped hulls, offset in wide slips — 10,000 lb to 16,000 lb lifts", src: 'home' },
    intro:
      'Cuddies, performance boats and cruisers, set up the way you dock: straight pull-in or back-in, centered or offset, with extra-long arms and extra-tall bunks where the drives need them.',
    sizes: ['10000', '12000', '14000', '16000'],
    options: [
      { title: 'Back-in docking', text: 'Lifts set up for back-in docking, with extra-long lift arms.', src: 'performance', photo: 'performance/14000-back-in-offset' },
      { title: 'Premium walkboards', text: 'Premium walkboards on both sides of the lift.', src: 'performance', photo: 'performance/14000-back-in-walkboards' },
      { title: 'Custom fitted', text: 'A 20,000 lb lift custom fitted into a 12 ft wide slip, with extra-long back-in arms.', src: 'performance', photo: 'performance/20000-12ft-slip' },
      { title: 'Extra-tall bunks', text: 'Extra-tall bunks for inboard drives and props.', src: 'performance', photo: 'performance/10000-tall-bunks-back-in' },
    ],
    hero: 'performance/2-valve-admiral-14000',
    gallery: ['performance/14000-14ft-slip', 'performance/16000-lift', 'large/24000-chris-craft-back-in', 'performance/14000-back-in-walkboards', 'home/triple-outboards', 'vbottom/16000-chris-craft-corsair'],
    oldPath: '/perfomance-boats-cruisers',
    quoteType: 'performance',
  },
  {
    slug: 'large-boats-cruisers',
    name: 'Large boat & cruiser lifts',
    short: 'Large boats & cruisers',
    tagline: { text: '16,000 to 24,000 lb lifts', src: 'large' },
    intro:
      'For the big ones: 16,000 to 24,000 lb lifts with up to 8 arms, 4 axles and 3 poly tanks, a V-brace at the bow for extra support, and lift guides to bring it home straight.',
    sizes: ['16000', '20000', '24000'],
    options: [
      { title: 'A V-brace at the bow', text: 'A V-brace bunk at the bow end gives extra support under some boats.', src: 'large', photo: 'parts/v-brace' },
      { title: 'Back-in or straight pull-in', text: '24,000 lb lifts installed as a back-in; 16,000 lb lifts as a straight pull-in.', src: 'large', photo: 'large/24000-back-in-16ft' },
      { title: 'Lift guides', text: 'FiberSteel lift guides on a 16,000 lb lift in a 14 ft wide slip.', src: 'large', photo: 'large/16000-lift-guides' },
      { title: 'Big boats, narrow slips', text: 'A 24,000 lb lift in a 14 ft wide slip, for a 53 ft Nor-Tech.', src: 'large', photo: 'large/24000-nor-tech' },
    ],
    hero: 'large/24000-back-in',
    gallery: ['large/24000-chris-craft-2', 'large/16000-straight-pull-in', 'large/24000-back-in-16ft-2', 'large/16000-tall-bunks-grand-lake', 'remotes/3-valve-24000', 'large/24000-chris-craft-back-in'],
    oldPath: '/large-boats-%26-cruisers',
    quoteType: 'large',
  },
  {
    slug: 'front-mounted',
    name: 'Front-mounted lifts',
    short: 'Front-mounted',
    tagline: { text: 'Super strong front-mounted lift with a 6,800 lb poly tank', src: 'front' },
    intro:
      'Front-mounted lifts attach to the dock itself on strong brackets — a front-mounted PWC lift can be mounted almost anywhere on a dock. FiberSteel builds them for boats, small sailboats and watercraft.',
    sizes: [],
    sizeNote: { text: 'Front-mounted lifts on the current site use a 6,800 lb poly tank, a 2,000 lb tank (custom, for a small catamaran sailboat) or 1,500 lb tanks (PWC sets).', src: 'front' },
    options: [
      { title: 'How it mounts', text: 'The attachment bracket has a poly bushing.', src: 'sizes', photo: 'parts/front-mount-bracket' },
      { title: 'Custom for sailboats', text: 'A custom front-mounted lift with a 2,000 lb poly tank, built for a small catamaran sailboat.', src: 'front', photo: 'front/catamaran-sailboat' },
      { title: 'PWC sets', text: 'Front-mounted PWC lift sets, each with a 1,500 lb poly tank, that work independently.', src: 'front', photo: 'front/pwc-set' },
    ],
    hero: 'front/6800-front-mounted',
    gallery: ['front/diagram', 'front/6800-front-mounted-2', 'front/6800-front-mounted-3', 'pwc/front-mounted-pwc'],
    oldPath: '/front-mounted-lifts',
    quoteType: 'front',
  },
  {
    slug: 'shallow-water',
    name: 'Shallow-water lifts',
    short: 'Shallow water',
    tagline: { text: 'Poly tanks only 20 to 24 inches deep', src: 'home' },
    intro:
      'Shallow cove, low lake level, or a dock where the bottom comes up fast: FiberSteel special-builds lifts with low-profile poly tanks for water most lifts can’t work in.',
    sizes: [],
    sizeNote: { text: 'Special-built 8,000 lb shallow-water lifts with 20 inch deep tanks, and 6,000 lb shallow-water lifts.', src: 'shallow' },
    options: [
      { title: 'Low-profile tanks', text: "FiberSteel's special-built 8,000 lb shallow-water lift has 20 inch deep tanks.", src: 'shallow', photo: 'shallow/8000-shallow-bow' },
      { title: 'V-bunks or flat bunks', text: 'With V-bunks, flat-deck style bunks, or flat bunks for pontoons and some tri-toons.', src: 'shallow', photo: 'shallow/6000-shallow-pontoon' },
    ],
    hero: 'shallow/8000-shallow-v-bunks',
    gallery: ['shallow/8000-shallow-2', 'shallow/6000-shallow', 'shallow/6000-shallow-flat-deck', 'shallow/8000-shallow-3'],
    oldPath: '/shallow-water-lifts',
    quoteType: 'shallow',
  },
];

export const getLiftType = (slug: string) => liftTypes.find((t) => t.slug === slug);
export const liftTypeHref = (slug: string) => `/lifts/${slug}/`;

/* ---------- Why FiberSteel (About page, their argument) ---------- */

export const whyFiberSteel: Fact[] = [
  { text: 'Proven design', src: 'about' },
  { text: 'Over 30 years strong', src: 'about' },
  { text: 'Virtually no metal parts in the water', src: 'about' },
  { text: 'Works in shallow water', src: 'about' },
];

/* ---------- Parts & features (sizes page gallery) ---------- */

export const parts: { title: string; photo: string; src: SourceKey }[] = [
  { title: 'Poly & stainless bushings', photo: 'parts/bushing-assembly', src: 'sizes' },
  { title: 'Tank shut-off valve', photo: 'parts/tank-shut-off-valve', src: 'sizes' },
  { title: 'Poly hull protectors', photo: 'parts/hull-protectors', src: 'sizes' },
  { title: 'V-brace for large cruisers', photo: 'parts/v-brace', src: 'sizes' },
  { title: 'Lift guides', photo: 'parts/lift-guides', src: 'sizes' },
  { title: 'Tall tri-toon bunk brackets', photo: 'parts/tritoon-riser-brackets', src: 'sizes' },
  { title: 'PWC dock bracket with stop', photo: 'parts/pwc-dock-bracket-stop', src: 'sizes' },
  { title: 'Front-mount bracket', photo: 'parts/front-mount-bracket', src: 'sizes' },
];
