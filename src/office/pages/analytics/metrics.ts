/** Report calculations: pure functions of the facts and a date range. */
import { issues } from '../../data/catalog';
import type { Component, Customer, DB, History, Item, JobFact, JobType, Lift } from '../../data/types';
import { addDays, diffDays } from '../../lib/dates';
import { available, checkDueOn, isOpenJob, liftCoverage, stockStatus, stockValue } from '../../selectors';
import { avg, median, sum, within, type Facts, type Range } from './facts';
import { reportCategory, reportItemName } from './standIns';

const SERVICE_TYPES = new Set<JobType>(['service', 'warranty']);
const FIELD_TYPES = new Set<JobType>(['install', 'service', 'warranty', 'remote', 'site-visit', 'delivery']);

/* ---------- Crews (placeholder people only) ---------- */

export type CrewWork = 'all' | 'install' | 'service' | 'build';

export interface CrewRow {
  id: string;
  name: string;
  title: string;
  team: 'Install crew' | 'Service' | 'Shop';
  jobs: number;
  installs: number;
  installHours: number;
  installEst: number;
  service: number;
  serviceHours: number;
  serviceEst: number;
  builds: number;
  buildHours: number;
  buildEst: number;
  siteVisits: number;
  onTime: number;
  timed: number;
  /** Their service visits that were a return trip for an earlier job */
  returns: number;
  revenue: number;
  actual: number;
  estimated: number;
}

/** The people the crew reports rate: install crews, service techs and the shop — placeholders, never Dean */
export const ratedStaff = (d: DB) => d.staff.filter((s) => (s.tech || s.shop) && s.role !== 'owner' && s.id !== 'dean');

const teamOf = (s: DB['staff'][number]): CrewRow['team'] => (s.shop ? 'Shop' : /service/i.test(s.title) ? 'Service' : 'Install crew');

const workMatches = (type: JobType, work: CrewWork) =>
  work === 'all' ? true : work === 'install' ? type === 'install' : work === 'build' ? type === 'build' : SERVICE_TYPES.has(type) || type === 'remote';

export function crewStats(d: DB, facts: Facts, range: Range, work: CrewWork = 'all'): CrewRow[] {
  const people = ratedStaff(d);
  const rows = new Map<string, CrewRow & { _ih: number[]; _ie: number[]; _sh: number[]; _se: number[]; _bh: number[]; _be: number[] }>();
  for (const s of people) {
    rows.set(s.id, { id: s.id, name: s.name, title: s.title, team: teamOf(s), jobs: 0, installs: 0, installHours: 0, installEst: 0, service: 0, serviceHours: 0, serviceEst: 0, builds: 0, buildHours: 0, buildEst: 0, siteVisits: 0, onTime: 0, timed: 0, returns: 0, revenue: 0, actual: 0, estimated: 0, _ih: [], _ie: [], _sh: [], _se: [], _bh: [], _be: [] });
  }
  for (const f of within(facts.jobs, range.from, range.to)) {
    if (!workMatches(f.type, work)) continue;
    f.crew.forEach((id, i) => {
      const r = rows.get(id);
      if (!r) return;
      r.jobs++;
      r.timed++;
      if (f.onTime) r.onTime++;
      r.actual += f.hours;
      r.estimated += f.estHours;
      if (f.type === 'install') {
        r.installs++;
        r._ih.push(f.hours);
        r._ie.push(f.estHours);
      } else if (f.type === 'build') {
        r.builds++;
        r._bh.push(f.hours);
        r._be.push(f.estHours);
      } else if (SERVICE_TYPES.has(f.type) || f.type === 'remote') {
        r.service++;
        r._sh.push(f.hours);
        r._se.push(f.estHours);
        if (f.callback) r.returns++;
      } else if (f.type === 'site-visit') r.siteVisits++;
      if (i === 0) r.revenue += f.revenue;
    });
  }
  return [...rows.values()]
    .map(({ _ih, _ie, _sh, _se, _bh, _be, ...r }) => ({ ...r, installHours: avg(_ih), installEst: avg(_ie), serviceHours: avg(_sh), serviceEst: avg(_se), buildHours: avg(_bh), buildEst: avg(_be) }))
    .filter((r) => r.jobs > 0);
}

export interface InstallCrewRow {
  key: string;
  label: string;
  members: string[];
  installs: number;
  hours: number;
  est: number;
  onTime: number;
}

/** Installs by crew (the lead and the installer together) */
export function installCrews(d: DB, facts: Facts, range: Range): InstallCrewRow[] {
  const rated = new Set(ratedStaff(d).map((s) => s.id));
  const first = (id: string) => d.staff.find((s) => s.id === id)?.name.split(' ')[0] ?? id;
  const acc = new Map<string, { members: string[]; hours: number[]; est: number[]; onTime: number }>();
  for (const f of within(facts.jobs, range.from, range.to)) {
    if (f.type !== 'install' || !f.crew.length || !f.crew.every((id) => rated.has(id))) continue;
    const key = f.crew.join('+');
    const a = acc.get(key) ?? { members: f.crew, hours: [], est: [], onTime: 0 };
    a.hours.push(f.hours);
    a.est.push(f.estHours);
    if (f.onTime) a.onTime++;
    acc.set(key, a);
  }
  return [...acc.entries()].map(([key, a]) => ({ key, label: a.members.map(first).join(' & '), members: a.members, installs: a.hours.length, hours: avg(a.hours), est: avg(a.est), onTime: a.onTime / a.hours.length }));
}

/* ---------- Service: what breaks, what's covered ---------- */

export const COMPONENTS: Component[] = ['Blower controller', 'Bushings', 'Hose', 'Galvanized part', 'Poly tank', 'Lift frame', 'Remote system'];

export function serviceStats(facts: Facts, range: Range) {
  const calls = within(facts.jobs, range.from, range.to).filter((f) => SERVICE_TYPES.has(f.type));
  const byComponent = COMPONENTS.map((c) => {
    const list = calls.filter((f) => f.component === c);
    return { key: c, label: c, calls: list.length, warranty: list.filter((f) => f.type === 'warranty').length, returns: list.filter((f) => f.callback).length };
  }).filter((r) => r.calls > 0);
  const issueCounts = new Map<string, number>();
  for (const f of calls) if (f.issue) issueCounts.set(f.issue, (issueCounts.get(f.issue) ?? 0) + 1);
  const byIssue = [...issueCounts.entries()]
    .map(([key, n]) => ({ key, label: issues[key]?.label ?? key, component: issues[key]?.component, calls: n }))
    .sort((a, b) => b.calls - a.calls);
  return {
    calls,
    total: calls.length,
    warranty: calls.filter((f) => f.type === 'warranty').length,
    returns: calls.filter((f) => f.callback).length,
    hours: avg(calls.map((f) => f.hours)),
    byComponent,
    byIssue,
  };
}

/** Lifts in service on a day: the analytics base (lifts from before the records) plus the customer registry */
export function liftsInService(d: DB, h: History, day: string) {
  return sum(Object.values(h.base)) + d.lifts.filter((l) => l.installedOn <= day).length;
}

/** Lifts with 3+ service or warranty visits in the last 12 months */
export function repeatLifts(d: DB, facts: Facts, today: string) {
  const since = addDays(today, -365);
  const byLift = new Map<string, JobFact[]>();
  for (const f of facts.jobs) {
    if (!f.liftId || !SERVICE_TYPES.has(f.type) || f.day < since || f.day > today) continue;
    byLift.set(f.liftId, [...(byLift.get(f.liftId) ?? []), f]);
  }
  const liftById = new Map(d.lifts.map((l) => [l.id, l]));
  const customerById = new Map(d.customers.map((c) => [c.id, c]));
  return [...byLift.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([liftId, list]) => {
      const lift = liftById.get(liftId);
      const last = [...list].sort((a, b) => (a.day < b.day ? 1 : -1))[0];
      return { lift, visits: list.length, warranty: list.filter((f) => f.type === 'warranty').length, last, customer: lift ? customerById.get(lift.customerId) : undefined };
    })
    .filter((r): r is { lift: Lift; visits: number; warranty: number; last: JobFact; customer: Customer | undefined } => !!r.lift)
    .sort((a, b) => b.visits - a.visits || (a.last.day < b.last.day ? 1 : -1));
}

/** What a report calls a lift: its stand-in size name (standIns.ts) */
export const reportLiftName = (d: DB, l: Lift) => {
  const it = d.items.find((i) => i.id === l.itemId);
  return it ? reportItemName(d, it) : l.kind === 'pwc' ? 'PWC lift' : 'Boat lift';
};

/* ---------- Sizes sold ---------- */

export interface SoldRow {
  key: string;
  label: string;
  category: string;
  units: number;
  direct: number;
  dealer: number;
  revenue: number;
  cost: number;
  margin: number;
  avgPrice: number;
  /** Built to order: no stock to plan */
  buildToOrder?: boolean;
  available?: number;
  daysOfSupply?: number;
  itemId?: string;
}

const isLiftItem = (it: Item) => it.kind === 'lift';

export function sizesSold(d: DB, facts: Facts, range: Range, by: 'size' | 'category', what: 'lifts' | 'all') {
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const acc = new Map<string, SoldRow>();
  for (const s of within(facts.sales, range.from, range.to)) {
    const it = itemById.get(s.itemId);
    if (!it || (what === 'lifts' && !isLiftItem(it))) continue;
    const key = by === 'size' ? it.id : reportCategory(it);
    let r = acc.get(key);
    if (!r) {
      // Lifts and add-ons under their stand-in names: the sales are invented (standIns.ts)
      r = { key, label: by === 'size' ? reportItemName(d, it) : key, category: reportCategory(it), units: 0, direct: 0, dealer: 0, revenue: 0, cost: 0, margin: 0, avgPrice: 0, itemId: by === 'size' ? it.id : undefined, buildToOrder: by === 'size' ? !!it.buildToOrder : undefined };
      acc.set(key, r);
    }
    r.units += s.qty;
    r[s.channel] += s.qty;
    r.revenue += s.revenue;
    r.cost += s.cost;
  }
  return [...acc.values()].map((r) => {
    const it = r.itemId ? itemById.get(r.itemId) : undefined;
    const stocked = it && !it.buildToOrder && it.kind !== 'used';
    const avail = stocked ? Math.max(0, available(it, 'camdenton')) : undefined;
    const perDay = r.units / Math.max(1, range.days);
    return { ...r, margin: r.revenue ? (r.revenue - r.cost) / r.revenue : 0, avgPrice: r.units ? r.revenue / r.units : 0, available: avail, daysOfSupply: avail !== undefined && perDay > 0 ? avail / perDay : undefined };
  });
}

/* ---------- Leads ---------- */

export function leadStats(facts: Facts, range: Range) {
  const list = within(facts.leads, range.from, range.to);
  const decided = (l: typeof list) => l.filter((x) => x.outcome === 'won' || x.outcome === 'lost' || x.outcome === 'closed');
  const winRate = (l: typeof list) => {
    const dd = decided(l);
    return dd.length ? dd.filter((x) => x.outcome === 'won').length / dd.length : 0;
  };
  const responses = list.filter((l) => l.responseMins !== undefined).map((l) => l.responseMins!);
  const sources = new Map<string, typeof list>();
  for (const l of list) sources.set(l.source, [...(sources.get(l.source) ?? []), l]);
  const quotes = list.filter((l) => l.kind === 'quote');
  const timedQuotes = quotes.filter((l) => l.responseMins !== undefined);
  const buckets = [
    { key: '1h', label: 'Within an hour', test: (m: number) => m <= 60 },
    { key: '4h', label: '1–4 hours', test: (m: number) => m > 60 && m <= 240 },
    { key: '24h', label: '4–24 hours', test: (m: number) => m > 240 && m <= 1440 },
    { key: 'later', label: 'More than a day', test: (m: number) => m > 1440 },
  ].map((b) => {
    const inB = timedQuotes.filter((l) => b.test(l.responseMins!));
    return { key: b.key, label: b.label, count: inB.length, winRate: winRate(inB), decided: decided(inB).length };
  });
  const kinds = (['quote', 'service', 'warranty', 'dealer', 'question'] as const).map((k) => ({ kind: k, total: list.filter((l) => l.kind === k).length }));
  return {
    list,
    total: list.length,
    quotes: quotes.length,
    service: list.filter((l) => l.kind === 'service').length,
    kinds,
    quoteWinRate: winRate(quotes),
    medianResponse: median(responses),
    wonValue: sum(quotes.filter((l) => l.outcome === 'won').map((l) => l.value)),
    open: list.filter((l) => l.outcome === 'open').length,
    bySource: [...sources.entries()].map(([source, l]) => {
      const q = l.filter((x) => x.kind === 'quote');
      const timed = l.filter((x) => x.responseMins !== undefined);
      return {
        source,
        total: l.length,
        quotes: q.length,
        won: q.filter((x) => x.outcome === 'won').length,
        lost: q.filter((x) => x.outcome === 'lost').length,
        open: l.filter((x) => x.outcome === 'open').length,
        winRate: winRate(q),
        medianResponse: timed.length ? median(timed.map((x) => x.responseMins!)) : undefined,
        wonValue: sum(q.filter((x) => x.outcome === 'won').map((x) => x.value)),
      };
    }),
    buckets,
  };
}

/* ---------- Dealer sales (sample dealer accounts) ---------- */

export function dealerStats(d: DB, facts: Facts, range: Range) {
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const sales = within(facts.sales, range.from, range.to).filter((s) => s.channel === 'dealer' && s.dealerId);
  const rows = d.dealers.map((dl) => {
    const mine = sales.filter((s) => s.dealerId === dl.id);
    // History lines carry no order number: one dealer's lines on one day are one order
    const orders = new Set(mine.map((s) => `${s.day}`)).size;
    const last = mine.reduce<string | undefined>((m, s) => (!m || s.day > m ? s.day : m), undefined);
    return { dealer: dl, orders, units: sum(mine.map((s) => s.qty)), revenue: sum(mine.map((s) => s.revenue)), last };
  });
  const categories = new Map<string, number>();
  for (const s of sales) {
    const it = itemById.get(s.itemId);
    if (!it) continue;
    const c = reportCategory(it);
    categories.set(c, (categories.get(c) ?? 0) + s.qty);
  }
  const directRevenue = sum(within(facts.sales, range.from, range.to).filter((s) => s.channel === 'direct').map((s) => s.revenue));
  return {
    sales,
    rows,
    revenue: sum(sales.map((s) => s.revenue)),
    units: sum(sales.map((s) => s.qty)),
    orders: sum(rows.map((r) => r.orders)),
    ordering: rows.filter((r) => r.units > 0).length,
    directRevenue,
    categories: [...categories.entries()].map(([key, units]) => ({ key, label: key, units })).sort((a, b) => b.units - a.units),
  };
}

/* ---------- Inventory health ---------- */

const SERVICE_PART_QTY: Record<string, number> = { 'C-HOSE': 20, 'C-BUSH': 4 };

/**
 * What left stock, per item: history builds use their lift's bill of materials, service calls the usual part for the
 * problem, sales the item itself; inside the detailed window, the stock movements themselves.
 */
export function stockUsage(d: DB, h: History, facts: Facts, from: string, to: string) {
  const used = new Map<string, number>();
  const last = new Map<string, string>();
  const add = (id: string, qty: number, day: string) => {
    if (day >= from && day <= to) used.set(id, (used.get(id) ?? 0) + qty);
    if (day <= to && (last.get(id) ?? '') < day) last.set(id, day);
  };
  const bomBySize = new Map<string, NonNullable<Item['bom']>>();
  for (const it of d.items) if (it.kind === 'lift' && it.sizeId && it.bom && !bomBySize.has(it.sizeId)) bomBySize.set(it.sizeId, it.bom);
  for (const f of h.jobs) {
    if (f.type === 'build' && f.size) for (const b of bomBySize.get(f.size) ?? []) add(b.itemId, b.qty, f.day);
    if (SERVICE_TYPES.has(f.type) && f.issue) {
      const part = issues[f.issue]?.parts[0];
      if (part) add(part, SERVICE_PART_QTY[part] ?? 1, f.day);
    }
  }
  for (const s of facts.sales) if (s.day < d.windowStart) add(s.itemId, s.qty, s.day);
  for (const m of d.moves) {
    if (m.qty >= 0 || (m.kind !== 'job' && m.kind !== 'sold' && m.kind !== 'shipped')) continue;
    const day = m.at.slice(0, 10);
    if (day >= d.windowStart) add(m.itemId, -m.qty, day);
  }
  return { used, last };
}

export type Health = 'out' | 'low' | 'slow' | 'overstock' | 'healthy' | 'special' | 'single';

export function inventoryHealth(d: DB, h: History, facts: Facts, range: Range, today: string) {
  const { used, last } = stockUsage(d, h, facts, range.from, range.to);
  return d.items.map((it) => {
    const s = it.stock.camdenton;
    const avail = Math.max(0, available(it, 'camdenton'));
    const qty = used.get(it.id) ?? 0;
    const perDay = qty / Math.max(1, range.days);
    const lastUsed = last.get(it.id);
    const idle = lastUsed ? diffDays(today, lastUsed) : 999;
    const status = stockStatus(it, 'camdenton');
    const daysOfSupply = perDay > 0 ? avail / perDay : undefined;
    const health: Health =
      it.kind === 'used'
        ? 'single'
        : status === 'special'
        ? 'special'
        : status === 'out'
          ? 'out'
          : status === 'low'
            ? 'low'
            : s.onHand > 0 && idle > 120
              ? 'slow'
              : daysOfSupply !== undefined && daysOfSupply > 365
                ? 'overstock'
                : 'healthy';
    return { item: it, onHand: s.onHand, available: avail, used: qty, lastUsed, idle, value: stockValue(it, 'camdenton'), daysOfSupply, health };
  });
}

/* ---------- Not seen in a year (a sample idea, not FiberSteel policy) ---------- */

export function notSeen(d: DB, today: string) {
  const booked = new Map<string, string>();
  for (const j of d.jobs) if (j.liftId && isOpenJob(j) && (j.type === 'service' || j.type === 'warranty')) booked.set(j.liftId, j.start ?? '');
  const customerById = new Map(d.customers.map((c) => [c.id, c]));
  return d.lifts
    .map((l) => {
      const customer = customerById.get(l.customerId);
      const due = checkDueOn(l);
      const cov = liftCoverage(l, today);
      return {
        lift: l,
        customer,
        lastSeen: l.lastServiceOn ?? l.installedOn,
        due,
        days: diffDays(due, today),
        booked: booked.has(l.id),
        bookedFor: booked.get(l.id),
        /** The 3-year coverage (blower controller, bushings, hose) — when it ends, if it still applies */
        threeYearEnds: cov[2].covered ? cov[2].until : undefined,
        fiveYearEnds: cov[1].covered ? cov[1].until : undefined,
      };
    })
    .filter((r) => r.customer && r.customer.kind === 'owner' && r.days <= 0);
}

export const fieldJob = (f: JobFact) => FIELD_TYPES.has(f.type);
