/**
 * Website → Dealer list: the public "Find a dealer" page. It lists FiberSteel's authorized dealers as the current site
 * does (src/data/dealers.ts); staff fix a phone number or a link, hide a dealer, or add a new one, and it goes out with
 * the next publish (simulated). The made-up dealer accounts in the Dealers section never appear here.
 *   /office/website/?tab=dealers[&dealer=new|<id>]
 */
import { useMemo, useState } from 'preact/hooks';
import { phone } from '../../lib/format';
import { param, setParams } from '../../router';
import { toast } from '../../toast';
import { Badge, Button, Card, Field, Menu, SearchInput, type MenuItem } from '../../ui/core';
import { Confirm, Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { newDealerId, removeNewDealer, saveDealer, setDealerHidden, undoDealer } from './actions';
import { webDealers, type WebDealer } from './data';
import { baseDealer, dealerFromBase, dealerProblems, sameDealer, stateName, tidyDealer, type DealerDraft } from './dealerList';
import { PendingBadge, SiteLink } from './helpers';
import { db } from '../../store';

const blankDealer = (id: string): DealerDraft => ({ id, name: '', city: '', state: 'MO', phones: [''], web: null, isNew: true });

function startingDealer(id: string): DealerDraft {
  const w = db.value.website;
  const saved = w.dealers[id] ?? w.dealersLive[id];
  if (saved) {
    const { by: _by, at: _at, ...rest } = saved;
    return { ...structuredClone(rest), phones: rest.phones.length ? [...rest.phones] : [''] };
  }
  const base = baseDealer(id);
  return base ? dealerFromBase(base) : blankDealer(id);
}

/** Add or change one dealer on the public list */
function DealerListingDialog({ id: requested, onClose }: { id: string; onClose: () => void }) {
  const [newId] = useState(newDealerId);
  const id = requested === 'new' ? newId : requested;
  const [form, setForm] = useState<DealerDraft>(() => startingDealer(id));
  const [start] = useState(() => tidyDealer(form));
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const base = baseDealer(id);
  const isNew = !base;
  const set = (patch: Partial<DealerDraft>) => setForm((f) => ({ ...f, ...patch }));
  const text = (k: keyof DealerDraft) => (e: Event) => set({ [k]: (e.target as HTMLInputElement).value } as Partial<DealerDraft>);
  const dirty = !sameDealer(tidyDealer(form), start);

  const save = () => {
    const found = dealerProblems(form);
    setProblems(found);
    if (found.length) return;
    saveDealer({ ...form, isNew: isNew || undefined });
    toast(`${form.name.trim()} saved — the dealer page shows it after the next publish (simulated)`, { tone: 'success' });
    onClose();
  };
  const leave = () => (dirty ? setConfirmLeave(true) : onClose());

  return (
    <Dialog
      title={isNew ? 'Add a dealer' : `Dealer: ${base?.name ?? form.name}`}
      description={
        isNew
          ? 'A new authorized dealer for the “Find a dealer” page. Use the business’s own name, town and phone.'
          : base?.factory
            ? 'FiberSteel’s own listing at the top of the page.'
            : 'As the dealer page lists it now. Fix a phone number or a link, or add what’s missing.'
      }
      size="md"
      class="dealer-edit"
      onClose={leave}
      footer={
        <>
          <Button onClick={leave}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save}>
            Save dealer
          </Button>
        </>
      }
    >
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {problems.length > 0 && (
          <div class="callout callout--red listing-problems" role="alert">
            <Icon name="alert" size={18} />
            <div>
              <p class="callout__title">Before saving:</p>
              <ul>
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div class="form-grid">
          <Field label="Business name" class="span-2">
            <input class="input" value={form.name} maxLength={80} onInput={text('name')} data-autofocus />
          </Field>
          <Field label="Street" optional class="span-2">
            <input class="input" value={form.street ?? ''} maxLength={80} onInput={text('street')} />
          </Field>
          <Field label="Town">
            <input class="input" value={form.city} maxLength={40} onInput={text('city')} />
          </Field>
          <div class="form-grid dealer-edit__state">
            <Field label="State">
              <input class="input" value={form.state} maxLength={2} placeholder="MO" aria-describedby="dealer-state-hint" onInput={text('state')} />
            </Field>
            <Field label="ZIP" optional>
              <input class="input" inputMode="numeric" value={form.zip ?? ''} maxLength={10} onInput={text('zip')} />
            </Field>
          </div>
          <p class="field__hint span-2 dealer-edit__hint" id="dealer-state-hint">
            The two-letter state, e.g. MO. The ZIP is optional.
          </p>
          <Field label="Area" optional class="span-2" hint="For a dealer listed by region, e.g. “Serving Middle Tennessee”">
            <input class="input" value={form.area ?? ''} maxLength={80} onInput={text('area')} />
          </Field>
          {form.phones.map((p, i) => (
            <Field key={i} label={i === 0 ? 'Phone' : `Phone ${i + 1}`} optional={i > 0}>
              <span class="dealer-edit__phone">
                <input
                  class="input"
                  type="tel"
                  value={p}
                  maxLength={20}
                  onInput={(e) => set({ phones: form.phones.map((x, n) => (n === i ? (e.target as HTMLInputElement).value : x)) })}
                />
                {i > 0 && (
                  <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Remove phone ${i + 1}`} onClick={() => set({ phones: form.phones.filter((_, n) => n !== i) })}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </span>
            </Field>
          ))}
          {form.phones.length < 3 && (
            <div class="field dealer-edit__more">
              <button type="button" class="btn btn--secondary btn--sm" onClick={() => set({ phones: [...form.phones, ''] })}>
                <Icon name="plus" size={16} />
                <span>Add a phone</span>
              </button>
            </div>
          )}
          <Field label="Email" optional>
            <input class="input" type="email" value={form.email ?? ''} maxLength={80} onInput={text('email')} />
          </Field>
          <Field label="Website" optional hint="Leave empty when the dealer’s site is down">
            <input class="input" type="url" value={form.web ?? ''} maxLength={120} placeholder="https://" onInput={text('web')} />
          </Field>
          <Field label="Lake or water" optional>
            <input class="input" value={form.lake ?? ''} maxLength={60} onInput={text('lake')} />
          </Field>
          <Field label="Note" optional class="span-2" hint="One line the page shows under the name">
            <input class="input" value={form.note ?? ''} maxLength={140} onInput={text('note')} />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
      {confirmLeave && (
        <Confirm
          title="Leave without saving?"
          confirmLabel="Leave without saving"
          danger
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            onClose();
          }}
        >
          <p>Your changes to this dealer will be lost.</p>
        </Confirm>
      )}
    </Dialog>
  );
}

function DealerRow({ r }: { r: WebDealer }) {
  const l = r.listing;
  const where = l.area ?? [l.city, l.state].filter(Boolean).join(', ');
  const items: (MenuItem | 'divider')[] = [{ label: 'Edit…', icon: 'edit', onSelect: () => setParams({ dealer: r.id }) }];
  if (r.pending && (!r.isNew || !!db.value.website.dealersLive[r.id])) items.push({ label: 'Undo changes', icon: 'undo', onSelect: () => (undoDealer(r.id), toast(`${l.name}: back to how the page lists it`)) });
  if (!r.factory && !r.isNew)
    items.push('divider', {
      label: r.hidden ? 'Show it on the page again' : 'Hide it from the page',
      icon: r.hidden ? 'eye' : 'archive',
      danger: !r.hidden,
      onSelect: () => (setDealerHidden(r.id, !r.hidden), toast(r.hidden ? `${l.name} goes back on the page with the next publish` : `${l.name} comes off the page with the next publish (simulated)`)),
    });
  if (r.isNew && !r.hidden)
    items.push('divider', { label: 'Remove it', icon: 'trash', danger: true, onSelect: () => (removeNewDealer(r.id), toast(`${l.name} removed`)) });
  return (
    <li class={r.hidden ? 'web-item dealer-row is-hidden' : 'web-item dealer-row'}>
      <div class="web-item__main">
        <p class="web-item__title">
          {l.name}
          {r.factory && <Badge tone="accent">Factory direct</Badge>}
          {r.isNew && !r.hidden && <Badge tone="violet">New</Badge>}
          {r.hidden && <Badge tone="neutral">{r.isNew ? 'Coming off' : 'Hidden'}</Badge>}
          {r.pending && <PendingBadge />}
        </p>
        <p class="web-item__meta">
          <Icon name="pin" size={13} /> {where}
          {l.lake ? ` · ${l.lake}` : ''}
        </p>
        <p class="web-item__meta">
          {[...l.phones.filter(Boolean).map((p) => phone(p)), l.email, l.web ? l.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : r.factory ? '' : 'No website listed'].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div class="web-item__actions">
        <Menu label={`Actions for ${l.name}`} items={items} size="sm" />
      </div>
    </li>
  );
}

export function DealersTab() {
  const editing = param('dealer');
  const [q, setQ] = useState('');
  const rows = webDealers.value;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => [r.listing.name, r.listing.city, r.listing.state, stateName(r.listing.state), r.listing.lake ?? '', r.listing.area ?? ''].some((v) => v.toLowerCase().includes(t)));
  }, [rows, q]);
  const onPage = rows.filter((r) => !r.hidden).length;

  return (
    <div class="installs-tab">
      <Card
        title="Find a dealer"
        subtitle={`${onPage} on the page — FiberSteel’s own listing and the authorized dealers, as the current site lists them. Coordinates are approximate (the town), for “sort by distance” in the visitor’s browser.`}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setParams({ dealer: 'new' })}>
            Add a dealer
          </Button>
        }
        flush
      >
        <div class="web-toolbar row">
          <SearchInput value={q} onInput={setQ} label="Search dealers" placeholder="Search by name, town, state or lake" />
          <span class="muted small">
            <SiteLink path="/dealers/">Open the dealer page</SiteLink>
          </span>
        </div>
        <ul class="web-list" role="list">
          {shown.map((r) => (
            <DealerRow key={r.id} r={r} />
          ))}
        </ul>
        {!shown.length && <p class="web-note muted small">No dealers match “{q}”.</p>}
        <p class="web-note muted small">
          <Icon name="info" size={13} /> New dealer inquiries from the website’s “Become a dealer” form arrive with the other requests. The sample dealer accounts and orders in the Dealers section are made up and
          never shown here.
        </p>
      </Card>
      {editing && <DealerListingDialog key={editing} id={editing} onClose={() => setParams({ dealer: undefined })} />}
    </div>
  );
}
