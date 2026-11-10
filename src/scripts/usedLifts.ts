/**
 * Used lifts on the public page: listings published from FiberSteel mode in this browser (simulated — kept in this
 * browser's storage, not on the site) change the sample cards they replace, take them off, or join the grid as new
 * cards, each marked "Preview". Without anything published, the page stays exactly as built.
 * Built with DOM APIs and textContent — what staff typed is never parsed as HTML.
 */
import { readPhotoUrls, readPublishedUsedLifts, type SiteUsedLift } from '../office/bridge';

const STATUS: Record<SiteUsedLift['status'], string> = { available: 'Available', pending: 'Sale pending', sold: 'Sold' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

let callModel: HTMLElement | null = null;

/** Put a published listing's details into a card (a sample's own card, or a copy of one for a new listing) */
function fill(card: HTMLElement, u: SiteUsedLift, photo: string | undefined, flag: string) {
  card.classList.toggle('is-sold', u.status === 'sold');
  const status = card.querySelector<HTMLElement>('.used-card__status');
  if (status) {
    status.textContent = STATUS[u.status];
    status.className = `used-card__status is-${u.status}`;
  }
  const media = card.querySelector<HTMLElement>('.card__media');
  if (media && (photo || !u.replaces)) {
    media.querySelectorAll('picture, img, .used-card__nophoto').forEach((n) => n.remove());
    if (photo) {
      const img = el('img');
      img.src = photo;
      img.alt = u.photo?.alt ?? u.title;
      img.decoding = 'async';
      media.prepend(img);
    } else media.prepend(el('span', 'used-card__nophoto', 'Photo coming soon'));
  }
  const text = (selector: string, value: string) => {
    const n = card.querySelector<HTMLElement>(selector);
    if (n) n.textContent = value;
  };
  text('.used-card__size', u.sizeName);
  text('.used-card__title', u.title);
  text('[data-used-condition]', u.condition);
  text('[data-used-price]', u.price ? usd(u.price) : 'Call for price');
  const includes = card.querySelector<HTMLElement>('.used-card__includes');
  includes?.replaceChildren(...u.includes.map((x) => el('li', 'chip', x)));
  // The call button: hidden for a sold lift, added (copied from another card) when a sold sample is for sale again
  let call = card.querySelector<HTMLElement>('[data-used-call]');
  if (!call && u.status !== 'sold' && callModel) {
    call = callModel.cloneNode(true) as HTMLElement;
    card.querySelector('[data-used-price]')?.after(call);
  }
  if (call) {
    call.hidden = u.status === 'sold';
    const label = call.querySelector('[data-used-call-label]');
    if (label) label.textContent = u.replaces ? `Call about ${u.replaces}` : 'Call about this lift';
  }
  const note = card.querySelector<HTMLElement>('[data-used-flag]');
  if (note) {
    note.textContent = u.replaces && !photo ? `${flag} · stand-in photo` : flag;
    note.classList.add('install-card__flag--preview');
  }
}

export async function initUsedLiftPreviews() {
  const grid = document.querySelector<HTMLElement>('[data-used-grid]');
  if (!grid) return;
  const published = Object.values(await readPublishedUsedLifts());
  if (!published.length) return;
  const urls = await readPhotoUrls(published.map((u) => u.photo?.id).filter((x): x is string => !!x));
  const model = grid.querySelector<HTMLElement>('[data-used-card]');
  callModel = (grid.querySelector<HTMLElement>('[data-used-call]')?.cloneNode(true) as HTMLElement | undefined) ?? null;
  const added: HTMLElement[] = [];
  for (const u of published) {
    const photo = u.photo ? urls.get(u.photo.id) : undefined;
    if (u.replaces) {
      const card = grid.querySelector<HTMLElement>(`[data-used-card="${CSS.escape(u.replaces)}"]`);
      if (!card) continue;
      if (u.removed) card.hidden = true;
      else fill(card, u, photo, 'Preview · updated in FiberSteel mode');
    } else if (!u.removed && model) {
      const card = model.cloneNode(true) as HTMLElement;
      card.dataset.usedCard = u.id;
      card.hidden = false;
      fill(card, u, photo, 'Preview · listed in FiberSteel mode');
      added.push(card);
    }
  }
  // New listings first
  grid.prepend(...added);
}
