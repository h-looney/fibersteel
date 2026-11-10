/** Search-as-you-type pickers (ARIA combobox pattern) for customers and inventory items. */
import type { ComponentChildren } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { createCustomer } from '../actions';
import type { Customer, Item } from '../data/types';
import { phone } from '../lib/format';
import { available, customerOf, itemLabel } from '../selectors';
import { db } from '../store';
import { Button, Field } from './core';
import { Icon } from './Icon';

interface ComboProps<T> {
  label: string;
  placeholder?: string;
  search: (q: string) => T[];
  getKey: (t: T) => string;
  renderOption: (t: T) => ComponentChildren;
  onSelect: (t: T) => void;
  emptyText?: string;
  footer?: ComponentChildren;
  autoFocus?: boolean;
  hideLabel?: boolean;
}

export function Combobox<T>({ label, placeholder, search, getKey, renderOption, onSelect, emptyText = 'No matches', footer, autoFocus, hideLabel }: ComboProps<T>) {
  const id = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (open ? search(q) : []), [q, open, db.value]);

  const choose = (t: T) => {
    onSelect(t);
    setQ('');
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div class="combo">
      <label class={hideLabel ? 'sr-only' : 'field__label'} for={`${id}-input`}>
        {label}
      </label>
      <div class="combo__control">
        <Icon name="search" size={16} />
        <input
          ref={input}
          id={`${id}-input`}
          class="input"
          type="text"
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
          placeholder={placeholder}
          value={q}
          data-autofocus={autoFocus ? '' : undefined}
          onInput={(e) => {
            setQ((e.target as HTMLInputElement).value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
        />
      </div>
      {open && (
        <div class="combo__popup">
          <ul class="combo__list" role="listbox" id={`${id}-list`} aria-label={label}>
            {results.length === 0 && <li class="combo__empty">{emptyText}</li>}
            {results.map((t, i) => (
              <li
                key={getKey(t)}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                class={`combo__option${i === active ? ' is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(t)}
              >
                {renderOption(t)}
              </li>
            ))}
          </ul>
          {footer && (
            <div class="combo__footer" onMouseDown={(e) => e.preventDefault()}>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const norm = (s: string) => s.toLowerCase();

export function searchCustomers(q: string, kinds?: Customer['kind'][]): Customer[] {
  const list = db.value.customers.filter((c) => !c.tags.includes('Counter sales') && (!kinds || kinds.includes(c.kind)));
  const term = norm(q.trim());
  if (!term) return [...list].sort((a, b) => (a.since < b.since ? 1 : -1)).slice(0, 6);
  const digits = term.replace(/\D/g, '');
  return list
    .filter(
      (c) =>
        norm(c.name).includes(term) ||
        norm(c.email).includes(term) ||
        norm(c.address.street).includes(term) ||
        norm(c.address.city).includes(term) ||
        (c.lake && (norm(c.lake.arm).includes(term) || norm(c.lake.cove ?? '').includes(term) || (c.lake.mm !== undefined && `mm ${c.lake.mm}`.includes(term)))) ||
        (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)),
    )
    .sort((a, b) => Number(norm(b.name).startsWith(term)) - Number(norm(a.name).startsWith(term)))
    .slice(0, 8);
}

/** Where a customer is, the way the office would say it: the lake spot for owners, the town otherwise */
export const whereLabel = (c: Customer) =>
  c.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}${c.lake.cove ? ` · ${c.lake.cove}` : ''}` : [c.address.street, c.address.city].filter(Boolean).join(', ');

/** Pick an existing customer or add one without leaving the form. */
export function CustomerPicker({ value, onChange, kinds, label = 'Customer', autoFocus }: { value?: string; onChange: (id: string | undefined) => void; kinds?: Customer['kind'][]; label?: string; autoFocus?: boolean }) {
  const selected = customerOf(db.value, value);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', street: '', city: '', zip: '', arm: '', mm: '' });

  if (selected) {
    return (
      <div class="field">
        <span class="field__label">{label}</span>
        <div class="picked">
          <span class="picked__icon">
            <Icon name="user" size={16} />
          </span>
          <span class="picked__text">
            <strong>{selected.name}</strong>
            <span class="muted small">
              {whereLabel(selected)} · {phone(selected.phone)}
            </span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  if (creating) {
    const set = (k: keyof typeof form) => (e: Event) => setForm({ ...form, [k]: (e.target as HTMLInputElement).value });
    return (
      <fieldset class="picked-new">
        <legend class="field__label">New customer</legend>
        <div class="form-grid">
          <Field label="Name" class="span-2">
            <input class="input" value={form.name} onInput={set('name')} data-autofocus />
          </Field>
          <Field label="Phone">
            <input class="input" type="tel" value={form.phone} onInput={set('phone')} />
          </Field>
          <Field label="Email">
            <input class="input" type="email" value={form.email} onInput={set('email')} />
          </Field>
          <Field label="Street address" class="span-2">
            <input class="input" value={form.street} onInput={set('street')} />
          </Field>
          <Field label="City">
            <input class="input" value={form.city} onInput={set('city')} />
          </Field>
          <Field label="ZIP">
            <input class="input" inputMode="numeric" value={form.zip} onInput={set('zip')} />
          </Field>
          <Field label="Lake arm or channel" hint="Where the dock is, if they’re on the lake">
            <input class="input" value={form.arm} onInput={set('arm')} placeholder="Gravois arm" />
          </Field>
          <Field label="Mile marker">
            <input class="input" inputMode="decimal" value={form.mm} onInput={set('mm')} placeholder="12" />
          </Field>
        </div>
        <div class="row" style={{ marginTop: '12px' }}>
          <Button
            variant="primary"
            size="sm"
            disabled={!form.name.trim()}
            onClick={() => {
              const mm = Number(form.mm);
              const id = createCustomer({
                name: form.name.trim(),
                kind: 'owner',
                phone: form.phone,
                email: form.email,
                address: { street: form.street, city: form.city, state: 'MO', zip: form.zip },
                lake: form.arm.trim() ? { arm: form.arm.trim(), mm: form.mm && Number.isFinite(mm) ? mm : undefined } : undefined,
                store: 'camdenton',
                contactPref: 'phone',
              });
              setCreating(false);
              onChange(id);
            }}
          >
            Add customer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      </fieldset>
    );
  }

  return (
    <Combobox<Customer>
      label={label}
      placeholder="Search by name, phone, address or cove"
      autoFocus={autoFocus}
      search={(q) => searchCustomers(q, kinds)}
      getKey={(c) => c.id}
      onSelect={(c) => onChange(c.id)}
      renderOption={(c) => (
        <>
          <span class="combo__title">{c.name}</span>
          <span class="combo__meta">
            {whereLabel(c)} · {phone(c.phone)}
          </span>
        </>
      )}
      emptyText="No customers match"
      footer={
        <button type="button" class="combo__create" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> New customer
        </button>
      }
    />
  );
}

export function searchItems(q: string, filter?: (it: Item) => boolean): Item[] {
  const term = norm(q.trim());
  const list = db.value.items.filter((it) => !filter || filter(it));
  if (!term) return list.slice(0, 8);
  return list.filter((it) => norm(it.id).includes(term) || norm(it.name).includes(term) || norm(it.brand).includes(term) || norm(it.category).includes(term)).slice(0, 10);
}

/** Search the catalog; shows what's available in Camdenton. */
export function ItemPicker({ onSelect, label = 'Add an item', filter, placeholder = 'Search by name, brand or SKU', hideLabel }: { onSelect: (item: Item) => void; label?: string; filter?: (it: Item) => boolean; placeholder?: string; hideLabel?: boolean }) {
  return (
    <Combobox<Item>
      label={label}
      hideLabel={hideLabel}
      placeholder={placeholder}
      search={(q) => searchItems(q, filter)}
      getKey={(it) => it.id}
      onSelect={onSelect}
      renderOption={(it) => {
        const a = available(it, 'camdenton');
        return (
          <>
            <span class="combo__title">{itemLabel(it)}</span>
            <span class="combo__meta">
              {it.id} · {a > 0 ? `${a} available` : it.buildToOrder ? 'Built to order' : 'None available'}
            </span>
          </>
        );
      }}
      emptyText="Nothing in the catalog matches"
    />
  );
}
