/**
 * "Find a dealer": dealer-list changes published from FiberSteel mode in this browser (simulated — kept in this browser's
 * storage, not on the site) show on the page as previews — an edited dealer's new details, a hidden dealer taken off,
 * a new dealer added. Without anything published, the page stays exactly as built.
 * Built with DOM APIs and textContent — what staff typed is never parsed as HTML. New cards are copies of an existing
 * one, so the page's own styles apply to them.
 */
import { readPublishedDealers, type SiteDealer } from '../office/bridge';
import { STATE_NAMES } from '../data/dealers';

/** State names for a chip — the dealer list's own, and the rest for a dealer added in a preview */
const MORE_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
export const stateLabel = (code: string) => STATE_NAMES[code] ?? MORE_STATES[code] ?? code;

const pretty = (p: string) => {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};
const telHref = (p: string) => `tel:+1${p.replace(/\D/g, '').slice(-10)}`;
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const directions = (d: SiteDealer) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.name, d.street, `${d.city}, ${d.state}`, d.zip].filter(Boolean).join(', '))}`;

/** Copy the page's scoped-style attributes onto a node made here */
function scoped<T extends Element>(node: T, like: Element): T {
  for (const a of [...like.attributes]) if (a.name.startsWith('data-astro-cid')) node.setAttribute(a.name, a.value);
  return node;
}

function make<K extends keyof HTMLElementTagNameMap>(like: Element, tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = scoped(document.createElement(tag), like);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

type IconKind = 'phone' | 'mail' | 'web' | 'map';

/** The icons the page already uses, by what the link does */
function iconSet(list: HTMLElement): Partial<Record<IconKind, Element>> {
  const out: Partial<Record<IconKind, Element>> = {};
  list.querySelectorAll<HTMLAnchorElement>('.dealer__action').forEach((a) => {
    const svg = a.querySelector('svg');
    if (!svg) return;
    const kind: IconKind = a.href.startsWith('tel:') ? 'phone' : a.href.startsWith('mailto:') ? 'mail' : /google\.com\/maps/.test(a.href) ? 'map' : 'web';
    out[kind] ??= svg;
  });
  return out;
}

/** Put a published dealer's details into its card */
function fill(li: HTMLElement, d: SiteDealer, icons: Partial<Record<IconKind, Element>>, flag: string) {
  li.dataset.state = d.state;
  if (d.geo) {
    li.dataset.lat = String(d.geo.lat);
    li.dataset.lng = String(d.geo.lng);
  } else {
    delete li.dataset.lat;
    delete li.dataset.lng;
  }
  const factory = li.classList.contains('dealer--factory');

  // Where: the pin, the town (or area), and the distance badge the page fills in
  const where = li.querySelector<HTMLElement>('.dealer__where');
  if (where) {
    const pin = where.querySelector('svg');
    const dist = where.querySelector('[data-dist]');
    where.replaceChildren(...[pin, document.createTextNode(` ${d.area ?? `${d.city}, ${d.state}`} `), dist].filter((n): n is Element | Text => !!n));
  }
  const name = li.querySelector<HTMLElement>('.dealer__name');
  if (name) name.textContent = d.name;
  const head = li.querySelector<HTMLElement>('.dealer__head')!;

  /** Set, add or remove one optional line */
  const line = (className: string, value: string | undefined, place: (node: HTMLElement) => void) => {
    let node = li.querySelector<HTMLElement>(`.${className}`);
    if (!value) return node?.remove();
    if (!node) {
      node = make(li, 'p', className);
      place(node);
    }
    node.textContent = value;
  };
  line('dealer__lake', d.lake, (n) => head.append(n));
  line('dealer__note', d.note, (n) => head.after(n));
  const addr = d.street || d.zip ? [d.street, `${d.city}, ${d.state}${d.zip ? ` ${d.zip}` : ''}`].filter(Boolean).join(' · ') : undefined;
  line('dealer__addr', addr, (n) => (li.querySelector('.dealer__note') ?? head).after(n));

  // The links: phones, email, website, directions (the factory keeps its own directions link)
  const actions = li.querySelector<HTMLElement>('.dealer__actions');
  if (actions) {
    const keep = factory ? [...actions.querySelectorAll<HTMLElement>('li')].find((x) => /google\.com\/maps/.test(x.querySelector('a')?.href ?? '')) : undefined;
    const item = (href: string, icon: IconKind, label: string, external = false) => {
      const li2 = make(actions, 'li');
      const a = make(actions, 'a', 'dealer__action');
      a.href = href;
      if (external) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      const svg = icons[icon]?.cloneNode(true);
      if (svg) a.append(svg, ' ');
      a.append(label);
      li2.append(a);
      return li2;
    };
    const items = [
      ...d.phones.map((p) => item(telHref(p), 'phone', pretty(p))),
      ...(d.email ? [item(`mailto:${d.email}`, 'mail', 'Email')] : []),
      ...(d.web ? [item(d.web, 'web', host(d.web), true)] : []),
      ...(keep ? [keep] : d.street || d.zip ? [item(directions(d), 'map', 'Directions', true)] : []),
    ];
    actions.replaceChildren(...items);
  }

  let note = li.querySelector<HTMLElement>('.dealer__flag');
  if (!note) {
    note = make(li, 'p', 'dealer__flag');
    li.append(note);
  }
  note.textContent = flag;
}

/** Show the published changes; returns true when anything changed (so the page can recount its state chips) */
export async function applyDealerPreviews(list: HTMLElement): Promise<boolean> {
  const published = Object.values(await readPublishedDealers());
  if (!published.length) return false;
  const icons = iconSet(list);
  const model = [...list.querySelectorAll<HTMLElement>('[data-dealer]')].find((li) => !li.classList.contains('dealer--factory'));
  for (const d of published) {
    const li = list.querySelector<HTMLElement>(`[data-dealer="${CSS.escape(d.id)}"]`);
    if (li) {
      if (d.hidden) {
        li.dataset.previewHidden = '';
        li.hidden = true;
      } else fill(li, d, icons, 'Preview · changed in FiberSteel mode');
    } else if (d.isNew && !d.hidden && model) {
      const card = model.cloneNode(true) as HTMLElement;
      card.dataset.dealer = d.id;
      card.hidden = false;
      delete card.dataset.previewHidden;
      card.querySelector('.dealer__badge')?.remove();
      fill(card, d, icons, 'Preview · added in FiberSteel mode');
      list.append(card);
    }
  }
  return true;
}
