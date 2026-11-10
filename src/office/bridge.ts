/**
 * Hand-off between the public website and FiberSteel mode (the optional staff demo).
 *
 * There's no backend in this concept. A submitted form is queued in localStorage and a BroadcastChannel ping tells
 * any open FiberSteel mode tab to pick it up — on the real site, each request would be emailed to the address
 * FiberSteel chooses, for the team to review. The other way round, installs, used-lift listings and dealer listings
 * published from FiberSteel mode (simulated) are read from this browser's IndexedDB. The public pages import only
 * this small file.
 */

import { FEATURES_KEY } from '../data/features';

export const QUEUE_KEY = 'fs-office-queue';
export const CHANNEL = 'fs-office';

export type FormKind = 'quote' | 'service' | 'warranty' | 'dealer' | 'contact';

export interface QueuedSubmission {
  /** Unique reference, also used to link from the confirmation message */
  ref: string;
  kind: FormKind;
  /** Local datetime, YYYY-MM-DDTHH:mm */
  at: string;
  name: string;
  email?: string;
  phone?: string;
  zip?: string;
  /** Lake, cove or town the request is for */
  location?: string;
  message?: string;
  /** What the visitor filled in, as label → shown value */
  fields: [string, string][];
  /** Structured values FiberSteel mode can use (lift size, boat weight, slip size…) */
  data?: Record<string, string>;
  photos?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function readQueue(): QueuedSubmission[] {
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearQueue(refs: string[]) {
  try {
    const rest = readQueue().filter((s) => !refs.includes(s.ref));
    if (rest.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Queue a submission for FiberSteel mode. Returns its reference, or undefined if storage is unavailable. */
export function queueSubmission(submission: Omit<QueuedSubmission, 'ref' | 'at'>): string | undefined {
  const ref = `W${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    const queue = readQueue();
    queue.push({ ...submission, ref, at: localNow() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    return undefined;
  }
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: 'queue' });
    channel.close();
  } catch {
    /* other tabs will see it on their next load */
  }
  return ref;
}

/* ---------- What FiberSteel mode publishes (simulated) ---------- */

/**
 * FiberSteel mode keeps its data in this browser's IndexedDB (database `fs-office`, store `state`). A publish
 * (simulated) writes what the public pages should show under these keys; photos are kept under `photo:<id>`. The
 * public pages read them to preview a publish in this browser — in production a publish would rebuild the site.
 */
export const OFFICE_DB = 'fs-office';
export const OFFICE_STORE = 'state';
export const SITE_INSTALLS_KEY = 'site-installs';
export const SITE_USED_KEY = 'site-used';
export const SITE_DEALERS_KEY = 'site-dealers';
export const photoKey = (id: string) => `photo:${id}`;

export interface SitePhoto {
  id: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

/** An install as published from FiberSteel mode */
export interface SiteInstall {
  id: string;
  title: string;
  summary: string;
  story: string[];
  kind: string;
  kindLabel: string;
  /** A lift size id (src/data/lifts.ts) and its name */
  size?: string;
  sizeName?: string;
  boat: string;
  slip?: string;
  docking?: string;
  town: string;
  lake: string;
  /** YYYY-MM */
  completed: string;
  built: string[];
  featured: boolean;
  photos: (SitePhoto & { before?: boolean })[];
}

/** A used-lift listing as published from FiberSteel mode */
export interface SiteUsedLift {
  id: string;
  title: string;
  size: string;
  sizeName: string;
  condition: string;
  includes: string[];
  status: 'available' | 'pending' | 'sold';
  /** Only if FiberSteel chooses to show prices (the current site doesn't) */
  price?: number;
  photo?: SitePhoto;
  /** The repo's sample listing it replaces, if any */
  replaces?: string;
  removed?: boolean;
}

/** A dealer listing as changed in FiberSteel mode: a new dealer, an edit, or hidden */
export interface SiteDealer {
  id: string;
  name: string;
  street?: string;
  city: string;
  state: string;
  zip?: string;
  /** Region, for a dealer listed by area rather than a town */
  area?: string;
  phones: string[];
  email?: string;
  web?: string | null;
  lake?: string;
  note?: string;
  /** Approximate, for "sort by distance" (new dealers have none until FiberSteel adds one) */
  geo?: { lat: number; lng: number };
  hidden?: boolean;
  isNew?: boolean;
}

/** Open FiberSteel mode's database to read it — without creating it when nothing has been saved in this browser. */
function openOfficeDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(OFFICE_DB, 1);
      req.onupgradeneeded = () => req.transaction?.abort();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function read<T>(conn: IDBDatabase, key: string): Promise<T | undefined> {
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

async function readKey<T>(key: string, fallback: T): Promise<T> {
  if (typeof indexedDB === 'undefined') return fallback;
  const conn = await openOfficeDb();
  if (!conn) return fallback;
  try {
    return (await read<T>(conn, key)) ?? fallback;
  } finally {
    conn.close();
  }
}

/** Installs published from FiberSteel mode in this browser, by id */
export const readPublishedInstalls = () => readKey<Record<string, SiteInstall>>(SITE_INSTALLS_KEY, {});
/** Used-lift listings published from FiberSteel mode in this browser, by id */
export const readPublishedUsedLifts = () => readKey<Record<string, SiteUsedLift>>(SITE_USED_KEY, {});
/** Dealer listing changes published from FiberSteel mode in this browser, by id */
export const readPublishedDealers = () => readKey<Record<string, SiteDealer>>(SITE_DEALERS_KEY, {});

/** Object URLs for photos kept in this browser, by photo id (missing ones are left out) */
export async function readPhotoUrls(photoIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!photoIds.length || typeof indexedDB === 'undefined') return out;
  const conn = await openOfficeDb();
  if (!conn) return out;
  try {
    for (const id of photoIds) {
      const blob = await read<Blob>(conn, photoKey(id));
      if (blob instanceof Blob) out.set(id, URL.createObjectURL(blob));
    }
  } finally {
    conn.close();
  }
  return out;
}

/* ---------- Site features switched in FiberSteel mode ---------- */

/** Where FiberSteel mode keeps its feature switches for the public pages in this browser (see src/data/features.ts) */
export const FEATURES_STORAGE_KEY = FEATURES_KEY;

/** The switches set in FiberSteel mode in this browser (only the ones it has set) */
export function readSiteFeatures(): Partial<Record<string, boolean>> {
  try {
    const value = JSON.parse(localStorage.getItem(FEATURES_STORAGE_KEY) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** Save a switch for the public pages in this browser. Open public tabs update at once (the storage event). */
export function writeSiteFeature(id: string, on: boolean) {
  try {
    localStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify({ ...readSiteFeatures(), [id]: on }));
  } catch {
    /* storage unavailable */
  }
}

export function clearSiteFeatures() {
  try {
    localStorage.removeItem(FEATURES_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
