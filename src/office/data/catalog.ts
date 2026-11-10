/**
 * FiberSteel mode's catalog: the lifts (one per size on the public site, src/data/lifts.ts), the components they're
 * built from, other makers' products FiberSteel sells, and used lifts.
 *
 * Prices: Admiral remotes and dock steps use the prices FiberSteel's current site shows (`publicPrice`). Every other
 * price and every cost and stock count is SAMPLE DATA for the demo — FiberSteel sets the real ones. Component names
 * are generic on purpose: the demo doesn't invent FiberSteel's part specs.
 */
import { getSize } from '../../data/lifts';
import type { Component, Item, ItemCategory, JobType, Vendor } from './types';

type Def = Omit<Item, 'stock' | 'reorderPoint' | 'reorderQty'> & { onHand: number; reorder?: [point: number, qty: number]; display?: number };

const lift = (id: string, sizeId: string, price: number, cost: number, onHand: number, bom: Item['bom'], opts: Partial<Def> = {}): Def => {
  const s = getSize(sizeId);
  if (!s) throw new Error(`Unknown size ${sizeId}`);
  return {
    id,
    name: s.name,
    brand: 'FiberSteel',
    category: s.group === 'pwc' ? 'PWC lifts' : 'Boat lifts',
    kind: 'lift',
    uom: s.id === 'pwc-twin' ? 'set' : 'ea',
    cost,
    price,
    vendorId: 'v-shop',
    sizeId,
    capacity: s.capacity,
    bom,
    onHand,
    ...opts,
  };
};

const part = (id: string, name: string, category: ItemCategory, cost: number, price: number, onHand: number, vendorId: string, reorder: [number, number], uom: Item['uom'] = 'ea'): Def => ({
  id,
  name,
  brand: 'FiberSteel',
  category,
  kind: 'component',
  uom,
  cost,
  price,
  vendorId,
  onHand,
  reorder,
});

// What a lift is built from (sample bills of materials — real ones would come from FiberSteel's shop)
const boatBom = (tanks: number, arms: number, axles: number, bunks = 'C-BUNK-V', box = 'C-BOX2'): Item['bom'] => [
  { itemId: 'C-TANK-LIFT', qty: tanks },
  { itemId: 'C-ARM', qty: arms },
  { itemId: 'C-AXLE', qty: axles },
  { itemId: 'C-FRAME', qty: 1 },
  { itemId: bunks, qty: 1 },
  { itemId: 'C-BRKT', qty: arms },
  { itemId: box, qty: 1 },
  { itemId: 'C-BLOWER', qty: 1 },
  { itemId: 'C-VALVE', qty: tanks },
  { itemId: 'C-HOSE', qty: 25 + tanks * 10 },
  { itemId: 'C-BUSH', qty: arms * 2 },
  { itemId: 'C-HULLPRO', qty: arms },
];

const defs: Def[] = [
  // ---------- Lifts (sizes from the public site; prices, costs and stock are samples) ----------
  lift('L-PWC1', 'pwc-single', 3400, 1850, 3, [{ itemId: 'C-TANK-PWC', qty: 1 }, { itemId: 'C-PWC-BRKT', qty: 2 }, { itemId: 'C-BOX1', qty: 1 }, { itemId: 'C-BLOWER', qty: 1 }, { itemId: 'C-HOSE', qty: 20 }, { itemId: 'C-BUSH', qty: 4 }], { reorder: [2, 2] }),
  lift('L-PWC2', 'pwc-twin', 6500, 3500, 1, [{ itemId: 'C-TANK-PWC', qty: 2 }, { itemId: 'C-PWC-BRKT', qty: 4 }, { itemId: 'C-BOX2', qty: 1 }, { itemId: 'C-BLOWER', qty: 1 }, { itemId: 'C-HOSE', qty: 40 }, { itemId: 'C-BUSH', qty: 8 }], { buildToOrder: true }),
  lift('L-PWCD', 'pwc-double', 5200, 2800, 0, [{ itemId: 'C-TANK-3700', qty: 1 }, { itemId: 'C-PWC-BRKT', qty: 2 }, { itemId: 'C-BOX1', qty: 1 }, { itemId: 'C-BLOWER', qty: 1 }, { itemId: 'C-HOSE', qty: 25 }, { itemId: 'C-BUSH', qty: 4 }], { buildToOrder: true }),
  lift('L-4800', '4800', 5600, 3000, 0, boatBom(1, 4, 2, 'C-BUNK-V', 'C-BOX1'), { buildToOrder: true }),
  lift('L-6800', '6800', 6600, 3550, 3, boatBom(1, 4, 2, 'C-BUNK-V', 'C-BOX1'), { reorder: [1, 2], display: 1 }),
  lift('L-8000', '8000', 7400, 4000, 1, boatBom(2, 4, 2), { buildToOrder: true }),
  lift('L-10000', '10000', 8900, 4800, 1, boatBom(2, 4, 2), { buildToOrder: true }),
  lift('L-12000', '12000', 10300, 5600, 0, boatBom(2, 6, 3), { buildToOrder: true }),
  lift('L-14000', '14000', 11600, 6300, 1, boatBom(2, 6, 3), { buildToOrder: true }),
  lift('L-16000', '16000', 13200, 7200, 0, boatBom(2, 6, 3), { buildToOrder: true }),
  lift('L-20000', '20000', 16800, 9100, 0, boatBom(3, 6, 3), { buildToOrder: true }),
  lift('L-24000', '24000', 20200, 11000, 0, [...(boatBom(3, 8, 4) ?? []), { itemId: 'C-VBRACE', qty: 1 }], { buildToOrder: true }),
  {
    ...lift('L-SHAL8', '8000', 8600, 4700, 0, [{ itemId: 'C-TANK-SHAL', qty: 2 }, { itemId: 'C-ARM', qty: 4 }, { itemId: 'C-AXLE', qty: 2 }, { itemId: 'C-FRAME', qty: 1 }, { itemId: 'C-BUNK-V', qty: 1 }, { itemId: 'C-BOX2', qty: 1 }, { itemId: 'C-BLOWER', qty: 1 }, { itemId: 'C-HOSE', qty: 45 }, { itemId: 'C-BUSH', qty: 8 }], { buildToOrder: true }),
    name: '8,000 lb shallow-water lift',
  },
  {
    ...lift('L-FRONT', '6800', 7100, 3900, 0, [{ itemId: 'C-TANK-LIFT', qty: 1 }, { itemId: 'C-FM-BRKT', qty: 2 }, { itemId: 'C-ARM', qty: 2 }, { itemId: 'C-BUNK-V', qty: 1 }, { itemId: 'C-BOX1', qty: 1 }, { itemId: 'C-BLOWER', qty: 1 }, { itemId: 'C-HOSE', qty: 25 }, { itemId: 'C-BUSH', qty: 4 }], { buildToOrder: true }),
    name: 'Front-mounted lift (6,800 lb tank)',
  },

  // ---------- Components (generic names; costs and stock are samples) ----------
  part('C-TANK-PWC', 'Poly tank — PWC (1,500 lb)', 'Poly tanks', 420, 690, 9, 'v-poly', [4, 6]),
  part('C-TANK-3700', 'Poly tank — double PWC (3,700 lb)', 'Poly tanks', 780, 1250, 3, 'v-poly', [2, 3]),
  part('C-TANK-LIFT', 'Poly tank — boat lift', 'Poly tanks', 960, 1550, 34, 'v-poly', [8, 10]),
  part('C-TANK-SHAL', 'Poly tank — shallow water (20 in. deep)', 'Poly tanks', 1050, 1700, 2, 'v-poly', [2, 4]),
  part('C-TANK-2000', 'Poly tank — 2,000 lb (custom front mount)', 'Poly tanks', 560, 920, 2, 'v-poly', [0, 1]),
  part('C-ARM', 'Galvanized lift arm', 'Frames & arms', 165, 290, 96, 'v-steel', [24, 40]),
  part('C-AXLE', 'Axle assembly', 'Frames & arms', 210, 360, 44, 'v-steel', [10, 16]),
  part('C-FRAME', 'Frame rail set', 'Frames & arms', 540, 880, 26, 'v-steel', [4, 6], 'set'),
  part('C-BUNK-V', 'V-bunk set', 'Bunks & brackets', 260, 450, 20, 'v-steel', [4, 6], 'set'),
  part('C-BUNK-PONT', 'Pontoon bunk set', 'Bunks & brackets', 300, 520, 5, 'v-steel', [3, 4], 'set'),
  part('C-BUNK-TRI', 'Tri-toon bunk set', 'Bunks & brackets', 380, 640, 3, 'v-steel', [2, 3], 'set'),
  part('C-BRKT', 'Bunk bracket', 'Bunks & brackets', 38, 70, 130, 'v-steel', [30, 40]),
  part('C-BRKT-TALL', 'Extra-tall bunk bracket', 'Bunks & brackets', 52, 95, 16, 'v-steel', [10, 16]),
  part('C-VBRACE', 'V-brace (bow end)', 'Bunks & brackets', 120, 210, 4, 'v-steel', [2, 3]),
  part('C-GUIDES', 'Lift guide set', 'Bunks & brackets', 230, 420, 5, 'v-steel', [2, 4], 'set'),
  part('C-WALK', 'Walk board set', 'Bunks & brackets', 340, 590, 6, 'v-steel', [3, 4], 'set'),
  part('C-HULLPRO', 'Poly hull protector', 'Hardware', 9, 18, 220, 'v-hardware', [60, 100]),
  part('C-PWC-BRKT', 'PWC dock bracket', 'Bunks & brackets', 44, 80, 22, 'v-steel', [10, 16]),
  part('C-FM-BRKT', 'Front-mount attachment bracket', 'Bunks & brackets', 95, 170, 6, 'v-steel', [4, 6]),
  part('C-BLOWER', 'Blower', 'Blowers & controls', 210, 365, 34, 'v-blower', [6, 8]),
  part('C-BOX1', 'Blower controller box — single valve', 'Blowers & controls', 160, 285, 11, 'v-blower', [4, 6]),
  part('C-BOX2', 'Blower controller box — double valve', 'Blowers & controls', 230, 395, 12, 'v-blower', [4, 6]),
  part('C-VALVE', 'Tank shut-off valve', 'Blowers & controls', 24, 45, 75, 'v-hardware', [20, 30]),
  part('C-HOSE', 'Air hose', 'Blowers & controls', 1.6, 3.5, 1500, 'v-hardware', [400, 600], 'ft'),
  part('C-BUSH', 'Poly & stainless bushing assembly', 'Hardware', 11, 22, 340, 'v-hardware', [100, 150]),
  part('C-NUT', 'Stainless Nylock nut', 'Hardware', 0.6, 1.5, 800, 'v-hardware', [300, 500]),

  // ---------- FiberSteel's other products and resale (public prices where the current site shows them) ----------
  { id: 'P-STEPS', name: 'Self-raising floating dock steps', brand: 'FiberSteel', category: 'Dock steps', kind: 'product', uom: 'ea', cost: 1150, price: 2195, publicPrice: true, vendorId: 'v-shop', onHand: 4, reorder: [2, 3], display: 1 },
  { id: 'R-ADM1', name: 'Admiral remote system — 1 valve', brand: 'Admiral', category: 'Remotes', kind: 'resale', uom: 'ea', cost: 1550, price: 2345, publicPrice: true, vendorId: 'v-remotes', onHand: 5, reorder: [3, 4] },
  { id: 'R-ADM2', name: 'Admiral remote system — 2 valve', brand: 'Admiral', category: 'Remotes', kind: 'resale', uom: 'ea', cost: 1680, price: 2520, publicPrice: true, vendorId: 'v-remotes', onHand: 10, reorder: [3, 4], display: 1 },
  { id: 'R-ADM3', name: 'Admiral remote system — 3 valve', brand: 'Admiral', category: 'Remotes', kind: 'resale', uom: 'ea', cost: 1860, price: 2785, publicPrice: true, vendorId: 'v-remotes', onHand: 5, reorder: [2, 2] },
  { id: 'R-ADM4', name: 'Admiral remote system — 4 valve', brand: 'Admiral', category: 'Remotes', kind: 'resale', uom: 'ea', cost: 1990, price: 2985, publicPrice: true, vendorId: 'v-remotes', onHand: 2, reorder: [0, 1] },
  { id: 'R-ADMAB', name: 'Admiral remote system — A/B split for 2 lifts', brand: 'Admiral', category: 'Remotes', kind: 'resale', uom: 'ea', cost: 1860, price: 2785, publicPrice: true, vendorId: 'v-remotes', onHand: 2, reorder: [1, 2] },
  { id: 'R-WAVE5', name: 'WaveArmor PWC docking station — 5 ft', brand: 'WaveArmor', category: 'Docking stations', kind: 'resale', uom: 'ea', cost: 1100, price: 1650, vendorId: 'v-docking', onHand: 2, reorder: [1, 2] },
  { id: 'R-WAVE6', name: 'WaveArmor PWC docking station — 6 ft', brand: 'WaveArmor', category: 'Docking stations', kind: 'resale', uom: 'ea', cost: 1250, price: 1850, vendorId: 'v-docking', onHand: 2, reorder: [1, 2] },

  // ---------- Used lifts (match the public site's sample listings) ----------
  { id: 'U-101', name: 'Used 8,000 lb lift with V-bunks', brand: 'FiberSteel', category: 'Used lifts', kind: 'used', uom: 'ea', cost: 2200, price: 3900, vendorId: 'v-shop', sizeId: '8000', capacity: 8000, onHand: 1 },
  { id: 'U-102', name: 'Used 6,800 lb pontoon lift', brand: 'FiberSteel', category: 'Used lifts', kind: 'used', uom: 'ea', cost: 1900, price: 3400, vendorId: 'v-shop', sizeId: '6800', capacity: 6800, onHand: 1 },
  { id: 'U-103', name: 'Used 14,000 lb lift', brand: 'FiberSteel', category: 'Used lifts', kind: 'used', uom: 'ea', cost: 3600, price: 6200, vendorId: 'v-shop', sizeId: '14000', capacity: 14000, onHand: 1 },
];

export function buildItems(): Item[] {
  return defs.map(({ onHand, reorder, display = 0, ...rest }) => ({
    ...rest,
    reorderPoint: reorder?.[0] ?? 0,
    reorderQty: reorder?.[1] ?? 0,
    stock: { camdenton: { onHand, reserved: 0, display } },
  }));
}

/** Lifts on the catalog, by size id (the first match: the standard build) */
export const liftItemFor = (sizeId: string) => defs.find((d) => d.kind === 'lift' && d.sizeId === sizeId)?.id;

export const vendors: Vendor[] = [
  // Sample payees and suppliers (invented — FiberSteel's real vendors would replace them)
  { id: 'v-shop', name: 'FiberSteel shop (built in-house)', kind: 'components', terms: 'Due on receipt', category: 'Steel & materials' },
  { id: 'v-steel', name: 'Steel & galvanizing supplier (sample)', kind: 'materials', terms: 'Net 30', account: 'FS-2201', category: 'Steel & materials' },
  { id: 'v-poly', name: 'Poly tank molder (sample)', kind: 'components', terms: 'Net 30', account: 'FS-118', category: 'Poly tanks' },
  { id: 'v-blower', name: 'Blower & controls supplier (sample)', kind: 'components', terms: 'Net 30', category: 'Steel & materials' },
  { id: 'v-hardware', name: 'Marine hardware supply (sample)', kind: 'components', terms: 'Net 30', category: 'Steel & materials' },
  { id: 'v-remotes', name: 'Remote systems distributor (sample)', kind: 'resale', terms: 'Net 30', category: 'Resale stock' },
  { id: 'v-docking', name: 'Docking station distributor (sample)', kind: 'resale', terms: 'Net 30', category: 'Resale stock' },
  { id: 'v-freight', name: 'Freight carrier (sample)', kind: 'services', terms: 'Net 15', category: 'Freight' },
  { id: 'v-util', name: 'Utilities — Camdenton (sample)', kind: 'utilities', terms: 'Net 15', category: 'Rent & utilities' },
  { id: 'v-fuel', name: 'Fleet fuel card (sample)', kind: 'services', terms: 'Net 15', category: 'Trucks, barge & fuel' },
  { id: 'v-insurance', name: 'Commercial insurance (sample)', kind: 'services', terms: 'Net 30', category: 'Insurance' },
  { id: 'v-shows', name: 'Boat show booths & ads (sample)', kind: 'services', terms: 'Net 30', category: 'Marketing & boat shows' },
  { id: 'v-cpa', name: 'Accounting firm (sample)', kind: 'services', terms: 'Net 30', category: 'Professional services' },
  { id: 'v-software', name: 'Phone, internet & software (sample)', kind: 'services', terms: 'Due on receipt', category: 'Software & fees' },
  { id: 'v-tools', name: 'Welding & tool supply (sample)', kind: 'materials', terms: 'Net 30', category: 'Shop supplies & tools' },
];

/** Service problems, by the component the warranty names, with the parts they usually take */
export interface IssueDef {
  label: string;
  component: Component;
  parts: string[];
}

export const issues: Record<string, IssueDef> = {
  'slow-raise': { label: 'Raises slowly or won’t raise', component: 'Blower controller', parts: ['C-BLOWER', 'C-VALVE'] },
  uneven: { label: 'Sits uneven or leans', component: 'Poly tank', parts: ['C-VALVE'] },
  hose: { label: 'Air hose leak', component: 'Hose', parts: ['C-HOSE'] },
  bushings: { label: 'Worn bushings or squeaks', component: 'Bushings', parts: ['C-BUSH'] },
  bunks: { label: 'Bunk or bracket adjustment', component: 'Galvanized part', parts: ['C-BRKT'] },
  blower: { label: 'Blower not running', component: 'Blower controller', parts: ['C-BLOWER'] },
  remote: { label: 'Remote not responding', component: 'Remote system', parts: [] },
  impact: { label: 'Storm or impact damage', component: 'Lift frame', parts: ['C-ARM', 'C-BRKT'] },
  tank: { label: 'Tank damage', component: 'Poly tank', parts: ['C-TANK-LIFT'] },
};

/** How often each issue shows up on service calls (sample weights) */
export const issueWeights: [string, number][] = [
  ['slow-raise', 22],
  ['bushings', 18],
  ['hose', 16],
  ['bunks', 14],
  ['uneven', 10],
  ['remote', 9],
  ['blower', 6],
  ['impact', 4],
  ['tank', 1],
];

/** Hours on a job, by type, and by lift size for builds and installs (sample standards) */
export const jobHours = (type: JobType, capacity = 8000) => {
  const big = Math.max(0, (capacity - 4800) / 19200); // 0 (4,800 lb) … 1 (24,000 lb)
  switch (type) {
    case 'site-visit':
      return 1;
    case 'build':
      return capacity <= 3700 ? 4 : Math.round((6 + big * 12) * 2) / 2;
    case 'install':
      return capacity <= 3700 ? 3 : Math.round((4 + big * 6) * 2) / 2;
    case 'remote':
      return 2;
    case 'delivery':
      return 3;
    default:
      return 1.5;
  }
};

export const checklists: Record<JobType, string[]> = {
  'site-visit': [
    'Confirm the boat: type, length, dry weight and fuel',
    'Measure the slip: width × length, and the water depth',
    'Note how they dock: straight pull-in or back-in, centered or offset',
    'Check overhead roof and structure clearance',
    'Photograph the slip and the dock frame',
    'Recommend the size and bunk setup, and send the quote',
  ],
  build: [
    'Pull the components from stock',
    'Assemble the frame, arms and axles',
    'Mount the poly tanks',
    'Fit the bunks and brackets for the boat',
    'Install the blower box, valves and hose',
    'Air test for leaks',
    'Tag the serial number and stage it in the yard',
  ],
  install: [
    'Confirm the size, bunks and docking style on the order',
    'Deliver the lift to the dock',
    'Mount it to the dock frame',
    'Set the bunks for the boat',
    'Connect the blower, valves and hose',
    'Test run: raise the boat carefully and check bunk position and hull clearance',
    'Walk the owner through the blower controls and the Do’s & Don’ts',
    'Register the warranty',
  ],
  service: ['Talk through the problem with the owner', 'Inspect the tanks, hose, valves and bushings', 'Repair or replace parts', 'Test raise and lower', 'Review the fix with the owner'],
  warranty: ['Confirm the original owner and the install date', 'Photograph the failed part', 'Replace the part', 'Test raise and lower', 'Record the claim'],
  delivery: ['Confirm the pickup or delivery window', 'Load and strap the lift', 'Deliver, or hand over to the freight carrier', 'Collect a signature'],
  remote: ['Mount the remote’s box on a post', 'Connect it to the blower', 'Sync the key fobs', 'Test up, down and auto-up', 'Show the owner the fobs'],
};

export const jobTypeLabels: Record<JobType, string> = {
  'site-visit': 'Site visit',
  build: 'Shop build',
  install: 'Install',
  service: 'Service call',
  warranty: 'Warranty',
  delivery: 'Delivery',
  remote: 'Remote install',
};
