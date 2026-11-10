/**
 * Changes made in the Website section. Like the rest of FiberSteel mode they're saved in this browser and go "live" on
 * the next publish (simulated): the public pages in this browser then preview them. In production a publish would
 * commit the change (or save it in a CMS) and rebuild the site.
 */
import { writeSiteFeature } from '../../bridge';
import type { DealerListing, InstallPost, PhotoMeta, UsedListing, WebsiteState } from '../../data/types';
import { now } from '../../lib/dates';
import { db, deletePhotos, markTried, me, mutate, putPhoto, setSiteDealers, setSiteInstalls, setSiteUsed, uid } from '../../store';
import { baseDealer, dealerFromBase, isDealerPending, sameDealer, siteDealers, tidyDealer, type DealerDraft } from './dealerList';
import { isInstallPending, siteInstalls, tidyInstall } from './installs';
import { preparePhoto, samePhotos } from './photos';
import { isUsedPending, sameUsed, sampleUsed, siteUsed, tidyUsed, usedFromSample, type UsedDraft } from './used';

const who = () => me.value?.id ?? 'dean';
const web = (d: { website: WebsiteState }) => d.website;
const photosLiveOf = (w: WebsiteState) => w.photosLive ?? {};

/* ---------- Lifts we've installed ---------- */

export const newInstallId = () => uid('INS-');

/** An install posted from FiberSteel mode: on the site after the next publish (simulated), or kept as a draft */
export function saveInstall(post: Omit<InstallPost, 'by' | 'at'>) {
  const p: InstallPost = { ...tidyInstall(post), by: who(), at: now() };
  mutate((d) => {
    d.website = { ...web(d), installs: { ...web(d).installs, [p.id]: p } };
  });
  if (p.status === 'published') markTried('post-install');
}

/** Back to the install as last published. One never published goes, with its photos. */
export function undoInstall(id: string) {
  const live = db.value?.website.installsLive[id];
  mutate((d) => {
    const installs = { ...web(d).installs };
    if (live) installs[id] = structuredClone(live);
    else delete installs[id];
    d.website = { ...web(d), installs };
  });
  undoPhotos(id);
}

/** Take an install down: off the list, and off the public site on the next publish (simulated) */
export function removeInstall(id: string) {
  const live = db.value?.website.installsLive[id];
  mutate((d) => {
    const installs = { ...web(d).installs };
    delete installs[id];
    d.website = { ...web(d), installs };
  });
  if (live) setPhotos(id, []);
  else undoPhotos(id);
}

/** "Lifts we've installed" on the public site — on or off. Takes effect right away (here: the public pages in this browser). */
export function setShowcase(on: boolean) {
  mutate((d) => {
    d.website = { ...web(d), showcase: on };
  });
  writeSiteFeature('installs', on);
}

/** A finished install that won't go on the website (no photos, or the owners would rather not): stop suggesting it */
export function skipInstallJob(jobId: string, skip = true) {
  mutate((d) => {
    const list = new Set(web(d).skipped ?? []);
    if (skip) list.add(jobId);
    else list.delete(jobId);
    d.website = { ...web(d), skipped: [...list] };
  });
}

/* ---------- Used lifts ---------- */

export const newUsedId = () => uid('USED-');

/** The listing as the public page shows it today, before anything is published from FiberSteel mode */
const usedBase = (id: string): UsedDraft | undefined => {
  const s = sampleUsed(id);
  return s ? usedFromSample(s) : undefined;
};

/** Save a listing — a new one, or changes to a sample listing. It goes live on the next publish (simulated). */
export function saveUsed(listing: UsedDraft) {
  const l: UsedListing = { ...tidyUsed(listing), by: who(), at: now() };
  mutate((d) => {
    const used = { ...web(d).used };
    // A sample listing put back the way the site already shows it, never published and with no photos: nothing to publish
    if (l.replaces && !web(d).usedLive[l.id] && sameUsed(l, usedBase(l.id)) && !web(d).photos[l.id]?.length) delete used[l.id];
    else used[l.id] = l;
    d.website = { ...web(d), used };
  });
}

/** Back to the listing as last published (or as the site shows it). Photos go back too. */
export function undoUsed(id: string) {
  const live = db.value?.website.usedLive[id];
  mutate((d) => {
    const used = { ...web(d).used };
    if (live) used[id] = structuredClone(live);
    else delete used[id];
    d.website = { ...web(d), used };
  });
  undoPhotos(id);
}

/** Take a listing off the page on the next publish (simulated). A sample is marked removed; a new one goes. */
export function removeUsed(id: string) {
  const w = db.value!.website;
  const base = usedBase(id);
  const current = w.used[id] ?? w.usedLive[id];
  if (base) {
    saveUsed({ ...(current ?? base), removed: true });
    return;
  }
  mutate((d) => {
    const used = { ...web(d).used };
    delete used[id];
    d.website = { ...web(d), used };
  });
  if (w.usedLive[id]) setPhotos(id, []);
  else undoPhotos(id);
}

/** Put a listing that was taken off back on the page (with the next publish) */
export function restoreUsed(id: string) {
  const w = db.value!.website;
  const current = w.used[id] ?? w.usedLive[id] ?? usedBase(id);
  if (current) saveUsed({ ...current, removed: false });
}

/** Change just the status (available · sale pending · sold) */
export function setUsedStatus(id: string, status: UsedListing['status']) {
  const w = db.value!.website;
  const current = w.used[id] ?? w.usedLive[id] ?? usedBase(id);
  if (current) saveUsed({ ...current, status });
}

/* ---------- The dealer list ---------- */

export const newDealerId = () => uid('DL-');

const dealerBase = (id: string): DealerDraft | undefined => {
  const b = baseDealer(id);
  return b ? dealerFromBase(b) : undefined;
};

/** Save a dealer — a new one, or changes to one on the list. It goes live on the next publish (simulated). */
export function saveDealer(listing: DealerDraft) {
  const l: DealerListing = { ...tidyDealer(listing), by: who(), at: now() };
  mutate((d) => {
    const dealers = { ...web(d).dealers };
    // Put back the way the page already lists it, never published: nothing to publish
    if (!l.isNew && !web(d).dealersLive[l.id] && sameDealer(l, dealerBase(l.id))) delete dealers[l.id];
    else dealers[l.id] = l;
    d.website = { ...web(d), dealers };
  });
}

/** Hide a dealer from the page (or show it again) on the next publish */
export function setDealerHidden(id: string, hidden: boolean) {
  const w = db.value!.website;
  const current = w.dealers[id] ?? w.dealersLive[id] ?? dealerBase(id);
  if (current) saveDealer({ ...current, hidden });
}

/** Back to the dealer as last published (or as the page lists it) */
export function undoDealer(id: string) {
  const live = db.value?.website.dealersLive[id];
  mutate((d) => {
    const dealers = { ...web(d).dealers };
    if (live) dealers[id] = structuredClone(live);
    else delete dealers[id];
    d.website = { ...web(d), dealers };
  });
}

/** Take a dealer added here off the list (and off the page on the next publish, if it was published) */
export function removeNewDealer(id: string) {
  mutate((d) => {
    const dealers = { ...web(d).dealers };
    delete dealers[id];
    d.website = { ...web(d), dealers };
  });
}

/* ---------- Photos (installs and used listings) ---------- */

const photosOf = (ownerId: string) => db.value?.website.photos[ownerId] ?? [];
const livePhotoIds = () => new Set(Object.values(photosLiveOf(db.value!.website)).flatMap((list) => list.map((p) => p.id)));

function setPhotos(ownerId: string, list: PhotoMeta[]) {
  mutate((d) => {
    const photos = { ...web(d).photos };
    if (list.length) photos[ownerId] = list;
    else delete photos[ownerId];
    d.website = { ...web(d), photos };
  });
}

/** Shrink and keep a photo in this browser, and add it to the post's photos. Throws a message fit to show. */
export async function addPhoto(ownerId: string, file: File, meta: { alt: string }) {
  const { blob, width, height } = await preparePhoto(file);
  const id = uid('ph');
  await putPhoto(id, blob);
  setPhotos(ownerId, [...photosOf(ownerId), { id, alt: meta.alt, width, height, by: who(), at: now() }]);
  return id;
}

export function updatePhoto(ownerId: string, id: string, patch: Partial<Pick<PhotoMeta, 'alt' | 'before'>>) {
  setPhotos(
    ownerId,
    photosOf(ownerId).map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
}

/** Move a photo to position `to` (0 makes it the main photo) */
export function movePhoto(ownerId: string, id: string, to: number) {
  const list = [...photosOf(ownerId)];
  const from = list.findIndex((p) => p.id === id);
  if (from < 0) return;
  const [photo] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(to, list.length)), 0, photo);
  setPhotos(ownerId, list);
}

export function removePhoto(ownerId: string, id: string) {
  setPhotos(
    ownerId,
    photosOf(ownerId).filter((p) => p.id !== id),
  );
  // A published photo is kept until the next publish takes it off the site
  if (!livePhotoIds().has(id)) void deletePhotos([id]);
}

/** Back to the photos as last published */
export function undoPhotos(ownerId: string) {
  const live = photosLiveOf(db.value!.website)[ownerId] ?? [];
  const keep = new Set(live.map((p) => p.id));
  const added = photosOf(ownerId).filter((p) => !keep.has(p.id));
  setPhotos(ownerId, structuredClone(live));
  void deletePhotos(added.map((p) => p.id));
}

/* ---------- Publish (simulated) ---------- */

/** How many changes the next publish would make, by what they belong to */
export function countPending(w: WebsiteState): { installs: number; used: number; dealers: number; total: number } {
  const live = photosLiveOf(w);
  let installs = 0;
  for (const id of new Set([...Object.keys(w.installs), ...Object.keys(w.installsLive)])) {
    const post = w.installs[id];
    const was = w.installsLive[id];
    if (isInstallPending(post, was)) installs++;
    // Photos count on their own only for an install that's on the site and otherwise unchanged
    else if ((post ?? was)?.status === 'published' && was?.status === 'published' && !samePhotos(w.photos[id], live[id])) installs++;
  }
  let used = 0;
  for (const id of new Set([...Object.keys(w.used), ...Object.keys(w.usedLive)])) {
    if (isUsedPending(w.used[id], w.usedLive[id], usedBase(id))) used++;
    else if ((w.used[id] || w.usedLive[id]) && !samePhotos(w.photos[id], live[id])) used++;
  }
  let dealers = 0;
  for (const id of new Set([...Object.keys(w.dealers), ...Object.keys(w.dealersLive)])) if (isDealerPending(w.dealers[id], w.dealersLive[id])) dealers++;
  return { installs, used, dealers, total: installs + used + dealers };
}

/**
 * Simulated publish: everything pending becomes "live", and the public pages in this browser preview it (IndexedDB:
 * site-installs, site-used, site-dealers, photo:<id>). Nothing on the real site changes in this concept.
 */
export function publishPending(): number {
  const changes = countPending(db.value!.website).total;
  const wasLive = livePhotoIds();
  mutate((d) => {
    const w = web(d);
    const owners = new Set([...Object.keys(w.installs), ...Object.keys(w.used)]);
    const photosLive = Object.fromEntries(Object.entries(structuredClone(w.photos)).filter(([id]) => owners.has(id)));
    d.website = {
      ...w,
      installsLive: structuredClone(w.installs),
      usedLive: structuredClone(w.used),
      dealersLive: structuredClone(w.dealers),
      photosLive,
      publishes: [{ id: uid('pub'), at: now(), by: who(), changes }, ...w.publishes],
    };
  });
  const w = db.value!.website;
  const live = photosLiveOf(w);
  void setSiteInstalls(siteInstalls(w.installsLive, live));
  void setSiteUsed(siteUsed(w.usedLive, live));
  void setSiteDealers(siteDealers(w.dealersLive));
  // Images no longer on the site or in a draft can go
  const kept = new Set(Object.values(w.photos).flatMap((list) => list.map((p) => p.id)));
  void deletePhotos([...wasLive].filter((id) => !kept.has(id)));
  markTried('publish');
  return changes;
}
