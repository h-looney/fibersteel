/**
 * FiberSteel mode's data store.
 *
 * One document (the DB) lives in a Preact signal and is saved to IndexedDB in this browser.
 * Open tabs stay in sync over a BroadcastChannel, and website form submissions queued by
 * the public pages (see bridge.ts) arrive as new inbox requests — live, if a tab is open.
 */
import { batch, computed, effect, signal } from '@preact/signals';
import { CHANNEL, OFFICE_DB, OFFICE_STORE, QUEUE_KEY, SITE_DEALERS_KEY, SITE_INSTALLS_KEY, SITE_USED_KEY, clearQueue, clearSiteFeatures, photoKey, readQueue, readSiteFeatures, writeSiteFeature, type QueuedSubmission, type SiteDealer, type SiteInstall, type SiteUsedLift } from './bridge';
import { boatSizes, estimateLiftSize } from '../data/lifts';
import { profiles } from './data/people';
import { createDemo, DB_VERSION, demoClock } from './data/seed';
import type { DB, Docking, History, Lead, LeadKind, LeadSource, Section, StoreId, UIState } from './data/types';
import { diffDays, now, shiftDates, today } from './lib/dates';
import { signInRequested } from './router';
import { toast } from './toast';

/* ---------- Signals ---------- */

export const db = signal<DB>(null as unknown as DB);
export const history = signal<History>(null as unknown as History);
export const ready = signal(false);

const UI_KEY = 'fs-office-ui';
const defaultUI: UIState = {
  signedIn: false,
  userId: 'dean',
  store: 'all',
  jobsView: 'board',
  range: '90d',
  welcomeDismissed: false,
  tried: [],
};

function loadUI(): UIState {
  try {
    const saved: UIState = { ...defaultUI, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') };
    // A profile the demo no longer offers (an earlier version's owner) becomes today's default
    if (!profiles.some((p) => p.id === saved.userId)) saved.userId = defaultUI.userId;
    // Arriving from the public site: pick a profile again
    if (signInRequested && saved.signedIn) return { ...saved, signedIn: false, lastUserId: saved.userId };
    return saved;
  } catch {
    return defaultUI;
  }
}

export const ui = signal<UIState>(loadUI());
effect(() => {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui.value));
  } catch {
    /* private mode */
  }
});

export const setUI = (patch: Partial<UIState>) => {
  ui.value = { ...ui.value, ...patch };
};

/** Tick off an item in the "Things to try" checklist */
export const markTried = (key: string) => {
  if (!ui.value.tried.includes(key)) setUI({ tried: [...ui.value.tried, key] });
};

export const me = computed(() => db.value?.staff.find((s) => s.id === ui.value.userId) ?? db.value?.staff[0]);

export const can = (section: Section) => {
  const user = me.value;
  return !!user && !!db.value && db.value.settings.permissions[user.role].includes(section);
};

/** Does a record belong to the location picked in the sidebar? (FiberSteel has one location, so always.) */
export const inStore = (store: StoreId) => ui.value.store === 'all' || ui.value.store === store;

/* ---------- Editing ---------- */

/**
 * Change the data. Top-level collections are copied so every view re-renders; use `edit()`
 * to change a single record without touching the previous version.
 */
export function mutate(fn: (d: DB) => void) {
  const current = db.value;
  const next = { ...current } as DB;
  for (const key of Object.keys(next) as (keyof DB)[]) {
    const value = next[key];
    if (Array.isArray(value)) (next as unknown as Record<string, unknown>)[key] = [...value];
  }
  fn(next);
  db.value = next;
}

/** Replace one record (by id) with an edited copy. */
export function edit<T extends { id: string }>(list: T[], id: string, fn: (draft: T) => void): T | undefined {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  const copy = structuredClone(list[i]);
  fn(copy);
  list[i] = copy;
  return copy;
}

/** Next sequential id, e.g. nextId(d, 'job', 'J') → 'J-41542' */
export function nextId(d: DB, key: string, prefix: string) {
  d.counters = { ...d.counters };
  const n = d.counters[key] ?? 1;
  d.counters[key] = n + 1;
  return `${prefix}-${n}`;
}

export const uid = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---------- IndexedDB (falls back to memory) ---------- */

let idb: Promise<IDBDatabase | null> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  idb ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(OFFICE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(OFFICE_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idb;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const conn = await openIdb();
  if (!conn) return undefined;
  return new Promise((resolve) => {
    try {
      const req = conn.transaction(OFFICE_STORE).objectStore(OFFICE_STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const conn = await openIdb();
  if (!conn) return;
  return new Promise((resolve) => {
    try {
      const tx = conn.transaction(OFFICE_STORE, 'readwrite');
      tx.objectStore(OFFICE_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string | IDBKeyRange): Promise<void> {
  const conn = await openIdb();
  if (!conn) return;
  return new Promise((resolve) => {
    try {
      const tx = conn.transaction(OFFICE_STORE, 'readwrite');
      tx.objectStore(OFFICE_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ---------- Photos: one key per image, outside the main document (which is saved on every change) ---------- */

const photoCache = new Map<string, Blob>();

export async function putPhoto(id: string, blob: Blob) {
  photoCache.set(id, blob);
  await idbSet(photoKey(id), blob);
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  const cached = photoCache.get(id);
  if (cached) return cached;
  const blob = await idbGet<Blob>(photoKey(id));
  if (blob instanceof Blob) photoCache.set(id, blob);
  return blob instanceof Blob ? blob : undefined;
}

export async function deletePhotos(ids: string[]) {
  for (const id of ids) {
    photoCache.delete(id);
    await idbDelete(photoKey(id));
  }
}

/** The installs the public pages preview after a publish (simulated) — see readPublishedInstalls() in bridge.ts */
export const setSiteInstalls = (value: Record<string, SiteInstall>) => idbSet(SITE_INSTALLS_KEY, value);

/** The used-lift listings the public page previews after a publish (simulated) */
export const setSiteUsed = (value: Record<string, SiteUsedLift>) => idbSet(SITE_USED_KEY, value);

/** The dealer listing changes the dealer page previews after a publish (simulated) */
export const setSiteDealers = (value: Record<string, SiteDealer>) => idbSet(SITE_DEALERS_KEY, value);

/** Forget every photo and everything published, and the site's feature switches, when the demo data starts over */
async function clearPhotos() {
  photoCache.clear();
  clearSiteFeatures();
  await idbDelete(IDBKeyRange.bound(photoKey(''), photoKey('\uffff')));
  await idbDelete(SITE_INSTALLS_KEY);
  await idbDelete(SITE_USED_KEY);
  await idbDelete(SITE_DEALERS_KEY);
}

/* ---------- Load, save, sync ---------- */

const TAB = Math.random().toString(36).slice(2);
let channel: BroadcastChannel | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let skipNextSave = false;

async function save(value: DB) {
  await idbSet('db', value);
  channel?.postMessage({ type: 'db', from: TAB });
}

effect(() => {
  const value = db.value;
  if (!ready.value || !value) return;
  if (skipNextSave) {
    skipNextSave = false;
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void save(value);
  }, 60);
});

export async function initStore() {
  let stored = await idbGet<DB>('db');
  let hist = await idbGet<History>('history');
  const t = today();

  if (!stored || stored.version !== DB_VERSION || !hist) {
    const demo = createDemo(t, demoClock());
    stored = demo.db;
    hist = demo.history;
    void clearPhotos();
    void idbSet('history', hist);
    void idbSet('db', stored);
  } else {
    // Keep the demo current: move every date forward by the days since it was generated.
    const delta = diffDays(t, stored.seededOn);
    if (delta > 0) {
      stored = shiftDates(stored, delta);
      hist = shiftDates(hist, delta);
      void idbSet('history', hist);
      void idbSet('db', stored);
    }
  }

  // The installs showcase's switch: what the public pages in this browser follow. It's written to localStorage at once when
  // flipped, so it wins over a saved copy that didn't make it to IndexedDB before the page was left
  const shown = readSiteFeatures().installs;
  if (typeof shown === 'boolean' && stored.website && stored.website.showcase !== shown) {
    stored = { ...stored, website: { ...stored.website, showcase: shown } };
    void idbSet('db', stored);
  } else writeSiteFeature('installs', stored.website?.showcase !== false);

  skipNextSave = true;
  batch(() => {
    db.value = stored!;
    history.value = hist!;
    ready.value = true;
  });

  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = async (e: MessageEvent) => {
      const msg = e.data as { type?: string; from?: string };
      if (msg.from === TAB) return;
      if (msg.type === 'db' || msg.type === 'reset') {
        const fresh = await idbGet<DB>('db');
        if (fresh) {
          skipNextSave = true;
          db.value = fresh;
        }
        if (msg.type === 'reset') {
          const h = await idbGet<History>('history');
          if (h) history.value = h;
        }
      } else if (msg.type === 'queue') ingestQueue(true);
    };
  } catch {
    /* no cross-tab sync */
  }
  window.addEventListener('storage', (e) => {
    if (e.key === QUEUE_KEY && e.newValue) ingestQueue(true);
  });
  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      void save(db.value);
    }
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  ingestQueue(false);
}

/** Start over with fresh demo data (and an empty "Things to try" list). */
export async function resetDemo() {
  const demo = createDemo(today(), demoClock());
  skipNextSave = true;
  batch(() => {
    db.value = demo.db;
    history.value = demo.history;
  });
  await Promise.all([idbSet('db', demo.db), idbSet('history', demo.history), clearPhotos()]);
  channel?.postMessage({ type: 'reset', from: TAB });
  setUI({ tried: [], welcomeDismissed: false });
}

/* ---------- Website submissions → inbox ---------- */

const kindOf: Record<QueuedSubmission['kind'], LeadKind> = { quote: 'quote', service: 'service', warranty: 'warranty', dealer: 'dealer', contact: 'question' };
const sourceOf: Record<QueuedSubmission['kind'], LeadSource> = { quote: 'web-quote', service: 'web-service', warranty: 'web-warranty', dealer: 'web-dealer', contact: 'web-contact' };
export const kindNoun: Record<LeadKind, string> = { quote: 'quote', service: 'service', warranty: 'warranty registration', dealer: 'dealer inquiry', question: 'message' };

const field = (s: QueuedSubmission, label: string) => s.fields.find(([k]) => k === label)?.[1];
const num = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function leadFrom(d: DB, s: QueuedSubmission): Lead {
  const kind = kindOf[s.kind];
  const digits = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-10);
  const match = d.customers.find(
    (c) => (s.email && c.email.toLowerCase() === s.email.toLowerCase()) || (digits(s.phone).length === 10 && digits(c.phone) === digits(s.phone)),
  );
  const id = nextId(d, 'lead', 'R');
  const data = s.data ?? {};
  // Quotes: the boat and slip as typed, and FiberSteel's formula
  const dryLb = num(data.dryWeight);
  const lengthFt = num(data.length);
  const estimate = dryLb && lengthFt ? estimateLiftSize(dryLb, num(data.fuel) ?? 0, lengthFt) : undefined;
  const docking = data.docking === 'straight' || data.docking === 'back-in' ? (data.docking as Docking) : data.docking === 'not-sure' ? 'not-sure' : undefined;
  const summary =
    kind === 'quote'
      ? [lengthFt ? `${lengthFt} ft ${(field(s, 'Boat type') ?? 'boat').replace(/ \(.*\)$/, '').toLowerCase()}` : field(s, 'Boat type'), estimate?.size?.name].filter(Boolean).join(' · ')
      : kind === 'service'
        ? [field(s, 'The problem'), field(s, 'Lift size')].filter(Boolean).join(' · ')
        : kind === 'warranty'
          ? `Warranty registration · ${field(s, 'Lift size') ?? 'lift'}`
          : kind === 'dealer'
            ? `Become a dealer · ${field(s, 'Business') ?? s.name}`
            : field(s, 'About') ?? 'Message from the website';
  const lead: Lead = {
    id,
    kind,
    source: sourceOf[s.kind],
    receivedAt: s.at,
    name: s.name || 'Website visitor',
    email: s.email,
    phone: s.phone,
    zip: s.zip,
    location: s.location ?? ([field(s, 'City'), field(s, 'State')].filter(Boolean).join(', ') || undefined),
    store: 'camdenton',
    summary: summary || `${kindNoun[kind][0].toUpperCase()}${kindNoun[kind].slice(1)} from the website`,
    message: s.message,
    fields: s.fields,
    data: s.data,
    boat: kind === 'quote' && lengthFt ? { type: (field(s, 'Boat type') ?? 'Boat').replace(/ \(.*\)$/, ''), lengthFt, dryLb: dryLb ?? 0, fuelGal: num(data.fuel) } : undefined,
    slip: kind === 'quote' && (data.slipWidth || data.slipLength || docking) ? { widthFt: num(data.slipWidth), lengthFt: num(data.slipLength), docking } : undefined,
    suggestedSize: estimate?.size?.id,
    photos: s.photos,
    stage: 'new',
    assignee: d.settings.forms.routing[kind],
    customerId: match?.id,
    value: estimate?.size ? d.items.find((i) => i.kind === 'lift' && i.sizeId === estimate.size!.id)?.price : undefined,
    unread: true,
    demo: true,
    ref: s.ref,
    activity: [{ id: uid('a'), at: s.at, by: 'customer', kind: 'received', text: 'Submitted on the website (this demo)' }],
  };
  if (estimate) {
    lead.activity.push({ id: uid('a'), at: s.at, by: 'system', kind: 'system', text: `FiberSteel’s formula: ${estimate.needed.toLocaleString('en-US')} lb → ${estimate.size?.name ?? `more than ${boatSizes[boatSizes.length - 1].name}`}` });
  }
  if (d.settings.forms.autoReply && s.email) {
    lead.activity.push({ id: uid('a'), at: s.at, by: 'system', kind: 'email', text: `Auto-reply sent to ${s.email}` });
  }
  return lead;
}

function ingestQueue(live: boolean) {
  const queue = readQueue();
  if (!queue.length || !db.value) return;
  const fresh = queue.filter((s) => !db.value.leads.some((l) => l.ref === s.ref));
  clearQueue(queue.map((s) => s.ref));
  if (!fresh.length) return;
  const added: Lead[] = [];
  mutate((d) => {
    for (const s of fresh) {
      const lead = leadFrom(d, s);
      added.push(lead);
      d.leads.unshift(lead);
      d.notices.unshift({
        id: uid('n'),
        at: now(),
        kind: 'lead',
        text: `New ${kindNoun[lead.kind]} from ${lead.name}${lead.customerId ? ' — matches an existing customer' : ''}`,
        href: `/office/inbox/?id=${lead.id}`,
        read: false,
      });
    }
  });
  markTried('web-request');
  if (live) {
    const lead = added[added.length - 1];
    toast(`New ${kindNoun[lead.kind]} from ${lead.name}`, {
      tone: 'success',
      action: { label: 'Open', run: () => openRecord(`/office/inbox/?id=${lead.id}`) },
    });
  }
}

/** Set by the router so the store can link to records without importing it. */
let openRecord: (href: string) => void = (href) => location.assign(href);
export const setOpenRecord = (fn: (href: string) => void) => {
  openRecord = fn;
};
