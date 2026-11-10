/**
 * "Lifts we've installed" on the public pages:
 *  - filter chips on install grids (boat type, lift size, docking), with ?kind= / ?size= / ?docking= opening on one;
 *  - installs published from FiberSteel mode in this browser join the grids they belong to as cards marked "Preview"
 *    (simulated: they're kept in this browser's storage, not on the site — production would rebuild the pages);
 *  - /installs/preview/?id=… builds a published install's page.
 * Everything is built with DOM APIs and textContent — what staff typed is never parsed as HTML.
 */
import { readPhotoUrls, readPublishedInstalls, type SiteInstall } from '../office/bridge';
import { withBase } from './url';

let published: Promise<Record<string, SiteInstall>> | null = null;
const fromOffice = () => (published ??= readPublishedInstalls());

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};

export const installPreviewHref = (id: string) => withBase(`/installs/preview/?id=${encodeURIComponent(id)}`);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Does a published install belong on a grid with this scope? */
function inScope(i: SiteInstall, scope: string): boolean {
  if (scope === 'all') return true;
  if (scope === 'featured') return i.featured;
  if (scope.startsWith('kind:')) return scope.slice(5).split(',').includes(i.kind);
  return false;
}

/** A card for an install published from FiberSteel mode, like InstallCard.astro's */
function previewCard(i: SiteInstall, photo: string | undefined, heading: string, pin: Element | null): HTMLElement {
  const item = el('div', 'install-grid__item');
  item.dataset.kind = i.kind;
  item.dataset.size = i.size ?? 'other';
  item.dataset.docking = i.docking ?? 'other';
  item.dataset.preview = '';
  const card = el('article', 'card card--hover install-card');
  card.dataset.installCard = i.id;
  const media = el('div', 'card__media install-card__media');
  if (photo) {
    const img = el('img');
    img.src = photo;
    img.alt = i.photos[0]?.alt ?? i.title;
    img.decoding = 'async';
    media.append(img);
  }
  if (i.photos.length > 1) {
    const count = el('span', 'install-card__count', `${i.photos.length} `);
    count.append(el('span', 'visually-hidden', 'photos'));
    media.append(count);
  }
  const body = el('div', 'card__body install-card__body');
  const where = el('p', 'install-card__where');
  if (pin) where.append(pin.cloneNode(true));
  where.append(`${i.town} · ${monthLabel(i.completed)}`);
  const title = el((/^h[2-4]$/.test(heading) ? heading : 'h3') as 'h3', 'install-card__title');
  const link = el('a', 'card__link', i.title);
  link.href = installPreviewHref(i.id);
  title.append(link);
  const facts = [i.sizeName, i.boat].filter(Boolean).join(' · ');
  body.append(where, title);
  if (facts) body.append(el('p', 'install-card__model', facts));
  body.append(
    el('p', 'install-card__kind', [i.kindLabel, i.docking, i.slip].filter(Boolean).join(' · ')),
    el('p', 'install-card__flag install-card__flag--preview', 'Preview · posted in FiberSteel mode'),
  );
  card.append(media, body);
  item.append(card);
  return item;
}

/* ---------- Grids ---------- */

let gridsStarted = false;

export function initInstallGrids() {
  if (gridsStarted) return;
  gridsStarted = true;
  const grids = [...document.querySelectorAll<HTMLElement>('[data-install-grid]')];
  const controls = grids.map(setupGrid);
  void addPublished(grids, controls);
}

interface GridControl {
  /** Re-apply the filters and counts after cards were added */
  refresh: () => void;
}

function setupGrid(grid: HTMLElement): GridControl {
  const cards = grid.querySelector<HTMLElement>('[data-install-cards]')!;
  const filters = grid.querySelector<HTMLElement>('[data-install-filters]');
  const status = grid.querySelector<HTMLElement>('[data-install-status]');
  const empty = grid.querySelector<HTMLElement>('[data-install-empty]');
  const what = grid.dataset.what ?? 'installs';
  const items = () => [...cards.querySelectorAll<HTMLElement>('.install-grid__item')];
  const rows = filters ? [...filters.querySelectorAll<HTMLElement>('[data-filter-row]')] : [];
  const active: Record<string, string> = Object.fromEntries(rows.map((r) => [r.dataset.filterRow!, 'all']));
  const chip = (f: string, v: string) => filters?.querySelector<HTMLButtonElement>(`[data-filter="${f}"][data-value="${CSS.escape(v)}"]`);

  /** Counts on the chips follow the cards (preview cards included); values only FiberSteel mode has get a chip */
  function recount(labels: Map<string, string>) {
    if (!filters) return;
    const all = items();
    filters.querySelectorAll('[data-filter-count="all"]').forEach((n) => (n.textContent = String(all.length)));
    for (const row of rows) {
      const f = row.dataset.filterRow!;
      const counts = new Map<string, number>();
      for (const it of all) counts.set(it.dataset[f]!, (counts.get(it.dataset[f]!) ?? 0) + 1);
      counts.delete('other');
      for (const [value, n] of counts) {
        let button = chip(f, value);
        if (!button) {
          button = el('button', 'chip');
          button.type = 'button';
          button.dataset.filter = f;
          button.dataset.value = value;
          button.dataset.label = labels.get(`${f}:${value}`) ?? value;
          button.setAttribute('aria-pressed', 'false');
          button.append(`${button.dataset.label} `, el('span', 'install-filters__n'));
          row.append(button);
        }
        button.querySelector('.install-filters__n')!.textContent = String(n);
      }
      row.hidden = counts.size < 1;
    }
    filters.hidden = all.length < 2;
  }

  function apply(announce = true) {
    let shown = 0;
    for (const it of items()) {
      const on = Object.entries(active).every(([f, v]) => v === 'all' || it.dataset[f] === v);
      it.hidden = !on;
      if (on) shown++;
    }
    rows.forEach((row) => {
      const f = row.dataset.filterRow!;
      row.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === active[f])));
    });
    if (empty) empty.hidden = shown > 0;
    if (announce && status) {
      const named = Object.entries(active)
        .filter(([, v]) => v !== 'all')
        .map(([f, v]) => chip(f, v)?.dataset.label ?? v);
      status.textContent = named.length ? `Showing ${shown} of ${items().length} ${what}: ${named.join(', ')}` : `Showing all ${shown} ${what}`;
    }
    if (rows.length) {
      const url = new URL(location.href);
      for (const [f, v] of Object.entries(active)) {
        if (v === 'all') url.searchParams.delete(f);
        else url.searchParams.set(f, v);
      }
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }

  filters?.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-filter]');
    if (!button) return;
    active[button.dataset.filter!] = button.dataset.value!;
    apply();
  });
  grid.querySelectorAll('[data-install-reset]').forEach((b) =>
    b.addEventListener('click', () => {
      for (const f of Object.keys(active)) active[f] = 'all';
      apply();
    }),
  );

  // ?kind=<kind> (and ?size=, ?docking=) opens on one
  const wanted = () => {
    const params = new URLSearchParams(location.search);
    for (const f of Object.keys(active)) {
      const v = params.get(f);
      active[f] = v && chip(f, v) ? v : 'all';
    }
  };
  wanted();
  if (Object.values(active).some((v) => v !== 'all')) apply(false);

  return {
    refresh: () => {
      const labels = new Map<string, string>();
      cards.querySelectorAll<HTMLElement>('[data-preview]').forEach((it) => {
        labels.set(`kind:${it.dataset.kind}`, it.dataset.kindName ?? it.dataset.kind!);
        labels.set(`size:${it.dataset.size}`, it.dataset.sizeName ?? it.dataset.size!);
        labels.set(`docking:${it.dataset.docking}`, it.dataset.docking!);
      });
      recount(labels);
      wanted();
      apply(false);
    },
  };
}

/** Add the installs published from FiberSteel mode in this browser to the grids they belong on */
async function addPublished(grids: HTMLElement[], controls: GridControl[]) {
  const all = Object.values(await fromOffice()).sort((a, b) => b.completed.localeCompare(a.completed));
  if (!all.length) return;
  const wanted = grids.map((g) => all.filter((i) => inScope(i, g.dataset.installGrid ?? '')));
  const leadIds = [...new Set(wanted.flat().map((i) => i.photos[0]?.id).filter((x): x is string => !!x))];
  const urls = await readPhotoUrls(leadIds);
  const pin = document.querySelector('.install-card__where svg');
  grids.forEach((grid, n) => {
    const list = wanted[n];
    if (!list.length) return;
    const cards = grid.querySelector<HTMLElement>('[data-install-cards]')!;
    const heading = grid.dataset.heading ?? 'h3';
    const made = list.map((i) => {
      const item = previewCard(i, i.photos[0] ? urls.get(i.photos[0].id) : undefined, heading, pin);
      item.dataset.kindName = i.kindLabel;
      item.dataset.sizeName = i.sizeName ?? 'Other';
      return item;
    });
    // Newest first: the published ones go in front
    cards.prepend(...made);
    const limit = Number(grid.dataset.limit) || 0;
    if (limit) [...cards.children].slice(limit).forEach((c) => c.remove());
    controls[n].refresh();
    // A section that was waiting for its first install
    grid.closest<HTMLElement>('[data-install-section]')?.removeAttribute('hidden');
  });
}

/* ---------- /installs/preview/?id=… ---------- */

export async function initInstallPreviewPage() {
  const page = document.querySelector<HTMLElement>('[data-install-preview]');
  if (!page) return;
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const i = id ? (await fromOffice())[id] : undefined;
  const missing = page.querySelector<HTMLElement>('[data-preview-missing]')!;
  // The page has two parts to show (the hero, and the story with "at a glance")
  const found = [...page.querySelectorAll<HTMLElement>('[data-preview-found]')];
  if (!i) {
    missing.hidden = false;
    found.forEach((f) => (f.hidden = true));
    return;
  }
  const month = monthLabel(i.completed);
  document.title = `${i.title} — ${i.town}, MO | FiberSteel Boat Lifts`;
  const text = (selector: string, value: string) => page.querySelectorAll(selector).forEach((n) => (n.textContent = value));
  text('[data-preview-eyebrow]', `Lifts we've installed · ${i.town}, MO`);
  text('[data-preview-title]', i.title);
  text('[data-preview-summary]', i.summary);
  const here = page.querySelector('.crumbs li:last-child [aria-current]');
  if (here) here.textContent = i.title;

  const params = new URLSearchParams({ type: i.kind, ...(i.size ? { size: i.size } : {}) });
  page.querySelectorAll<HTMLAnchorElement>('[data-preview-quote]').forEach((a) => (a.href = withBase(`/quote/?${params}`)));

  const story = page.querySelector<HTMLElement>('[data-preview-story]')!;
  story.replaceChildren(...i.story.map((p) => el('p', undefined, p)));
  const built = page.querySelector<HTMLElement>('[data-preview-built]')!;
  built.replaceChildren(...i.built.map((b) => el('li', undefined, b)));
  const row = (label: string, value: string) => {
    const div = el('div');
    div.append(el('dt', undefined, label), el('dd', undefined, value));
    return div;
  };
  page.querySelector('[data-preview-glance]')!.replaceChildren(
    ...[
      ['The lift', i.sizeName ?? ''],
      ['The boat', i.boat],
      ['Slip', i.slip ?? ''],
      ['Docking', i.docking ?? ''],
      ['Where', `${i.town}, MO${i.lake ? ` · ${i.lake}` : ''}`],
      ['Finished', month],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => row(k, v)),
  );

  // The photos, from this browser's storage
  const urls = await readPhotoUrls(i.photos.map((p) => p.id));
  const photos = i.photos.filter((p) => urls.has(p.id));
  const gallery = page.querySelector<HTMLElement>('[data-preview-gallery]')!;
  if (photos.length) {
    const slides = el('div', 'gallery__slides');
    photos.forEach((p, n) => {
      const slide = el('figure', 'gallery__slide');
      slide.dataset.slide = String(n);
      slide.hidden = n > 0;
      const frame = el('div', p.width / p.height > 1.4 ? 'gallery__frame gallery__frame--fill' : 'gallery__frame');
      const img = el('img');
      img.src = urls.get(p.id)!;
      img.alt = p.alt;
      img.width = p.width;
      img.height = p.height;
      frame.append(img);
      slide.append(frame);
      const caption = [p.before ? 'Before' : '', p.caption ?? ''].filter(Boolean).join(' · ');
      if (caption) slide.append(el('figcaption', 'gallery__caption', caption));
      slides.append(slide);
    });
    const parts: HTMLElement[] = [slides];
    if (photos.length > 1) {
      const thumbs = el('ul', 'gallery__thumbs');
      thumbs.setAttribute('role', 'list');
      photos.forEach((p, n) => {
        const button = el('button', 'gallery__thumb');
        button.type = 'button';
        button.dataset.show = String(n);
        button.setAttribute('aria-pressed', String(n === 0));
        const img = el('img');
        img.src = urls.get(p.id)!;
        img.alt = '';
        button.append(img, el('span', 'visually-hidden', `Photo ${n + 1} of ${photos.length}: ${p.alt}`));
        const li = el('li');
        li.append(button);
        thumbs.append(li);
      });
      parts.push(thumbs);
      thumbs.addEventListener('click', (e) => {
        const b = (e.target as Element).closest<HTMLElement>('[data-show]');
        if (!b) return;
        const show = Number(b.dataset.show);
        slides.querySelectorAll<HTMLElement>('[data-slide]').forEach((s, n) => (s.hidden = n !== show));
        thumbs.querySelectorAll('[data-show]').forEach((t, n) => t.setAttribute('aria-pressed', String(n === show)));
      });
    }
    gallery.replaceChildren(...parts);
  } else {
    gallery.append(el('p', 'gallery__note', 'The photos for this install are in another browser.'));
  }
  found.forEach((f) => (f.hidden = false));
  missing.hidden = true;
}
