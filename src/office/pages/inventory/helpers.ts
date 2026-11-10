/** Inventory-only helpers: purchase-order math, build capacity, reorder suggestions, labels and CSV export. */
import type { DB, Item, Job, PurchaseOrder, StockMove, Vendor } from '../../data/types';
import { available } from '../../selectors';
import type { Tone } from '../../ui/core';
import type { IconName } from '../../ui/Icon';

type Meta = { label: string; tone: Tone; icon: IconName };

/** FiberSteel works from one place: the shop, office and yard in Camdenton */
export const SHOP = 'camdenton' as const;
export const SHOP_NAME = 'Camdenton shop';

export const poStatusMeta: Record<PurchaseOrder['status'], Meta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'edit' },
  ordered: { label: 'Ordered', tone: 'blue', icon: 'send' },
  partial: { label: 'Partly received', tone: 'amber', icon: 'truck' },
  received: { label: 'Received', tone: 'green', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'x-circle' },
};

export const moveMeta: Record<StockMove['kind'], Meta> = {
  received: { label: 'Received', tone: 'green', icon: 'download' },
  built: { label: 'Built in the shop', tone: 'violet', icon: 'hardhat' },
  job: { label: 'Used on a job', tone: 'accent', icon: 'wrench' },
  shipped: { label: 'Shipped to a dealer', tone: 'teal', icon: 'truck' },
  sold: { label: 'Sold', tone: 'blue', icon: 'receipt' },
  adjustment: { label: 'Adjustment', tone: 'amber', icon: 'edit' },
};

export const isOpenPO = (po: PurchaseOrder) => po.status === 'draft' || po.status === 'ordered' || po.status === 'partial';
export const poTotal = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.qty * l.cost, 0);
export const poOrderedQty = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.qty, 0);
export const poReceivedQty = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + Math.min(l.qty, l.received), 0);
export const poOutstanding = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + Math.max(0, l.qty - l.received), 0);

/** FiberSteel's own shop "vendor" — lifts and dock steps are built here, not bought */
export const SHOP_VENDOR = 'v-shop';
export const isShopBuilt = (it: Pick<Item, 'vendorId'>) => it.vendorId === SHOP_VENDOR;

/** Vendors FiberSteel buys stock from: materials, components and other makers' products */
export const stockVendors = (d: DB): Vendor[] => d.vendors.filter((v) => v.id !== SHOP_VENDOR && (v.kind === 'materials' || v.kind === 'components' || v.kind === 'resale'));

/** Can this item go on a purchase order? (Not lifts or dock steps built in the shop, not trade-ins) */
export const orderable = (it: Item) => !isShopBuilt(it) && it.kind !== 'used';

/** "8 ft", "2 sets", "3" */
export function qtyLabel(it: Pick<Item, 'uom'>, n: number): string {
  if (it.uom === 'ft') return `${n} ft`;
  if (it.uom === 'set') return `${n} set${n === 1 ? '' : 's'}`;
  return String(n);
}

/** What an item is, in a word or two */
export const kindLabel: Record<Item['kind'], string> = {
  lift: 'Lift',
  product: 'FiberSteel product',
  component: 'Component',
  resale: 'Resale',
  used: 'Used lift',
};

/** Icon for items without a FiberSteel photo (other makers' products, generic parts) */
export function itemIcon(it: Item): IconName {
  if (it.category === 'Remotes') return 'remote';
  if (it.category === 'Docking stations') return 'anchor';
  if (it.category === 'Dock steps') return 'steps';
  if (it.kind === 'lift' || it.kind === 'used') return 'lift';
  if (it.category === 'Blowers & controls') return 'bolt';
  return it.kind === 'component' ? 'wrench' : 'box';
}

/** Outstanding quantity of an item on open (ordered or partly received) purchase orders */
export function onOrder(d: DB, itemId: string): number {
  let n = 0;
  for (const po of d.pos) {
    if (po.status !== 'ordered' && po.status !== 'partial') continue;
    for (const l of po.lines) if (l.itemId === itemId) n += Math.max(0, l.qty - l.received);
  }
  return n;
}

/* ---------- Builds ---------- */

const doneStates = new Set(['completed', 'closed', 'cancelled']);
export const isOpenBuild = (j: Job) => j.type === 'build' && !doneStates.has(j.status);

export interface BuildCapacity {
  /** Lifts that could be built from components on hand, after what's already set aside */
  canBuild: number;
  /** The component that runs out first */
  limiting?: { item: Item; perLift: number; available: number };
  lines: { item: Item; perLift: number; available: number; enoughFor: number }[];
}

/** How many of a lift the shop could build right now from free stock (minimum over its bill of materials) */
export function buildCapacity(d: DB, lift: Item): BuildCapacity {
  const lines = (lift.bom ?? [])
    .map((b) => {
      const item = d.items.find((i) => i.id === b.itemId);
      if (!item) return undefined;
      const a = Math.max(0, available(item, SHOP));
      return { item, perLift: b.qty, available: a, enoughFor: Math.floor(a / b.qty) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!lines.length) return { canBuild: 0, lines };
  const limiting = lines.reduce((min, l) => (l.enoughFor < min.enoughFor ? l : min), lines[0]);
  return { canBuild: limiting.enoughFor, limiting: { item: limiting.item, perLift: limiting.perLift, available: limiting.available }, lines };
}

/** The lifts that use a component, and how many per lift */
export const usedIn = (d: DB, componentId: string) =>
  d.items.filter((it) => it.kind === 'lift' && it.bom?.some((b) => b.itemId === componentId)).map((it) => ({ lift: it, perLift: it.bom!.find((b) => b.itemId === componentId)!.qty }));

/** Open shop builds for a lift: jobs and how many lifts they make */
export function openBuildsFor(d: DB, itemId: string) {
  const jobs = d.jobs.filter((j) => isOpenBuild(j) && j.itemId === itemId);
  return { jobs, qty: jobs.reduce((s, j) => s + (j.qty ?? 1), 0) };
}

/* ---------- Reorders ---------- */

export interface ReorderGroup {
  vendorId: string;
  lines: { itemId: string; qty: number; available: number }[];
}

/**
 * Items below their reorder point that aren't already on an open purchase order, grouped by vendor so each group can
 * become one draft order. Lifts built in the shop and trade-ins never show up here.
 */
export function reorderSuggestions(d: DB): ReorderGroup[] {
  const covered = new Set<string>();
  for (const po of d.pos) {
    if (!isOpenPO(po)) continue;
    for (const l of po.lines) if (l.received < l.qty) covered.add(l.itemId);
  }
  const groups = new Map<string, ReorderGroup>();
  for (const it of d.items) {
    if (!orderable(it) || it.buildToOrder || it.reorderQty <= 0) continue;
    const a = available(it, SHOP);
    if (a >= it.reorderPoint || covered.has(it.id)) continue;
    const group = groups.get(it.vendorId) ?? { vendorId: it.vendorId, lines: [] };
    group.lines.push({ itemId: it.id, qty: it.reorderQty + Math.max(0, -a), available: a });
    groups.set(it.vendorId, group);
  }
  return [...groups.values()].sort((a, b) => b.lines.length - a.lines.length);
}

/** Download rows as a CSV file (client-side; nothing leaves the browser). */
export function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
