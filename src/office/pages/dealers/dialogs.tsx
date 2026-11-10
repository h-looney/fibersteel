/** Add or edit a dealer account; create or edit a dealer order. Opened via openDialog({ kind: 'dealer' | 'dealer-order' }). */
import { useState } from 'preact/hooks';
import { addDealer, createDealerOrder, dealerRate, updateDealer, updateDealerOrder } from '../../actions';
import type { Dealer, DealerOrder, Item } from '../../data/types';
import { addDays, today } from '../../lib/dates';
import { money } from '../../lib/format';
import { navigate } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Segmented, Switch } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { orderTotal, pct, shipLabels } from './helpers';

const emailOk = (v: string) => !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/* ---------- Dealer account ---------- */

export function DealerDialog({ dealerId, onClose }: { dealerId?: string; onClose: () => void }) {
  const existing = dealerId ? db.value.dealers.find((x) => x.id === dealerId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [contact, setContact] = useState(existing?.contact ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [state, setState] = useState(existing?.state ?? '');
  const [area, setArea] = useState(existing?.area ?? '');
  const [status, setStatus] = useState<Dealer['status']>(existing?.status ?? 'prospect');
  const [discount, setDiscount] = useState(String(Math.round((existing?.discount ?? 0.2) * 100)));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [tried, setTried] = useState(false);

  const discountN = Number(discount);
  const discountOk = Number.isFinite(discountN) && discountN >= 0 && discountN < 60;
  const ok = !!name.trim() && !!contact.trim() && emailOk(email) && discountOk;

  const save = (e?: Event) => {
    e?.preventDefault();
    setTried(true);
    if (!ok) return;
    const record = {
      name: name.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      area: area.trim(),
      status,
      discount: Math.round(discountN) / 100,
      notes: notes.trim() || undefined,
    };
    if (existing) {
      updateDealer(existing.id, record);
      toast('Dealer details saved');
      onClose();
      return;
    }
    const id = addDealer(record);
    toast(`${record.name} added as a dealer`);
    onClose();
    navigate(`/office/dealers/?id=${id}`);
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.name}` : 'Add a dealer'}
      description={existing ? `Dealer ${existing.id}` : 'A business that orders lifts at dealer pricing. A billing record is set up with it.'}
      onClose={onClose}
      size="lg"
      class="cust-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save()}>
            {existing ? 'Save changes' : 'Add dealer'}
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={save} noValidate>
        <p class="callout">
          <Icon name="info" size={16} />
          <span>Dealer accounts here are samples for the demo. The dealer list on the public site is kept separately, under Website → Dealer list.</span>
        </p>
        <div class="form-grid">
          <Field label="Business name">
            <input class="input" value={name} data-autofocus aria-invalid={tried && !name.trim() ? 'true' : undefined} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            {tried && !name.trim() && <span class="field__error-text">Please enter the business name.</span>}
          </Field>
          <Field label="Contact person">
            <input class="input" value={contact} aria-invalid={tried && !contact.trim() ? 'true' : undefined} onInput={(e) => setContact((e.target as HTMLInputElement).value)} />
            {tried && !contact.trim() && <span class="field__error-text">Who should FiberSteel talk to?</span>}
          </Field>
          <Field label="Phone">
            <input class="input" type="tel" autocomplete="off" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Email">
            <input class="input" type="email" autocomplete="off" value={email} aria-invalid={tried && !emailOk(email) ? 'true' : undefined} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
            {tried && !emailOk(email) && <span class="field__error-text">That email address doesn’t look right.</span>}
          </Field>
          <Field label="City">
            <input class="input" value={city} onInput={(e) => setCity((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="State">
            <input class="input" value={state} maxLength={2} onInput={(e) => setState((e.target as HTMLInputElement).value.toUpperCase())} />
          </Field>
          <Field label="Lakes or areas served" class="span-2">
            <input class="input" value={area} placeholder="e.g. Lakes in north Texas" onInput={(e) => setArea((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Status">
            <select class="select" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as Dealer['status'])}>
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
          <Field label="Dealer discount off list (%)" hint="Sample terms — FiberSteel sets the real ones">
            <input class="input" type="number" min="0" max="59" step="1" inputMode="numeric" value={discount} aria-invalid={tried && !discountOk ? 'true' : undefined} onInput={(e) => setDiscount((e.target as HTMLInputElement).value)} />
            {tried && !discountOk && <span class="field__error-text">Use a percentage from 0 to 59.</span>}
          </Field>
        </div>
        <Field label="Notes" optional>
          <textarea class="textarea" rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Dealer order ---------- */

interface Line {
  itemId: string;
  qty: number;
  rate: number;
}

const orderable = (it: Item) => (it.kind === 'lift' || it.kind === 'product' || it.kind === 'resale') && it.category !== 'Used lifts';

export function DealerOrderDialog({ orderId, dealerId, preset, onClose }: { orderId?: string; dealerId?: string; preset?: Partial<Pick<DealerOrder, 'ship' | 'notes'>>; onClose: () => void }) {
  const d = db.value;
  const existing = orderId ? d.dealerOrders.find((o) => o.id === orderId) : undefined;
  const editable = !existing || existing.status === 'quote';
  const choices = d.dealers.filter((x) => x.status !== 'paused' || x.id === (existing?.dealerId ?? dealerId));
  const [dealer, setDealer] = useState(existing?.dealerId ?? dealerId ?? choices.find((x) => x.status === 'active')?.id ?? '');
  const [lines, setLines] = useState<Line[]>(existing ? existing.lines.map((l) => ({ ...l })) : []);
  const [ship, setShip] = useState<DealerOrder['ship']>(existing?.ship ?? preset?.ship ?? 'freight');
  const [shipOn, setShipOn] = useState(existing?.shipOn ?? addDays(today(), 14));
  const [notes, setNotes] = useState(existing?.notes ?? preset?.notes ?? '');
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);

  const account = d.dealers.find((x) => x.id === dealer);
  const itemOf = (id: string) => d.items.find((i) => i.id === id);
  const total = orderTotal({ lines });
  const ok = !!account && lines.length > 0 && lines.every((l) => l.qty > 0 && l.rate >= 0);

  const pickDealer = (id: string) => {
    setDealer(id);
    const next = d.dealers.find((x) => x.id === id);
    // Re-price lines at the new dealer's discount
    if (next) setLines(lines.map((l) => ({ ...l, rate: itemOf(l.itemId) ? dealerRate(itemOf(l.itemId)!, next) : l.rate })));
  };
  const addItem = (it: Item) => {
    const at = lines.findIndex((l) => l.itemId === it.id);
    if (at >= 0) setLines(lines.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l)));
    else setLines([...lines, { itemId: it.id, qty: 1, rate: account ? dealerRate(it, account) : it.price }]);
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const save = () => {
    setTried(true);
    if (existing && !editable) {
      updateDealerOrder(existing.id, { shipOn, notes: notes.trim() || undefined });
      toast('Order saved');
      onClose();
      return;
    }
    if (!ok) return;
    if (existing) {
      updateDealerOrder(existing.id, { dealerId: dealer, lines, ship, shipOn, notes: notes.trim() || undefined });
      toast(`${existing.id} saved`);
      onClose();
      return;
    }
    const id = createDealerOrder({ dealerId: dealer, lines, ship, shipOn, notes: notes.trim() || undefined, confirm });
    const builds = db.value.dealerOrders.find((o) => o.id === id)?.jobIds.length ?? 0;
    toast(confirm ? `${id} confirmed${builds ? ` — ${builds} shop job${builds === 1 ? '' : 's'} created` : ''}` : `${id} saved as a quote`, { tone: 'success' });
    onClose();
    navigate(`/office/dealers/?tab=orders&id=${id}`);
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.id}` : 'New dealer order'}
      description={existing ? (editable ? 'A quote can still change.' : 'Confirmed orders keep their lines — the shop is building them. Ship date and notes can change.') : 'Lifts and products for a dealer, at dealer pricing.'}
      onClose={onClose}
      size="lg"
      class="cust-dialog deal-dialog"
      footer={
        <>
          <span class="deal-dialog__total">
            Total <strong class="tabular">{money(total, false)}</strong>
          </span>
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={tried && editable && !ok} onClick={save}>
            {existing ? 'Save changes' : confirm ? 'Create & confirm' : 'Save as a quote'}
          </Button>
        </>
      }
    >
      <div class="stack">
        <Field label="Dealer">
          <select class="select" value={dealer} disabled={!editable} data-autofocus onChange={(e) => pickDealer((e.target as HTMLSelectElement).value)}>
            <option value="" disabled>
              Choose a dealer…
            </option>
            {choices.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.status !== 'active' ? ` (${x.status})` : ''}
              </option>
            ))}
          </select>
          {tried && !account && <span class="field__error-text">Choose the dealer.</span>}
        </Field>
        {account && (
          <p class="muted small">
            {account.contact} · {account.city}, {account.state} · dealer discount {pct(account.discount)} off list (sample)
          </p>
        )}

        <div class="deal-lines">
          <div class="table-wrap">
            <table class="table table--dense">
              <caption class="sr-only">Order lines</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="num">
                    Qty
                  </th>
                  <th scope="col" class="num">
                    Dealer price
                  </th>
                  <th scope="col" class="num">
                    Amount
                  </th>
                  {editable && (
                    <th scope="col">
                      <span class="sr-only">Remove</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={editable ? 5 : 4} class="muted">
                      No lines yet — add a lift or product below.
                    </td>
                  </tr>
                )}
                {lines.map((l, i) => {
                  const it = itemOf(l.itemId);
                  return (
                    <tr key={`${l.itemId}-${i}`}>
                      <td>
                        <span class="cell-main cell-main--plain">{it?.name ?? l.itemId}</span>
                        <span class="cell-sub">
                          {l.itemId}
                          {it ? ` · list ${money(it.price, false)}${it.publicPrice ? '' : ' (sample)'}` : ''}
                        </span>
                      </td>
                      <td class="num">
                        {editable ? (
                          <input class="input input--sm deal-lines__qty" type="number" min="1" step="1" inputMode="numeric" aria-label={`Quantity of ${it?.name ?? l.itemId}`} value={l.qty} onInput={(e) => setLine(i, { qty: Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0)) })} />
                        ) : (
                          l.qty
                        )}
                      </td>
                      <td class="num">
                        {editable ? (
                          <input class="input input--sm deal-lines__rate" type="number" min="0" step="1" inputMode="decimal" aria-label={`Dealer price for ${it?.name ?? l.itemId}`} value={l.rate} onInput={(e) => setLine(i, { rate: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
                        ) : (
                          money(l.rate, false)
                        )}
                      </td>
                      <td class="num tabular">{money(l.qty * l.rate, false)}</td>
                      {editable && (
                        <td>
                          <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Remove ${it?.name ?? l.itemId}`} onClick={() => setLines(lines.filter((_, k) => k !== i))}>
                            <Icon name="trash" size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && <ItemPicker label="Add a lift or product" filter={orderable} placeholder="Search sizes, dock steps, remotes…" onSelect={addItem} />}
          {tried && editable && lines.length === 0 && <span class="field__error-text">Add at least one line.</span>}
        </div>

        <div class="form-grid">
          <div class="field">
            <span class="field__label" id="deal-ship-label">
              Shipping
            </span>
            {editable ? (
              <Segmented<DealerOrder['ship']>
                label="Shipping"
                value={ship}
                onChange={setShip}
                items={(Object.keys(shipLabels) as DealerOrder['ship'][]).map((k) => ({ key: k, label: shipLabels[k] }))}
              />
            ) : (
              <span>{shipLabels[ship]}</span>
            )}
          </div>
          <Field label="Ship by">
            <input class="input" type="date" value={shipOn} min={today()} onInput={(e) => setShipOn((e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        <Field label="Notes" optional>
          <textarea class="textarea" rows={2} value={notes} placeholder="Bunk setups, colors, the freight carrier…" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
        {!existing && (
          <Switch
            checked={confirm}
            onChange={setConfirm}
            label="Confirm the order now"
            description="Creates the shop builds for lifts that aren’t already in stock. Leave it off to send the dealer a quote first."
          />
        )}
      </div>
    </Dialog>
  );
}
