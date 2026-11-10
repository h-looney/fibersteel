/** Ctrl/⌘+K search across customers, lifts, requests, jobs, invoices, inventory, dealers and pages. */
import { signal } from '@preact/signals';
import { Fragment } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import type { Section } from '../data/types';
import { openDialog } from '../dialogs';
import { money, phone, shortDate } from '../lib/format';
import { navigate, sectionPath } from '../router';
import { customerOf, invoiceTotals, itemLabel, liftLabel } from '../selectors';
import { can, db } from '../store';
import { Dialog } from '../ui/Dialog';
import { Icon, type IconName } from '../ui/Icon';
import { sectionTitles } from './Shell';

export const paletteOpen = signal(false);

interface Result {
  id: string;
  group: string;
  icon: IconName;
  title: string;
  meta?: string;
  run: () => void;
}

const sectionIcons: Record<Section, IconName> = {
  dashboard: 'dashboard',
  'my-day': 'sun',
  inbox: 'inbox',
  jobs: 'clipboard',
  customers: 'users',
  warranty: 'shield',
  inventory: 'box',
  dealers: 'handshake',
  accounting: 'bank',
  analytics: 'chart',
  website: 'globe',
  settings: 'sliders',
};

function search(q: string): Result[] {
  const d = db.value;
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const has = (...fields: (string | undefined)[]) => fields.some((f) => f && f.toLowerCase().includes(term));
  const out: Result[] = [];
  const go = (path: string) => () => navigate(path);

  const pages = (Object.keys(sectionTitles) as Section[]).filter((s) => can(s) && (!term || sectionTitles[s].toLowerCase().includes(term)));
  pages.forEach((s) => out.push({ id: `p-${s}`, group: 'Go to', icon: sectionIcons[s], title: sectionTitles[s], run: go(sectionPath(s)) }));

  const actions: [string, IconName, () => void, Section][] = [
    ['New job', 'plus', () => openDialog({ kind: 'job' }), 'jobs'],
    ['New customer', 'plus', () => openDialog({ kind: 'customer' }), 'customers'],
    ['Log a phone request', 'phone', () => openDialog({ kind: 'request' }), 'inbox'],
    ['New quote', 'file', () => openDialog({ kind: 'invoice', preset: { kind: 'estimate' } }), 'accounting'],
    ['New invoice', 'receipt', () => openDialog({ kind: 'invoice', preset: { kind: 'invoice' } }), 'accounting'],
    ['New dealer order', 'handshake', () => openDialog({ kind: 'dealer-order' }), 'dealers'],
    ['Order components', 'truck', () => openDialog({ kind: 'po' }), 'inventory'],
  ];
  actions
    .filter(([label, , , s]) => can(s) && (!term || label.toLowerCase().includes(term)))
    .forEach(([label, icon, run]) => out.push({ id: `a-${label}`, group: 'Actions', icon, title: label, run }));

  if (term.length < 2) return out;
  const limit = 6;

  if (can('customers')) {
    d.customers
      .filter((c) => has(c.name, c.email, c.address.street, c.address.city, c.id, c.contact) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)))
      .slice(0, limit)
      .forEach((c) => out.push({ id: c.id, group: 'Customers', icon: 'user', title: c.name, meta: `${c.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}` : c.address.city} · ${phone(c.phone)}`, run: go(`/office/customers/?id=${c.id}`) }));
    d.lifts
      .filter((l) => has(l.serial, l.id))
      .slice(0, 3)
      .forEach((l) => out.push({ id: l.id, group: 'Lifts', icon: 'lift', title: liftLabel(l), meta: `Serial ${l.serial} · ${customerOf(d, l.customerId)?.name ?? ''}`, run: go(`/office/customers/?id=${l.customerId}&lift=${l.id}`) }));
  }
  if (can('inbox')) {
    d.leads
      .filter((l) => has(l.name, l.summary, l.id, l.email, l.city))
      .slice(0, limit)
      .forEach((l) => out.push({ id: l.id, group: 'Requests', icon: 'inbox', title: `${l.name} — ${l.summary}`, meta: `${l.id} · ${shortDate(l.receivedAt)}`, run: go(`/office/inbox/?id=${l.id}`) }));
  }
  if (can('jobs')) {
    d.jobs
      .filter((j) => has(j.id, j.title, customerOf(d, j.customerId)?.name))
      .slice(0, limit)
      .forEach((j) => out.push({ id: j.id, group: 'Jobs', icon: 'clipboard', title: j.title, meta: `${j.id} · ${customerOf(d, j.customerId)?.name ?? ''}${j.start ? ` · ${shortDate(j.start)}` : ''}`, run: go(`/office/jobs/?id=${j.id}`) }));
  }
  if (can('accounting')) {
    d.invoices
      .filter((i) => has(i.id, customerOf(d, i.customerId)?.name))
      .slice(0, limit)
      .forEach((i) => out.push({ id: i.id, group: 'Invoices & quotes', icon: i.kind === 'estimate' ? 'file' : 'receipt', title: `${i.id} — ${customerOf(d, i.customerId)?.name ?? ''}`, meta: `${money(invoiceTotals(i).total)} · ${shortDate(i.issuedOn)}`, run: go(`/office/accounting/?tab=${i.kind === 'estimate' ? 'estimates' : 'invoices'}&id=${i.id}`) }));
  }
  if (can('inventory')) {
    d.items
      .filter((it) => has(it.id, it.name, it.brand, it.category))
      .slice(0, limit)
      .forEach((it) => out.push({ id: it.id, group: 'Inventory', icon: 'box', title: itemLabel(it), meta: `${it.id} · ${it.buildToOrder ? 'built to order' : `${it.stock.camdenton.onHand} on hand`}`, run: go(`/office/inventory/?id=${it.id}`) }));
  }
  if (can('dealers')) {
    d.dealers
      .filter((x) => has(x.name, x.contact, x.city, x.id))
      .slice(0, 4)
      .forEach((x) => out.push({ id: x.id, group: 'Dealers', icon: 'handshake', title: x.name, meta: `${x.city}, ${x.state} · ${x.contact}`, run: go(`/office/dealers/?id=${x.id}`) }));
    d.dealerOrders
      .filter((o) => has(o.id))
      .slice(0, 4)
      .forEach((o) => out.push({ id: o.id, group: 'Dealer orders', icon: 'truck', title: `${o.id} — ${d.dealers.find((x) => x.id === o.dealerId)?.name ?? ''}`, meta: shortDate(o.placedOn), run: go(`/office/dealers/?tab=orders&id=${o.id}`) }));
  }
  return out;
}

export function CommandPalette() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => search(q), [q, db.value]);
  const close = () => (paletteOpen.value = false);
  const choose = (r: Result) => {
    close();
    r.run();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length);
      setActive(next);
      listRef.current?.querySelector(`#pal-${next}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  let lastGroup = '';
  return (
    <Dialog title="Search FiberSteel mode" onClose={close} size="md" class="palette">
      <div class="palette__input">
        <Icon name="search" size={18} />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `pal-${active}` : undefined}
          aria-label="Search"
          placeholder="Name, phone, job number, invoice, SKU…"
          value={q}
          data-autofocus
          onInput={(e) => {
            setQ((e.target as HTMLInputElement).value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <ul class="palette__list" id="palette-list" role="listbox" aria-label="Results" ref={listRef}>
        {results.length === 0 && <li class="palette__empty">No matches for “{q}”.</li>}
        {results.map((r, i) => {
          const header = r.group !== lastGroup ? r.group : null;
          lastGroup = r.group;
          return (
            <Fragment key={r.id}>
              {header && (
                <li class="palette__group" role="presentation">
                  {header}
                </li>
              )}
              <li id={`pal-${i}`} role="option" aria-selected={i === active} class={`palette__item${i === active ? ' is-active' : ''}`} onMouseMove={() => setActive(i)} onClick={() => choose(r)}>
                <Icon name={r.icon} size={16} />
                <span class="palette__title">{r.title}</span>
                {r.meta && <span class="palette__meta">{r.meta}</span>}
              </li>
            </Fragment>
          );
        })}
      </ul>
      <p class="palette__hint">
        <kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd> to move · <kbd class="kbd">Enter</kbd> to open · <kbd class="kbd">Esc</kbd> to close
      </p>
    </Dialog>
  );
}
