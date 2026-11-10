/**
 * Customer & lift helpers: per-customer roll-ups, the merged service history (live jobs plus the analytics history),
 * the activity timeline, and the labels the Customers and Warranty sections share.
 */
import type { Activity, Customer, DB, Dealer, History, JobFact, JobStatus, JobType, Lift, LiftKind } from '../../data/types';
import { diffDays, diffMinutes, today } from '../../lib/dates';
import { money, plural } from '../../lib/format';
import { invoiceTotals, itemOf, jobDay } from '../../selectors';

export const kindLabels: Record<Customer['kind'], string> = { owner: 'Owner', marina: 'Marina or resort', dealer: 'Dealer' };
export const kindPlural: Record<Customer['kind'], string> = { owner: 'Owners', marina: 'Marinas & resorts', dealer: 'Dealers' };
export const contactPrefLabels: Record<Customer['contactPref'], string> = { phone: 'Phone call', email: 'Email', text: 'Text message' };
/** How a payment came in (falls back to the method's own name for any added later) */
export const methodLabels: Record<string, string> = { card: 'card', check: 'check', cash: 'cash', ach: 'bank transfer', venmo: 'Venmo', paypal: 'PayPal' };

export const liftKindLabels: Record<LiftKind, string> = { boat: 'Boat lift', pwc: 'PWC lift', front: 'Front-mounted lift', shallow: 'Shallow-water lift' };

/** Tags offered when editing a customer (plus any already in use) */
export const suggestedTags = ['Lake home', 'Second home', 'Commercial', 'Dealer', 'Gate code', 'Call ahead', 'Boat access only', 'Two lifts'];

/** Bunk setups the demo knows (the sample data's, plus a couple from FiberSteel's lift pages) */
export const bunkOptions = ['V-bunks', 'Extra-tall bunks (inboard)', 'Pontoon bunks', 'Tri-toon bunks', 'Combo bunks', 'V-bunks + bow V-brace', 'PWC bunks'];
export const extraOptions = ['Walk boards', 'Lift guides', 'Bow V-brace', 'Hull protectors'];

/** Where a lake owner's dock is, or a business's town */
export const whereText = (c: Customer) =>
  c.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}${c.lake.cove ? ` · ${c.lake.cove}` : ''}` : c.address.city || '—';

/** "FiberSteel" · the dealer's name · "a FiberSteel dealer" · "another installer" */
export function installedByText(l: Lift, dealers: Dealer[]) {
  if (l.installedBy === 'FiberSteel') return 'FiberSteel';
  if (l.installedBy === 'Dealer') return dealers.find((x) => x.id === l.dealerId)?.name ?? 'a FiberSteel dealer';
  return 'another installer';
}

/** FiberSteel's warranty applies to lifts FiberSteel installed, for the original purchaser */
export const warrantyEligible = (l: Lift) => l.installedBy === 'FiberSteel' && l.originalOwner;
export const needsRegistration = (l: Lift) => warrantyEligible(l) && !l.registered;

/** Why a lift has no FiberSteel warranty, in plain words */
export function notCoveredReason(l: Lift) {
  if (l.installedBy === 'Dealer') return 'Installed by a dealer. FiberSteel’s warranty is valid only on lifts FiberSteel installed; for lifts its dealers install outside the Lake of the Ozarks area, the warranty page says to check with the local dealer.';
  if (l.installedBy === 'Other') return 'Installed by someone else, so FiberSteel’s warranty doesn’t apply — it’s valid only on lifts FiberSteel installed.';
  if (!l.originalOwner) return 'This owner isn’t the original purchaser (the lift came with the house or was bought used). FiberSteel’s warranty is for the original purchaser only.';
  return '';
}

export const boatText = (l: Pick<Lift, 'boat'>) =>
  l.boat ? `${l.boat.lengthFt} ft ${l.boat.type.toLowerCase()}${l.boat.dryLb ? ` · ${l.boat.dryLb.toLocaleString('en-US')} lb dry` : ''}${l.boat.fuelGal ? ` · ${l.boat.fuelGal} gal` : ''}` : '';

export const slipText = (l: Pick<Lift, 'slip'>) =>
  l.slip ? `${l.slip.widthFt} × ${l.slip.lengthFt} ft · ${l.slip.docking === 'back-in' ? 'back-in' : 'straight pull-in'}${l.slip.offset ? ' · offset' : ''}` : '';

/* ---------- Roll-ups ---------- */

export interface CustomerSummary {
  lifts: Lift[];
  lastService?: string;
  /** Balance due now — invoices for installs that haven't happened yet don't count */
  open: number;
  overdue: number;
  /** FiberSteel-installed lifts (original owner) not registered yet */
  unregistered: number;
}

const summaryCache = new WeakMap<DB, Map<string, CustomerSummary>>();

export function customerSummaries(d: DB): Map<string, CustomerSummary> {
  const cached = summaryCache.get(d);
  if (cached) return cached;
  const t = today();
  const map = new Map<string, CustomerSummary>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = { lifts: [], open: 0, overdue: 0, unregistered: 0 };
      map.set(id, s);
    }
    return s;
  };
  for (const l of d.lifts) {
    const s = get(l.customerId);
    s.lifts.push(l);
    if (l.lastServiceOn && (!s.lastService || l.lastServiceOn > s.lastService)) s.lastService = l.lastServiceOn;
    if (needsRegistration(l)) s.unregistered++;
  }
  const jobs = new Map(d.jobs.map((j) => [j.id, j]));
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const { balance } = invoiceTotals(inv);
    if (balance <= 0.004) continue;
    const job = inv.jobId ? jobs.get(inv.jobId) : undefined;
    if (job && job.type === 'install' && job.status !== 'closed' && job.status !== 'completed') continue;
    const s = get(inv.customerId);
    s.open += balance;
    if (inv.dueOn < t) s.overdue += balance;
  }
  summaryCache.set(d, map);
  return map;
}

/** Invoiced to the customer on record (the detailed records start with the demo's window) */
export function spendOnRecord(d: DB, customerId: string) {
  let total = 0;
  for (const inv of d.invoices) {
    if (inv.customerId === customerId && inv.kind === 'invoice' && inv.status !== 'draft' && inv.status !== 'void') total += invoiceTotals(inv).subtotal;
  }
  return total;
}

/* ---------- Service history ---------- */

export interface HistoryRow {
  id: string;
  day: string;
  type: JobType;
  title: string;
  /** Parts used, for service and warranty visits */
  detail?: string;
  techs: string[];
  hours?: number;
  revenue?: number;
  status?: JobStatus;
  /** Live job (links to the job page); history rows are read-only */
  jobId?: string;
  liftId?: string;
}

function factTitle(f: JobFact, l?: Lift): string {
  const what = f.component ? f.component.toLowerCase() : 'lift check';
  const model = l ? ` — ${l.model}` : '';
  if (f.type === 'warranty') return `Warranty repair: ${what}${model}`;
  if (f.type === 'remote') return `Remote installed${model}`;
  return `${f.callback ? 'Return visit: ' : 'Service call: '}${what}${model}`;
}

/** Live jobs, earlier visits from the history, and FiberSteel installs, newest first — for a customer or one lift. */
export function serviceHistory(d: DB, h: History, filter: { customerId?: string; liftId?: string }): HistoryRow[] {
  if (!filter.customerId && !filter.liftId) return [];
  const lifts = d.lifts.filter((l) => (filter.liftId ? l.id === filter.liftId : l.customerId === filter.customerId));
  const liftIds = new Set(lifts.map((l) => l.id));
  const rows: HistoryRow[] = [];
  const installJobs = new Set<string>();
  for (const j of d.jobs) {
    if (j.status === 'cancelled') continue;
    if (filter.liftId ? j.liftId !== filter.liftId : j.customerId !== filter.customerId) continue;
    if (j.type === 'build') continue; // shop work, not a visit
    if (j.type === 'install' && j.liftId) installJobs.add(j.liftId);
    const actual = j.startedAt && j.completedAt ? Math.max(0.25, Math.round((diffMinutes(j.completedAt, j.startedAt) / 60) * 4) / 4) : undefined;
    const inv = j.invoiceId ? d.invoices.find((i) => i.id === j.invoiceId) : undefined;
    const used = j.type === 'service' || j.type === 'warranty' ? j.parts.filter((p) => itemOf(d, p.itemId)?.kind === 'component') : [];
    rows.push({
      id: j.id,
      day: jobDay(j),
      type: j.type,
      title: j.title,
      detail: used.length ? `${used[0].status === 'used' ? 'Used' : 'Reserved'}: ${used.map((p) => itemOf(d, p.itemId)!.name).join(', ')}` : undefined,
      techs: j.crew,
      hours: actual,
      revenue: inv ? invoiceTotals(inv).subtotal : j.value,
      status: j.status,
      jobId: j.id,
      liftId: j.liftId,
    });
  }
  const byLift = new Map(lifts.map((l) => [l.id, l]));
  for (const f of h.jobs) {
    if (!f.liftId || !liftIds.has(f.liftId)) continue;
    const l = byLift.get(f.liftId)!;
    if (f.day < l.installedOn) continue;
    rows.push({ id: f.id, day: f.day, type: f.type, title: factTitle(f, l), techs: f.crew, hours: f.hours, revenue: f.revenue, liftId: f.liftId });
  }
  for (const l of lifts) {
    if (l.installedBy !== 'FiberSteel' || installJobs.has(l.id)) continue;
    rows.push({ id: `inst-${l.id}`, day: l.installedOn, type: 'install', title: `Installed ${l.model}`, detail: `Serial ${l.serial}`, techs: [], liftId: l.id });
  }
  return rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/* ---------- Activity timeline ---------- */

export interface TimelineEntry {
  id: string;
  at: string;
  by: string;
  kind: Activity['kind'] | 'payment' | 'invoice' | 'lift';
  text: string;
  source?: { label: string; to: string; section: 'inbox' | 'jobs' | 'accounting' | 'dealers' };
}

export function customerTimeline(d: DB, c: Customer): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const a of c.activity ?? []) out.push({ ...a });
  for (const l of d.lifts) {
    if (l.customerId !== c.id) continue;
    out.push({ id: `lift-${l.id}`, at: `${l.installedOn}T15:00`, by: 'system', kind: 'lift', text: `${l.model} installed${l.installedBy === 'FiberSteel' ? ' by FiberSteel' : l.installedBy === 'Dealer' ? ' by a dealer' : ' by another installer'} · serial ${l.serial}` });
  }
  for (const l of d.leads) {
    if (l.customerId !== c.id) continue;
    for (const a of l.activity) out.push({ ...a, id: `${l.id}-${a.id}`, source: { label: `Request ${l.id}`, to: `/office/inbox/?id=${l.id}`, section: 'inbox' } });
  }
  for (const j of d.jobs) {
    if (j.customerId !== c.id) continue;
    for (const a of j.notes) out.push({ ...a, id: `${j.id}-${a.id}`, source: { label: j.id, to: `/office/jobs/?id=${j.id}`, section: 'jobs' } });
  }
  for (const inv of d.invoices) {
    if (inv.customerId !== c.id || inv.status === 'draft') continue;
    const to = `/office/accounting/?tab=${inv.kind === 'estimate' ? 'estimates' : 'invoices'}&id=${inv.id}`;
    out.push({
      id: `${inv.id}-sent`,
      at: inv.sentAt ?? `${inv.issuedOn}T09:00`,
      by: inv.salesperson ?? 'system',
      kind: 'invoice',
      text: `${inv.kind === 'estimate' ? 'Quote' : 'Invoice'} ${inv.id} sent — ${money(invoiceTotals(inv).total)}`,
      source: { label: inv.id, to, section: 'accounting' },
    });
    for (const p of inv.payments) {
      out.push({ id: `${inv.id}-${p.id}`, at: `${p.date}T12:00`, by: 'customer', kind: 'payment', text: `Paid ${money(p.amount)} by ${methodLabels[p.method] ?? p.method}`, source: { label: inv.id, to, section: 'accounting' } });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/* ---------- Dates ---------- */

/** "3 years" · "about a year" · "8 months" · "45 days" */
export function timeLeft(days: number) {
  if (days >= 700) return `${Math.round(days / 365)} years`;
  if (days >= 330) return 'about a year';
  if (days >= 60) return `${Math.round(days / 30.4)} months`;
  return plural(Math.max(0, days), 'day');
}

export const daysUntil = (day: string) => diffDays(day, today());
