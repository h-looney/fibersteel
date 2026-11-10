/**
 * Demo data generator for FiberSteel mode.
 *
 * Builds a believable boat-lift builder and installer around "today": ~15 months of analytics history (compact facts),
 * five weeks of detailed records (requests, jobs, invoices, stock movements, dealer orders), and a three-week schedule
 * ahead. A fixed random seed makes the data identical for everyone; dates are relative, so the demo always looks
 * current. Every customer, figure and performance number is invented; the only real names are FiberSteel's own lift
 * sizes, the Admiral remotes and dock steps (with the prices FiberSteel publishes), and Dean as a sign-in profile.
 */
import { createRng } from '../lib/rng';
import { addDays, addMinutes, diffDays, monthKey, weekday } from '../lib/dates';
import { buildItems, checklists, issues, issueWeights, jobHours, jobTypeLabels, liftItemFor, vendors } from './catalog';
import { arms, boatTypes, coves, crews, defaultPermissions, defaultRouting, firstNames, lastNames, marinas, sampleDealers, staff, streets, techProfiles, towns } from './people';
import { getSize } from '../../data/lifts';
import type {
  Activity,
  BankAccount,
  BankTxn,
  Bill,
  BoatInfo,
  BooksState,
  Customer,
  DB,
  Dealer,
  DealerOrder,
  DealerOrderStatus,
  History,
  Invoice,
  InvoiceLine,
  Item,
  Job,
  JobFact,
  JobStatus,
  JobType,
  Lead,
  LeadFact,
  LeadKind,
  LeadSource,
  LeadStage,
  Lift,
  MonthFact,
  Notice,
  PaymentMethod,
  PurchaseOrder,
  SaleFact,
  Settings,
  StockMove,
  WarrantyClaim,
  WebsiteState,
} from './types';

export const DB_VERSION = 2;

export const defaultWebsite = (): WebsiteState => ({ installs: {}, installsLive: {}, used: {}, usedLive: {}, dealers: {}, dealersLive: {}, photos: {}, publishes: [], showcase: true });

export const WINDOW_DAYS = 35;
const HISTORY_DAYS = 455;
const FUTURE_DAYS = 21;

export function demoClock(d = new Date()): string {
  // Capped mid-afternoon so there is always work left on today's schedule to try; before opening the day simply
  // hasn't started yet
  const mins = Math.min(13 * 60 + 30, d.getHours() * 60 + d.getMinutes());
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

const GROWTH = 1.06;
/** The time of day the demo is generated for (before anyone starts work) — see statusForDay */
const GEN_CLOCK = '07:00';

// Per business day. Lift work peaks in spring; service runs through the boating season.
const INSTALLS = [0.22, 0.3, 0.62, 0.95, 1.1, 1.0, 0.75, 0.6, 0.5, 0.38, 0.28, 0.18];
const SERVICE = [0.5, 0.6, 0.9, 1.4, 1.8, 2.0, 2.1, 1.8, 1.4, 1.1, 0.85, 0.55];
const QUOTES = [0.7, 1.0, 1.5, 1.8, 1.7, 1.3, 1.0, 0.8, 0.7, 0.6, 0.55, 0.45];
const REMOTES = [0.08, 0.1, 0.18, 0.28, 0.32, 0.3, 0.26, 0.2, 0.16, 0.12, 0.1, 0.08];
// Dealer orders per week: dealers stock up in late winter and spring
const DEALER = [1.1, 1.5, 1.7, 1.5, 1.1, 0.7, 0.45, 0.35, 0.45, 0.55, 0.75, 0.85];

/** What lake customers buy (sample weights), by catalog lift */
const SIZE_MIX: [string, number][] = [
  ['L-PWC1', 10], ['L-PWC2', 5], ['L-PWCD', 4], ['L-4800', 6], ['L-6800', 12], ['L-8000', 11], ['L-10000', 12],
  ['L-12000', 8], ['L-14000', 9], ['L-16000', 8], ['L-20000', 4], ['L-24000', 4], ['L-SHAL8', 3], ['L-FRONT', 2],
];
/** What dealers order (sample weights) */
const DEALER_MIX: [string, number][] = [['L-PWC1', 12], ['L-PWC2', 6], ['L-4800', 8], ['L-6800', 14], ['L-8000', 12], ['L-10000', 10], ['L-12000', 5], ['L-14000', 5], ['L-16000', 3], ['P-STEPS', 4]];

const NOTE_TEMPLATES: Record<string, string[]> = {
  install: ['Owner met us at the dock.', 'Bunks set for the boat; test run looked good.', 'Walked the owners through the blower box and the Do’s & Don’ts.', 'Tight slip — took a little extra time to center it.'],
  service: ['Found a loose hose fitting — tightened and tested.', 'Replaced worn bushings on two arms.', 'Owner says it raises evenly now.', 'Recommended an Admiral remote; they’ll think about it.'],
  build: ['Frame assembled; tanks mounted.', 'Bunks fitted for the boat on the order.', 'Air test passed. Staged in the yard.'],
};

export function createDemo(T: string, clock = '10:30'): { db: DB; history: History } {
  const rng = createRng(20261110);
  const items = buildItems();
  const itemById = new Map(items.map((i) => [i.id, i]));
  const it = (id: string) => itemById.get(id)!;
  const windowStart = addDays(T, -WINDOW_DAYS);
  const histFrom = addDays(windowStart, -HISTORY_DAYS);
  const counters: Record<string, number> = { lead: 4100, job: 52100, invoice: 21400, estimate: 8800, po: 1300, claim: 400, customer: 3000, lift: 7000, order: 900, bill: 6100, dealer: 107 };
  const next = (key: string, prefix: string) => `${prefix}-${counters[key]++}`;
  const isBusinessDay = (day: string) => weekday(day) !== 0 && weekday(day) !== 6;
  const monthIdx = (day: string) => Number(day.slice(5, 7)) - 1;
  const growth = (day: string) => GROWTH ** (diffDays(day, T) / 365);
  const at = (day: string, hm: string) => `${day}T${hm}`;
  const hm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const phone = () => `573-555-01${String(rng.int(0, 99)).padStart(2, '0')}`;
  const emailFor = (first: string, last: string) => `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@${rng.pick(['example.com', 'example.net', 'example.org'])}`;
  const actId = () => `a${counters.lead}${Math.floor(rng.next() * 1e6).toString(36)}`;
  const sizeName = (itemId: string) => it(itemId).name;

  /* ---------- Customers and their lifts ---------- */

  const customers: Customer[] = [];
  const lifts: Lift[] = [];

  function newOwner(sinceDay: string): Customer {
    const first = rng.pick(firstNames);
    const last = rng.pick(lastNames);
    const town = rng.weighted(towns.map((t) => [t, t.weight] as const));
    const armDef = arms.find((a) => a.towns.includes(town.city)) ?? arms[0];
    const c: Customer = {
      id: next('customer', 'C'),
      name: `${first} ${rng.chance(0.3) ? `& ${rng.pick(firstNames.filter((n) => n !== first))} ` : ''}${last}`,
      kind: 'owner',
      phone: phone(),
      email: emailFor(first, last),
      address: { street: `${rng.int(10, 999)} ${rng.pick(streets)}`, city: town.city, state: 'MO', zip: town.zip },
      lake: { arm: armDef.arm, mm: Math.round(rng.float(armDef.mm[0], armDef.mm[1]) * 2) / 2, cove: rng.chance(0.6) ? rng.pick(coves) : undefined },
      store: 'camdenton',
      since: sinceDay,
      tags: [],
      contactPref: rng.weighted([['phone', 6], ['text', 3], ['email', 2]] as const),
    };
    customers.push(c);
    return c;
  }

  function boatFor(itemId: string): BoatInfo {
    const item = it(itemId);
    const cap = item.capacity ?? 8000;
    if (item.category === 'PWC lifts') {
      const b = boatTypes.find((x) => x.kind === 'pwc')!;
      const lengthFt = rng.int(b.length[0], b.length[1]);
      return { type: itemId === 'L-PWC1' ? 'Personal watercraft' : 'Two personal watercraft', lengthFt, dryLb: Math.round((lengthFt * rng.int(b.dryPerFt[0], b.dryPerFt[1])) / 10) * 10 };
    }
    // A boat the lift's capacity covers by FiberSteel's formula (dry + fuel × 7 + 2,000 or 3,000)
    const candidates = boatTypes.filter((b) => b.kind === 'boat');
    for (let tries = 0; tries < 30; tries++) {
      const b = rng.pick(candidates);
      const lengthFt = rng.int(b.length[0], b.length[1]);
      const dryLb = Math.round((lengthFt * rng.int(b.dryPerFt[0], b.dryPerFt[1])) / 50) * 50;
      const fuelGal = Math.round(rng.int(b.fuel[0], b.fuel[1]) / 5) * 5;
      const need = dryLb + fuelGal * 7 + (lengthFt > 30 ? 3000 : 2000);
      if (need <= cap && need > cap * 0.62) return { type: b.type, lengthFt, dryLb, fuelGal };
    }
    return { type: 'Bowrider', lengthFt: 22, dryLb: Math.max(1500, cap - 3000), fuelGal: 40 };
  }

  function addLift(c: Customer, itemId: string, installedOn: string, opts: Partial<Lift> = {}): Lift {
    const item = it(itemId);
    const boat = boatFor(itemId);
    const bunks =
      item.category === 'PWC lifts' ? 'PWC bunks' : boatTypes.find((b) => b.type === boat.type)?.bunks ?? 'V-bunks';
    const l: Lift = {
      id: next('lift', 'LF'),
      customerId: c.id,
      itemId,
      model: item.name,
      capacity: item.capacity ?? 0,
      kind: itemId === 'L-SHAL8' ? 'shallow' : itemId === 'L-FRONT' ? 'front' : item.category === 'PWC lifts' ? 'pwc' : 'boat',
      serial: `FS${installedOn.slice(2, 4)}${String(rng.int(1000, 9999))}`,
      installedOn,
      installedBy: 'FiberSteel',
      originalOwner: rng.chance(0.86),
      registered: rng.chance(0.7),
      boat,
      slip:
        item.category === 'PWC lifts'
          ? { widthFt: rng.pick([8, 10, 12]), lengthFt: rng.pick([14, 16, 18]), docking: 'straight' }
          : { widthFt: rng.pick([10, 12, 12, 14, 14, 16, 16]), lengthFt: Math.max(20, boat.lengthFt + rng.int(2, 8)), docking: rng.chance(0.3) ? 'back-in' : 'straight', offset: rng.chance(0.12) },
      bunks,
      extras: [
        ...(rng.chance(0.35) ? ['Walk boards'] : []),
        ...(rng.chance(0.2) ? ['Lift guides'] : []),
        ...(item.capacity && item.capacity >= 16000 && rng.chance(0.5) ? ['Bow V-brace'] : []),
      ],
      ...opts,
    };
    if (l.registered) l.registrationNo = `REG-${l.serial.slice(2)}`;
    if (rng.chance(item.category === 'PWC lifts' ? 0.15 : 0.38)) {
      const valves = (item.capacity ?? 0) >= 20000 ? 3 : (item.capacity ?? 0) >= 8000 ? 2 : 1;
      l.remote = { brand: rng.weighted([['Admiral', 8], ['FirstMate', 1], ['Captain’s Choice', 1]] as const), valves, installedOn: addDays(installedOn, rng.int(0, 700)) };
      if (l.remote.installedOn > T) l.remote.installedOn = installedOn;
    }
    lifts.push(l);
    return l;
  }

  /** Lifts already in place went in before the detailed records start (a later date is mirrored back before it) */
  const beforeWindow = (day: string) => (day < windowStart ? day : addDays(windowStart, -1 - diffDays(day, windowStart)));

  // The installed base: lake owners whose FiberSteel lifts went in over the past ~14 years
  for (let i = 0; i < 360; i++) {
    const installedOn = addDays(windowStart, -rng.int(30, 14 * 365));
    const c = newOwner(installedOn);
    const l = addLift(c, rng.weighted(SIZE_MIX), installedOn);
    if (rng.chance(0.22)) addLift(c, rng.weighted([['L-PWC1', 3], ['L-PWC2', 2], ['L-PWCD', 1]] as const), beforeWindow(addDays(installedOn, rng.int(0, 900))));
    if (rng.chance(0.08)) {
      l.installedBy = 'Other';
      l.originalOwner = false;
    }
  }
  // Marinas and resorts with several lifts
  for (const m of marinas) {
    const since = addDays(windowStart, -rng.int(900, 3000));
    const town = rng.pick(towns);
    const c: Customer = {
      id: next('customer', 'C'),
      name: m.name,
      contact: m.contact,
      kind: 'marina',
      phone: phone(),
      email: `office@${m.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 14)}.example.com`,
      address: { street: `${rng.int(100, 999)} ${rng.pick(streets)}`, city: town.city, state: 'MO', zip: town.zip },
      store: 'camdenton',
      since,
      tags: ['Commercial'],
      contactPref: 'email',
    };
    customers.push(c);
    for (let k = 0; k < rng.int(4, 9); k++) addLift(c, rng.weighted([['L-PWC1', 4], ['L-6800', 3], ['L-10000', 2], ['L-14000', 1]] as const), beforeWindow(addDays(since, rng.int(0, 1200))));
  }

  /* ---------- Sample dealers ---------- */

  const dealers: Dealer[] = sampleDealers.map((s, i) => {
    const c: Customer = {
      id: next('customer', 'C'),
      name: s.name,
      contact: s.contact,
      kind: 'dealer',
      phone: `${['217', '319', '469', '636', '785', '615'][i]}-555-01${String(10 + i * 7).padStart(2, '0')}`,
      email: `orders@${s.name.toLowerCase().replace(/\(sample\)/, '').replace(/[^a-z]+/g, '').slice(0, 16)}.example.net`,
      address: { street: `${rng.int(100, 9999)} Marina Rd`, city: s.city.split(',')[0], state: s.state, zip: '00000' },
      store: 'camdenton',
      since: addDays(windowStart, -rng.int(400, 2600)),
      tags: ['Dealer'],
      contactPref: 'email',
      dealerId: s.id,
    };
    customers.push(c);
    return {
      id: s.id,
      name: s.name,
      city: s.city,
      state: s.state,
      area: s.area,
      contact: s.contact,
      phone: c.phone,
      email: c.email,
      status: i === 5 ? 'prospect' : i === 4 ? 'paused' : 'active',
      since: c.since,
      discount: i < 2 ? 0.22 : 0.18,
      customerId: c.id,
      notes: i === 5 ? 'Inquired through the website’s Become a dealer form.' : undefined,
    };
  });
  const activeDealers = dealers.filter((d) => d.status === 'active');

  /* ---------- Analytics history (compact facts) ---------- */

  const hist: History = { from: histFrom, to: addDays(windowStart, -1), jobs: [], sales: [], leads: [], months: [], base: {} };
  for (const [id] of SIZE_MIX) {
    const s = it(id).sizeId;
    if (s) hist.base[s] = (hist.base[s] ?? 0) + rng.int(30, 140);
  }
  let factN = 0;
  const factId = (p: string) => `${p}${(factN++).toString(36)}`;
  const crewTime = (lead: string, est: number) => {
    const p = techProfiles[lead] ?? { speed: 1, onTime: 0.9, callback: 0.04 };
    return { hours: Math.max(0.5, Math.round(est * p.speed * rng.float(0.82, 1.22) * 4) / 4), onTime: rng.chance(p.onTime), callback: rng.chance(p.callback) };
  };

  for (let day = histFrom; day < windowStart; day = addDays(day, 1)) {
    if (!isBusinessDay(day)) continue;
    const m = monthIdx(day);
    const g = growth(day);
    // Installs (with their shop builds and site visits)
    for (let n = rng.poisson(INSTALLS[m] * g); n > 0; n--) {
      const itemId = rng.weighted(SIZE_MIX);
      const item = it(itemId);
      const pair = rng.pick(crews.install);
      const est = jobHours('install', item.capacity);
      const t = crewTime(pair[0], est);
      hist.jobs.push({ id: factId('j'), day, type: 'install', crew: [...pair], hours: t.hours, estHours: est, onTime: t.onTime, size: item.sizeId, callback: false, revenue: Math.round(item.price * 0.08) });
      const shopLead = rng.pick(crews.shop);
      const bEst = jobHours('build', item.capacity);
      const b = crewTime(shopLead, bEst);
      hist.jobs.push({ id: factId('j'), day: addDays(day, -rng.int(3, 12)), type: 'build', crew: [shopLead], hours: b.hours, estHours: bEst, onTime: b.onTime, size: item.sizeId, callback: false, revenue: 0 });
      if (rng.chance(0.7)) hist.jobs.push({ id: factId('j'), day: addDays(day, -rng.int(14, 40)), type: 'site-visit', crew: [rng.pick([pair[0], 'luke'])], hours: rng.pick([0.75, 1, 1, 1.25, 1.5]), estHours: 1, onTime: rng.chance(0.93), size: item.sizeId, callback: false, revenue: 0 });
      hist.sales.push({ id: factId('s'), day, itemId, qty: 1, revenue: item.price, cost: item.cost, channel: 'direct' });
    }
    // Service calls
    for (let n = rng.poisson(SERVICE[m] * g); n > 0; n--) {
      const tech = rng.pick(crews.service);
      const issueKey = rng.weighted(issueWeights);
      const issue = issues[issueKey];
      const l = rng.pick(lifts);
      const t = crewTime(tech, 1.5);
      const warranty = issue.component !== 'Remote system' && rng.chance(0.16);
      hist.jobs.push({ id: factId('j'), day, type: warranty ? 'warranty' : 'service', crew: [tech], hours: t.hours, estHours: 1.5, onTime: t.onTime, liftId: l.id, size: it(l.itemId!).sizeId, component: issue.component, issue: issueKey, callback: t.callback, revenue: warranty ? 95 : 95 + Math.round(t.hours * 85) });
    }
    // Remote installs
    for (let n = rng.poisson(REMOTES[m] * g); n > 0; n--) {
      const remote = rng.weighted([['R-ADM1', 2], ['R-ADM2', 5], ['R-ADM3', 2], ['R-ADMAB', 1]] as const);
      const tech = rng.pick(crews.service);
      const t = crewTime(tech, 2);
      hist.jobs.push({ id: factId('j'), day, type: 'remote', crew: [tech], hours: t.hours, estHours: 2, onTime: t.onTime, callback: false, revenue: 200 });
      hist.sales.push({ id: factId('s'), day, itemId: remote, qty: 1, revenue: it(remote).price, cost: it(remote).cost, channel: 'direct' });
    }
    // Parts, dock steps and docking stations over the counter
    if (rng.chance(0.35)) hist.sales.push({ id: factId('s'), day, itemId: rng.pick(['C-BUSH', 'C-HOSE', 'C-VALVE', 'C-HULLPRO', 'C-BRKT']), qty: rng.int(1, 8), revenue: 0, cost: 0, channel: 'direct' });
    if (rng.chance(0.05 + INSTALLS[m] * 0.06)) hist.sales.push({ id: factId('s'), day, itemId: 'P-STEPS', qty: 1, revenue: 2195, cost: it('P-STEPS').cost, channel: 'direct' });
    // Leads
    const leadCount = rng.poisson((QUOTES[m] + SERVICE[m] * 0.7 + 0.25) * g);
    for (let n = 0; n < leadCount; n++) {
      const kind: LeadKind = rng.weighted([['quote', QUOTES[m]], ['service', SERVICE[m] * 0.6], ['warranty', 0.12], ['question', 0.2], ['dealer', 0.02]] as const);
      const source: LeadSource =
        kind === 'quote'
          ? rng.weighted([['web-quote', 4], ['phone', 6], ['walk-in', 1.5], ['facebook', 1], ['referral', 1.5], ['boat-show', m < 3 ? 2 : 0.2]] as const)
          : kind === 'service'
            ? rng.weighted([['web-service', 3], ['phone', 7]] as const)
            : kind === 'warranty'
              ? 'web-warranty'
              : kind === 'dealer'
                ? 'web-dealer'
                : rng.weighted([['web-contact', 3], ['phone', 2], ['facebook', 1]] as const);
      const live = source === 'phone' || source === 'walk-in' || source === 'boat-show';
      const responseMins = live ? undefined : Math.round(Math.max(4, rng.normal(source === 'facebook' ? 220 : 140, 110)));
      const winP = kind === 'quote' ? (responseMins === undefined ? 0.46 : responseMins < 60 ? 0.52 : responseMins < 240 ? 0.4 : 0.26) : 0.85;
      const outcome = kind === 'quote' ? (rng.chance(winP) ? 'won' : 'lost') : 'closed';
      hist.leads.push({ id: factId('l'), day, source, kind, outcome, responseMins, value: kind === 'quote' ? it(rng.weighted(SIZE_MIX)).price : 0 });
    }
    // Dealer orders (weekly rhythm, spread across business days)
    if (rng.chance((DEALER[m] * g) / 5)) {
      const d = rng.pick(activeDealers);
      const lines = rng.int(1, 3);
      for (let k = 0; k < lines; k++) {
        const itemId = rng.weighted(DEALER_MIX);
        const qty = it(itemId).category === 'PWC lifts' ? rng.int(1, 4) : rng.int(1, 2);
        const rate = Math.round(it(itemId).price * (1 - d.discount));
        hist.sales.push({ id: factId('s'), day, itemId, qty, revenue: rate * qty, cost: it(itemId).cost * qty, channel: 'dealer', dealerId: d.id });
      }
    }
  }
  for (let day = histFrom; monthKey(day) < monthKey(windowStart); day = addDays(day, 31)) {
    const m = monthIdx(day);
    const g = growth(day);
    const season = 0.75 + INSTALLS[m] * 0.4;
    hist.months.push({
      month: monthKey(day),
      opex: {
        Payroll: Math.round(38000 * season * g),
        'Rent & utilities': Math.round(3400 + rng.int(0, 600)),
        'Trucks, barge & fuel': Math.round(2600 * season * g),
        Insurance: 2150,
        'Marketing & boat shows': Math.round(m <= 2 ? 6500 : 900 + rng.int(0, 400)),
        'Shop supplies & tools': Math.round(1500 * season),
        'Professional services': 650,
        'Software & fees': 420,
        Freight: Math.round(1200 * (DEALER[m] / 1.2)),
      },
    });
  }

  /* ---------- Detailed window: requests, jobs, invoices ---------- */

  const leads: Lead[] = [];
  const jobs: Job[] = [];
  const invoices: Invoice[] = [];
  const claims: WarrantyClaim[] = [];
  const moves: StockMove[] = [];
  const notices: Notice[] = [];
  const dealerOrders: DealerOrder[] = [];
  const taxRate = 0.07225; // sample rate

  const checklistFor = (type: JobType, done: boolean) =>
    checklists[type].map((label, i) => ({ id: `c${i}`, label, done }));

  function invoiceFor(c: Customer, day: string, lines: Omit<InvoiceLine, 'id'>[], opts: Partial<Invoice> = {}): Invoice {
    const inv: Invoice = {
      id: next('invoice', 'INV'),
      kind: 'invoice',
      customerId: c.id,
      store: 'camdenton',
      issuedOn: day,
      dueOn: addDays(day, c.kind === 'dealer' ? 30 : 15),
      status: 'sent',
      lines: lines.map((l, i) => ({ ...l, id: `l${i}` })),
      taxRate: c.kind === 'dealer' ? 0 : taxRate,
      payments: [],
      sentAt: at(day, '16:10'),
      salesperson: 'dean',
      ...opts,
    };
    invoices.push(inv);
    return inv;
  }

  const totalOf = (inv: Invoice) => {
    const sub = inv.lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const tax = inv.lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.rate, 0) * inv.taxRate;
    return Math.round((sub + tax) * 100) / 100;
  };

  function pay(inv: Invoice, day: string, share = 1, method?: PaymentMethod) {
    if (day > T) return;
    inv.payments.push({ id: `p${inv.payments.length}`, date: day, amount: Math.round(totalOf(inv) * share * 100) / 100, method: method ?? rng.weighted([['check', 4], ['card', 4], ['ach', 1], ['cash', 0.5], ['venmo', 0.6]] as const) });
  }

  function addJob(j: Omit<Job, 'id' | 'store' | 'notes' | 'parts' | 'checklist'> & Partial<Pick<Job, 'notes' | 'parts' | 'checklist'>>): Job {
    const job: Job = { id: next('job', 'J'), store: 'camdenton', notes: [], parts: [], checklist: checklistFor(j.type, j.status === 'completed' || j.status === 'closed'), ...j };
    jobs.push(job);
    return job;
  }

  /** The schedule: minutes booked per person per day, so jobs fill gaps instead of stacking */
  const booked = new Map<string, number>();
  function slot(person: string, day: string, hours: number, earliest = 8 * 60): string | null {
    const key = `${person}|${day}`;
    const start = Math.max(earliest, booked.get(key) ?? 8 * 60);
    const end = start + Math.round(hours * 60);
    if (end > 17 * 60 + 30) return null;
    booked.set(key, end + 30);
    return at(day, hm(Math.round(start / 15) * 15));
  }
  function schedule(crew: string[], from: string, hours: number, maxDays = 10): string | undefined {
    for (let d = from, i = 0; i < maxDays; d = addDays(d, 1), i++) {
      if (!isBusinessDay(d)) continue;
      const starts = crew.map((p) => (booked.get(`${p}|${d}`) ?? 8 * 60) as number);
      const earliest = Math.max(8 * 60, ...starts);
      if (earliest + hours * 60 > 17 * 60 + 30) continue;
      let s: string | null = null;
      for (const p of crew) s = slot(p, d, hours, earliest);
      if (s) return s;
    }
    return undefined;
  }

  /**
   * A job's status from its day. Today's jobs are generated as if the day hadn't started (GEN_CLOCK), so the random
   * choices — and every record and id — come out the same whatever time the demo is opened; "Today, as of the clock"
   * below then moves them along to the real time.
   */
  const statusForDay = (day: string, start?: string, hours = 2): JobStatus => {
    if (day < T) return 'completed';
    if (day > T) return 'scheduled';
    if (!start) return 'scheduled';
    if (start.slice(11) > GEN_CLOCK) return 'scheduled';
    return addMinutes(start, Math.round(hours * 60)).slice(11) <= GEN_CLOCK ? 'completed' : 'in-progress';
  };
  /** A moment `minBack`–`maxBack` days before `day`, never later than yesterday evening */
  const before = (day: string, minBack: number, maxBack: number) => {
    const ref = day > T ? T : day;
    return at(addDays(ref, -rng.int(Math.max(1, minBack), Math.max(1, maxBack))), hm(rng.int(8 * 60, 19 * 60)));
  };
  const notAfterNow = (dt: string) => (dt.slice(0, 10) >= T ? at(addDays(T, -1), '16:30') : dt);

  const ownersWithLifts = customers.filter((c) => c.kind === 'owner');

  // Lake installs in the window and three weeks ahead: each has its build, often a site visit and a quote
  const installPlan: { day: string; itemId: string }[] = [];
  for (let day = windowStart; day <= addDays(T, FUTURE_DAYS); day = addDays(day, 1)) {
    if (!isBusinessDay(day)) continue;
    for (let n = rng.poisson(INSTALLS[monthIdx(day)] * 1.15); n > 0; n--) installPlan.push({ day, itemId: rng.weighted(SIZE_MIX) });
  }
  // The story: an install on the water today, and one finished last week that hasn't been posted on the website
  installPlan.push({ day: T, itemId: 'L-14000' });
  installPlan.push({ day: addDays(T, -6), itemId: 'L-SHAL8' });

  for (const plan of installPlan) {
    const item = it(plan.itemId);
    const fresh = rng.chance(0.75);
    const c = fresh ? newOwner(addDays(plan.day, -rng.int(20, 60))) : rng.pick(ownersWithLifts);
    const pair = rng.pick(crews.install);
    const hours = jobHours('install', item.capacity);
    const start = schedule([...pair], plan.day, hours, 3) ?? at(plan.day, '08:00');
    const day = start.slice(0, 10);
    const status = statusForDay(day, start, hours);
    const lift = status === 'completed' ? addLift(c, plan.itemId, day) : undefined;
    // The sale started as a request
    const receivedAt = before(day, 18, 45);
    const source: LeadSource = rng.weighted([['web-quote', 4], ['phone', 6], ['referral', 1.5], ['facebook', 1], ['walk-in', 1]] as const);
    const boat = lift?.boat ?? boatFor(plan.itemId);
    const lead: Lead = {
      id: next('lead', 'R'),
      kind: 'quote',
      source,
      receivedAt,
      name: c.name,
      email: c.email,
      phone: c.phone,
      city: c.address.city,
      zip: c.address.zip,
      location: c.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}` : c.address.city,
      store: 'camdenton',
      summary: `${boat.lengthFt} ft ${boat.type.toLowerCase()} · ${item.name}`,
      fields: [['Boat type', boat.type], ['Length (ft)', String(boat.lengthFt)], ['Dry weight (lb)', String(boat.dryLb)]],
      boat,
      suggestedSize: item.sizeId,
      stage: 'won',
      assignee: 'dean',
      customerId: c.id,
      firstResponseAt: source.startsWith('web') ? addMinutes(receivedAt, rng.int(20, 240)) : receivedAt,
      closedAt: notAfterNow(addMinutes(receivedAt, 60 * 24 * rng.int(3, 12))),
      value: item.price,
      unread: false,
      activity: [
        { id: actId(), at: receivedAt, by: source.startsWith('web') ? 'customer' : 'dean', kind: 'received', text: source.startsWith('web') ? 'Quote request from the website' : `Logged a ${source === 'phone' ? 'call' : source}` },
        { id: actId(), at: addMinutes(receivedAt, 90), by: 'dean', kind: 'estimate', text: `Quote sent: ${item.name}` },
        { id: actId(), at: addMinutes(receivedAt, 60 * 24 * 5), by: 'dean', kind: 'status', text: 'Won — lift ordered' },
      ],
    };
    leads.push(lead);
    c.since = c.since < receivedAt.slice(0, 10) ? c.since : receivedAt.slice(0, 10);
    // Site visit (measure the slip) for most bigger lifts
    if (item.category === 'Boat lifts' && rng.chance(0.65)) {
      const vDay = addDays(receivedAt.slice(0, 10), rng.int(2, 6));
      const tech = rng.pick([pair[0], 'luke']);
      const vStart = vDay < windowStart ? undefined : schedule([tech], vDay, 1, 4);
      if (vStart) {
        const vStatus = statusForDay(vStart.slice(0, 10), vStart, 1);
        addJob({ type: 'site-visit', title: `Measure the slip — ${c.name}`, customerId: c.id, itemId: plan.itemId, leadId: lead.id, status: vStatus === 'completed' ? 'closed' : vStatus, priority: 'normal', start: vStart, hours: 1, crew: [tech], description: `Boat: ${boat.lengthFt} ft ${boat.type.toLowerCase()}. Confirm slip size, depth and docking.`, location: lead.location, createdAt: receivedAt, completedAt: vStatus === 'completed' ? addMinutes(vStart, 60) : undefined, startedAt: vStatus !== 'scheduled' ? vStart : undefined });
      }
    }
    // The build in the shop, a few days before
    const shopLead = rng.pick(crews.shop);
    const bHours = jobHours('build', item.capacity);
    const bFrom = addDays(day, -rng.int(4, 9));
    const bStart = bFrom < windowStart ? undefined : schedule([shopLead], bFrom, Math.min(8, bHours), 5);
    let buildJob: Job | undefined;
    if (bStart) {
      const bStatus = statusForDay(bStart.slice(0, 10), bStart, Math.min(8, bHours));
      buildJob = addJob({ type: 'build', title: `Build ${item.name} — ${c.name}`, customerId: c.id, itemId: plan.itemId, leadId: lead.id, status: bStatus === 'completed' ? 'closed' : bStatus, priority: 'normal', start: bStart, hours: bHours, crew: [shopLead], description: `${lift?.bunks ?? boatTypes.find((b) => b.type === boat.type)?.bunks ?? 'V-bunks'} for a ${boat.lengthFt} ft ${boat.type.toLowerCase()}.`, createdAt: lead.closedAt!, completedAt: bStatus === 'completed' ? addMinutes(bStart, Math.round(bHours * 60 * (techProfiles[shopLead]?.speed ?? 1))) : undefined, startedAt: bStatus !== 'scheduled' ? bStart : undefined });
      buildJob.parts = (item.bom ?? []).map((b) => ({ itemId: b.itemId, qty: b.qty, store: 'camdenton', status: bStatus === 'completed' ? 'used' : 'reserved' }));
      if (bStatus === 'completed') {
        buildJob.notes.push({ id: actId(), at: buildJob.completedAt!, by: shopLead, kind: 'note', text: rng.pick(NOTE_TEMPLATES.build) });
        buildJob.notes.push({ id: actId(), at: buildJob.completedAt!, by: shopLead, kind: 'status', text: 'Closed — billed with the install' });
      }
    }
    // The install itself
    const job = addJob({
      type: 'install',
      title: `Install ${item.name} — ${c.name}`,
      customerId: c.id,
      liftId: lift?.id,
      itemId: plan.itemId,
      leadId: lead.id,
      status,
      priority: 'normal',
      start,
      hours,
      crew: [...pair],
      description: `${boat.lengthFt} ft ${boat.type.toLowerCase()}. Slip ${lift?.slip ? `${lift.slip.widthFt} × ${lift.slip.lengthFt} ft, ${lift.slip.docking === 'back-in' ? 'back-in' : 'straight pull-in'}` : 'per the site visit'}.`,
      location: lead.location,
      createdAt: lead.closedAt!,
      startedAt: status !== 'scheduled' ? start : undefined,
      completedAt: status === 'completed' ? addMinutes(start, Math.round(hours * 60)) : undefined,
      value: item.price,
      photos: status === 'completed' ? rng.int(2, 6) : undefined,
    });
    if (status === 'completed') {
      job.signature = { name: c.name.split(' ')[0], at: job.completedAt! };
      job.notes.push({ id: actId(), at: job.completedAt!, by: pair[0], kind: 'note', text: rng.pick(NOTE_TEMPLATES.install) });
      const inv = invoiceFor(c, day, [
        { description: `FiberSteel ${item.name}${lift ? ` — serial ${lift.serial}` : ''}`, qty: 1, rate: item.price, itemId: plan.itemId, category: 'Lifts', taxable: true },
        { description: 'Delivery, installation & set-up on the lake', qty: 1, rate: Math.round(item.price * 0.08), category: 'Installation', taxable: false },
      ], { jobId: job.id, leadId: lead.id });
      job.invoiceId = inv.id;
      job.status = rng.chance(0.85) ? 'closed' : 'completed';
      const paidOn = addDays(day, rng.int(0, 20));
      if (rng.chance(0.82)) pay(inv, paidOn, 1);
      else if (rng.chance(0.5)) pay(inv, day, 0.5);
      moves.push({ id: `m${moves.length}`, at: job.completedAt!, itemId: plan.itemId, store: 'camdenton', qty: -1, kind: 'job', ref: job.id, by: pair[0] });
    }
    // Built but not installed yet: the lift waits in the yard, set aside for this install
    if (buildJob?.completedAt && status !== 'completed') {
      job.parts = [{ itemId: plan.itemId, qty: 1, store: 'camdenton', status: 'reserved' }];
      item.stock.camdenton.onHand += 1;
    }
    if (buildJob?.completedAt) {
      moves.push({ id: `m${moves.length}`, at: buildJob.completedAt!, itemId: plan.itemId, store: 'camdenton', qty: 1, kind: 'built', ref: buildJob.id, by: buildJob.crew[0] });
      for (const p of buildJob.parts) moves.push({ id: `m${moves.length}`, at: buildJob.completedAt!, itemId: p.itemId, store: 'camdenton', qty: -p.qty, kind: 'job', ref: buildJob.id, by: buildJob.crew[0] });
    }
  }

  // Service calls, warranty work and remote installs
  for (let day = windowStart; day <= addDays(T, FUTURE_DAYS); day = addDays(day, 1)) {
    if (!isBusinessDay(day)) continue;
    const m = monthIdx(day);
    for (let n = rng.poisson(SERVICE[m] * 1.1) + (day === T ? 1 : 0); n > 0; n--) {
      const l = rng.pick(lifts.filter((x) => x.installedOn < day));
      const c = customers.find((x) => x.id === l.customerId)!;
      const issueKey = rng.weighted(issueWeights);
      const issue = issues[issueKey];
      const tech = rng.pick(crews.service);
      const start = schedule([tech], day, 1.5, 3);
      if (!start) continue;
      const jDay = start.slice(0, 10);
      const status = statusForDay(jDay, start, 1.5);
      const yearsIn = diffDays(jDay, l.installedOn) / 365;
      const coveredPart =
        l.installedBy === 'FiberSteel' && l.originalOwner &&
        ((issue.component === 'Poly tank' || issue.component === 'Lift frame') ||
          (issue.component === 'Galvanized part' && yearsIn < 5) ||
          ((issue.component === 'Blower controller' || issue.component === 'Bushings' || issue.component === 'Hose') && yearsIn < 3));
      const warranty = coveredPart && issue.parts.length > 0 && rng.chance(0.75);
      const receivedAt = before(jDay, 1, 9);
      const source: LeadSource = rng.weighted([['web-service', 4], ['phone', 6]] as const);
      const lead: Lead = {
        id: next('lead', 'R'),
        kind: 'service',
        source,
        receivedAt,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.address.city,
        location: c.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}` : c.address.city,
        store: 'camdenton',
        summary: `${issue.label} · ${l.model}`,
        fields: [['The problem', issue.label], ['Lift size', l.model], ['Installed by', l.installedBy === 'FiberSteel' ? 'FiberSteel' : 'Someone else / not sure']],
        stage: status === 'scheduled' ? 'scheduled' : 'closed',
        assignee: 'jamie',
        customerId: c.id,
        firstResponseAt: source === 'web-service' ? addMinutes(receivedAt, rng.int(15, 180)) : receivedAt,
        closedAt: status === 'scheduled' ? undefined : start,
        unread: false,
        activity: [{ id: actId(), at: receivedAt, by: source === 'web-service' ? 'customer' : 'jamie', kind: 'received', text: source === 'web-service' ? 'Service request from the website' : 'Logged a call' }],
      };
      leads.push(lead);
      const job = addJob({
        type: warranty ? 'warranty' : 'service',
        title: `${warranty ? 'Warranty' : 'Service'}: ${issue.label.toLowerCase()} — ${c.name}`,
        customerId: c.id,
        liftId: l.id,
        leadId: lead.id,
        status,
        priority: issueKey === 'impact' || issueKey === 'slow-raise' ? 'high' : 'normal',
        start,
        hours: 1.5,
        crew: [tech],
        description: `${l.model}${l.remote ? `, ${l.remote.brand} remote` : ''}. ${issue.label}.`,
        location: lead.location,
        issue: issue.label,
        createdAt: receivedAt,
        startedAt: status !== 'scheduled' ? start : undefined,
        completedAt: status === 'completed' ? addMinutes(start, rng.int(60, 140)) : undefined,
      });
      lead.jobId = job.id;
      if (issue.parts.length) job.parts = issue.parts.map((p) => ({ itemId: p, qty: p === 'C-HOSE' ? rng.int(10, 30) : p === 'C-BUSH' ? rng.int(2, 6) : 1, store: 'camdenton', status: status === 'completed' ? 'used' : 'reserved' }));
      if (status === 'completed') {
        l.lastServiceOn = jDay;
        job.notes.push({ id: actId(), at: job.completedAt!, by: tech, kind: 'note', text: rng.pick(NOTE_TEMPLATES.service) });
        job.signature = { name: c.name.split(' ')[0], at: job.completedAt! };
        const afterYear = yearsIn >= 1;
        const partsLines = job.parts.map((p) => ({ description: it(p.itemId).name, qty: p.qty, rate: warranty ? 0 : it(p.itemId).price, itemId: p.itemId, category: 'Parts' as const, taxable: true }));
        const inv = invoiceFor(c, jDay, [
          ...(afterYear ? [{ description: 'Service call fee', qty: 1, rate: 95, category: 'Service' as const, taxable: false }] : []),
          { description: `Labor — ${issue.label.toLowerCase()}`, qty: Math.max(1, Math.round(diffDays(jDay, jDay) + 1)), rate: 85, category: 'Service', taxable: false },
          ...partsLines,
        ], { jobId: job.id, memo: warranty ? 'Warranty: parts covered by FiberSteel; service call and labor billed to the owner.' : undefined });
        job.invoiceId = inv.id;
        job.status = rng.chance(0.8) ? 'closed' : 'completed';
        if (rng.chance(0.8)) pay(inv, addDays(jDay, rng.int(0, 14)), 1);
        for (const p of job.parts) moves.push({ id: `m${moves.length}`, at: job.completedAt!, itemId: p.itemId, store: 'camdenton', qty: -p.qty, kind: 'job', ref: job.id, by: tech });
        if (warranty) {
          const claim: WarrantyClaim = {
            id: next('claim', 'WC'),
            liftId: l.id,
            customerId: c.id,
            jobId: job.id,
            store: 'camdenton',
            openedOn: jDay,
            issue: issue.label,
            component: issue.component,
            part: it(issue.parts[0]).name,
            coveredBy: 'FiberSteel',
            status: rng.weighted([['replaced', 6], ['approved', 2], ['part-sent', 1]] as const),
            partCost: Math.round(it(issue.parts[0]).cost * (job.parts.find((p) => p.itemId === issue.parts[0])?.qty ?? 1) * 100) / 100,
            updatedOn: addDays(jDay, rng.int(0, 5)),
          };
          if (claim.updatedOn > T) claim.updatedOn = T;
          claims.push(claim);
          job.claimId = claim.id;
        }
      } else if (warranty) {
        // A warranty visit on the schedule: the claim was opened when the request came in (approved before the visit)
        const claim: WarrantyClaim = {
          id: next('claim', 'WC'),
          liftId: l.id,
          customerId: c.id,
          jobId: job.id,
          store: 'camdenton',
          openedOn: receivedAt.slice(0, 10),
          issue: issue.label,
          component: issue.component,
          part: it(issue.parts[0]).name,
          coveredBy: 'FiberSteel',
          status: Number(job.id.replace(/\D/g, '')) % 2 ? 'approved' : 'open',
          partCost: Math.round(it(issue.parts[0]).cost * (job.parts.find((p) => p.itemId === issue.parts[0])?.qty ?? 1) * 100) / 100,
          updatedOn: receivedAt.slice(0, 10),
        };
        claims.push(claim);
        job.claimId = claim.id;
      }
    }
    // Remote installs
    for (let n = rng.poisson(REMOTES[m] * 1.4); n > 0; n--) {
      const l = rng.pick(lifts.filter((x) => !x.remote && x.kind !== 'pwc'));
      const c = customers.find((x) => x.id === l.customerId)!;
      const tech = rng.pick(crews.service);
      const start = schedule([tech], day, 2, 3);
      if (!start) continue;
      const status = statusForDay(start.slice(0, 10), start, 2);
      const remote = l.capacity >= 20000 ? 'R-ADM3' : l.capacity >= 8000 ? 'R-ADM2' : 'R-ADM1';
      const job = addJob({ type: 'remote', title: `Fit an Admiral remote — ${c.name}`, customerId: c.id, liftId: l.id, itemId: remote, status, priority: 'normal', start, hours: 2, crew: [tech], description: `${it(remote).name} on the ${l.model}.`, location: c.lake ? `${c.lake.arm}, MM ${c.lake.mm}` : undefined, createdAt: before(start.slice(0, 10), 5, 10), startedAt: status !== 'scheduled' ? start : undefined, completedAt: status === 'completed' ? addMinutes(start, 120) : undefined });
      job.parts = [{ itemId: remote, qty: 1, store: 'camdenton', status: status === 'completed' ? 'used' : 'reserved' }];
      if (status === 'completed') {
        l.remote = { brand: 'Admiral', valves: remote === 'R-ADM3' ? 3 : remote === 'R-ADM2' ? 2 : 1, installedOn: start.slice(0, 10) };
        const inv = invoiceFor(c, start.slice(0, 10), [
          { description: it(remote).name, qty: 1, rate: it(remote).price, itemId: remote, category: 'Remotes & add-ons', taxable: true },
          { description: 'Remote installation on the Lake of the Ozarks', qty: 1, rate: 200, category: 'Installation', taxable: false },
        ], { jobId: job.id });
        job.invoiceId = inv.id;
        job.status = 'closed';
        pay(inv, addDays(start.slice(0, 10), rng.int(0, 7)), 1, 'card');
        moves.push({ id: `m${moves.length}`, at: job.completedAt!, itemId: remote, store: 'camdenton', qty: -1, kind: 'job', ref: job.id, by: tech });
      }
    }
  }

  // Requested (not yet scheduled) and on-hold work
  for (let k = 0; k < 6; k++) {
    const l = rng.pick(lifts);
    const c = customers.find((x) => x.id === l.customerId)!;
    const issue = issues[rng.weighted(issueWeights)];
    const createdAt = before(T, 1, 4);
    const job = addJob({ type: 'service', title: `Service: ${issue.label.toLowerCase()} — ${c.name}`, customerId: c.id, liftId: l.id, status: k < 4 ? 'requested' : 'on-hold', priority: k === 0 ? 'high' : 'normal', hours: 1.5, crew: [], description: `${l.model}. ${issue.label}.`, issue: issue.label, location: c.lake ? `${c.lake.arm}, MM ${c.lake.mm}` : undefined, createdAt, holdReason: k >= 4 ? 'Waiting on a part' : undefined });
    if (k >= 4) job.parts = issue.parts.slice(0, 1).map((p) => ({ itemId: p, qty: 1, store: 'camdenton', status: 'reserved' }));
  }

  // The rest of today: a site visit for Jesse after the install, and an afternoon service call for Luke
  {
    const c = rng.pick(ownersWithLifts);
    const start = slot('jesse', T, 1, 15 * 60) ?? at(T, '15:00');
    const boat = boatFor('L-10000');
    addJob({ type: 'site-visit', title: `Measure the slip — ${c.name}`, customerId: c.id, itemId: 'L-10000', status: 'scheduled', priority: 'normal', start, hours: 1, crew: ['jesse'], description: `Boat: ${boat.lengthFt} ft ${boat.type.toLowerCase()}. Confirm slip size, depth and docking; they’d like guides.`, location: c.lake ? `${c.lake.arm}, MM ${c.lake.mm}` : undefined, createdAt: before(T, 1, 3) });
    const l = rng.pick(lifts.filter((x) => x.kind === 'boat' && x.installedOn < addDays(T, -400)));
    const owner = customers.find((x) => x.id === l.customerId)!;
    const s2 = slot('luke', T, 1.5, 13 * 60) ?? at(T, '13:00');
    addJob({ type: 'service', title: `Service: raises slowly — ${owner.name}`, customerId: owner.id, liftId: l.id, status: 'scheduled', priority: 'high', start: s2, hours: 1.5, crew: ['luke'], description: `${l.model}. Raises slowly; owner hears air at the box.`, issue: issues['slow-raise'].label, location: owner.lake ? `${owner.lake.arm}, MM ${owner.lake.mm}` : undefined, createdAt: before(T, 1, 2), parts: [{ itemId: 'C-VALVE', qty: 1, store: 'camdenton', status: 'reserved' }] });
  }

  /* ---------- Open requests in the inbox (recent, not yet worked) ---------- */

  const recent = (hoursAgo: number) => {
    const d = new Date(`${T}T${clock}`);
    d.setMinutes(d.getMinutes() - Math.round(hoursAgo * 60));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const inboxStage = (h: number): LeadStage => (h < 20 ? 'new' : h < 60 ? 'contacted' : 'quoted');
  for (let k = 0; k < 14; k++) {
    const hoursAgo = k < 3 ? rng.float(0.3, 5) : rng.float(6, 160);
    const receivedAt = recent(hoursAgo);
    const kind: LeadKind = rng.weighted([['quote', 6], ['service', 3], ['warranty', 1], ['question', 1.2]] as const);
    const first = rng.pick(firstNames);
    const last = rng.pick(lastNames);
    const town = rng.weighted(towns.map((t) => [t, t.weight] as const));
    const armDef = arms.find((a) => a.towns.includes(town.city)) ?? arms[0];
    const source: LeadSource = kind === 'quote' ? rng.weighted([['web-quote', 5], ['phone', 3], ['facebook', 1]] as const) : kind === 'service' ? rng.weighted([['web-service', 3], ['phone', 2]] as const) : kind === 'warranty' ? 'web-warranty' : 'web-contact';
    const itemId = rng.weighted(SIZE_MIX);
    const boat = boatFor(itemId);
    const stage = inboxStage(hoursAgo);
    const issue = issues[rng.weighted(issueWeights)];
    // Service requests and warranty registrations come from owners already on file (registrations: a recent install)
    const recentUnregistered = lifts.filter((x) => !x.registered && x.installedBy === 'FiberSteel' && x.originalOwner && diffDays(T, x.installedOn) < 150);
    const ownerLift = kind === 'service' ? rng.pick(lifts) : kind === 'warranty' ? rng.pick(recentUnregistered.length ? recentUnregistered : lifts.filter((x) => !x.registered)) : undefined;
    const owner = ownerLift ? customers.find((x) => x.id === ownerLift.customerId) : undefined;
    const lead: Lead = {
      id: next('lead', 'R'),
      kind,
      source,
      receivedAt,
      name: owner?.name ?? `${first} ${last}`,
      email: owner?.email ?? emailFor(first, last),
      phone: owner?.phone ?? phone(),
      city: owner?.address.city ?? town.city,
      zip: owner?.address.zip ?? town.zip,
      location: owner?.lake ? `${owner.lake.arm}${owner.lake.mm !== undefined ? `, MM ${owner.lake.mm}` : ''}` : `${armDef.arm}, MM ${Math.round(rng.float(armDef.mm[0], armDef.mm[1]))}`,
      store: 'camdenton',
      customerId: owner?.id,
      summary:
        kind === 'quote'
          ? `${boat.lengthFt} ft ${boat.type.toLowerCase()} · ${it(itemId).name}`
          : kind === 'service'
            ? `${issue.label}${ownerLift ? ` · ${ownerLift.model}` : ''}`
            : kind === 'warranty'
              ? `Warranty registration · ${ownerLift?.model ?? it(itemId).name}`
              : 'Do you have a used lift that would fit a pontoon?',
      message: kind === 'question' ? 'We’re looking for something for this season. Thanks!' : undefined,
      fields:
        kind === 'quote'
          ? [['Boat type', boat.type], ['Length (ft)', String(boat.lengthFt)], ['Dry weight (lb)', String(boat.dryLb)], ...(boat.fuelGal ? ([['Fuel capacity (gal)', String(boat.fuelGal)]] as [string, string][]) : []), ['Calculator suggested', `${it(itemId).name}`], ['Docking', rng.pick(['Straight pull-in', 'Back-in', 'Not sure yet'])]]
          : kind === 'service'
            ? [['The problem', issue.label], ['Lift size', ownerLift?.model ?? it(rng.weighted(SIZE_MIX)).name], ['Installed by', ownerLift?.installedBy === 'Dealer' ? 'A FiberSteel dealer' : 'FiberSteel'], ...(ownerLift ? ([['Installed (year)', ownerLift.installedOn.slice(0, 4)]] as [string, string][]) : [])]
            : kind === 'warranty'
              ? [['Lift size', ownerLift?.model ?? it(itemId).name], ['Installation date', ownerLift?.installedOn ?? addDays(T, -20)], ['Installed by', 'FiberSteel'], ...(ownerLift ? ([['Serial or order number', ownerLift.serial]] as [string, string][]) : [])]
              : [['About', 'A used lift']],
      data:
        kind === 'warranty' && ownerLift
          ? { liftSize: it(ownerLift.itemId ?? itemId).sizeId ?? '', installDate: ownerLift.installedOn, installedBy: 'fibersteel', serial: ownerLift.serial }
          : kind === 'service' && ownerLift
            ? { liftSize: it(ownerLift.itemId ?? itemId).sizeId ?? '', installed: 'fibersteel', installYear: ownerLift.installedOn.slice(0, 4) }
            : undefined,
      boat: kind === 'quote' ? boat : undefined,
      slip: kind === 'quote' ? { widthFt: rng.pick([10, 12, 14, 16]), lengthFt: boat.lengthFt + rng.int(2, 8) } : undefined,
      suggestedSize: kind === 'quote' ? it(itemId).sizeId : undefined,
      stage: kind === 'quote' ? stage : stage === 'quoted' ? 'contacted' : stage,
      assignee: stage === 'new' && k < 2 ? undefined : defaultRouting[kind],
      unread: stage === 'new',
      firstResponseAt: stage === 'new' ? undefined : addMinutes(receivedAt, rng.int(15, 200)),
      value: kind === 'quote' ? it(itemId).price : undefined,
      activity: [{ id: actId(), at: receivedAt, by: source.startsWith('web') ? 'customer' : defaultRouting[kind], kind: 'received', text: source.startsWith('web') ? 'Submitted on the website' : source === 'facebook' ? 'Facebook message' : 'Logged a call' }],
    };
    if (stage !== 'new') lead.activity.push({ id: actId(), at: lead.firstResponseAt!, by: defaultRouting[kind], kind: stage === 'quoted' ? 'estimate' : 'call', text: stage === 'quoted' ? 'Quote sent' : 'Called back — left a message' });
    leads.push(lead);
  }
  // Quotes that didn't go ahead (sample reasons), so the win rate has losses to count
  const lostReasons = ['Went with another lift', 'Price', 'Sold the boat', 'Waiting until next season', 'The dock isn’t ready', 'No reply after the quote'];
  for (let k = 0; k < 14; k++) {
    const day = addDays(T, -rng.int(6, WINDOW_DAYS));
    if (!isBusinessDay(day)) continue;
    const receivedAt = at(day, hm(rng.int(8 * 60, 18 * 60)));
    const first = rng.pick(firstNames);
    const last = rng.pick(lastNames);
    const town = rng.weighted(towns.map((t) => [t, t.weight] as const));
    const armDef = arms.find((a) => a.towns.includes(town.city)) ?? arms[0];
    const itemId = rng.weighted(SIZE_MIX);
    const boat = boatFor(itemId);
    const source: LeadSource = rng.weighted([['web-quote', 4], ['phone', 5], ['facebook', 1], ['boat-show', 0.5]] as const);
    const firstResponseAt = source === 'phone' || source === 'boat-show' ? receivedAt : addMinutes(receivedAt, rng.int(30, 600));
    const closedAt = notAfterNow(addMinutes(receivedAt, 60 * 24 * rng.int(5, 20)));
    const reason = rng.pick(lostReasons);
    leads.push({
      id: next('lead', 'R'),
      kind: 'quote',
      source,
      receivedAt,
      name: `${first} ${last}`,
      email: emailFor(first, last),
      phone: phone(),
      city: town.city,
      zip: town.zip,
      location: `${armDef.arm}, MM ${Math.round(rng.float(armDef.mm[0], armDef.mm[1]))}`,
      store: 'camdenton',
      summary: `${boat.lengthFt} ft ${boat.type.toLowerCase()} · ${it(itemId).name}`,
      fields: [['Boat type', boat.type], ['Length (ft)', String(boat.lengthFt)], ['Dry weight (lb)', String(boat.dryLb)]],
      boat,
      suggestedSize: it(itemId).sizeId,
      stage: 'lost',
      lostReason: reason,
      assignee: 'dean',
      firstResponseAt,
      closedAt,
      value: it(itemId).price,
      unread: false,
      activity: [
        { id: actId(), at: receivedAt, by: source === 'web-quote' ? 'customer' : 'dean', kind: 'received', text: source === 'web-quote' ? 'Submitted on the website' : source === 'facebook' ? 'Facebook message' : source === 'boat-show' ? 'Logged at a boat show' : 'Logged a call' },
        { id: actId(), at: firstResponseAt, by: 'dean', kind: 'estimate', text: `Quote sent: ${it(itemId).name}` },
        { id: actId(), at: closedAt, by: 'dean', kind: 'status', text: `Marked lost — ${reason.toLowerCase()}` },
      ],
    });
  }
  // The story request: a website quote straight from the calculator, minutes ago
  const storyBoat: BoatInfo = { type: 'Bowrider', lengthFt: 24, dryLb: 4200, fuelGal: 50 };
  leads.push({
    id: next('lead', 'R'),
    kind: 'quote',
    source: 'web-quote',
    receivedAt: recent(0.4),
    name: 'Jordan & Sam Ellison',
    email: 'jordan.ellison@example.com',
    phone: '573-555-0142',
    city: 'Sunrise Beach',
    zip: '65079',
    location: 'Main channel, MM 24 · Eagle Cove',
    store: 'camdenton',
    summary: '24 ft bowrider · 6,800 lb lift',
    fields: [['Boat type', 'V-bottom (fishing, ski, runabout)'], ['Boat brand', '(not given)'], ['Length (ft)', '24'], ['Dry weight (lb)', '4200'], ['Fuel capacity (gal)', '50'], ['Calculator suggested', '6,800 lb lift (needs 6,550 lb)'], ['Slip width (ft)', '12'], ['Slip length (ft)', '28'], ['Docking', 'Straight pull-in'], ['Interested in', 'An Admiral remote control'], ['When', 'Before summer']],
    boat: storyBoat,
    slip: { widthFt: 12, lengthFt: 28, docking: 'straight' },
    suggestedSize: '6800',
    stage: 'new',
    unread: true,
    value: it('L-6800').price,
    activity: [{ id: actId(), at: recent(0.4), by: 'customer', kind: 'received', text: 'Submitted on the website (lift size calculator → quote request)' }],
  });
  // A dealer inquiry from the website (the sample prospect)
  const prospect = dealers.find((d) => d.status === 'prospect')!;
  leads.push({
    id: next('lead', 'R'),
    kind: 'dealer',
    source: 'web-dealer',
    receivedAt: recent(30),
    name: prospect.contact,
    email: prospect.email,
    phone: prospect.phone,
    location: prospect.city,
    store: 'camdenton',
    summary: `Become a dealer · ${prospect.name}`,
    fields: [['Business', prospect.name], ['Type of business', 'Marina'], ['Lakes / areas served', prospect.area]],
    stage: 'contacted',
    assignee: 'dean',
    dealerId: prospect.id,
    unread: false,
    firstResponseAt: recent(26),
    activity: [
      { id: actId(), at: recent(30), by: 'customer', kind: 'received', text: 'Become a dealer inquiry from the website' },
      { id: actId(), at: recent(26), by: 'dean', kind: 'call', text: 'Talked through dealer pricing; sending the dealer packet.' },
    ],
  });

  /* ---------- Dealer orders ---------- */

  const orderStatuses: [DealerOrderStatus, number][] = [['delivered', 5], ['shipped', 2], ['ready', 2], ['building', 2], ['confirmed', 2], ['quote', 1]];
  for (let k = 0; k < 14; k++) {
    const d = rng.pick(activeDealers);
    const status = k < 3 ? (['ready', 'building', 'confirmed'] as const)[k] : rng.weighted(orderStatuses);
    const placedOn = addDays(T, -(status === 'delivered' ? rng.int(20, 34) : status === 'shipped' ? rng.int(8, 18) : status === 'quote' ? rng.int(0, 4) : rng.int(3, 14)));
    const lines: DealerOrder['lines'] = [];
    for (let n = rng.int(1, 3); n > 0; n--) {
      const itemId = rng.weighted(DEALER_MIX);
      const qty = it(itemId).category === 'PWC lifts' ? rng.int(1, 4) : rng.int(1, 2);
      // The same lift twice is one line
      const same = lines.find((l) => l.itemId === itemId);
      if (same) same.qty += qty;
      else lines.push({ itemId, qty, rate: Math.round(it(itemId).price * (1 - d.discount)) });
    }
    const o: DealerOrder = {
      id: next('order', 'DO'),
      dealerId: d.id,
      placedOn,
      lines,
      status,
      ship: rng.weighted([['freight', 5], ['pickup', 2], ['delivery', 2]] as const),
      shipOn: addDays(placedOn, rng.int(10, 21)),
      jobIds: [],
      by: 'dean',
    };
    if (status === 'shipped' || status === 'delivered') o.shippedOn = addDays(placedOn, rng.int(8, 14));
    if (status === 'delivered') o.deliveredOn = addDays(o.shippedOn!, rng.int(1, 4));
    if (o.shippedOn && o.shippedOn > T) o.shippedOn = T;
    if (o.deliveredOn && o.deliveredOn > T) o.deliveredOn = T;
    // Confirmed orders: the shop builds are booked, waiting to be scheduled (their components set aside)
    if (status === 'confirmed') {
      for (const line of o.lines) {
        if (it(line.itemId).kind !== 'lift') continue;
        const job = addJob({ type: 'build', title: `Build ${line.qty} × ${sizeName(line.itemId)} — ${d.name}`, customerId: d.customerId, itemId: line.itemId, qty: line.qty, dealerOrderId: o.id, status: 'requested', priority: 'normal', hours: jobHours('build', it(line.itemId).capacity) * line.qty, crew: [], description: `Dealer order ${o.id}.`, createdAt: at(placedOn, '09:00') });
        job.parts = (it(line.itemId).bom ?? []).map((b) => ({ itemId: b.itemId, qty: b.qty * line.qty, store: 'camdenton', status: 'reserved' }));
        o.jobIds.push(job.id);
      }
    }
    // Shop builds for orders being built (one job per line), and a delivery when it's ready
    if (status === 'building' || status === 'ready') {
      for (const line of o.lines) {
        if (it(line.itemId).kind !== 'lift') continue;
        const shopLead = rng.pick(crews.shop);
        const bStart = schedule([shopLead], status === 'ready' ? addDays(T, -6) : T, Math.min(8, jobHours('build', it(line.itemId).capacity)), 6);
        if (!bStart) continue;
        const bStatus = status === 'ready' ? 'completed' : statusForDay(bStart.slice(0, 10), bStart, 4);
        const job = addJob({ type: 'build', title: `Build ${line.qty} × ${sizeName(line.itemId)} — ${d.name}`, customerId: d.customerId, itemId: line.itemId, qty: line.qty, dealerOrderId: o.id, status: bStatus === 'completed' ? 'closed' : bStatus, priority: 'normal', start: bStart, hours: jobHours('build', it(line.itemId).capacity) * line.qty, crew: [shopLead], description: `Dealer order ${o.id}.`, createdAt: at(placedOn, '09:00'), startedAt: bStatus !== 'scheduled' ? bStart : undefined, completedAt: bStatus === 'completed' ? addMinutes(bStart, Math.round(jobHours('build', it(line.itemId).capacity) * line.qty * 60 * (techProfiles[shopLead]?.speed ?? 1))) : undefined });
        o.jobIds.push(job.id);
        // The components it takes (reserved until the build is done)
        job.parts = (it(line.itemId).bom ?? []).map((b) => ({ itemId: b.itemId, qty: b.qty * line.qty, store: 'camdenton', status: bStatus === 'completed' ? 'used' : 'reserved' }));
        if (bStatus === 'completed') {
          moves.push({ id: `m${moves.length}`, at: job.completedAt!, itemId: line.itemId, store: 'camdenton', qty: line.qty, kind: 'built', ref: job.id, by: shopLead });
          for (const p of job.parts) moves.push({ id: `m${moves.length}`, at: job.completedAt!, itemId: p.itemId, store: 'camdenton', qty: -p.qty, kind: 'job', ref: job.id, by: shopLead });
        }
      }
      if (status === 'ready') {
        const del = addJob({ type: 'delivery', title: `${o.ship === 'freight' ? 'Freight pickup' : o.ship === 'pickup' ? 'Dealer pickup' : 'Deliver'} — ${d.name}`, customerId: d.customerId, dealerOrderId: o.id, status: 'scheduled', priority: 'normal', start: schedule(['marco'], addDays(T, 2), 3, 5), hours: 3, crew: ['marco'], description: `${o.lines.map((l) => `${l.qty} × ${sizeName(l.itemId)}`).join(', ')}.`, createdAt: at(T, '08:30') });
        o.jobIds.push(del.id);
      }
    }
    if (status === 'shipped' || status === 'delivered') {
      const c = customers.find((x) => x.id === d.customerId)!;
      const inv = invoiceFor(c, o.shippedOn!, o.lines.map((l) => ({ description: `${sizeName(l.itemId)} (dealer)`, qty: l.qty, rate: l.rate, itemId: l.itemId, category: 'Dealer sales' as const, taxable: false })), { dealerOrderId: o.id, salesperson: 'dean' });
      o.invoiceId = inv.id;
      if (status === 'delivered' && rng.chance(0.6)) pay(inv, addDays(o.shippedOn!, rng.int(10, 28)), 1, 'ach');
      for (const l of o.lines) moves.push({ id: `m${moves.length}`, at: at(o.shippedOn!, '10:00'), itemId: l.itemId, store: 'camdenton', qty: -l.qty, kind: 'shipped', ref: o.id, by: 'marco' });
    }
    dealerOrders.push(o);
  }

  /* ---------- Estimates for open quotes; overdue invoices ---------- */

  for (const l of leads.filter((x) => x.kind === 'quote' && x.stage === 'quoted')) {
    const c = customers.find((x) => x.email === l.email) ?? newOwner(l.receivedAt.slice(0, 10));
    if (!l.customerId) {
      c.name = l.name;
      c.email = l.email!;
      c.phone = l.phone!;
      l.customerId = c.id;
    }
    const itemId = liftItemFor(l.suggestedSize ?? '6800') ?? 'L-6800';
    const est: Invoice = {
      id: next('estimate', 'EST'),
      kind: 'estimate',
      customerId: c.id,
      leadId: l.id,
      store: 'camdenton',
      issuedOn: l.firstResponseAt!.slice(0, 10),
      dueOn: addDays(l.firstResponseAt!.slice(0, 10), 30),
      status: 'sent',
      lines: [
        { id: 'l0', description: `FiberSteel ${sizeName(itemId)}`, qty: 1, rate: it(itemId).price, itemId, category: 'Lifts', taxable: true },
        { id: 'l1', description: 'Delivery, installation & set-up on the lake', qty: 1, rate: Math.round(it(itemId).price * 0.08), category: 'Installation', taxable: false },
      ],
      taxRate,
      payments: [],
      sentAt: l.firstResponseAt,
      salesperson: 'dean',
    };
    invoices.push(est);
    l.estimateId = est.id;
  }
  // Won quotes: the accepted quote is on file too
  for (const l of leads.filter((x) => x.kind === 'quote' && x.stage === 'won' && x.customerId && x.suggestedSize && x.closedAt && x.closedAt.slice(0, 10) >= windowStart)) {
    const itemId = liftItemFor(l.suggestedSize!) ?? 'L-6800';
    const sentOn = (l.activity.find((a) => a.kind === 'estimate')?.at ?? l.receivedAt).slice(0, 10);
    const est: Invoice = {
      id: next('estimate', 'EST'),
      kind: 'estimate',
      customerId: l.customerId!,
      leadId: l.id,
      store: 'camdenton',
      issuedOn: sentOn,
      dueOn: addDays(sentOn, 30),
      status: 'accepted',
      acceptedOn: l.closedAt!.slice(0, 10),
      lines: [
        { id: 'l0', description: `FiberSteel ${sizeName(itemId)}`, qty: 1, rate: it(itemId).price, itemId, category: 'Lifts', taxable: true },
        { id: 'l1', description: 'Delivery, installation & set-up on the lake', qty: 1, rate: Math.round(it(itemId).price * 0.08), category: 'Installation', taxable: false },
      ],
      taxRate,
      payments: [],
      sentAt: at(sentOn, '11:30'),
      salesperson: 'dean',
    };
    invoices.push(est);
    l.estimateId = est.id;
  }
  // Make two older invoices overdue
  for (const inv of invoices.filter((i) => i.kind === 'invoice' && !i.payments.length && diffDays(T, i.issuedOn) > 20).slice(0, 2)) inv.remindedAt = undefined;

  /* ---------- Stock: purchase orders, receiving, current levels ---------- */

  const pos: PurchaseOrder[] = [];
  const poDefs: { vendorId: string; lines: [string, number][]; status: PurchaseOrder['status']; daysAgo: number }[] = [
    { vendorId: 'v-poly', lines: [['C-TANK-LIFT', 10], ['C-TANK-PWC', 6]], status: 'received', daysAgo: 24 },
    { vendorId: 'v-steel', lines: [['C-ARM', 40], ['C-AXLE', 16], ['C-BRKT', 40]], status: 'received', daysAgo: 18 },
    { vendorId: 'v-remotes', lines: [['R-ADM2', 4], ['R-ADM1', 4]], status: 'partial', daysAgo: 9 },
    { vendorId: 'v-poly', lines: [['C-TANK-SHAL', 4], ['C-TANK-3700', 3]], status: 'ordered', daysAgo: 4 },
    { vendorId: 'v-blower', lines: [['C-BLOWER', 8], ['C-BOX2', 6]], status: 'draft', daysAgo: 1 },
  ];
  for (const p of poDefs) {
    const createdAt = at(addDays(T, -p.daysAgo), '09:15');
    const po: PurchaseOrder = {
      id: next('po', 'PO'),
      vendorId: p.vendorId,
      store: 'camdenton',
      status: p.status,
      createdAt,
      orderedOn: p.status === 'draft' ? undefined : createdAt.slice(0, 10),
      expectedOn: addDays(createdAt.slice(0, 10), 12),
      receivedOn: p.status === 'received' ? addDays(createdAt.slice(0, 10), rng.int(5, 9)) : undefined,
      lines: p.lines.map(([itemId, qty], i) => ({ itemId, qty, received: p.status === 'received' ? qty : p.status === 'partial' && i === 0 ? qty : 0, cost: it(itemId).cost })),
      createdBy: 'travis',
    };
    pos.push(po);
    for (const l of po.lines) if (l.received) moves.push({ id: `m${moves.length}`, at: at(po.receivedOn ?? addDays(createdAt.slice(0, 10), 6), '13:00'), itemId: l.itemId, store: 'camdenton', qty: l.received, kind: 'received', ref: po.id, by: 'travis' });
  }
  /* ---------- Today, as of the clock ----------
   * Everything above was generated as if the day hadn't started (GEN_CLOCK). This moves today's jobs along to the real
   * time without drawing a random number, so the data is the same whenever the demo is opened: started jobs are in
   * progress, finished ones are ready to invoice (site visits and deliveries simply close).
   */
  {
    const serials = new Set(lifts.map((l) => l.serial));
    let nextSerial = 9999;
    for (const j of jobs) {
      if (!j.start || j.start.slice(0, 10) !== T || j.status !== 'scheduled' || j.start.slice(11) > clock) continue;
      j.startedAt = j.start;
      const end = addMinutes(j.start, Math.round(j.hours * 60));
      // Shop builds run all day
      if (j.type === 'build' || end.slice(11) > clock) {
        j.status = 'in-progress';
        continue;
      }
      const c = customers.find((x) => x.id === j.customerId);
      j.status = j.type === 'site-visit' || j.type === 'delivery' ? 'closed' : 'completed';
      j.completedAt = end;
      j.checklist = j.checklist.map((x) => ({ ...x, done: true }));
      if (c && j.type !== 'site-visit') j.signature = { name: c.name.split(' ')[0], at: end };
      for (const p of j.parts) {
        if (p.status !== 'reserved') continue;
        p.status = 'used';
        if (j.type === 'install' && p.itemId === j.itemId) it(p.itemId).stock.camdenton.onHand = Math.max(0, it(p.itemId).stock.camdenton.onHand - 1);
        moves.push({ id: `m${moves.length}`, at: end, itemId: p.itemId, store: 'camdenton', qty: -p.qty, kind: 'job', ref: j.id, by: j.crew[0] ?? 'system' });
      }
      const lift = lifts.find((l) => l.id === j.liftId);
      if ((j.type === 'service' || j.type === 'warranty') && lift) lift.lastServiceOn = T;
      if (j.type === 'remote' && lift && j.itemId) lift.remote = { brand: 'Admiral', valves: j.itemId === 'R-ADM3' ? 3 : j.itemId === 'R-ADM2' ? 2 : 1, installedOn: T };
      // A finished install puts the lift on the customer's record
      if (j.type === 'install' && j.itemId && c && !j.liftId) {
        const item = it(j.itemId);
        const lead = leads.find((l) => l.id === j.leadId);
        const boat = lead?.boat ?? { type: 'Boat', lengthFt: 22, dryLb: Math.max(1500, (item.capacity ?? 8000) - 3000), fuelGal: 40 };
        while (serials.has(`FS${T.slice(2, 4)}${nextSerial}`)) nextSerial--;
        const serial = `FS${T.slice(2, 4)}${nextSerial--}`;
        serials.add(serial);
        const l: Lift = {
          id: next('lift', 'LF'),
          customerId: c.id,
          itemId: item.id,
          model: item.name,
          capacity: item.capacity ?? 0,
          kind: item.id === 'L-SHAL8' ? 'shallow' : item.id === 'L-FRONT' ? 'front' : item.category === 'PWC lifts' ? 'pwc' : 'boat',
          serial,
          installedOn: T,
          installedBy: 'FiberSteel',
          originalOwner: true,
          registered: false,
          boat,
          slip: { widthFt: lead?.slip?.widthFt ?? 14, lengthFt: lead?.slip?.lengthFt ?? Math.max(20, boat.lengthFt + 4), docking: lead?.slip?.docking === 'back-in' ? 'back-in' : 'straight' },
          bunks: item.category === 'PWC lifts' ? 'PWC bunks' : boatTypes.find((b) => b.type === boat.type)?.bunks ?? 'V-bunks',
          extras: [],
        };
        lifts.push(l);
        j.liftId = l.id;
      }
      // Warranty work: the part is covered (the owner pays the service call and labor)
      if (j.type === 'warranty' && lift && !j.claimId) {
        const issueDef = Object.values(issues).find((x) => x.label === j.issue);
        const used = j.parts[0];
        const claim: WarrantyClaim = {
          id: next('claim', 'WC'),
          liftId: lift.id,
          customerId: lift.customerId,
          jobId: j.id,
          store: 'camdenton',
          openedOn: T,
          issue: j.issue ?? 'Warranty repair',
          component: issueDef?.component ?? 'Galvanized part',
          part: used ? it(used.itemId).name : issueDef?.label ?? 'Repair',
          coveredBy: 'FiberSteel',
          status: used ? 'replaced' : 'open',
          partCost: used ? Math.round(it(used.itemId).cost * used.qty * 100) / 100 : 0,
          updatedOn: T,
        };
        claims.push(claim);
        j.claimId = claim.id;
      }
      const lead = leads.find((l) => l.id === j.leadId);
      if (lead && (lead.kind === 'service' || lead.kind === 'warranty') && lead.stage !== 'closed') {
        lead.stage = 'closed';
        lead.closedAt = end;
      }
    }
  }

  // Reserve stock for open jobs
  for (const j of jobs) for (const p of j.parts) if (p.status === 'reserved') it(p.itemId).stock.camdenton.reserved += p.qty;
  // Finished lifts for dealer orders waiting to ship are in the yard, set aside for the order
  for (const o of dealerOrders.filter((x) => x.status === 'ready')) {
    for (const l of o.lines) {
      if (it(l.itemId).kind !== 'lift') continue;
      it(l.itemId).stock.camdenton.onHand += l.qty;
      it(l.itemId).stock.camdenton.reserved += l.qty;
    }
  }
  // A tank that's running low (the dashboard flags it)
  it('C-TANK-SHAL').stock.camdenton.onHand = 2;
  it('C-TANK-SHAL').stock.camdenton.reserved = Math.min(2, it('C-TANK-SHAL').stock.camdenton.reserved);

  /* ---------- Bills, bank, books ---------- */

  const bills: Bill[] = [];
  for (const po of pos.filter((p) => p.status === 'received' || p.status === 'partial')) {
    const amount = po.lines.reduce((s, l) => s + l.received * l.cost, 0);
    const issuedOn = po.receivedOn ?? addDays(po.createdAt.slice(0, 10), 6);
    bills.push({ id: next('bill', 'B'), vendorId: po.vendorId, number: `${po.vendorId.slice(2).toUpperCase()}-${rng.int(10000, 99999)}`, issuedOn, dueOn: addDays(issuedOn, 30), amount, category: vendors.find((v) => v.id === po.vendorId)!.category, store: 'camdenton', status: diffDays(T, issuedOn) > 20 ? 'paid' : 'open', paidOn: diffDays(T, issuedOn) > 20 ? addDays(issuedOn, 20) : undefined, poId: po.id });
  }
  for (const [vendorId, amount, daysAgo, paid] of [
    ['v-util', 612.4, 12, false],
    ['v-fuel', 1840.75, 9, false],
    ['v-insurance', 2150, 28, true],
    ['v-shows', 4800, 6, false],
    ['v-software', 418.6, 15, true],
    ['v-freight', 1275, 5, false],
    ['v-tools', 690.2, 20, true],
  ] as [string, number, number, boolean][]) {
    const issuedOn = addDays(T, -daysAgo);
    const v = vendors.find((x) => x.id === vendorId)!;
    bills.push({ id: next('bill', 'B'), vendorId, number: `${vendorId.slice(2).toUpperCase()}-${rng.int(1000, 9999)}`, issuedOn, dueOn: addDays(issuedOn, v.terms === 'Net 30' ? 30 : 15), amount, category: v.category, store: 'camdenton', status: paid ? 'paid' : 'open', paidOn: paid ? addDays(issuedOn, 7) : undefined, memo: vendorId === 'v-shows' ? 'Winter boat show booth deposit' : undefined });
  }

  const accounts: BankAccount[] = [
    { id: 'acct-op', name: 'Operating checking', kind: 'checking', mask: '4418', balance: 86420.15 },
    { id: 'acct-sav', name: 'Savings', kind: 'savings', mask: '9021', balance: 42000 },
    { id: 'acct-card', name: 'Business card', kind: 'credit', mask: '3307', balance: -3816.4 },
  ];
  const txns: BankTxn[] = [];
  for (const inv of invoices) for (const p of inv.payments) if (diffDays(T, p.date) <= 14) txns.push({ id: `t${txns.length}`, accountId: 'acct-op', date: p.date, description: `${p.method === 'card' ? 'Card deposit' : p.method === 'ach' ? 'ACH deposit' : 'Deposit'} — ${customers.find((c) => c.id === inv.customerId)?.name}`, amount: p.amount, match: { kind: 'invoice', id: inv.id }, reviewed: diffDays(T, p.date) > 3 });
  for (const b of bills.filter((x) => x.paidOn && diffDays(T, x.paidOn) <= 14)) txns.push({ id: `t${txns.length}`, accountId: 'acct-op', date: b.paidOn!, description: vendors.find((v) => v.id === b.vendorId)!.name, amount: -b.amount, match: { kind: 'bill', id: b.id }, reviewed: true });
  txns.push({ id: `t${txns.length}`, accountId: 'acct-op', date: addDays(T, -3), description: 'Payroll', amount: -18640.22, match: { kind: 'payroll' }, reviewed: false });
  txns.push({ id: `t${txns.length}`, accountId: 'acct-card', date: addDays(T, -2), description: 'Welding supply store', amount: -186.4, reviewed: false });

  const books: BooksState = {
    mode: 'in-house',
    connected: false,
    autoSync: true,
    sync: { customers: true, items: true, invoices: true, payments: true, bills: true },
    mapping: [
      { key: 'Lifts', label: 'Lift sales', account: 'Sales — Lifts' },
      { key: 'Installation', label: 'Installation', account: 'Sales — Installation' },
      { key: 'Service', label: 'Service', account: 'Sales — Service' },
      { key: 'Parts', label: 'Parts', account: 'Sales — Parts' },
      { key: 'Remotes & add-ons', label: 'Remotes & add-ons', account: 'Sales — Remotes & add-ons' },
      { key: 'Dealer sales', label: 'Dealer sales', account: 'Sales — Dealers' },
      { key: 'tax', label: 'Sales tax collected', account: 'Sales tax payable' },
      { key: 'deposits', label: 'Customer payments', account: 'Undeposited funds' },
    ],
    log: [],
  };

  /* ---------- Notices ---------- */

  const lowItems = items.filter((i) => i.kind !== 'used' && !i.buildToOrder && i.stock.camdenton.onHand - i.stock.camdenton.reserved <= i.reorderPoint);
  notices.push(
    { id: 'n1', at: recent(0.4), kind: 'lead', text: 'New quote request from Jordan & Sam Ellison — 24 ft bowrider, the calculator says 6,800 lb', href: `/office/inbox/?id=${leads[leads.length - 2].id}`, read: false },
    { id: 'n2', at: recent(3), kind: 'build', text: `${dealerOrders.find((o) => o.status === 'ready')?.id ?? 'A dealer order'} is built and ready to ship`, href: '/office/dealers/?tab=orders', read: false },
    ...lowItems.slice(0, 2).map((i, k) => ({ id: `n-low-${k}`, at: recent(20 + k), kind: 'stock' as const, text: `Low stock: ${i.name}`, href: `/office/inventory/?id=${i.id}`, read: false })),
    { id: 'n4', at: recent(46), kind: 'dealer', text: `${prospect.name} asked about becoming a dealer`, href: '/office/dealers/', read: true },
  );

  /* ---------- Settings ---------- */

  const settings: Settings = {
    taxRates: { camdenton: taxRate },
    terms: 'Net 15',
    invoiceFooter: 'Thank you for choosing FiberSteel Boat Lifts — The Boaters Choice!',
    laborRate: 85,
    serviceFee: 95,
    remoteInstall: 200,
    forms: {
      routing: { ...defaultRouting },
      autoReply: true,
      autoReplyText: 'Thanks for reaching out to FiberSteel Boat Lifts! We’ve got your request and will get back to you within 48 hours. Need us sooner? Call 573-346-3088 (sales) or 573-346-9688 (service).',
      emailTo: { sales: 'dean@lakeboatlifts.com', service: 'fibersteelservice@gmail.com' },
    },
    notifications: { newLead: true, jobCompleted: true, paymentReceived: true, lowStock: true, dailyDigest: false },
    permissions: structuredClone(defaultPermissions),
  };

  jobs.sort((a, b) => (a.start ?? a.createdAt).localeCompare(b.start ?? b.createdAt));
  leads.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const db: DB = {
    version: DB_VERSION,
    seededOn: T,
    windowStart,
    counters,
    staff: structuredClone(staff),
    customers,
    lifts,
    claims,
    leads,
    jobs,
    items,
    moves,
    pos,
    vendors: structuredClone(vendors),
    invoices,
    bills,
    accounts,
    txns,
    books,
    notices,
    settings,
    dealers,
    dealerOrders,
    website: defaultWebsite(),
  };
  return { db, history: hist };
}

/** Counts for the README and tests */
export const demoStats = (db: DB, history: History) => ({
  customers: db.customers.length,
  lifts: db.lifts.length,
  leads: db.leads.length,
  jobs: db.jobs.length,
  invoices: db.invoices.length,
  dealers: db.dealers.length,
  dealerOrders: db.dealerOrders.length,
  historyJobs: history.jobs.length,
  historySales: history.sales.length,
  labels: jobTypeLabels,
});
