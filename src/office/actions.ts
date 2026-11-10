/**
 * Every change to FiberSteel mode's data goes through these actions, so side effects stay the same wherever a change
 * starts — finishing an install on the board or on a crew member's phone uses up the same stock, adds the same lift
 * to the customer's record and lets the office know the same way.
 *
 * Section-specific helpers can live next to their pages; anything shared belongs here.
 */
import { checklists, issues, jobHours, jobTypeLabels, liftItemFor } from './data/catalog';
import type {
  Activity,
  BoatInfo,
  Component,
  Customer,
  DB,
  Dealer,
  DealerOrder,
  DealerOrderStatus,
  Invoice,
  InvoiceLine,
  Item,
  Job,
  JobStatus,
  JobType,
  Lead,
  LeadKind,
  LeadSource,
  LeadStage,
  Lift,
  LiftKind,
  Notice,
  PaymentMethod,
  PurchaseOrder,
  RemoteBrand,
  Role,
  Section,
  Settings,
  StoreId,
  WarrantyClaim,
} from './data/types';
import { addDays, now, today } from './lib/dates';
import { money } from './lib/format';
import { invoiceTotals, serviceFeeApplies } from './selectors';
import { db, edit, markTried, me, mutate, nextId, uid } from './store';

const actor = () => me.value?.id ?? 'system';
const stamp = () => now();
/** FiberSteel works from one place */
const STORE: StoreId = 'camdenton';

const stageLabels: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  quoted: 'Quote sent',
  won: 'Won',
  lost: 'Lost',
  closed: 'Closed',
};

const statusLabels: Record<JobStatus, string> = {
  requested: 'Needs scheduling',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  'on-hold': 'On hold',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const orderStatusLabels: Record<DealerOrderStatus, string> = {
  quote: 'Quote',
  confirmed: 'Confirmed',
  building: 'Building',
  ready: 'Ready to ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function activity(kind: Activity['kind'], text: string, by = actor()): Activity {
  return { id: uid('a'), at: stamp(), by, kind, text };
}

export function notify(d: DB, kind: Notice['kind'], text: string, href?: string) {
  d.notices = [{ id: uid('n'), at: stamp(), kind, text, href, read: false }, ...d.notices];
}

const syncIfConnected = (d: DB, what: string) => {
  if (!d.books.connected || !d.books.autoSync) return undefined;
  d.books = { ...d.books, lastSyncAt: stamp(), log: [{ id: uid('q'), at: stamp(), level: 'ok' as const, text: what }, ...d.books.log].slice(0, 60) };
  return stamp();
};

const firstNameOf = (d: DB, id?: string) => d.staff.find((s) => s.id === id)?.name.split(' ')[0];

/* ======================================================================
   Requests (inbox)
   ====================================================================== */

export function setLeadStage(id: string, stage: LeadStage, note?: string) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      const prev = l.stage;
      if (prev === stage) return;
      l.stage = stage;
      l.unread = false;
      if (stage !== 'new' && !l.firstResponseAt) l.firstResponseAt = stamp();
      if (stage === 'won' || stage === 'lost' || stage === 'closed') l.closedAt = stamp();
      l.activity.push(activity('status', note ?? `Moved from ${stageLabels[prev]} to ${stageLabels[stage]}`));
    }),
  );
}

export function assignLead(id: string, staffId: string | undefined) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      l.assignee = staffId;
      const who = d.staff.find((s) => s.id === staffId)?.name ?? 'nobody';
      l.activity.push(activity('assign', `Assigned to ${who}`));
    }),
  );
}

/** Log a call, email, text or note. Reaching out moves a new request to Contacted. */
export function addLeadActivity(id: string, kind: 'note' | 'email' | 'call' | 'text', text: string) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      l.activity.push(activity(kind, text));
      l.unread = false;
      if (kind !== 'note') {
        if (!l.firstResponseAt) l.firstResponseAt = stamp();
        if (l.stage === 'new') {
          l.stage = 'contacted';
          l.activity.push(activity('status', 'Moved from New to Contacted'));
        }
      }
    }),
  );
}

export function markLeadRead(id: string, read = true) {
  const lead = db.value.leads.find((l) => l.id === id);
  if (!lead || lead.unread === !read) return;
  mutate((d) => edit(d.leads, id, (l) => (l.unread = !read)));
}

export function toggleLeadStar(id: string) {
  mutate((d) => edit(d.leads, id, (l) => (l.starred = !l.starred)));
}

export function linkLeadToCustomer(leadId: string, customerId: string) {
  mutate((d) =>
    edit(d.leads, leadId, (l) => {
      l.customerId = customerId;
      l.activity.push(activity('system', `Linked to customer ${d.customers.find((c) => c.id === customerId)?.name ?? customerId}`));
    }),
  );
}

/** "Gravois arm, MM 12, Hidden Cove" → { arm, mm, cove }. Anything that doesn't read like a lake spot is an address. */
export function lakeSpot(text: string): Customer['lake'] | undefined {
  if (!/\b(arm|channel|cove|creek|bend|mm|mile)\b/i.test(text)) return undefined;
  const mm = text.match(/\b(?:MM|mile(?: marker)?)\s*(\d+(?:\.\d+)?)/i);
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^(?:MM|mile(?: marker)?)\s*\d/i.test(s));
  return { arm: parts[0] ?? text, mm: mm ? Number(mm[1]) : undefined, cove: parts[1] };
}

function customerFromLead(d: DB, l: Lead): string {
  const id = nextId(d, 'customer', 'C');
  const pref = l.fields.find(([k]) => k === 'Best way to reach you')?.[1] ?? '';
  const lake = l.location ? lakeSpot(l.location) : undefined;
  d.customers.push({
    id,
    name: l.name,
    kind: 'owner',
    phone: l.phone ?? '',
    email: l.email ?? '',
    address: { street: !lake && l.location ? l.location : '', city: l.city ?? '', state: 'MO', zip: l.zip ?? '' },
    lake,
    store: l.store,
    since: today(),
    tags: [],
    contactPref: /email/i.test(pref) ? 'email' : /text/i.test(pref) ? 'text' : 'phone',
  });
  return id;
}

/** Create a customer record from a request's contact details and link them. */
export function createCustomerFromLead(leadId: string): string {
  let id = '';
  mutate((d) => {
    const l = d.leads.find((x) => x.id === leadId)!;
    id = customerFromLead(d, l);
    edit(d.leads, leadId, (x) => {
      x.customerId = id;
      x.activity.push(activity('system', `Customer record ${id} created`));
    });
  });
  return id;
}

const loggedFrom: Partial<Record<LeadSource, string>> = {
  'walk-in': 'Logged from a walk-in',
  facebook: 'Logged from a Facebook message',
  referral: 'Logged a referral',
  'boat-show': 'Logged at a boat show',
};

/** Log a phone call, walk-in, Facebook message or boat-show conversation as a request. */
export function logRequest(input: {
  kind: LeadKind;
  source: LeadSource;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  location?: string;
  summary: string;
  message?: string;
  assignee?: string;
  customerId?: string;
  boat?: BoatInfo;
  suggestedSize?: string;
}): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'lead', 'R');
    const lead: Lead = {
      id,
      kind: input.kind,
      source: input.source,
      receivedAt: stamp(),
      name: input.name,
      phone: input.phone,
      email: input.email,
      city: input.city,
      location: input.location,
      store: STORE,
      summary: input.summary,
      message: input.message,
      fields: [],
      boat: input.boat,
      suggestedSize: input.suggestedSize,
      stage: 'new',
      assignee: input.assignee ?? d.settings.forms.routing[input.kind],
      customerId: input.customerId,
      unread: false,
      activity: [activity('received', loggedFrom[input.source] ?? 'Logged from a phone call')],
      firstResponseAt: stamp(),
    };
    d.leads = [lead, ...d.leads];
  });
  return id;
}

/* ======================================================================
   Customers
   ====================================================================== */

export function createCustomer(input: Omit<Customer, 'id' | 'since' | 'tags'> & { tags?: string[] }): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'customer', 'C');
    d.customers.push({ ...input, id, since: today(), tags: input.tags ?? [] });
  });
  return id;
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  mutate((d) => edit(d.customers, id, (c) => Object.assign(c, patch)));
}

export function addCustomerNote(id: string, kind: 'note' | 'call' | 'email' | 'text', text: string) {
  mutate((d) =>
    edit(d.customers, id, (c) => {
      c.activity = [activity(kind, text), ...(c.activity ?? [])];
    }),
  );
}

/* ======================================================================
   Lifts at customers' docks
   ====================================================================== */

export interface NewLift {
  customerId: string;
  itemId?: string;
  model?: string;
  capacity?: number;
  kind?: LiftKind;
  serial?: string;
  installedOn: string;
  installedBy: Lift['installedBy'];
  dealerId?: string;
  originalOwner?: boolean;
  registered?: boolean;
  boat?: BoatInfo;
  slip?: Lift['slip'];
  bunks?: string;
  extras?: string[];
  remote?: Lift['remote'];
}

export const liftKindOf = (item?: Item): LiftKind =>
  item?.id === 'L-SHAL8' ? 'shallow' : item?.id === 'L-FRONT' ? 'front' : item?.category === 'PWC lifts' ? 'pwc' : 'boat';

/** Valves a remote needs, by lift size (more tanks, more valves) — the same rule the sample data uses */
export const remoteValves = (capacity: number) => (capacity >= 20000 ? 3 : capacity >= 8000 ? 2 : 1);

const registrationNo = (serial: string) => `REG-${serial.replace(/^FS/i, '')}`;

/** FS + two-digit year + four digits, unique */
function newSerial(d: DB, day: string) {
  const used = new Set(d.lifts.map((l) => l.serial));
  let serial = '';
  do serial = `FS${day.slice(2, 4)}${Math.floor(1000 + Math.random() * 9000)}`;
  while (used.has(serial));
  return serial;
}

function pushLift(d: DB, input: NewLift): string {
  const item = d.items.find((i) => i.id === input.itemId);
  const id = nextId(d, 'lift', 'LF');
  const serial = input.serial?.trim() || newSerial(d, input.installedOn);
  const lift: Lift = {
    id,
    customerId: input.customerId,
    itemId: item?.id,
    model: input.model ?? item?.name ?? 'Lift',
    capacity: input.capacity ?? item?.capacity ?? 0,
    kind: input.kind ?? liftKindOf(item),
    serial,
    installedOn: input.installedOn,
    installedBy: input.installedBy,
    dealerId: input.dealerId,
    originalOwner: input.originalOwner ?? true,
    registered: input.registered ?? false,
    registrationNo: input.registered ? registrationNo(serial) : undefined,
    boat: input.boat,
    slip: input.slip,
    bunks: input.bunks ?? (item?.category === 'PWC lifts' ? 'PWC bunks' : 'V-bunks'),
    extras: input.extras ?? [],
    remote: input.remote,
  };
  d.lifts.push(lift);
  return id;
}

/** Add a lift that's already at a customer's dock (one from before FiberSteel mode, or another installer's). */
export function addLift(input: NewLift): string {
  let id = '';
  mutate((d) => (id = pushLift(d, input)));
  return id;
}

export function updateLift(id: string, patch: Partial<Lift>) {
  mutate((d) => edit(d.lifts, id, (l) => Object.assign(l, patch)));
}

/** Register a lift's warranty (the website's registration form, or by hand). */
export function registerLift(liftId: string) {
  mutate((d) =>
    edit(d.lifts, liftId, (l) => {
      l.registered = true;
      l.registrationNo = l.registrationNo ?? registrationNo(l.serial);
    }),
  );
  markTried('register');
}

/**
 * The lift went with the house: it moves to the new owner's record. FiberSteel's warranty is for the original
 * purchaser only, so the new owner's lift shows as not covered.
 */
export function transferLift(liftId: string, toCustomerId: string) {
  mutate((d) => {
    const lift = d.lifts.find((l) => l.id === liftId);
    if (!lift || lift.customerId === toCustomerId) return;
    const from = lift.customerId;
    const toName = d.customers.find((c) => c.id === toCustomerId)?.name ?? toCustomerId;
    const fromName = d.customers.find((c) => c.id === from)?.name ?? from;
    edit(d.lifts, liftId, (l) => {
      l.customerId = toCustomerId;
      l.originalOwner = false;
    });
    edit(d.customers, from, (c) => (c.activity = [activity('note', `${lift.model} (${lift.serial}) moved to ${toName}`), ...(c.activity ?? [])]));
    edit(d.customers, toCustomerId, (c) => (c.activity = [activity('note', `${lift.model} (${lift.serial}) moved here from ${fromName} — not the original purchaser, so the warranty doesn’t carry over`), ...(c.activity ?? [])]));
  });
}

const remoteBrandOf = (v?: string): RemoteBrand | undefined =>
  v === 'admiral' ? 'Admiral' : v === 'firstmate' ? 'FirstMate' : v === 'captains-choice' ? 'Captain’s Choice' : undefined;

/**
 * A warranty registration from the website: register the lift it matches, or add the lift (and the customer, if
 * they're new) from what the owner typed.
 */
export function registerFromLead(leadId: string, liftId?: string): string {
  let id = liftId ?? '';
  mutate((d) => {
    const l = d.leads.find((x) => x.id === leadId);
    if (!l) return;
    if (!id) {
      const data = l.data ?? {};
      const customerId = l.customerId ?? customerFromLead(d, l);
      const itemId = data.liftSize && data.liftSize !== 'other' ? liftItemFor(data.liftSize) : undefined;
      const item = d.items.find((i) => i.id === itemId);
      const installedOn = /^\d{4}-\d{2}-\d{2}$/.test(data.installDate ?? '') ? data.installDate! : today();
      const brand = remoteBrandOf(data.remote);
      id = pushLift(d, {
        customerId,
        itemId,
        model: item?.name ?? 'Lift (size to confirm)',
        installedOn,
        installedBy: data.installedBy === 'dealer' ? 'Dealer' : 'FiberSteel',
        serial: data.serial,
        registered: true,
        remote: brand ? { brand, valves: remoteValves(item?.capacity ?? 8000), installedOn } : undefined,
      });
      edit(d.leads, leadId, (x) => (x.customerId = customerId));
    } else {
      edit(d.lifts, id, (x) => {
        x.registered = true;
        x.registrationNo = x.registrationNo ?? registrationNo(x.serial);
      });
      const owner = d.lifts.find((x) => x.id === id)?.customerId;
      if (owner && !l.customerId) edit(d.leads, leadId, (x) => (x.customerId = owner));
    }
    const lift = d.lifts.find((x) => x.id === id)!;
    edit(d.leads, leadId, (x) => {
      x.stage = 'closed';
      x.closedAt = stamp();
      x.unread = false;
      if (!x.firstResponseAt) x.firstResponseAt = stamp();
      x.activity.push(activity('status', `Registered ${lift.model} · ${lift.serial} (${lift.registrationNo})`));
    });
  });
  markTried('register');
  return id;
}

/* ======================================================================
   Jobs: site visits, shop builds, installs, service, warranty, deliveries, remotes
   ====================================================================== */

export interface NewJob {
  type: JobType;
  customerId: string;
  title?: string;
  description?: string;
  liftId?: string;
  itemId?: string;
  /** Builds: how many */
  qty?: number;
  leadId?: string;
  dealerOrderId?: string;
  start?: string;
  hours?: number;
  crew?: string[];
  priority?: 'normal' | 'high';
  value?: number;
  location?: string;
  /** Service and warranty: an issue key (data/catalog.ts → issues); its usual parts are reserved */
  issueKey?: string;
}

/** Sample time standards: by job type, and by lift size for builds and installs */
export const defaultHours = (d: DB, type: JobType, itemId?: string, liftId?: string, qty = 1) => {
  const capacity = d.items.find((i) => i.id === itemId)?.capacity ?? d.lifts.find((l) => l.id === liftId)?.capacity;
  return jobHours(type, capacity) * (type === 'build' ? qty : 1);
};

const checklistFor = (type: JobType) => checklists[type].map((label, i) => ({ id: `c${i + 1}`, label, done: false }));

function defaultTitle(d: DB, input: NewJob) {
  const c = d.customers.find((x) => x.id === input.customerId);
  const lift = d.lifts.find((l) => l.id === input.liftId);
  const item = d.items.find((i) => i.id === input.itemId);
  const who = c ? ` — ${c.name}` : '';
  const issue = input.issueKey ? issues[input.issueKey]?.label.toLowerCase() : undefined;
  switch (input.type) {
    case 'site-visit':
      return `Measure the slip${who}`;
    case 'build':
      return `Build ${(input.qty ?? 1) > 1 ? `${input.qty} × ` : ''}${item?.name ?? 'lift'}${who}`;
    case 'install':
      return `Install ${item?.name ?? 'lift'}${who}`;
    case 'service':
      return `Service: ${issue ?? lift?.model ?? 'lift'}${who}`;
    case 'warranty':
      return `Warranty: ${issue ?? lift?.model ?? 'lift'}${who}`;
    case 'remote':
      return `Fit ${item ? `an ${item.brand} remote` : 'a remote'}${who}`;
    default:
      return `Delivery${who}`;
  }
}

/** Reserve stock for a job (a finished lift, a remote, components, parts). */
function reserve(d: DB, job: Job, itemId: string, qty: number) {
  if (qty <= 0 || !d.items.some((i) => i.id === itemId)) return;
  job.parts.push({ itemId, qty, store: job.store, status: 'reserved' });
  edit(d.items, itemId, (it) => (it.stock[job.store].reserved += qty));
}

function release(d: DB, job: Job) {
  for (const p of job.parts) {
    if (p.status !== 'reserved') continue;
    edit(d.items, p.itemId, (it) => (it.stock[p.store].reserved = Math.max(0, it.stock[p.store].reserved - p.qty)));
  }
  job.parts = job.parts.filter((p) => p.status === 'used');
}

function pushJob(d: DB, input: NewJob): Job {
  const id = nextId(d, 'job', 'J');
  const item = d.items.find((i) => i.id === input.itemId);
  const issue = input.issueKey ? issues[input.issueKey] : undefined;
  const customer = d.customers.find((c) => c.id === input.customerId);
  const job: Job = {
    id,
    type: input.type,
    title: input.title?.trim() || defaultTitle(d, input),
    customerId: input.customerId,
    liftId: input.liftId,
    itemId: input.itemId,
    qty: input.type === 'build' ? (input.qty ?? 1) : undefined,
    leadId: input.leadId,
    dealerOrderId: input.dealerOrderId,
    store: STORE,
    status: input.start ? 'scheduled' : 'requested',
    priority: input.priority ?? 'normal',
    start: input.start,
    hours: input.hours ?? defaultHours(d, input.type, input.itemId, input.liftId, input.qty),
    crew: input.crew ?? [],
    description: input.description ?? '',
    location: input.location ?? (customer?.lake ? `${customer.lake.arm}${customer.lake.mm !== undefined ? `, MM ${customer.lake.mm}` : ''}` : undefined),
    checklist: checklistFor(input.type),
    parts: [],
    notes: [activity('system', 'Job created')],
    createdAt: stamp(),
    issue: issue?.label,
    value: input.value,
  };
  // What the job will use: the finished lift for an install, the components for a build, the remote for a remote
  // install, and the usual parts for the problem on a service or warranty call
  if (item && (input.type === 'install' || input.type === 'remote')) reserve(d, job, item.id, 1);
  if (item && input.type === 'build') for (const b of item.bom ?? []) reserve(d, job, b.itemId, b.qty * (input.qty ?? 1));
  if (issue && (input.type === 'service' || input.type === 'warranty')) {
    for (const p of issue.parts) reserve(d, job, p, p === 'C-HOSE' ? 20 : p === 'C-BUSH' ? 4 : 1);
  }
  d.jobs.push(job);
  if (input.leadId) {
    edit(d.leads, input.leadId, (l) => {
      l.jobId = l.jobId ?? id;
      l.unread = false;
      if (l.stage === 'new' || l.stage === 'contacted') l.stage = 'scheduled';
      if (!l.firstResponseAt) l.firstResponseAt = stamp();
      l.activity.push(activity('job', `${jobTypeLabels[input.type]} ${id} created${input.start ? ' and scheduled' : ''}`));
    });
  }
  return job;
}

export function createJob(input: NewJob): string {
  let id = '';
  mutate((d) => (id = pushJob(d, input).id));
  if (input.start) markTried('schedule');
  return id;
}

export function updateJob(id: string, patch: Partial<Job>) {
  mutate((d) => edit(d.jobs, id, (j) => Object.assign(j, patch)));
}

/** Put a job on the calendar (or take it off) and set the crew. */
export function scheduleJob(id: string, start: string | undefined, crew: string[]) {
  mutate((d) =>
    edit(d.jobs, id, (j) => {
      j.start = start;
      j.crew = crew;
      if (start && (j.status === 'requested' || j.status === 'on-hold')) j.status = 'scheduled';
      if (!start && j.status === 'scheduled') j.status = 'requested';
      const names = crew.map((c) => firstNameOf(d, c)).filter(Boolean).join(' & ');
      j.notes.push(activity('job', start ? `Scheduled for ${start.replace('T', ' ')}${names ? ` with ${names}` : ''}` : 'Removed from the schedule'));
    }),
  );
  markTried('schedule');
}

export function setJobStatus(id: string, status: JobStatus, opts: { holdReason?: string } = {}) {
  if (status === 'completed') return completeJob(id);
  mutate((d) => {
    const job = edit(d.jobs, id, (j) => {
      if (j.status === status) return;
      const prev = j.status;
      j.status = status;
      if (status === 'in-progress' && !j.startedAt) j.startedAt = stamp();
      if (status === 'on-hold') j.holdReason = opts.holdReason ?? j.holdReason ?? 'Waiting on parts';
      if (status !== 'on-hold' && prev === 'on-hold') j.holdReason = undefined;
      if (status === 'cancelled') release(d, j);
      j.notes.push(activity('status', `Status changed from ${statusLabels[prev]} to ${statusLabels[status]}${status === 'on-hold' ? ` — ${j.holdReason}` : ''}`));
    });
    // A dealer order is "building" once the shop starts on it
    if (job?.type === 'build' && status === 'in-progress' && job.dealerOrderId) {
      edit(d.dealerOrders, job.dealerOrderId, (o) => {
        if (o.status === 'confirmed') o.status = 'building';
      });
    }
  });
  markTried('board');
}

/** Valves on a remote, from its catalog name ("… 2 valve", "A/B split") */
const valvesOf = (it: Item) => (/A\/B/.test(it.name) ? 2 : Number(it.name.match(/(\d) valve/)?.[1] ?? 1));

/** Who covers a warranty part: FiberSteel, or the remote's maker */
const coveredByFor = (component: Component, lift?: Lift): WarrantyClaim['coveredBy'] => {
  if (component !== 'Remote system') return 'FiberSteel';
  const brand = lift?.remote?.brand;
  return brand === 'FirstMate' ? 'AquaLogic Marine (FirstMate)' : brand === 'Captain’s Choice' ? 'Captain’s Choice' : brand === 'Admiral' ? 'Admiral' : 'FiberSteel';
};

/**
 * Finish a job: record times and signature and use up what was reserved. Then, by type —
 * build: the lift goes into stock (and a dealer order is ready once all its builds are done) ·
 * install: the lift is added to the customer's record · service and warranty: the lift's service date, and a
 * warranty claim for the part · remote: the remote goes on the lift · delivery: the dealer order ships.
 */
export function completeJob(id: string, opts: { arrivedAt?: string; finishedAt?: string; signature?: { name: string; image?: string }; note?: string } = {}) {
  mutate((d) => {
    const job = d.jobs.find((j) => j.id === id);
    if (!job || job.status === 'completed' || job.status === 'closed') return;
    const done = edit(d.jobs, id, (j) => {
      j.status = 'completed';
      j.startedAt = opts.arrivedAt ?? j.startedAt ?? j.start ?? stamp();
      j.completedAt = opts.finishedAt ?? stamp();
      j.holdReason = undefined;
      j.checklist = j.checklist.map((c) => ({ ...c, done: true }));
      if (opts.signature) j.signature = { ...opts.signature, at: j.completedAt };
      if (opts.note) j.notes.push(activity('note', opts.note));
      j.notes.push(activity('status', 'Job completed'));
      // Reserved stock is now used
      j.parts = j.parts.map((p) => {
        if (p.status !== 'reserved') return p;
        edit(d.items, p.itemId, (it) => {
          const s = it.stock[p.store];
          s.reserved = Math.max(0, s.reserved - p.qty);
          s.onHand = Math.max(0, s.onHand - p.qty);
        });
        d.moves = [{ id: uid('m'), at: stamp(), itemId: p.itemId, store: p.store, qty: -p.qty, kind: 'job', ref: id, by: actor() }, ...d.moves];
        return { ...p, status: 'used' as const };
      });
    })!;
    const day = today();
    const customer = d.customers.find((c) => c.id === done.customerId);

    if (done.type === 'build' && done.itemId) {
      const qty = done.qty ?? 1;
      // Into the yard — set aside for the dealer order it was built for
      edit(d.items, done.itemId, (it) => {
        it.stock[done.store].onHand += qty;
        if (done.dealerOrderId) it.stock[done.store].reserved += qty;
      });
      d.moves = [{ id: uid('m'), at: stamp(), itemId: done.itemId, store: done.store, qty, kind: 'built', ref: id, by: actor() }, ...d.moves];
      if (done.dealerOrderId) {
        const order = d.dealerOrders.find((o) => o.id === done.dealerOrderId);
        const builds = d.jobs.filter((j) => order?.jobIds.includes(j.id) && j.type === 'build');
        if (order && builds.every((j) => j.status === 'completed' || j.status === 'closed' || j.status === 'cancelled')) {
          edit(d.dealerOrders, order.id, (o) => (o.status = 'ready'));
          addDeliveryJob(d, order);
          notify(d, 'dealer', `Dealer order ${order.id} is built and ready to ship`, `/office/dealers/?tab=orders&id=${order.id}`);
        }
      } else {
        // Set the finished lift aside for the install it was built for
        const open = (s: JobStatus) => s === 'requested' || s === 'scheduled' || s === 'in-progress' || s === 'on-hold';
        const install = d.jobs.find(
          (j) => j.type === 'install' && j.itemId === done.itemId && open(j.status) && (done.leadId ? j.leadId === done.leadId : j.customerId === done.customerId) && !j.parts.some((p) => p.itemId === done.itemId),
        );
        if (install) edit(d.jobs, install.id, (j) => reserve(d, j, done.itemId!, 1));
        notify(d, 'build', `${d.items.find((i) => i.id === done.itemId)?.name ?? 'Lift'} built${customer ? ` for ${customer.name}` : ''} — ready for the install`, `/office/jobs/?id=${install?.id ?? id}`);
      }
    }

    if (done.type === 'install' && done.itemId && !done.liftId) {
      const lead = d.leads.find((l) => l.id === done.leadId);
      const item = d.items.find((i) => i.id === done.itemId);
      // The lift leaves the yard — even when it wasn't set aside for this job (it was built after the job was booked)
      if (!done.parts.some((p) => p.itemId === done.itemId) && item && item.stock[done.store].onHand > 0) {
        edit(d.items, item.id, (it) => (it.stock[done.store].onHand -= 1));
        d.moves = [{ id: uid('m'), at: stamp(), itemId: item.id, store: done.store, qty: -1, kind: 'job', ref: id, by: actor() }, ...d.moves];
      }
      const docking = lead?.slip?.docking === 'straight' || lead?.slip?.docking === 'back-in' ? lead.slip.docking : 'straight';
      const liftId = pushLift(d, {
        customerId: done.customerId,
        itemId: done.itemId,
        installedOn: day,
        installedBy: 'FiberSteel',
        boat: lead?.boat,
        slip: lead?.slip?.widthFt && lead.slip.lengthFt ? { widthFt: lead.slip.widthFt, lengthFt: lead.slip.lengthFt, docking } : undefined,
        bunks: item?.category === 'PWC lifts' ? 'PWC bunks' : undefined,
      });
      edit(d.jobs, id, (j) => (j.liftId = liftId));
      if (d.website.showcase) notify(d, 'job', `${customer?.name ?? 'An'} install is finished — post it in “Lifts we’ve installed”?`, `/office/website/?tab=installs&job=${id}`);
    }

    if (done.liftId && (done.type === 'service' || done.type === 'warranty')) edit(d.lifts, done.liftId, (l) => (l.lastServiceOn = day));

    if (done.type === 'remote' && done.liftId && done.itemId) {
      const remote = d.items.find((i) => i.id === done.itemId);
      if (remote) edit(d.lifts, done.liftId, (l) => (l.remote = { brand: remote.brand === 'Admiral' ? 'Admiral' : (l.remote?.brand ?? 'Admiral'), valves: valvesOf(remote), installedOn: day }));
    }

    // Warranty work: a claim for the part (parts only — the owner pays the service call and labor)
    if (done.type === 'warranty' && !done.claimId && done.liftId) {
      const lift = d.lifts.find((l) => l.id === done.liftId);
      const issueDef = Object.values(issues).find((x) => x.label === done.issue);
      const component: Component = issueDef?.component ?? 'Galvanized part';
      const usedParts = done.parts.filter((p) => p.status === 'used');
      const partCost = usedParts.reduce((s, p) => s + p.qty * (d.items.find((i) => i.id === p.itemId)?.cost ?? 0), 0);
      const claimId = nextId(d, 'claim', 'WC');
      d.claims = [
        {
          id: claimId,
          liftId: done.liftId,
          customerId: done.customerId,
          jobId: id,
          store: done.store,
          openedOn: day,
          issue: done.issue ?? 'Warranty repair',
          component,
          part: d.items.find((i) => i.id === usedParts[0]?.itemId)?.name ?? issueDef?.label ?? 'Repair',
          coveredBy: coveredByFor(component, lift),
          status: component === 'Remote system' ? 'referred' : usedParts.length ? 'replaced' : 'open',
          partCost: Math.round(partCost * 100) / 100,
          updatedOn: day,
        },
        ...d.claims,
      ];
      edit(d.jobs, id, (j) => (j.claimId = claimId));
    }
    // A claim opened before the visit: the part has now been replaced
    if (done.type === 'warranty' && done.claimId) {
      edit(d.claims, done.claimId, (c) => {
        if (c.status !== 'open' && c.status !== 'approved' && c.status !== 'part-sent') return;
        c.status = 'replaced';
        c.updatedOn = day;
      });
    }

    if (done.type === 'delivery' && done.dealerOrderId) shipOrder(d, done.dealerOrderId, true);

    if (done.leadId) {
      edit(d.leads, done.leadId, (l) => {
        if ((l.kind === 'service' || l.kind === 'warranty') && l.stage !== 'closed') {
          l.stage = 'closed';
          l.closedAt = stamp();
          l.activity.push(activity('status', `Closed — ${id} completed`));
        }
      });
    }
    if (d.settings.notifications.jobCompleted) {
      notify(d, 'job', `${firstNameOf(d, actor()) ?? 'Someone'} finished ${jobTypeLabels[done.type].toLowerCase()} ${done.id}${customer ? ` for ${customer.name}` : ''}`, `/office/jobs/?id=${id}`);
    }
  });
  markTried('complete');
}

export function addJobNote(id: string, text: string) {
  mutate((d) => edit(d.jobs, id, (j) => j.notes.push(activity('note', text))));
}

export function toggleChecklistItem(jobId: string, itemId: string) {
  mutate((d) => edit(d.jobs, jobId, (j) => (j.checklist = j.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)))));
}

/** Reserve a part from stock for this job. */
export function addJobPart(jobId: string, itemId: string, qty: number) {
  mutate((d) => {
    edit(d.jobs, jobId, (j) => {
      j.parts.push({ itemId, qty, store: j.store, status: 'reserved' });
      j.notes.push(activity('job', `Reserved ${qty} × ${d.items.find((i) => i.id === itemId)?.name ?? itemId}`));
    });
    edit(d.items, itemId, (it) => (it.stock[STORE].reserved += qty));
  });
}

export function removeJobPart(jobId: string, index: number) {
  mutate((d) => {
    const job = d.jobs.find((j) => j.id === jobId);
    const part = job?.parts[index];
    if (!job || !part) return;
    if (part.status === 'reserved') edit(d.items, part.itemId, (it) => (it.stock[part.store].reserved = Math.max(0, it.stock[part.store].reserved - part.qty)));
    edit(d.jobs, jobId, (j) => j.parts.splice(index, 1));
  });
}

/* ======================================================================
   Invoices, estimates & payments
   ====================================================================== */

/** Builds are billed with the install (or the dealer order), deliveries for dealer orders with the order. */
export const billedElsewhere = (job: Job) => job.type === 'build' || (job.type === 'delivery' && !!job.dealerOrderId);

/**
 * Suggested invoice lines for a finished job. The service-call fee and remote installation price are the ones on
 * FiberSteel's site ($95 after the first year; $200 on the lake). Labor rate and install pricing are samples.
 */
export function linesForJob(d: DB, job: Job): InvoiceLine[] {
  const s = d.settings;
  const lift = d.lifts.find((l) => l.id === job.liftId);
  const lines: InvoiceLine[] = [];
  const line = (description: string, qty: number, rate: number, category: InvoiceLine['category'], taxable: boolean, itemId?: string) =>
    lines.push({ id: uid('l'), description, qty, rate, category, taxable, itemId });
  const hours = job.startedAt && job.completedAt ? Math.max(0.5, Math.round(((Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 3.6e6) * 4) / 4) : job.hours;
  const skip = new Set<string>();

  if (billedElsewhere(job)) return [];
  if (job.type === 'install') {
    const it = d.items.find((i) => i.id === job.itemId);
    if (it) {
      line(`FiberSteel ${it.name}${lift ? ` — serial ${lift.serial}` : ''}`, 1, it.price, 'Lifts', true, it.id);
      line('Delivery, installation & set-up on the lake', 1, Math.round(it.price * 0.08), 'Installation', false);
      skip.add(it.id);
    }
  } else if (job.type === 'remote') {
    const it = d.items.find((i) => i.id === job.itemId);
    if (it) {
      line(it.name, 1, it.price, 'Remotes & add-ons', true, it.id);
      skip.add(it.id);
    }
    line('Remote installation on the Lake of the Ozarks', 1, s.remoteInstall, 'Installation', false);
  } else if (job.type === 'service' || job.type === 'warranty') {
    if (!job.callbackOf && (!lift || serviceFeeApplies(lift))) line('Service call fee', 1, s.serviceFee, 'Service', false);
    line(`Labor${job.issue ? ` — ${job.issue.toLowerCase()}` : ''}`, hours, s.laborRate, 'Service', false);
  } else if (job.type === 'site-visit') {
    line('Site visit — measure the slip', 1, 0, 'Service', false);
  } else if (job.type === 'delivery') {
    line('Delivery', 1, 0, 'Installation', false);
  }
  for (const p of job.parts) {
    if (skip.has(p.itemId)) continue;
    const it = d.items.find((i) => i.id === p.itemId);
    if (!it) continue;
    line(job.type === 'warranty' ? `${it.name} (covered by the warranty)` : it.name, p.qty, job.type === 'warranty' ? 0 : it.price, 'Parts', true, it.id);
  }
  return lines;
}

export function createInvoice(input: {
  kind: 'invoice' | 'estimate';
  customerId: string;
  lines: InvoiceLine[];
  jobId?: string;
  leadId?: string;
  dealerOrderId?: string;
  issuedOn?: string;
  dueOn?: string;
  memo?: string;
  status?: Invoice['status'];
}): string {
  let id = '';
  mutate((d) => (id = pushInvoice(d, input)));
  return id;
}

function pushInvoice(d: DB, input: Parameters<typeof createInvoice>[0]): string {
  const id = input.kind === 'estimate' ? nextId(d, 'estimate', 'EST') : nextId(d, 'invoice', 'INV');
  const issuedOn = input.issuedOn ?? today();
  const customer = d.customers.find((c) => c.id === input.customerId);
  const termDays =
    input.kind === 'estimate' ? 30 : customer?.kind === 'dealer' || customer?.kind === 'marina' ? 30 : d.settings.terms === 'Net 30' ? 30 : d.settings.terms === 'Net 15' ? 15 : 0;
  const inv: Invoice = {
    id,
    kind: input.kind,
    customerId: input.customerId,
    jobId: input.jobId,
    leadId: input.leadId,
    dealerOrderId: input.dealerOrderId,
    store: STORE,
    issuedOn,
    dueOn: input.dueOn ?? addDays(issuedOn, termDays),
    status: input.status ?? 'draft',
    lines: input.lines,
    taxRate: d.settings.taxRates[STORE],
    payments: [],
    memo: input.memo,
    salesperson: actor(),
  };
  if (inv.status === 'sent') inv.sentAt = stamp();
  d.invoices = [inv, ...d.invoices];
  if (input.leadId && input.kind === 'estimate') {
    edit(d.leads, input.leadId, (l) => {
      l.estimateId = id;
      l.value = invoiceTotals(inv).subtotal;
      if (l.stage !== 'won' && l.stage !== 'lost') l.stage = inv.status === 'sent' ? 'quoted' : l.stage;
      l.activity.push(activity('estimate', `Quote ${id} ${inv.status === 'sent' ? 'sent' : 'drafted'} — ${money(invoiceTotals(inv).total)}`));
    });
  }
  return id;
}

/** Bill a finished job, or close it when it's billed elsewhere (a build, a dealer delivery). */
export function invoiceJob(jobId: string, opts: { send?: boolean } = {}): string | undefined {
  const job = db.value.jobs.find((j) => j.id === jobId)!;
  if (billedElsewhere(job) || (job.invoiceId && db.value.invoices.some((i) => i.id === job.invoiceId))) {
    mutate((d) =>
      edit(d.jobs, jobId, (j) => {
        j.status = 'closed';
        j.notes.push(activity('status', j.invoiceId ? `Closed — billed on ${j.invoiceId}` : j.dealerOrderId ? `Closed — billed with dealer order ${j.dealerOrderId}` : 'Closed — billed with the install'));
      }),
    );
    return job.invoiceId;
  }
  const id = createInvoice({
    kind: 'invoice',
    customerId: job.customerId,
    lines: linesForJob(db.value, job),
    jobId,
    leadId: job.type === 'install' ? job.leadId : undefined,
    status: opts.send ? 'sent' : 'draft',
    memo: job.type === 'warranty' ? 'Warranty: the part is covered by FiberSteel; the service call and labor are billed to the owner.' : undefined,
  });
  mutate((d) => {
    edit(d.jobs, jobId, (j) => {
      j.invoiceId = id;
      j.status = 'closed';
      j.notes.push(activity('status', `Invoice ${id} created`));
    });
    const synced = syncIfConnected(d, `Invoice ${id} sent to QuickBooks`);
    if (synced) edit(d.invoices, id, (i) => (i.syncedAt = synced));
  });
  return id;
}

export function updateInvoice(id: string, patch: Partial<Invoice>) {
  mutate((d) => edit(d.invoices, id, (i) => Object.assign(i, patch)));
}

export function sendInvoice(id: string) {
  mutate((d) => {
    const inv = edit(d.invoices, id, (i) => {
      if (i.status === 'draft') i.status = 'sent';
      i.sentAt = stamp();
    });
    if (inv?.kind === 'estimate' && inv.leadId) {
      edit(d.leads, inv.leadId, (l) => {
        if (l.stage !== 'won' && l.stage !== 'lost') l.stage = 'quoted';
        l.activity.push(activity('estimate', `Quote ${id} sent to the customer`));
      });
    }
    const synced = syncIfConnected(d, `${inv?.kind === 'estimate' ? 'Estimate' : 'Invoice'} ${id} sent to QuickBooks`);
    if (synced) edit(d.invoices, id, (i) => (i.syncedAt = synced));
  });
}

export function recordPayment(invoiceId: string, amount: number, method: PaymentMethod, date = today(), ref?: string) {
  mutate((d) => {
    const inv = edit(d.invoices, invoiceId, (i) => {
      i.payments.push({ id: uid('p'), date, amount: Math.round(amount * 100) / 100, method, ref });
      if (i.status === 'draft') i.status = 'sent';
    })!;
    const c = d.customers.find((x) => x.id === inv.customerId);
    if (d.settings.notifications.paymentReceived) notify(d, 'payment', `Payment received: ${money(amount)} from ${c?.name ?? 'a customer'} (${method})`, `/office/accounting/?tab=invoices&id=${invoiceId}`);
    const synced = syncIfConnected(d, `Payment of ${money(amount)} on ${invoiceId} sent to QuickBooks`);
    if (synced) edit(d.invoices, invoiceId, (i) => (i.syncedAt = synced));
  });
  markTried('payment');
}

export function voidInvoice(id: string) {
  mutate((d) => edit(d.invoices, id, (i) => (i.status = 'void')));
}

export function sendReminder(id: string) {
  mutate((d) => edit(d.invoices, id, (i) => (i.remindedAt = stamp())));
}

export function acceptEstimate(id: string) {
  mutate((d) => {
    const est = edit(d.invoices, id, (i) => {
      i.status = 'accepted';
      i.acceptedOn = today();
    })!;
    if (est.leadId) {
      edit(d.leads, est.leadId, (l) => {
        l.stage = 'won';
        l.closedAt = stamp();
        l.value = invoiceTotals(est).subtotal;
        l.activity.push(activity('status', `Quote ${id} accepted`));
      });
    }
  });
}

export function declineEstimate(id: string, reason = 'Customer declined') {
  mutate((d) => {
    const est = edit(d.invoices, id, (i) => (i.status = 'declined'))!;
    if (est.leadId) {
      edit(d.leads, est.leadId, (l) => {
        l.stage = 'lost';
        l.lostReason = reason;
        l.closedAt = stamp();
        l.activity.push(activity('status', `Marked lost — ${reason.toLowerCase()}`));
      });
    }
  });
}

/** Turn an accepted quote into an invoice (deposit billing). */
export function convertEstimate(id: string): string {
  const est = db.value.invoices.find((i) => i.id === id)!;
  if (est.status !== 'accepted') acceptEstimate(id);
  return createInvoice({ kind: 'invoice', customerId: est.customerId, lines: structuredClone(est.lines), leadId: est.leadId, status: 'sent', memo: `From quote ${id}` });
}

/**
 * The customer said yes: accept the quote and put the lift into the pipeline — a shop build and an install, both
 * waiting to be scheduled.
 */
export function orderFromEstimate(id: string): { buildId?: string; installId?: string } {
  const est = db.value.invoices.find((i) => i.id === id);
  if (!est) return {};
  if (est.status !== 'accepted') acceptEstimate(id);
  const out: { buildId?: string; installId?: string } = {};
  mutate((d) => {
    const liftLine = est.lines.find((l) => d.items.find((i) => i.id === l.itemId)?.kind === 'lift');
    if (!liftLine?.itemId) return;
    const lead = d.leads.find((l) => l.id === est.leadId);
    const boat = lead?.boat ? `${lead.boat.lengthFt} ft ${lead.boat.type.toLowerCase()}` : undefined;
    out.buildId = pushJob(d, { type: 'build', customerId: est.customerId, itemId: liftLine.itemId, leadId: est.leadId, description: boat ? `For a ${boat}.` : '' }).id;
    out.installId = pushJob(d, { type: 'install', customerId: est.customerId, itemId: liftLine.itemId, leadId: est.leadId, value: liftLine.rate, location: lead?.location, description: boat ? `${boat[0].toUpperCase()}${boat.slice(1)}.` : '' }).id;
    if (est.leadId) edit(d.leads, est.leadId, (l) => (l.jobId = out.installId));
  });
  markTried('order');
  return out;
}

/* ======================================================================
   Warranty claims
   ====================================================================== */

export function createClaim(input: { liftId: string; jobId?: string; issue: string; component: Component; part: string; partCost?: number; notes?: string }): string {
  let id = '';
  mutate((d) => {
    const lift = d.lifts.find((l) => l.id === input.liftId)!;
    id = nextId(d, 'claim', 'WC');
    const claim: WarrantyClaim = {
      id,
      liftId: lift.id,
      customerId: lift.customerId,
      jobId: input.jobId,
      store: STORE,
      openedOn: today(),
      issue: input.issue,
      component: input.component,
      part: input.part,
      coveredBy: coveredByFor(input.component, lift),
      status: input.component === 'Remote system' ? 'referred' : 'open',
      partCost: input.partCost ?? 0,
      updatedOn: today(),
      notes: input.notes,
    };
    d.claims = [claim, ...d.claims];
    if (input.jobId) edit(d.jobs, input.jobId, (j) => (j.claimId = id));
  });
  return id;
}

export function setClaimStatus(id: string, status: WarrantyClaim['status'], patch: Partial<WarrantyClaim> = {}) {
  mutate((d) =>
    edit(d.claims, id, (c) => {
      c.status = status;
      c.updatedOn = today();
      Object.assign(c, patch);
    }),
  );
}

/* ======================================================================
   Dealers & dealer orders
   ====================================================================== */

export function addDealer(input: Omit<Dealer, 'id' | 'since' | 'customerId'> & { since?: string }): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'dealer', 'D');
    const customerId = nextId(d, 'customer', 'C');
    d.customers.push({
      id: customerId,
      name: input.name,
      contact: input.contact,
      kind: 'dealer',
      phone: input.phone,
      email: input.email,
      address: { street: '', city: input.city, state: input.state, zip: '' },
      store: STORE,
      since: today(),
      tags: ['Dealer'],
      contactPref: 'email',
      dealerId: id,
    });
    d.dealers.push({ ...input, id, since: input.since ?? today(), customerId });
  });
  return id;
}

/** A "become a dealer" request becomes a prospect account. */
export function createDealerFromLead(leadId: string): string {
  const l = db.value.leads.find((x) => x.id === leadId)!;
  const f = (label: string) => l.fields.find(([k]) => k === label)?.[1];
  const id = addDealer({
    name: f('Business') ?? l.name,
    city: f('City') ?? l.city ?? '',
    state: f('State') ?? 'MO',
    area: f('Lakes / areas served') ?? '',
    contact: l.name,
    phone: l.phone ?? '',
    email: l.email ?? '',
    status: 'prospect',
    discount: 0.2,
    notes: l.message,
  });
  mutate((d) =>
    edit(d.leads, leadId, (x) => {
      x.dealerId = id;
      x.customerId = d.dealers.find((dl) => dl.id === id)?.customerId;
      if (x.stage === 'new') x.stage = 'contacted';
      x.activity.push(activity('system', `Dealer account ${id} created (prospect)`));
    }),
  );
  return id;
}

export function updateDealer(id: string, patch: Partial<Dealer>) {
  mutate((d) => {
    const dealer = edit(d.dealers, id, (x) => Object.assign(x, patch));
    if (dealer && (patch.name || patch.contact || patch.phone || patch.email || patch.city || patch.state)) {
      edit(d.customers, dealer.customerId, (c) => {
        c.name = dealer.name;
        c.contact = dealer.contact;
        c.phone = dealer.phone;
        c.email = dealer.email;
        c.address = { ...c.address, city: dealer.city, state: dealer.state };
      });
    }
  });
}

/** Dealer price: list less the dealer's discount */
export const dealerRate = (item: Item, dealer: Dealer) => Math.round(item.price * (1 - dealer.discount));

function addBuildJobs(d: DB, order: DealerOrder) {
  const dealer = d.dealers.find((x) => x.id === order.dealerId)!;
  const ids: string[] = [];
  for (const line of order.lines) {
    const item = d.items.find((i) => i.id === line.itemId);
    if (item?.kind !== 'lift') continue;
    // Use finished lifts already in stock first (set aside for this order); build the rest
    const free = Math.max(0, item.stock[STORE].onHand - item.stock[STORE].reserved - item.stock[STORE].display);
    const fromStock = Math.min(free, line.qty);
    if (fromStock) edit(d.items, item.id, (it) => (it.stock[STORE].reserved += fromStock));
    const build = line.qty - fromStock;
    if (!build) continue;
    ids.push(pushJob(d, { type: 'build', customerId: dealer.customerId, itemId: item.id, qty: build, dealerOrderId: order.id, description: `Dealer order ${order.id} for ${dealer.name}.` }).id);
  }
  return ids;
}

function addDeliveryJob(d: DB, order: DealerOrder) {
  if (d.jobs.some((j) => j.type === 'delivery' && j.dealerOrderId === order.id && j.status !== 'cancelled')) return;
  const dealer = d.dealers.find((x) => x.id === order.dealerId)!;
  const what = order.lines.map((l) => `${l.qty} × ${d.items.find((i) => i.id === l.itemId)?.name ?? l.itemId}`).join(', ');
  const job = pushJob(d, {
    type: 'delivery',
    customerId: dealer.customerId,
    dealerOrderId: order.id,
    title: `${order.ship === 'freight' ? 'Freight pickup' : order.ship === 'pickup' ? 'Dealer pickup' : 'Deliver'} — ${dealer.name}`,
    description: `${what}.`,
    location: `${dealer.city}, ${dealer.state}`,
  });
  edit(d.dealerOrders, order.id, (o) => o.jobIds.push(job.id));
}

/** Ship (or deliver) a dealer order: stock goes out and the dealer is invoiced, once. */
function shipOrder(d: DB, orderId: string, delivered = false) {
  const order = d.dealerOrders.find((o) => o.id === orderId);
  if (!order || order.status === 'cancelled') return;
  const dealer = d.dealers.find((x) => x.id === order.dealerId)!;
  const day = today();
  if (!order.shippedOn) {
    for (const l of order.lines) {
      // Finished lifts were set aside for the order; other items come straight off the shelf
      edit(d.items, l.itemId, (it) => {
        it.stock[STORE].onHand = Math.max(0, it.stock[STORE].onHand - l.qty);
        if (it.kind === 'lift') it.stock[STORE].reserved = Math.max(0, it.stock[STORE].reserved - l.qty);
      });
      d.moves = [{ id: uid('m'), at: stamp(), itemId: l.itemId, store: STORE, qty: -l.qty, kind: 'shipped', ref: order.id, by: actor() }, ...d.moves];
    }
  }
  let invoiceId = order.invoiceId;
  if (!invoiceId) {
    invoiceId = pushInvoice(d, {
      kind: 'invoice',
      customerId: dealer.customerId,
      dealerOrderId: order.id,
      status: 'sent',
      lines: order.lines.map((l) => ({ id: uid('l'), description: `${d.items.find((i) => i.id === l.itemId)?.name ?? l.itemId} (dealer)`, qty: l.qty, rate: l.rate, itemId: l.itemId, category: 'Dealer sales', taxable: false })),
      memo: `Dealer order ${order.id}`,
    });
    const synced = syncIfConnected(d, `Invoice ${invoiceId} sent to QuickBooks`);
    if (synced) edit(d.invoices, invoiceId, (i) => (i.syncedAt = synced));
  }
  edit(d.dealerOrders, order.id, (o) => {
    o.shippedOn = o.shippedOn ?? day;
    o.invoiceId = invoiceId;
    o.status = delivered || o.ship === 'delivery' || o.ship === 'pickup' ? 'delivered' : 'shipped';
    if (o.status === 'delivered') o.deliveredOn = o.deliveredOn ?? day;
  });
  notify(d, 'dealer', `Dealer order ${order.id} ${order.ship === 'freight' && !delivered ? 'shipped' : 'delivered'} — invoice ${invoiceId} sent to ${dealer.name}`, `/office/dealers/?tab=orders&id=${order.id}`);
}

export function createDealerOrder(input: { dealerId: string; lines: { itemId: string; qty: number; rate?: number }[]; ship: DealerOrder['ship']; shipOn?: string; notes?: string; confirm?: boolean }): string {
  let id = '';
  mutate((d) => {
    const dealer = d.dealers.find((x) => x.id === input.dealerId)!;
    id = nextId(d, 'order', 'DO');
    const order: DealerOrder = {
      id,
      dealerId: dealer.id,
      placedOn: today(),
      lines: input.lines.map((l) => {
        const item = d.items.find((i) => i.id === l.itemId)!;
        return { itemId: l.itemId, qty: l.qty, rate: l.rate ?? dealerRate(item, dealer) };
      }),
      status: input.confirm ? 'confirmed' : 'quote',
      ship: input.ship,
      shipOn: input.shipOn,
      jobIds: [],
      notes: input.notes,
      by: actor(),
    };
    d.dealerOrders = [order, ...d.dealerOrders];
    if (input.confirm) {
      order.jobIds = addBuildJobs(d, order);
      if (!order.jobIds.length) {
        order.status = 'ready';
        addDeliveryJob(d, order);
      }
    }
  });
  markTried('dealer-order');
  return id;
}

/** Move a dealer order along. Confirming starts the shop builds; shipping invoices the dealer. */
export function setDealerOrderStatus(id: string, status: DealerOrderStatus) {
  mutate((d) => {
    const order = d.dealerOrders.find((o) => o.id === id);
    if (!order || order.status === status) return;
    if (status === 'shipped' || status === 'delivered') return shipOrder(d, id, status === 'delivered');
    if (status === 'cancelled') {
      // Finished lifts set aside for the order go back to the yard: the ones taken from stock, and the ones built
      if (order.status !== 'quote') {
        for (const line of order.lines) {
          const builds = d.jobs.filter((j) => order.jobIds.includes(j.id) && j.type === 'build' && j.itemId === line.itemId);
          const built = builds.filter((j) => j.status === 'completed' || j.status === 'closed').reduce((n, j) => n + (j.qty ?? 1), 0);
          const fromStock = Math.max(0, line.qty - builds.reduce((n, j) => n + (j.qty ?? 1), 0));
          const setAside = built + fromStock;
          if (setAside && d.items.find((i) => i.id === line.itemId)?.kind === 'lift') edit(d.items, line.itemId, (it) => (it.stock[STORE].reserved = Math.max(0, it.stock[STORE].reserved - setAside)));
        }
      }
      for (const jobId of order.jobIds) {
        edit(d.jobs, jobId, (j) => {
          if (j.status === 'completed' || j.status === 'closed' || j.status === 'cancelled') return;
          release(d, j);
          j.status = 'cancelled';
          j.notes.push(activity('status', `Cancelled with dealer order ${id}`));
        });
      }
    }
    edit(d.dealerOrders, id, (o) => (o.status = status));
    if (status === 'confirmed' && !order.jobIds.length) {
      const jobIds = addBuildJobs(d, order);
      edit(d.dealerOrders, id, (o) => (o.jobIds = jobIds));
      if (!jobIds.length) {
        edit(d.dealerOrders, id, (o) => (o.status = 'ready'));
        addDeliveryJob(d, d.dealerOrders.find((o) => o.id === id)!);
      }
    }
    if (status === 'ready') addDeliveryJob(d, d.dealerOrders.find((o) => o.id === id)!);
  });
}

export function updateDealerOrder(id: string, patch: Partial<DealerOrder>) {
  mutate((d) => edit(d.dealerOrders, id, (o) => Object.assign(o, patch)));
}

/* ======================================================================
   Inventory
   ====================================================================== */

export function adjustStock(itemId: string, delta: number, note: string) {
  mutate((d) => {
    edit(d.items, itemId, (it) => (it.stock[STORE].onHand = Math.max(0, it.stock[STORE].onHand + delta)));
    d.moves = [{ id: uid('m'), at: stamp(), itemId, store: STORE, qty: delta, kind: 'adjustment', by: actor(), note }, ...d.moves];
  });
  markTried('stock');
}

export function updateItem(id: string, patch: Partial<Item>) {
  mutate((d) => edit(d.items, id, (it) => Object.assign(it, patch)));
}

export function createPO(input: { vendorId: string; lines: { itemId: string; qty: number }[]; notes?: string; order?: boolean }): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'po', 'PO');
    const po: PurchaseOrder = {
      id,
      vendorId: input.vendorId,
      store: STORE,
      status: input.order ? 'ordered' : 'draft',
      createdAt: stamp(),
      orderedOn: input.order ? today() : undefined,
      expectedOn: input.order ? addDays(today(), 10) : undefined,
      lines: input.lines.map((l) => ({ ...l, received: 0, cost: d.items.find((i) => i.id === l.itemId)?.cost ?? 0 })),
      notes: input.notes,
      createdBy: actor(),
    };
    d.pos = [po, ...d.pos];
  });
  return id;
}

export function updatePO(id: string, patch: Partial<PurchaseOrder>) {
  mutate((d) => edit(d.pos, id, (p) => Object.assign(p, patch)));
}

export function orderPO(id: string) {
  mutate((d) =>
    edit(d.pos, id, (p) => {
      p.status = 'ordered';
      p.orderedOn = today();
      p.expectedOn = p.expectedOn ?? addDays(today(), 10);
    }),
  );
}

/** Receive some or all of a purchase order into stock; creates the vendor bill for what arrived. */
export function receivePO(id: string, quantities?: Record<string, number>) {
  mutate((d) => {
    const po = d.pos.find((p) => p.id === id)!;
    let amount = 0;
    const at = stamp();
    const lines = po.lines.map((l) => {
      const qty = Math.max(0, Math.min(l.qty - l.received, quantities?.[l.itemId] ?? l.qty - l.received));
      if (!qty) return l;
      amount += qty * l.cost;
      edit(d.items, l.itemId, (it) => (it.stock[po.store].onHand += qty));
      d.moves = [{ id: uid('m'), at, itemId: l.itemId, store: po.store, qty, kind: 'received', ref: id, by: actor() }, ...d.moves];
      return { ...l, received: l.received + qty };
    });
    const complete = lines.every((l) => l.received >= l.qty);
    edit(d.pos, id, (p) => {
      p.lines = lines;
      p.status = complete ? 'received' : 'partial';
      if (complete) p.receivedOn = today();
    });
    if (amount > 0) {
      const vendor = d.vendors.find((v) => v.id === po.vendorId)!;
      d.bills = [
        {
          id: nextId(d, 'bill', 'B'),
          vendorId: vendor.id,
          number: `${vendor.name.replace(/[^A-Z]/g, '').slice(0, 3) || 'INV'}-${Math.floor(10000 + Math.random() * 89999)}`,
          issuedOn: today(),
          dueOn: addDays(today(), vendor.terms === 'Net 30' ? 30 : vendor.terms === 'Net 15' ? 15 : 0),
          amount: Math.round(amount * 100) / 100,
          category: vendor.category,
          store: po.store,
          status: 'open',
          memo: `Received on ${id}`,
          poId: id,
        },
        ...d.bills,
      ];
    }
  });
  markTried('stock');
}

/* ======================================================================
   Bills & banking
   ====================================================================== */

export function payBill(id: string, date = today()) {
  mutate((d) => {
    const bill = edit(d.bills, id, (b) => {
      b.status = 'paid';
      b.paidOn = date;
    })!;
    const vendor = d.vendors.find((v) => v.id === bill.vendorId);
    d.txns = [{ id: uid('t'), accountId: 'acct-op', date, description: `ACH — ${vendor?.name ?? 'Vendor'}`, amount: -bill.amount, category: bill.category, match: { kind: 'bill', id }, reviewed: true }, ...d.txns];
    edit(d.accounts, 'acct-op', (a) => (a.balance = Math.round((a.balance - bill.amount) * 100) / 100));
    const synced = syncIfConnected(d, `Bill payment to ${vendor?.name ?? 'vendor'} sent to QuickBooks`);
    if (synced) edit(d.bills, id, (b) => (b.syncedAt = synced));
  });
}

export function scheduleBill(id: string, date: string) {
  mutate((d) =>
    edit(d.bills, id, (b) => {
      b.status = 'scheduled';
      b.scheduledOn = date;
    }),
  );
}

export function categorizeTxn(id: string, category: string) {
  mutate((d) =>
    edit(d.txns, id, (t) => {
      t.category = category;
      t.reviewed = true;
    }),
  );
}

/* ======================================================================
   Books: in-house or QuickBooks
   ====================================================================== */

export function setBooksMode(mode: 'in-house' | 'quickbooks') {
  mutate((d) => (d.books = { ...d.books, mode }));
}

export function updateBooks(patch: Partial<DB['books']>) {
  mutate((d) => (d.books = { ...d.books, ...patch }));
}

/** Simulated QuickBooks Online connection (no data leaves the browser). */
export function connectQuickBooks(company = 'FiberSteel Boat Lifts, LLC') {
  mutate((d) => {
    const at = stamp();
    const recent = d.invoices.filter((i) => i.status !== 'draft');
    const log = [
      { id: uid('q'), at, level: 'ok' as const, text: `Connected to QuickBooks Online company “${company}”` },
      { id: uid('q'), at, level: 'ok' as const, text: `Matched ${d.customers.length.toLocaleString()} customers and ${d.items.length} products & services` },
      { id: uid('q'), at, level: 'ok' as const, text: `Sent ${recent.length} invoices and ${recent.reduce((n, i) => n + i.payments.length, 0)} payments` },
      { id: uid('q'), at, level: 'warn' as const, text: '2 customers have no email address — invoices for them will sync without e-delivery' },
    ];
    d.books = { ...d.books, connected: true, mode: 'quickbooks', company, connectedAt: at, lastSyncAt: at, log: [...log.reverse(), ...d.books.log] };
    d.invoices = d.invoices.map((i) => (i.status === 'draft' || i.syncedAt ? i : { ...i, syncedAt: at }));
    notify(d, 'sync', 'QuickBooks Online connected — first sync finished', '/office/accounting/?tab=integrations');
  });
  markTried('quickbooks');
}

export function disconnectQuickBooks() {
  mutate((d) => {
    d.books = { ...d.books, connected: false, mode: 'in-house', log: [{ id: uid('q'), at: stamp(), level: 'warn' as const, text: 'Disconnected from QuickBooks Online' }, ...d.books.log] };
  });
}

export function syncQuickBooks() {
  mutate((d) => {
    const at = stamp();
    const pending = d.invoices.filter((i) => i.status !== 'draft' && !i.syncedAt);
    d.invoices = d.invoices.map((i) => (i.status === 'draft' || i.syncedAt ? i : { ...i, syncedAt: at }));
    d.books = {
      ...d.books,
      lastSyncAt: at,
      log: [{ id: uid('q'), at, level: 'ok' as const, text: pending.length ? `Sent ${pending.length} new invoice${pending.length === 1 ? '' : 's'} and updated payments` : 'Everything is up to date' }, ...d.books.log].slice(0, 60),
    };
  });
}

/* ======================================================================
   Settings
   ====================================================================== */

export function updateSettings(fn: (s: Settings) => void) {
  mutate((d) => {
    const next = structuredClone(d.settings);
    fn(next);
    d.settings = next;
  });
}

export function setPermission(role: Role, section: Section, allowed: boolean) {
  updateSettings((s) => {
    const list = new Set(s.permissions[role]);
    if (allowed) list.add(section);
    else list.delete(section);
    s.permissions[role] = [...list];
  });
}
