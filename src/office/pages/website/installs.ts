/**
 * Installs posted in FiberSteel mode (Website → Installs, "Lifts we've installed"): checking one before it goes up, what
 * counts as a change waiting for the next publish, and what the public pages show once it's published (simulated).
 * No photo or store imports, so Node can run this file in the unit tests.
 */
import type { SiteInstall, SitePhoto } from '../../bridge';
import type { InstallPost, PhotoMeta } from '../../data/types';
import { installKinds } from '../../../data/installs.ts';
import { getSize } from '../../../data/lifts.ts';

export const MAX_BUILT = 10;

/** The kinds of install the public grid filters by (src/data/installs.ts) */
export const INSTALL_KINDS = installKinds;
export const kindName = (id: string) => installKinds.find((k) => k.id === id)?.label ?? id;
export const sizeName = (id?: string) => (id ? (getSize(id)?.name ?? id) : '');

/** What crews usually note about a lift, one click away in the editor (FiberSteel's own options and parts) */
export const COMMON_BUILT = [
  'V-bunks',
  'Pontoon bunks',
  'Tri-toon bunks',
  'Extra-tall bunks',
  'Walk boards on both sides',
  'Lift guides',
  'Bow V-brace',
  'Poly hull protectors',
  'Admiral remote control blower system',
  'Set up for back-in docking',
  'Installed as a straight pull-in',
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-06" → "June 2026" */
export const monthLabel = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
  return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};

/** "this month" as YYYY-MM, the latest finish date a post can have */
export const thisMonth = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The story as paragraphs: split at blank lines, whitespace tidied */
export const storyParagraphs = (story: string): string[] =>
  story
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

export const tidyRows = (rows: string[]) => rows.map((r) => r.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Trimmed and tidied, as it's saved */
export function tidyInstall<T extends Omit<InstallPost, 'by' | 'at'>>(p: T): T {
  const out = {
    ...p,
    title: p.title.trim(),
    summary: p.summary.replace(/\s+/g, ' ').trim(),
    story: storyParagraphs(p.story).join('\n\n'),
    boat: p.boat.replace(/\s+/g, ' ').trim(),
    slip: p.slip?.trim() || undefined,
    town: p.town.trim(),
    built: tidyRows(p.built),
  };
  if (!out.slip) delete out.slip;
  if (!out.size) delete out.size;
  if (!out.docking) delete out.docking;
  return out;
}

/**
 * What has to be fixed before an install can go on the site — each a message fit to show. A draft only needs a title
 * or a lift size, so a half-written post can wait for its photos.
 */
export function installProblems(p: Omit<InstallPost, 'by' | 'at'>, photos: Pick<PhotoMeta, 'alt'>[], today = thisMonth()): string[] {
  const problems: string[] = [];
  if (p.status === 'draft') {
    if (!p.title.trim() && !p.size) problems.push('Give it a title (or pick the lift size) to save it as a draft.');
    return problems;
  }
  if (!p.title.trim()) problems.push('Give it a title, e.g. “14,000 lb back-in lift with walk boards”.');
  if (!p.summary.trim()) problems.push('Add the one-line summary — it’s what search results show.');
  if (!p.kind) problems.push('Pick the kind of install — it’s how visitors filter the grid.');
  if (p.kind !== 'dock-steps' && !p.boat.trim()) problems.push('Describe the boat, e.g. “24 ft bowrider” — the boat, never the owner.');
  if (!p.town.trim()) problems.push('Add the town (only the town — never the street).');
  else if (/\d/.test(p.town)) problems.push('Only the town goes on the site — take the house number, road or mile marker out.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.completed)) problems.push('Add the month it was finished.');
  else if (p.completed > today) problems.push('The finish month can’t be in the future.');
  if (!storyParagraphs(p.story).length) problems.push('Write a few lines about the job: what the boat and slip needed, and what was built.');
  if (!tidyRows(p.built).length) problems.push('List at least one thing built for it, e.g. “Extra-tall bunks”.');
  if (!photos.length) problems.push('Add at least one photo of the finished lift.');
  photos.forEach((ph, i) => {
    if (!ph.alt.trim()) problems.push(`Describe photo ${i + 1} — screen readers read it aloud.`);
  });
  if (!p.consent) problems.push('Confirm the owners said yes to sharing the photos.');
  return problems;
}

const sameRows = (a: string[], b: string[]) => a.length === b.length && a.every((r, i) => r === b[i]);

/** Same content: what the public pages would show is identical */
export function sameInstall(a?: Omit<InstallPost, 'by' | 'at'>, b?: Omit<InstallPost, 'by' | 'at'>): boolean {
  if (!a || !b) return a === b;
  return (
    a.title === b.title &&
    a.summary === b.summary &&
    a.story === b.story &&
    a.kind === b.kind &&
    (a.size ?? '') === (b.size ?? '') &&
    a.boat === b.boat &&
    (a.slip ?? '') === (b.slip ?? '') &&
    (a.docking ?? '') === (b.docking ?? '') &&
    a.town === b.town &&
    a.completed === b.completed &&
    a.featured === b.featured &&
    a.status === b.status &&
    a.consent === b.consent &&
    sameRows(a.built, b.built)
  );
}

/** On the public site? (published, as last published) */
export const isLive = (live?: InstallPost) => live?.status === 'published';

/** Waiting for the next publish: anything that would change what the site shows */
export function isInstallPending(post: InstallPost | undefined, live: InstallPost | undefined): boolean {
  if (!post) return isLive(live);
  if (!live) return post.status === 'published';
  if (post.status === 'draft' && live.status === 'draft') return false;
  return !sameInstall(post, live);
}

/** What the public pages show after a publish (simulated): the published installs, with their photos */
export function siteInstalls(posts: Record<string, InstallPost>, photos: Record<string, PhotoMeta[]>): Record<string, SiteInstall> {
  return Object.fromEntries(
    Object.values(posts)
      .filter((p) => p.status === 'published')
      .map((p): [string, SiteInstall] => {
        const list: (SitePhoto & { before?: boolean })[] = (photos[p.id] ?? []).map((ph) => ({
          id: ph.id,
          alt: ph.alt.trim() || `${p.title}, installed by FiberSteel`,
          caption: ph.caption,
          width: ph.width,
          height: ph.height,
          ...(ph.before ? { before: true } : {}),
        }));
        return [
          p.id,
          {
            id: p.id,
            title: p.title,
            summary: p.summary,
            story: storyParagraphs(p.story),
            kind: p.kind,
            kindLabel: kindName(p.kind),
            ...(p.size ? { size: p.size, sizeName: sizeName(p.size) } : {}),
            boat: p.boat,
            ...(p.slip ? { slip: p.slip } : {}),
            ...(p.docking ? { docking: p.docking } : {}),
            town: p.town,
            lake: 'Lake of the Ozarks',
            completed: p.completed,
            built: [...p.built],
            featured: p.featured,
            photos: list,
          },
        ];
      }),
  );
}

/** "Lake Ozark · June 2026" */
export const whereWhen = (p: Pick<InstallPost, 'town' | 'completed'>) => [p.town, monthLabel(p.completed)].filter(Boolean).join(' · ');
