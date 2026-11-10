/** Inventory dialogs: correct a count, and build a purchase order. One location — the Camdenton shop. */
import { useState } from 'preact/hooks';
import { adjustStock, createPO, orderPO, updatePO } from '../../actions';
import { useAssets } from '../../assets';
import type { Item } from '../../data/types';
import { money } from '../../lib/format';
import { navigate, sectionPath } from '../../router';
import { available, itemLabel, itemOf, itemPhotoKey } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Segmented } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { itemIcon, onOrder, orderable, qtyLabel, SHOP, SHOP_NAME, stockVendors } from './helpers';

const toInt = (v: string) => (v.trim() === '' ? NaN : Math.floor(Number(v)));

/** Thumbnail: FiberSteel's own photo when there is one, an icon otherwise (never another maker's photo) */
export function Thumb({ item, size = 40 }: { item: Item; size?: number }) {
  const { photos } = useAssets();
  const key = itemPhotoKey(item);
  const src = key ? photos[key] : undefined;
  const style = size === 40 ? undefined : { width: `${size}px`, height: `${size}px` };
  return src ? (
    <img class="thumb" src={src} alt="" width={size} height={size} loading="lazy" style={style} />
  ) : (
    <span class="thumb" aria-hidden="true" style={style}>
      <Icon name={itemIcon(item)} size={Math.round(size * 0.45)} />
    </span>
  );
}

/** Small product summary used at the top of each dialog */
export function ItemSummary({ item, onChange }: { item: Item; onChange?: () => void }) {
  return (
    <div class="inv-pick">
      <Thumb item={item} />
      <span class="inv-pick__text">
        <strong>{itemLabel(item)}</strong>
        <span class="muted small">
          {item.id} · {item.category}
        </span>
      </span>
      {onChange && (
        <Button size="sm" variant="ghost" onClick={onChange}>
          Change
        </Button>
      )}
    </div>
  );
}

/* ---------- Adjust ---------- */

type AdjustMode = 'count' | 'add' | 'remove';
const reasons = ['Cycle count', 'Damaged', 'Found', 'Used in the shop', 'Boat-show display', 'Other'] as const;
const defaultReason: Record<AdjustMode, (typeof reasons)[number]> = { count: 'Cycle count', add: 'Found', remove: 'Damaged' };

export function AdjustDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = itemOf(db.value, itemId);
  const [mode, setMode] = useState<AdjustMode>('count');
  const [amountText, setAmountText] = useState(String(item?.stock[SHOP].onHand ?? 0));
  const [reason, setReason] = useState<string>(defaultReason.count);
  const [note, setNote] = useState('');
  if (!item) return null;

  const level = item.stock[SHOP];
  const current = level.onHand;
  const amount = toInt(amountText);
  const delta = !Number.isFinite(amount) ? 0 : mode === 'add' ? amount : mode === 'remove' ? -amount : amount - current;
  const next = current + delta;
  const valid = Number.isFinite(amount) && (mode === 'count' ? amount >= 0 && delta !== 0 : amount >= 1) && next >= 0;
  const committed = level.reserved + level.display;

  const switchMode = (m: AdjustMode) => {
    setMode(m);
    setReason(defaultReason[m]);
    setAmountText(m === 'count' ? String(current) : '1');
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (!valid) return;
    adjustStock(item.id, delta, note.trim() ? `${reason} — ${note.trim()}` : reason);
    toast(`${itemLabel(item)}: now ${qtyLabel(item, next)} on hand`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Adjust stock"
      description={`Correct the count at the ${SHOP_NAME} after a count, damage or a found item.`}
      onClose={onClose}
      size="md"
      class="inv-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="inv-adjust-form" disabled={!valid}>
            Save adjustment
          </Button>
        </>
      }
    >
      <form id="inv-adjust-form" class="stack" onSubmit={submit} noValidate>
        <ItemSummary item={item} />
        <p class="muted small">
          {qtyLabel(item, current)} on hand · {qtyLabel(item, level.reserved)} set aside for jobs and builds
          {level.display ? ` · ${qtyLabel(item, level.display)} on display` : ''}
        </p>
        <div class="form-grid">
          <div class="field span-2">
            <span class="field__label" aria-hidden="true">
              Change
            </span>
            <Segmented<AdjustMode>
              label="Type of change"
              size="sm"
              value={mode}
              onChange={switchMode}
              items={[
                { key: 'count', label: 'Set count' },
                { key: 'add', label: 'Add' },
                { key: 'remove', label: 'Remove' },
              ]}
            />
          </div>
          <Field label={mode === 'count' ? 'Counted on hand' : mode === 'add' ? 'Quantity to add' : 'Quantity to remove'}>
            <input class="input inv-qty" type="number" inputMode="numeric" min={mode === 'count' ? 0 : 1} step={1} value={amountText} onInput={(e) => setAmountText((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Reason">
            <select class="select" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Note" optional class="span-2">
            <input class="input" value={note} placeholder="e.g. Cracked tank found when unloading" onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
          </Field>
        </div>

        {mode === 'remove' && Number.isFinite(amount) && next < 0 && (
          <p class="inv-error" role="alert">
            There {current === 1 ? 'is' : 'are'} only {qtyLabel(item, current)} on hand.
          </p>
        )}
        {valid && (
          <div class="inv-preview" aria-live="polite">
            <span class="inv-preview__label">After saving</span>
            <span>
              {current} → <strong>{next}</strong> on hand ({delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`})
            </span>
            {next < committed && (
              <span class="inv-warn">
                <Icon name="alert" size={14} /> That’s fewer than the {committed} set aside for jobs, builds or display.
              </span>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}

/* ---------- Purchase order ---------- */

interface Line {
  itemId: string;
  qty: string;
}

export function PODialog({ poId, preset, onClose }: { poId?: string; preset?: { vendorId?: string; itemIds?: string[] }; onClose: () => void }) {
  const d = db.value;
  const existing = poId ? d.pos.find((p) => p.id === poId) : undefined;
  const vendors = stockVendors(d);
  const presetItems = (preset?.itemIds ?? []).map((id) => itemOf(d, id)).filter((it): it is Item => !!it && orderable(it));
  const [vendorId, setVendorId] = useState<string>(existing?.vendorId ?? preset?.vendorId ?? presetItems[0]?.vendorId ?? '');
  const [lines, setLines] = useState<Line[]>(() =>
    existing ? existing.lines.map((l) => ({ itemId: l.itemId, qty: String(l.qty) })) : presetItems.map((it) => ({ itemId: it.id, qty: String(Math.max(1, it.reorderQty)) })),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [notice, setNotice] = useState('');

  if (existing && existing.status !== 'draft') {
    return (
      <Dialog title={`${existing.id} can’t be edited`} onClose={onClose} size="sm" class="inv-dialog" footer={<Button onClick={onClose}>Close</Button>}>
        <p>This order has already been placed with the vendor. Receive it or cancel it from the order instead.</p>
      </Dialog>
    );
  }

  const vendor = vendors.find((v) => v.id === vendorId);
  const parsed = lines.map((l) => ({ itemId: l.itemId, text: l.qty, qty: toInt(l.qty), item: itemOf(d, l.itemId)! })).filter((l) => l.item);
  const total = parsed.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0) * l.item.cost, 0);
  const units = parsed.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0);
  const badQty = parsed.some((l) => !(l.qty >= 1));
  const valid = !!vendor && parsed.length > 0 && !badQty;

  const addItem = (it: Item) => {
    setNotice('');
    if (!vendorId) setVendorId(it.vendorId);
    setLines((ls) => (ls.some((l) => l.itemId === it.id) ? ls.map((l) => (l.itemId === it.id ? { ...l, qty: String((toInt(l.qty) || 0) + 1) } : l)) : [...ls, { itemId: it.id, qty: String(Math.max(1, it.reorderQty)) }]));
  };

  const changeVendor = (id: string) => {
    const keep = lines.filter((l) => itemOf(d, l.itemId)?.vendorId === id);
    const removed = lines.length - keep.length;
    setVendorId(id);
    setLines(keep);
    setNotice(removed ? `Removed ${removed} item${removed === 1 ? '' : 's'} that ${removed === 1 ? 'comes' : 'come'} from a different vendor.` : '');
  };

  const save = (order: boolean) => {
    if (!valid || !vendor) return;
    const clean = parsed.map((l) => ({ itemId: l.itemId, qty: l.qty }));
    let id = existing?.id ?? '';
    if (existing) {
      updatePO(existing.id, { vendorId, notes: notes.trim() || undefined, lines: clean.map((l) => ({ ...l, received: 0, cost: itemOf(d, l.itemId)!.cost })) });
      if (order) orderPO(existing.id);
    } else {
      id = createPO({ vendorId, lines: clean, notes: notes.trim() || undefined, order });
    }
    toast(order ? `${id} placed with ${vendor.name} — expected in about ten days` : `${id} saved as a draft`, { tone: 'success' });
    onClose();
    navigate(sectionPath('inventory', { tab: 'orders', po: id }), { scroll: false });
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.id}` : 'New purchase order'}
      description={`Order components, materials or resale stock for the ${SHOP_NAME}.`}
      onClose={onClose}
      size="lg"
      class="inv-dialog"
      footer={
        <>
          <span class="inv-po-total">
            {parsed.length ? `${parsed.length} line${parsed.length === 1 ? '' : 's'} · ${units} items · ` : ''}
            <strong>{money(total)}</strong>
          </span>
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button variant="primary" icon="send" disabled={!valid} onClick={() => save(true)}>
            Place order
          </Button>
        </>
      }
    >
      <div class="stack">
        <Field label="Vendor" hint="Sample suppliers — FiberSteel’s real vendors would replace them.">
          <select class="select" value={vendorId} onChange={(e) => changeVendor((e.target as HTMLSelectElement).value)}>
            <option value="">Choose a vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        {vendor && (
          <p class="muted small">
            {vendor.terms}
            {vendor.account ? ` · Account ${vendor.account}` : ''} · Deliver to the {SHOP_NAME}
          </p>
        )}

        <div class="inv-po-add">
          <ItemPicker
            label={vendor ? `Add an item from ${vendor.name}` : 'Add an item'}
            placeholder={vendor ? 'Search this vendor’s items' : 'Search by name or SKU — picks the vendor for you'}
            filter={(it) => orderable(it) && (!vendorId || it.vendorId === vendorId)}
            onSelect={addItem}
          />
        </div>
        {notice && (
          <p class="muted small" role="status">
            {notice}
          </p>
        )}

        {parsed.length === 0 ? (
          <p class="inv-empty-lines">No items yet. Search above to add what you need.</p>
        ) : (
          <div class="table-wrap">
            <table class="table table--dense inv-po-lines">
              <caption class="sr-only">Items on this order</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="is-right">
                    Quantity
                  </th>
                  <th scope="col" class="is-right hide-sm">
                    Unit cost
                  </th>
                  <th scope="col" class="is-right">
                    Line total
                  </th>
                  <th scope="col">
                    <span class="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((l) => {
                  const label = itemLabel(l.item);
                  const a = available(l.item, SHOP);
                  const incoming = onOrder(d, l.item.id);
                  const drafted = d.pos
                    .filter((p) => p.status === 'draft' && p.id !== poId)
                    .flatMap((p) => p.lines.filter((x) => x.itemId === l.item.id).map((x) => ({ po: p.id, qty: x.qty })));
                  return (
                    <tr key={l.itemId}>
                      <td>
                        <span class="cell-main">{label}</span>
                        <span class="cell-sub">
                          {l.item.id} · {qtyLabel(l.item, a)} available
                          {incoming ? ` · ${qtyLabel(l.item, incoming)} already on order` : ''}
                          {drafted.length ? ` · ${drafted.map((x) => `${x.qty} on draft ${x.po}`).join(', ')}` : ''}
                        </span>
                      </td>
                      <td class="is-right">
                        <input
                          class="input input--sm inv-qty inv-qty--sm"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={l.text}
                          aria-label={`Quantity of ${label}`}
                          aria-invalid={!(l.qty >= 1) || undefined}
                          onInput={(e) => {
                            const v = (e.target as HTMLInputElement).value;
                            setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, qty: v } : x)));
                          }}
                        />
                      </td>
                      <td class="is-right tabular hide-sm">{money(l.item.cost)}</td>
                      <td class="is-right tabular">{money((Number.isFinite(l.qty) ? l.qty : 0) * l.item.cost)}</td>
                      <td class="is-right">
                        <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Remove ${label}`} onClick={() => setLines((ls) => ls.filter((x) => x.itemId !== l.itemId))}>
                          <Icon name="close" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td />
                  <td class="hide-sm" />
                  <td class="is-right tabular">{money(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {badQty && parsed.length > 0 && (
          <p class="inv-error" role="alert">
            Every line needs a quantity of at least 1.
          </p>
        )}
        <p class="muted small">Costs are sample numbers for the demo.</p>

        <Field label="Notes for the order" optional>
          <textarea class="textarea" rows={2} value={notes} placeholder="e.g. Deliver to the back gate at the shop" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </div>
    </Dialog>
  );
}
