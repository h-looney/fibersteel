/**
 * Facts behind the reports: the analytics history (older months) plus the same shapes derived from today's live
 * records, so changes made in the demo show up in the numbers.
 */
import { issues } from '../../data/catalog';
import type { DB, History, JobFact, LeadFact, RangeKey, SaleFact } from '../../data/types';
import { addDays, diffDays, diffMinutes, monthKey, startOfWeek, startOfYear } from '../../lib/dates';
import { monthShort, shortDate } from '../../lib/format';

export interface Facts {
  jobs: JobFact[];
  sales: SaleFact[];
  leads: LeadFact[];
}

/** Issue key for a job's problem label ("Air hose leak" → 'hose') */
const issueKeyByLabel = new Map(Object.entries(issues).map(([k, v]) => [v.label, k]));
export const issueKeyOf = (label?: string) => (label ? issueKeyByLabel.get(label) : undefined);

const cache = new WeakMap<object, { key: unknown[]; facts: Facts }>();

export function allFacts(d: DB, h: History): Facts {
  const key = [d.jobs, d.invoices, d.leads, d.lifts, d.items, h];
  const hit = cache.get(h);
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.facts;

  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const liftById = new Map(d.lifts.map((l) => [l.id, l]));
  const invoiceById = new Map(d.invoices.map((i) => [i.id, i]));

  const jobs: JobFact[] = [...h.jobs];
  for (const j of d.jobs) {
    if ((j.status !== 'completed' && j.status !== 'closed') || !j.completedAt) continue;
    const day = j.completedAt.slice(0, 10);
    if (day < d.windowStart) continue;
    const started = j.startedAt ?? j.start ?? j.completedAt;
    const lift = j.liftId ? liftById.get(j.liftId) : undefined;
    const item = itemById.get(lift?.itemId ?? j.itemId ?? '');
    const inv = j.invoiceId ? invoiceById.get(j.invoiceId) : undefined;
    const issue = issueKeyOf(j.issue);
    jobs.push({
      id: j.id,
      day,
      type: j.type,
      crew: j.crew,
      hours: Math.max(0.25, Math.round((diffMinutes(j.completedAt, started) / 60) * 4) / 4),
      estHours: j.hours,
      onTime: j.start ? diffMinutes(started, j.start) <= 15 : true,
      liftId: j.liftId,
      size: item?.sizeId,
      component: issue ? issues[issue].component : undefined,
      issue,
      callback: !!j.callbackOf,
      callbackOf: j.callbackOf,
      // Work billed on the job; installs count their installation charge (the lift itself is a sale)
      revenue: inv ? inv.lines.filter((l) => l.category !== 'Lifts' && l.category !== 'Parts' && l.category !== 'Remotes & add-ons').reduce((s, l) => s + l.qty * l.rate, 0) : 0,
    });
  }

  const sales: SaleFact[] = [];
  // History parts sold over the counter carry no amounts — value them at list price and cost
  for (const s of h.sales) {
    const it = itemById.get(s.itemId);
    sales.push(s.revenue || !it ? s : { ...s, revenue: it.price * s.qty, cost: s.cost || it.cost * s.qty });
  }
  const jobById = new Map(d.jobs.map((j) => [j.id, j]));
  const orderById = new Map(d.dealerOrders.map((o) => [o.id, o]));
  const customerById = new Map(d.customers.map((c) => [c.id, c]));
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const job = inv.jobId ? jobById.get(inv.jobId) : undefined;
    let day = inv.issuedOn;
    if (job) {
      if (job.status !== 'completed' && job.status !== 'closed') continue;
      day = (job.completedAt ?? inv.issuedOn).slice(0, 10);
    }
    if (day < d.windowStart) continue;
    const order = inv.dealerOrderId ? orderById.get(inv.dealerOrderId) : undefined;
    const customer = customerById.get(inv.customerId);
    const dealerId = order?.dealerId ?? (customer?.kind === 'dealer' ? customer.dealerId : undefined);
    for (const l of inv.lines) {
      if (!l.itemId) continue;
      const it = itemById.get(l.itemId);
      if (!it) continue;
      sales.push({ id: `${inv.id}-${l.id}`, day, itemId: it.id, qty: l.qty, revenue: l.qty * l.rate, cost: l.qty * it.cost, channel: dealerId ? 'dealer' : 'direct', dealerId });
    }
  }

  const leads: LeadFact[] = [...h.leads];
  for (const l of d.leads) {
    const day = l.receivedAt.slice(0, 10);
    if (day < d.windowStart) continue;
    leads.push({
      id: l.id,
      day,
      source: l.source,
      kind: l.kind,
      outcome: l.stage === 'won' ? 'won' : l.stage === 'lost' ? 'lost' : l.stage === 'closed' ? 'closed' : 'open',
      responseMins: isLive(l.source) ? undefined : l.firstResponseAt ? Math.max(0, diffMinutes(l.firstResponseAt, l.receivedAt)) : undefined,
      value: l.value ?? 0,
    });
  }

  const facts = { jobs, sales, leads };
  cache.set(h, { key, facts });
  return facts;
}

/** Calls, walk-ins and boat-show conversations are answered on the spot: they have no reply time */
export const isLive = (source: string) => source === 'phone' || source === 'walk-in' || source === 'boat-show';

/* ---------- Date ranges ---------- */

export interface Range {
  from: string;
  to: string;
  label: string;
  days: number;
  /** Same dates a year earlier, when the data covers them */
  prev?: { from: string; to: string };
}

export const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'season', label: 'This lift season (since March)' },
  { key: 'ytd', label: 'Year to date' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'custom', label: 'Custom range' },
];

export function resolveRange(key: RangeKey, today: string, dataStart: string, from?: string, to?: string): Range {
  let f: string;
  let t = today;
  let label: string;
  switch (key) {
    case '30d':
      f = addDays(today, -29);
      label = 'Last 30 days';
      break;
    case 'season': {
      // Lift work picks up in March and runs through the boating season
      const y = +today.slice(0, 4);
      f = +today.slice(5, 7) >= 3 ? `${y}-03-01` : `${y - 1}-03-01`;
      label = `This lift season (since ${shortDate(f)})`;
      break;
    }
    case 'ytd':
      f = startOfYear(today);
      label = 'Year to date';
      break;
    case '12m':
      f = addDays(today, -364);
      label = 'Last 12 months';
      break;
    case 'custom':
      f = from && from >= dataStart ? from : addDays(today, -89);
      t = to && to <= today && to >= f ? to : today;
      label = `${shortDate(f)} – ${shortDate(t)}`;
      break;
    default:
      f = addDays(today, -89);
      label = 'Last 90 days';
  }
  if (f < dataStart) f = dataStart;
  const days = diffDays(t, f) + 1;
  const prevFrom = `${+f.slice(0, 4) - 1}${f.slice(4)}`;
  const prevTo = `${+t.slice(0, 4) - 1}${t.slice(4)}`;
  return { from: f, to: t, label, days, prev: prevFrom >= dataStart ? { from: prevFrom, to: prevTo } : undefined };
}

export const within = <T extends { day: string }>(list: T[], from: string, to: string) => list.filter((x) => x.day >= from && x.day <= to);

/** Buckets for time charts: weeks for short ranges, months otherwise */
export function timeBuckets(from: string, to: string) {
  const days = diffDays(to, from) + 1;
  const buckets: { key: string; label: string; title: string; from: string; to: string }[] = [];
  if (days <= 120) {
    // Axis labels stay short: the month where it changes ("Sep 7"), then just the day ("14")
    let month = '';
    for (let s = startOfWeek(from); s <= to; s = addDays(s, 7)) {
      const e = addDays(s, 6);
      const shown = s > from ? s : from;
      const label = shown.slice(0, 7) !== month ? shortDate(shown).replace(/, \d{4}$/, '') : String(+shown.slice(8, 10));
      month = shown.slice(0, 7);
      buckets.push({ key: s, label, title: `Week of ${shortDate(s)}`, from: s < from ? from : s, to: e > to ? to : e });
    }
    // Fold a stub first week (a few days) into the next so it doesn't read as a drop
    if (buckets.length > 2 && diffDays(buckets[0].to, buckets[0].from) < 3) {
      const [stub, next] = buckets;
      buckets.splice(0, 2, { ...next, label: shortDate(stub.from).replace(/, \d{4}$/, ''), title: `${shortDate(stub.from)} – ${shortDate(next.to)}`, from: stub.from });
    }
  } else {
    let s = `${monthKey(from)}-01`;
    while (s <= to) {
      const next = `${monthKey(addDays(s, 32))}-01`;
      const e = addDays(next, -1);
      buckets.push({ key: monthKey(s), label: monthShort(monthKey(s)), title: `${monthShort(monthKey(s))} ${s.slice(0, 4)}`, from: s < from ? from : s, to: e > to ? to : e });
      s = next;
    }
  }
  return buckets;
}

export const bucketIndex = (buckets: { from: string; to: string }[], day: string) => buckets.findIndex((b) => day >= b.from && day <= b.to);

/* ---------- Small math ---------- */

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Download rows as a CSV file (client-side only) */
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => (typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`)).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
