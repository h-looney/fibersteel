/**
 * Data for the Website section: installs posted for "Lifts we've installed", used-lift listings and the public dealer
 * list — each as it stands in FiberSteel mode, what's waiting for the next publish (simulated), and what the public
 * site shows now.
 *
 * Read elsewhere too: shell/Shell.tsx (the sidebar badge) and the dashboard use `loadWebsiteData`, `websiteAttention`,
 * `installsToPost` and `pendingCount`.
 */
import { computed } from '@preact/signals';
import { installs as sampleInstalls } from '../../../data/installs';
import type { DealerListing, InstallPost, Job, UsedListing } from '../../data/types';
import { addDays, today } from '../../lib/dates';
import { db } from '../../store';
import { countPending } from './actions';
import { baseDealer, dealerFromBase, isDealerPending, siteDealerList, type DealerDraft } from './dealerList';
import { isInstallPending, kindName, sizeName } from './installs';
import { samePhotos } from './photos';
import { isUsedPending, sampleUsed, sampleUsedLifts, usedFromSample, type UsedDraft } from './used';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** A public-site path under the base path (opens the concept site) */
export const siteHref = (path: string) => `${BASE}${path}`;
/** The preview page of an install published from FiberSteel mode */
export const installPreviewPath = (id: string) => `/installs/preview/?id=${encodeURIComponent(id)}`;

/** Nothing to fetch: everything the section needs is in the demo data. Kept for the shell and the dashboard. */
export function loadWebsiteData() {
  /* no-op */
}

/* ---------- The contract: badge and dashboard ---------- */

/** How far back a finished install still counts as one to post */
export const POST_WINDOW_DAYS = 14;

/** Finished installs from the last two weeks with no post yet (and not marked "not for the website"), newest first */
export const installsToPost = computed<Job[]>(() => {
  const d = db.value;
  if (!d) return [];
  const w = d.website;
  const posted = new Set([...Object.values(w.installs), ...Object.values(w.installsLive)].map((p) => p.jobId).filter(Boolean));
  const skipped = new Set(w.skipped ?? []);
  const from = addDays(today(), -POST_WINDOW_DAYS);
  return d.jobs
    .filter((j) => j.type === 'install' && (j.status === 'completed' || j.status === 'closed') && !posted.has(j.id) && !skipped.has(j.id))
    .filter((j) => (j.completedAt ?? j.start ?? '').slice(0, 10) >= from)
    .sort((a, b) => (b.completedAt ?? b.start ?? '').localeCompare(a.completedAt ?? a.start ?? ''));
});

/** Changes waiting for the next publish (simulated) */
export const pendingCount = computed(() => (db.value ? countPending(db.value.website).total : 0));

/** The sidebar badge: finished installs to post, plus changes waiting to be published */
export const websiteAttention = computed(() => installsToPost.value.length + pendingCount.value);

/* ---------- Installs ---------- */

export interface WebInstall {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  sizeName: string;
  boat: string;
  town: string;
  completed: string;
  /** sample: built into the concept (src/data/installs.ts) */
  state: 'sample' | 'published' | 'draft';
  /** On the public site right now (samples always; posts once published) */
  live: boolean;
  /** Changes waiting for the next publish */
  pending: boolean;
  featured: boolean;
  photoCount: number;
  /** A photo kept in this browser (posts) */
  photoId?: string;
  /** A sample's photo, by Assets.photos key (`install:<slug>`) */
  photoKey?: string;
  /** The page on the public site (site path, before the base) */
  page?: string;
  post?: InstallPost;
  /** Taken down since the last publish */
  removed?: boolean;
}

export const webInstalls = computed<WebInstall[]>(() => {
  const w = db.value?.website;
  if (!w) return [];
  const live = w.installsLive;
  const photosLive = w.photosLive ?? {};
  const list: WebInstall[] = [];
  for (const id of new Set([...Object.keys(w.installs), ...Object.keys(live)])) {
    const p = w.installs[id] ?? live[id];
    const was = live[id];
    const onSite = was?.status === 'published';
    const own = w.photos[id] ?? [];
    list.push({
      id,
      title: p.title || 'Untitled install',
      kind: p.kind,
      kindLabel: p.kind ? kindName(p.kind) : '',
      sizeName: sizeName(p.size),
      boat: p.boat,
      town: p.town,
      completed: p.completed,
      state: w.installs[id] ? p.status : 'draft',
      live: onSite,
      pending: isInstallPending(w.installs[id], was) || (onSite && !samePhotos(own, photosLive[id])),
      featured: p.featured,
      photoCount: own.length,
      photoId: own[0]?.id,
      page: onSite ? installPreviewPath(id) : undefined,
      post: w.installs[id],
      removed: !w.installs[id],
    });
  }
  list.sort((a, b) => Number(!!b.post && !b.live) - Number(!!a.post && !a.live) || b.completed.localeCompare(a.completed));
  for (const i of [...sampleInstalls].sort((a, b) => b.month.localeCompare(a.month))) {
    list.push({
      id: i.slug,
      title: i.title,
      kind: i.kind,
      kindLabel: kindName(i.kind),
      sizeName: sizeName(i.size ?? undefined),
      boat: i.boat === '—' ? '' : i.boat,
      town: i.town,
      completed: i.month,
      state: 'sample',
      live: true,
      pending: false,
      featured: !!i.featured,
      photoCount: i.photos.length,
      photoKey: `install:${i.slug}`,
      page: `/installs/${i.slug}/`,
    });
  }
  return list;
});

/* ---------- Used lifts ---------- */

export interface WebUsed {
  id: string;
  listing: UsedDraft;
  /** A sample listing from the concept (src/data/usedLifts.ts) */
  sample: boolean;
  /** Changed in FiberSteel mode (the sample as written, or a new listing) */
  changed: boolean;
  pending: boolean;
  /** On the page after the last publish (or a sample the page shows) */
  live: boolean;
  removed: boolean;
  photoCount: number;
  photoId?: string;
  /** The sample's stand-in photo (Assets.photos key `used:<id>`) */
  photoKey?: string;
}

export const webUsed = computed<WebUsed[]>(() => {
  const w = db.value?.website;
  if (!w) return [];
  const photosLive = w.photosLive ?? {};
  const rows: WebUsed[] = [];
  const seen = new Set<string>();
  const row = (id: string, current: UsedDraft | undefined, sample: boolean): WebUsed | undefined => {
    const post = w.used[id];
    const was = w.usedLive[id];
    const listing = post ?? was ?? current;
    if (!listing) return undefined;
    const own = w.photos[id] ?? [];
    const base = sample ? current : undefined;
    return {
      id,
      listing,
      sample,
      changed: !!post || !!was,
      pending: isUsedPending(post, was, base) || ((!!post || !!was) && !samePhotos(own, photosLive[id])),
      live: sample ? !(was?.removed ?? false) : !!was && !was.removed,
      // Marked removed, or a new listing taken off after it was published
      removed: !!listing.removed || (!sample && !post && !!was),
      photoCount: own.length,
      photoId: own[0]?.id,
      photoKey: sample && !own.length ? `used:${id}` : undefined,
    };
  };
  // New listings first, then the samples in the page's order
  for (const id of new Set([...Object.keys(w.used), ...Object.keys(w.usedLive)])) {
    if (sampleUsed(id)) continue;
    const r = row(id, undefined, false);
    if (r) rows.push(r);
    seen.add(id);
  }
  rows.sort((a, b) => (b.listing as UsedListing).at?.localeCompare((a.listing as UsedListing).at ?? '') ?? 0);
  for (const s of sampleUsedLifts) {
    const r = row(s.id, usedFromSample(s), true);
    if (r) rows.push(r);
  }
  return rows;
});

/* ---------- The dealer list ---------- */

export interface WebDealer {
  id: string;
  listing: DealerDraft;
  factory: boolean;
  isNew: boolean;
  hidden: boolean;
  changed: boolean;
  pending: boolean;
}

export const webDealers = computed<WebDealer[]>(() => {
  const w = db.value?.website;
  if (!w) return [];
  const rows: WebDealer[] = siteDealerList.map((d) => {
    const post = w.dealers[d.id];
    const listing: DealerDraft = post ?? w.dealersLive[d.id] ?? dealerFromBase(d);
    return {
      id: d.id,
      listing,
      factory: !!d.factory,
      isNew: false,
      hidden: !!listing.hidden,
      changed: !!post || !!w.dealersLive[d.id],
      pending: isDealerPending(post, w.dealersLive[d.id]),
    };
  });
  for (const id of new Set([...Object.keys(w.dealers), ...Object.keys(w.dealersLive)])) {
    if (baseDealer(id)) continue;
    const post: DealerListing | undefined = w.dealers[id];
    const listing = post ?? w.dealersLive[id];
    rows.push({ id, listing, factory: false, isNew: true, hidden: !!listing.hidden || !post, changed: true, pending: isDealerPending(post, w.dealersLive[id]) });
  }
  return rows;
});

/* ---------- Everything waiting for the next publish ---------- */

export interface PendingChange {
  key: string;
  area: 'installs' | 'used' | 'dealers';
  id: string;
  title: string;
  what: string;
  /** It's on the site now, so the change can be undone (a new one is deleted from its tab instead) */
  canUndo: boolean;
}

export const pendingChanges = computed<PendingChange[]>(() => {
  const out: PendingChange[] = [];
  const w = db.value?.website;
  if (!w) return out;
  for (const i of webInstalls.value) {
    if (i.state === 'sample' || !i.pending) continue;
    const what = i.removed ? 'Comes off the site' : !i.live && i.state === 'published' ? 'Goes on the site' : i.state === 'draft' && i.live ? 'Comes off the site (back to a draft)' : 'Changes on the site';
    out.push({ key: `i:${i.id}`, area: 'installs', id: i.id, title: i.title, what, canUndo: !!w.installsLive[i.id] });
  }
  for (const u of webUsed.value) {
    if (!u.pending) continue;
    const what = u.removed ? 'Comes off the page' : u.sample ? 'Sample listing changed' : u.live ? 'Listing changed' : 'New listing goes up';
    out.push({ key: `u:${u.id}`, area: 'used', id: u.id, title: u.listing.title, what, canUndo: u.sample || !!w.usedLive[u.id] });
  }
  for (const d of webDealers.value) {
    if (!d.pending) continue;
    const what = d.isNew ? (d.hidden ? 'Comes off the list' : 'Added to the list') : d.hidden ? 'Hidden from the list' : 'Details changed';
    out.push({ key: `d:${d.id}`, area: 'dealers', id: d.id, title: d.listing.name, what, canUndo: !d.isNew || !!w.dealersLive[d.id] });
  }
  return out;
});
