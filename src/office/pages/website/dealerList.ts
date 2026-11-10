/**
 * The public dealer list (Website → Dealer list): FiberSteel's authorized dealers as the current site lists them
 * (src/data/dealers.ts), edits, hidden dealers and new ones made in FiberSteel mode, what's waiting for the next
 * publish (simulated), and what the dealer page previews once it's published. Not the sample dealer accounts in the
 * Dealers section — those are made up, and never shown on the site. No store imports, so Node can run this file.
 */
import type { SiteDealer } from '../../bridge';
import type { DealerListing } from '../../data/types';
import { dealers, STATE_NAMES, type Dealer } from '../../../data/dealers.ts';

export const siteDealerList = dealers;
export const baseDealer = (id?: string): Dealer | undefined => (id ? dealers.find((d) => d.id === id) : undefined);
export const stateName = (s: string) => STATE_NAMES[s] ?? s;

export type DealerDraft = Omit<DealerListing, 'by' | 'at'>;

/** A dealer as the public page lists it now, in the editor's shape */
export const dealerFromBase = (d: Dealer): DealerDraft => ({
  id: d.id,
  name: d.name,
  street: d.street,
  city: d.city,
  state: d.state,
  zip: d.zip,
  area: d.area,
  phones: [...d.phones],
  email: d.email,
  web: d.web ?? null,
  lake: d.lake,
  note: d.note,
});

const clean = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Trimmed and tidied, as it's saved (empty optional fields dropped) */
export function tidyDealer<T extends DealerDraft>(l: T): T {
  const out: T = {
    ...l,
    name: clean(l.name),
    street: clean(l.street) || undefined,
    city: clean(l.city),
    state: clean(l.state).toUpperCase(),
    zip: clean(l.zip) || undefined,
    area: clean(l.area) || undefined,
    phones: l.phones.map(clean).filter(Boolean),
    email: clean(l.email) || undefined,
    web: clean(l.web) || null,
    lake: clean(l.lake) || undefined,
    note: clean(l.note) || undefined,
  };
  for (const k of ['street', 'zip', 'area', 'email', 'lake', 'note'] as const) if (out[k] === undefined) delete out[k];
  if (!out.hidden) delete out.hidden;
  if (!out.isNew) delete out.isNew;
  return out;
}

/** What has to be fixed before a dealer can be saved — each a message fit to show */
export function dealerProblems(l: DealerDraft): string[] {
  const problems: string[] = [];
  if (!clean(l.name)) problems.push('Add the business name, as the dealer writes it.');
  if (!clean(l.city) && !clean(l.area)) problems.push('Add the town (or the area, for a dealer listed by region).');
  if (!/^[A-Za-z]{2}$/.test(clean(l.state))) problems.push('Use the two-letter state, e.g. “MO”.');
  const phones = l.phones.map(clean).filter(Boolean);
  if (!phones.length) problems.push('Add at least one phone number.');
  phones.forEach((p) => {
    if (p.replace(/\D/g, '').length !== 10) problems.push(`Check the phone number “${p}” — 10 digits, e.g. 573-346-3088.`);
  });
  const email = clean(l.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('Check the email address.');
  const web = clean(l.web);
  if (web) {
    try {
      const u = new URL(web);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      problems.push('The website needs to be a full address, starting with https://');
    }
  }
  return problems;
}

/** Same content: the dealer page would show it the same way */
export function sameDealer(a?: DealerDraft, b?: DealerDraft): boolean {
  if (!a || !b) return a === b;
  const t = (x: DealerDraft) => tidyDealer({ ...x, isNew: undefined });
  const [x, y] = [t(a), t(b)];
  return (
    x.name === y.name &&
    (x.street ?? '') === (y.street ?? '') &&
    x.city === y.city &&
    x.state === y.state &&
    (x.zip ?? '') === (y.zip ?? '') &&
    (x.area ?? '') === (y.area ?? '') &&
    x.phones.join('|') === y.phones.join('|') &&
    (x.email ?? '') === (y.email ?? '') &&
    (x.web ?? '') === (y.web ?? '') &&
    (x.lake ?? '') === (y.lake ?? '') &&
    (x.note ?? '') === (y.note ?? '') &&
    !!x.hidden === !!y.hidden
  );
}

/** Waiting for the next publish? A dealer never changed before differs from the site unless it matches the list. */
export function isDealerPending(post: DealerListing | undefined, live: DealerListing | undefined): boolean {
  if (!post) return !!live;
  if (live) return !sameDealer(post, live);
  const base = baseDealer(post.id);
  return base ? !sameDealer(post, dealerFromBase(base)) : true;
}

/** What the dealer page shows after a publish (simulated): every change, with the town's map spot for existing dealers */
export function siteDealers(listings: Record<string, DealerListing>): Record<string, SiteDealer> {
  return Object.fromEntries(
    Object.values(listings).map((l): [string, SiteDealer] => {
      const base = baseDealer(l.id);
      return [
        l.id,
        {
          id: l.id,
          name: l.name,
          ...(l.street ? { street: l.street } : {}),
          city: l.city,
          state: l.state,
          ...(l.zip ? { zip: l.zip } : {}),
          ...(l.area ? { area: l.area } : {}),
          phones: [...l.phones],
          ...(l.email ? { email: l.email } : {}),
          web: l.web ?? null,
          ...(l.lake ? { lake: l.lake } : {}),
          ...(l.note ? { note: l.note } : {}),
          ...(base ? { geo: { ...base.geo } } : {}),
          ...(l.hidden ? { hidden: true } : {}),
          ...(l.isNew ? { isNew: true } : {}),
        },
      ];
    }),
  );
}
