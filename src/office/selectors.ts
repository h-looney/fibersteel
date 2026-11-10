/**
 * Derived values shared across FiberSteel mode: invoice math, stock levels, lift warranty coverage, revenue.
 * Pure functions of the data — no editing here.
 */
import { addDays, diffDays, inRange, monthKey, today } from './lib/dates';
import type { Component, Customer, DB, Dealer, History, Invoice, Item, Job, Lift, RevenueCategory, Staff, StoreFilter, StoreId } from './data/types';

export const STORES: StoreId[] = ['camdenton'];
export const storeName = (_s?: StoreId | 'all' | 'both') => 'Camdenton';
export const matchStore = (filter: StoreFilter, store: StoreId) => filter === 'all' || filter === store;

/* ---------- Lookups ---------- */

const cache = new WeakMap<object, Map<string, unknown>>();
function indexBy<T extends { id: string }>(list: T[]): Map<string, T> {
  let m = cache.get(list) as Map<string, T> | undefined;
  if (!m) {
    m = new Map(list.map((x) => [x.id, x]));
    cache.set(list, m as Map<string, unknown>);
  }
  return m;
}

export const byId = <T extends { id: string }>(list: T[], id: string | undefined): T | undefined => (id ? indexBy(list).get(id) : undefined);
export const customerOf = (d: DB, id?: string) => byId<Customer>(d.customers, id);
export const liftOf = (d: DB, id?: string) => byId<Lift>(d.lifts, id);
export const itemOf = (d: DB, id?: string) => byId<Item>(d.items, id);
export const staffOf = (d: DB, id?: string) => byId<Staff>(d.staff, id);
export const jobOf = (d: DB, id?: string) => byId<Job>(d.jobs, id);
export const invoiceOf = (d: DB, id?: string) => byId<Invoice>(d.invoices, id);
export const dealerOf = (d: DB, id?: string) => byId<Dealer>(d.dealers, id);
export const firstName = (d: DB, id?: string) => (id === 'system' ? 'FiberSteel mode' : id === 'customer' ? 'Customer' : staffOf(d, id)?.name.split(' ')[0] ?? '—');
export const itemLabel = (it: Item) => it.name;

/**
 * Which thumbnail (an Assets.photos key, built in src/pages/office/[...section].astro) shows for a catalog item.
 * FiberSteel's own photos only — other makers' products (remote systems, docking stations) get no photo.
 */
export function itemPhotoKey(it?: Item): string | undefined {
  if (!it) return undefined;
  if (it.kind === 'used') return 'used';
  const byId: Record<string, string> = {
    'L-SHAL8': 'shallow',
    'L-FRONT': 'front',
    'L-PWC2': 'pwc-twin',
    'C-GUIDES': 'guides',
    'C-PWC-BRKT': 'pwc-bracket',
    'C-FM-BRKT': 'front-bracket',
    'C-VBRACE': 'vbrace',
    'C-HULLPRO': 'hull',
    'C-BUSH': 'hardware',
    'C-VALVE': 'controls',
  };
  if (byId[it.id]) return byId[it.id];
  if (it.category === 'PWC lifts') return 'pwc';
  if (it.category === 'Boat lifts') return (it.capacity ?? 0) >= 20000 ? 'large' : 'boat-lift';
  if (it.category === 'Dock steps') return 'steps';
  if (it.category === 'Bunks & brackets') return it.id === 'C-BUNK-TRI' || it.id === 'C-BUNK-PONT' ? 'pontoon' : 'bunks';
  return undefined;
}
export const liftLabel = (l: Lift) => `${l.model}${l.kind === 'pwc' ? '' : l.boat ? ` · ${l.boat.lengthFt} ft ${l.boat.type.toLowerCase()}` : ''}`;

/* ---------- Invoices ---------- */

export function invoiceTotals(inv: Invoice) {
  const subtotal = inv.lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const taxable = inv.lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.rate, 0);
  const tax = Math.round(taxable * inv.taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { subtotal, tax, total, paid, balance };
}

export type InvoiceStatus = 'draft' | 'open' | 'partial' | 'overdue' | 'paid' | 'void' | 'sent' | 'accepted' | 'declined' | 'expired';

export function invoiceStatus(inv: Invoice, day = today()): InvoiceStatus {
  if (inv.status === 'draft' || inv.status === 'void') return inv.status;
  if (inv.kind === 'estimate') {
    if (inv.status === 'accepted' || inv.status === 'declined') return inv.status;
    return inv.dueOn < day ? 'expired' : 'sent';
  }
  const { paid, balance } = invoiceTotals(inv);
  if (balance <= 0) return 'paid';
  if (inv.dueOn < day) return 'overdue';
  return paid > 0 ? 'partial' : 'open';
}

export const daysOverdue = (inv: Invoice, day = today()) => Math.max(0, diffDays(day, inv.dueOn));

/** Money owed, bucketed by how late it is */
export function arAging(d: DB, store: StoreFilter, day = today()) {
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
  const rows: { inv: Invoice; balance: number; days: number }[] = [];
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || !matchStore(store, inv.store)) continue;
    const st = invoiceStatus(inv, day);
    if (st === 'paid' || st === 'void' || st === 'draft') continue;
    const { balance } = invoiceTotals(inv);
    const days = daysOverdue(inv, day);
    if (days === 0) buckets.current += balance;
    else if (days <= 30) buckets.d30 += balance;
    else if (days <= 60) buckets.d60 += balance;
    else buckets.d90 += balance;
    buckets.total += balance;
    rows.push({ inv, balance, days });
  }
  return { buckets, rows };
}

/* ---------- Inventory ---------- */

/** On hand minus reserved for jobs minus showroom/boat-show displays */
export const available = (it: Item, store: StoreId) => it.stock[store].onHand - it.stock[store].reserved - it.stock[store].display;

export type StockStatus = 'out' | 'low' | 'ok' | 'special';

export function stockStatus(it: Item, store: StoreFilter): StockStatus {
  if (it.buildToOrder || it.kind === 'used') return 'special';
  const stores = store === 'all' ? STORES : [store];
  let worst: StockStatus = 'ok';
  for (const s of stores) {
    const a = available(it, s);
    if (a <= 0 && it.reorderPoint > 0) return 'out';
    if (a <= it.reorderPoint && it.reorderPoint > 0) worst = 'low';
  }
  return worst;
}

export const lowStock = (d: DB, store: StoreFilter) => d.items.filter((it) => {
  const s = stockStatus(it, store);
  return s === 'low' || s === 'out';
});

export const stockValue = (it: Item, store: StoreFilter) => (store === 'all' ? STORES : [store]).reduce((s, st) => s + it.stock[st].onHand * it.cost, 0);

/* ---------- Lifts & warranty ---------- */

/**
 * FiberSteel's warranty (Warranty page): lifetime on the polyethylene tanks and lift frame; 5 years on hot-dipped
 * galvanized parts; 3 years on the blower controller, bushings and hose — to the original purchaser, for as long as
 * they own it, and valid only if FiberSteel installed the lift. Parts only.
 */
export interface Coverage {
  component: Component | 'Tanks & frame' | 'Galvanized parts' | 'Blower, bushings & hose';
  term: string;
  /** undefined = lifetime */
  until?: string;
  covered: boolean;
}

export function liftCoverage(l: Lift, day = today()): Coverage[] {
  const eligible = l.installedBy === 'FiberSteel' && l.originalOwner;
  const y = (n: number) => addDays(l.installedOn, Math.round(365.25 * n));
  return [
    { component: 'Tanks & frame', term: 'Lifetime', covered: eligible },
    { component: 'Galvanized parts', term: '5 years', until: y(5), covered: eligible && y(5) >= day },
    { component: 'Blower, bushings & hose', term: '3 years', until: y(3), covered: eligible && y(3) >= day },
  ];
}

/** Does the warranty cover this component today? */
export function covers(l: Lift, component: Component, day = today()) {
  const cov = liftCoverage(l, day);
  if (component === 'Poly tank' || component === 'Lift frame') return cov[0].covered;
  if (component === 'Galvanized part') return cov[1].covered;
  if (component === 'Blower controller' || component === 'Bushings' || component === 'Hose') return cov[2].covered;
  return false; // remote systems: their makers' warranties
}

export type WarrantyState = 'active' | 'expiring' | 'lifetime-only' | 'not-eligible';

/** The lift's warranty at a glance: the 3- and 5-year parts first, then lifetime tanks and frame */
export function warrantyState(l: Lift, day = today()): WarrantyState {
  if (l.installedBy !== 'FiberSteel' || !l.originalOwner) return 'not-eligible';
  const cov = liftCoverage(l, day);
  const three = cov[2].until!;
  const five = cov[1].until!;
  if (three >= day) return diffDays(three, day) <= 90 ? 'expiring' : 'active';
  if (five >= day) return diffDays(five, day) <= 90 ? 'expiring' : 'active';
  return 'lifetime-only';
}

/** The $95 service fee applies after one year from the installation date (Warranty page) */
export const serviceFeeApplies = (l: Lift, day = today()) => diffDays(day, l.installedOn) >= 365;

/** A yearly check is due 12 months after the last visit (or the install) — a sample reminder, not FiberSteel policy */
export const checkDueOn = (l: Lift) => addDays(l.lastServiceOn ?? l.installedOn, 365);

/* ---------- Jobs ---------- */

export const jobDay = (j: Job) => (j.start ?? j.completedAt ?? j.createdAt).slice(0, 10);
export const isOpenJob = (j: Job) => j.status === 'requested' || j.status === 'scheduled' || j.status === 'in-progress' || j.status === 'on-hold';
export const jobsOn = (d: DB, day: string, store: StoreFilter) =>
  d.jobs.filter((j) => j.start && j.start.slice(0, 10) === day && matchStore(store, j.store) && j.status !== 'cancelled').sort((a, b) => (a.start! < b.start! ? -1 : 1));

/* ---------- Revenue (recognized when the work is done) ---------- */

export interface RevenueEvent {
  day: string;
  store: StoreId;
  category: RevenueCategory;
  amount: number;
}

const revenueCache = new WeakMap<object, RevenueEvent[]>();

/**
 * Every dollar of revenue with the day it was earned: lifts, installs, service and remotes on the day the job was
 * completed, dealer orders and counter sales on the invoice date. History facts cover the months before the
 * detailed records begin.
 */
export function revenueEvents(d: DB, h: History): RevenueEvent[] {
  const cached = revenueCache.get(d.invoices);
  if (cached && revenueCache.get(h.jobs) === cached) return cached;
  const out: RevenueEvent[] = [];
  const store: StoreId = 'camdenton';
  const itemCat = (id: string) => byId(d.items, id)?.category;

  for (const s of h.sales) {
    if (s.channel === 'dealer') out.push({ day: s.day, store, category: 'Dealer sales', amount: s.revenue });
    else {
      const cat = itemCat(s.itemId);
      out.push({ day: s.day, store, category: cat === 'Remotes' || cat === 'Dock steps' || cat === 'Docking stations' ? 'Remotes & add-ons' : cat === 'Boat lifts' || cat === 'PWC lifts' ? 'Lifts' : 'Parts', amount: s.revenue || (byId(d.items, s.itemId)?.price ?? 0) * s.qty });
    }
  }
  for (const f of h.jobs) {
    if (!f.revenue) continue;
    out.push({ day: f.day, store, category: f.type === 'install' || f.type === 'remote' ? 'Installation' : 'Service', amount: f.revenue });
  }

  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const job = inv.jobId ? jobOf(d, inv.jobId) : undefined;
    let day = inv.issuedOn;
    if (job) {
      if (job.status !== 'closed' && job.status !== 'completed') continue;
      day = (job.completedAt ?? inv.issuedOn).slice(0, 10);
    }
    if (day < d.windowStart) continue;
    for (const l of inv.lines) out.push({ day, store: inv.store, category: l.category, amount: l.qty * l.rate });
  }
  revenueCache.set(d.invoices, out);
  revenueCache.set(h.jobs, out);
  return out;
}

export function revenueBetween(events: RevenueEvent[], from: string, to: string, store: StoreFilter) {
  let total = 0;
  for (const e of events) if (inRange(e.day, from, to) && matchStore(store, e.store)) total += e.amount;
  return total;
}

/** Revenue per month (oldest first) for the last `count` months, split into direct (lake) and dealer sales */
export function monthlyRevenue(events: RevenueEvent[], endDay: string, count: number) {
  const keys: string[] = [];
  let d = `${monthKey(endDay)}-01`;
  for (let i = 0; i < count; i++) {
    keys.unshift(monthKey(d));
    d = addDays(d, -1);
    d = `${monthKey(d)}-01`;
  }
  const rows = keys.map((key) => ({ key, direct: 0, dealer: 0 }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (const e of events) {
    const i = idx.get(e.day.slice(0, 7));
    if (i !== undefined && e.day <= endDay) rows[i][e.category === 'Dealer sales' ? 'dealer' : 'direct'] += e.amount;
  }
  return rows;
}
