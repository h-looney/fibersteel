/**
 * Inventory: the Camdenton shop's finished lifts, components, FiberSteel's other products and resale stock — what's set
 * aside for builds and jobs, what the shop could build right now, purchase orders, every stock movement and vendors.
 *   /office/inventory/?tab=stock|lifts|orders|activity|vendors  (&id=<SKU> opens an item, &po=<PO-…> an order)
 *   &kind=lifts|components|products|used and &filter=low|out narrow the stock list
 *
 * Costs, stock counts, vendors and bills of materials are sample data. Prices are FiberSteel's where its current site
 * shows them (Admiral remotes, dock steps); the rest are samples.
 */
import { useState } from 'preact/hooks';
import { createPO, orderPO, receivePO, updateItem, updatePO } from '../../actions';
import type { Item, Job, PurchaseOrder, StockMove, Vendor } from '../../data/types';
import { today } from '../../lib/dates';
import { dayLabel, money, number, percent, plural, shortDate, time } from '../../lib/format';
import { route, setParams } from '../../router';
import { available, customerOf, dealerOf, firstName, itemLabel, itemOf, lowStock, stockStatus, stockValue } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { AvatarStack, Button, Card, Chips, cx, Details, EmptyState, Field, Link, Meter, PageHeader, SearchInput, Stat, TabPanel, Tabs } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { jobStatusOf, StatusBadge, stockMeta } from '../../ui/status';
import { DataTable, type Column } from '../../ui/Table';
import { AdjustDialog, PODialog, Thumb } from './dialogs';
import {
  buildCapacity,
  downloadCsv,
  isOpenBuild,
  isOpenPO,
  isShopBuilt,
  kindLabel,
  moveMeta,
  onOrder,
  openBuildsFor,
  orderable,
  poOrderedQty,
  poOutstanding,
  poReceivedQty,
  poStatusMeta,
  poTotal,
  qtyLabel,
  reorderSuggestions,
  SHOP,
  SHOP_NAME,
  stockVendors,
  usedIn,
} from './helpers';

type Tab = 'stock' | 'lifts' | 'orders' | 'activity' | 'vendors';
const TABS: Tab[] = ['stock', 'lifts', 'orders', 'activity', 'vendors'];
type Kind = 'all' | 'lifts' | 'components' | 'products' | 'used';
type Sub = { kind: 'adjust'; itemId: string } | { kind: 'po'; poId?: string; preset?: { vendorId?: string; itemIds?: string[] } };

const inKind = (it: Item, k: Kind) =>
  k === 'all' ? true : k === 'lifts' ? it.kind === 'lift' : k === 'components' ? it.kind === 'component' : k === 'products' ? it.kind === 'product' || it.kind === 'resale' : it.kind === 'used';

const orderAsNeeded = { label: 'Order as needed', tone: 'neutral' as const, icon: 'truck' as const };
const forSale = { label: 'For sale', tone: 'teal' as const, icon: 'tag' as const };
const sold = { label: 'Sold', tone: 'neutral' as const, icon: 'check' as const };

/** Stock badge: trade-ins read "For sale"/"Sold"; items with no reorder point and nothing free read "Order as needed". */
function statusMeta(it: Item) {
  if (it.kind === 'used') return available(it, SHOP) > 0 ? forSale : sold;
  const s = stockStatus(it, 'all');
  if (s === 'ok' && it.reorderPoint === 0 && available(it, SHOP) <= 0) return orderAsNeeded;
  return stockMeta[s];
}
const statusRank = (it: Item) => {
  const meta = statusMeta(it);
  return meta === stockMeta.out ? 0 : meta === stockMeta.low ? 1 : meta === stockMeta.ok ? 2 : 3;
};
const closedJob = new Set(['closed', 'completed', 'cancelled']);

function StockCell({ item }: { item: Item }) {
  const s = item.stock[SHOP];
  const extra = [s.reserved ? `${qtyLabel(item, s.reserved)} set aside` : '', s.display ? `${qtyLabel(item, s.display)} on display` : ''].filter(Boolean).join(' · ');
  return (
    <span class="inv-stock">
      <span>
        <strong class="tabular">{qtyLabel(item, s.onHand)}</strong> on hand
      </span>
      {extra && <span class="cell-sub">{extra}</span>}
    </span>
  );
}

function PriceCell({ item }: { item: Item }) {
  return (
    <span class="inv-price">
      <span class="tabular">{money(item.price, item.price % 1 !== 0)}</span>
      {item.publicPrice && <span class="cell-sub">On FiberSteel’s site</span>}
    </span>
  );
}

function RefLink({ refId, onOpenPO }: { refId?: string; onOpenPO: (id: string) => void }) {
  if (!refId) return <span class="muted">—</span>;
  if (refId.startsWith('J-')) return <Link to={`/office/jobs/?id=${refId}`}>{refId}</Link>;
  if (refId.startsWith('INV-')) return <Link to={`/office/accounting/?tab=invoices&id=${refId}`}>{refId}</Link>;
  if (refId.startsWith('DO-')) return <Link to={`/office/dealers/?tab=orders&id=${refId}`}>{refId}</Link>;
  if (refId.startsWith('PO-'))
    return (
      <button type="button" class="link-btn" onClick={() => onOpenPO(refId)}>
        {refId}
      </button>
    );
  return <span>{refId}</span>;
}

function Delta({ qty, item }: { qty: number; item?: Item }) {
  const label = item ? qtyLabel(item, Math.abs(qty)) : String(Math.abs(qty));
  return <span class={cx('inv-delta tabular', qty > 0 ? 'is-good' : 'is-bad')}>{qty > 0 ? `+${label}` : `−${label}`}</span>;
}

/** "In progress", "Starts tomorrow", "Starts Fri, Nov 13" or "Not scheduled yet" for the next of some builds */
function buildWhen(jobs: Job[]) {
  if (jobs.some((j) => j.status === 'in-progress')) return 'In progress';
  const next = jobs.filter((j) => j.start).sort((a, b) => (a.start! < b.start! ? -1 : 1))[0];
  if (!next?.start) return 'Not scheduled yet';
  const when = dayLabel(next.start);
  return `Starts ${/^(Today|Tomorrow|Yesterday)$/.test(when) ? when.toLowerCase() : when}`;
}

const usedInBuild = { label: 'Used in a build', tone: 'violet' as const, icon: 'hardhat' as const };

/** A movement's badge: components pulled for a shop build read as such */
function moveMetaFor(m: StockMove) {
  if (m.kind === 'job' && m.ref) {
    const job = db.value.jobs.find((j) => j.id === m.ref);
    if (job?.type === 'build') return usedInBuild;
  }
  return moveMeta[m.kind];
}

/** Who a job is for: the customer, or the dealer on a dealer order */
function jobFor(job: Job) {
  const d = db.value;
  const order = job.dealerOrderId ? d.dealerOrders.find((o) => o.id === job.dealerOrderId) : undefined;
  if (order) return `${dealerOf(d, order.dealerId)?.name ?? 'Dealer'} · ${order.id}`;
  return customerOf(d, job.customerId)?.name ?? 'Customer';
}

/* ---------- Stock tab ---------- */

function StockTab({ onOpen }: { onOpen: (id: string) => void }) {
  const d = db.value;
  const params = route.value.params;
  const kindParam = (params.get('kind') ?? 'all') as Kind;
  const filterParam = params.get('filter') ?? '';
  const stockFilter = filterParam === 'low' || filterParam === 'out' ? filterParam : '';
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  const categories = [...new Set(d.items.filter((it) => inKind(it, kindParam)).map((i) => i.category))];
  const term = q.trim().toLowerCase();
  const rows = d.items.filter((it) => {
    if (!inKind(it, kindParam)) return false;
    if (category && it.category !== category) return false;
    if (stockFilter) {
      const s = stockStatus(it, 'all');
      if (stockFilter === 'out' ? s !== 'out' : s !== 'low' && s !== 'out') return false;
    }
    return !term || it.name.toLowerCase().includes(term) || it.brand.toLowerCase().includes(term) || it.id.toLowerCase().includes(term) || it.category.toLowerCase().includes(term);
  });

  const setKind = (k: Kind) => {
    setCategory('');
    setParams({ kind: k === 'all' ? undefined : k, filter: stockFilter || undefined }, { replace: true });
  };
  const toggleLow = () => setParams({ filter: stockFilter ? undefined : 'low', kind: kindParam === 'all' ? undefined : kindParam }, { replace: true });
  const clear = () => {
    setQ('');
    setCategory('');
    setParams({ filter: undefined, kind: undefined }, { replace: true });
  };

  const columns: Column<Item>[] = [
    {
      key: 'product',
      label: 'Item',
      sortValue: (it) => itemLabel(it).toLowerCase(),
      render: (it) => (
        <div class="item-cell">
          <Thumb item={it} />
          <span class="inv-product">
            <button type="button" class="inv-link" onClick={() => onOpen(it.id)}>
              {itemLabel(it)}
            </button>
            <span class="cell-sub">
              {it.id} · {it.category}
              {it.brand !== 'FiberSteel' ? ` · ${it.brand}` : ''}
            </span>
          </span>
        </div>
      ),
    },
    { key: 'onhand', label: 'On hand', sortValue: (it) => it.stock[SHOP].onHand, render: (it) => <StockCell item={it} /> },
    {
      key: 'available',
      label: 'Available',
      align: 'right',
      sortValue: (it) => available(it, SHOP),
      render: (it) => {
        const a = available(it, SHOP);
        return <span class={cx('tabular', a < 0 && 'is-bad')}>{a < 0 ? `${qtyLabel(it, Math.abs(a))} short` : qtyLabel(it, a)}</span>;
      },
    },
    {
      key: 'reorder',
      label: 'Reorder point',
      align: 'right',
      hide: 'sm',
      sortValue: (it) => it.reorderPoint,
      render: (it) => (it.buildToOrder || it.kind === 'used' ? <span class="muted">—</span> : <span class="tabular">{qtyLabel(it, it.reorderPoint)}</span>),
    },
    { key: 'status', label: 'Status', sortValue: statusRank, render: (it) => <StatusBadge meta={statusMeta(it)} /> },
    { key: 'price', label: 'Price', align: 'right', hide: 'sm', sortValue: (it) => it.price, render: (it) => <PriceCell item={it} /> },
  ];

  const filtered = !!(term || category || stockFilter || kindParam !== 'all');

  return (
    <>
      <div class="toolbar">
        <SearchInput value={q} onInput={setQ} label="Search inventory" placeholder="Search name, category or SKU" />
        <label class="inv-select">
          <span class="sr-only">Category</span>
          <select class="select" value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Chips<Kind>
          label="Item type"
          value={kindParam}
          onChange={setKind}
          items={[
            { key: 'all', label: 'All' },
            { key: 'lifts', label: 'Lifts' },
            { key: 'components', label: 'Components' },
            { key: 'products', label: 'Products' },
            { key: 'used', label: 'Used lifts' },
          ]}
        />
        <button type="button" class="chip" aria-pressed={!!stockFilter} onClick={toggleLow}>
          <Icon name="alert" size={14} /> {stockFilter === 'out' ? 'Out of stock' : 'Low stock'}
        </button>
        <span class="toolbar__spacer" />
        <span class="muted small" aria-live="polite">
          {plural(rows.length, 'item')}
        </span>
      </div>
      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(it) => it.id}
          caption="Inventory items"
          onRowClick={(it) => onOpen(it.id)}
          pageSize={30}
          rowClass={(it) => (stockStatus(it, 'all') === 'out' ? 'inv-row--out' : undefined)}
          empty={
            <EmptyState icon="box" title="No items match" action={filtered ? <Button onClick={clear}>Clear filters</Button> : undefined}>
              Try a different search or filter.
            </EmptyState>
          }
        />
      </Card>
      <p class="acct-footnote inv-footnote">
        Prices marked “On FiberSteel’s site” are the ones the current site shows. Every other price, every cost and every stock count is sample data for the demo.
      </p>
    </>
  );
}

/* ---------- Item drawer ---------- */

function ReorderEditor({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false);
  const [point, setPoint] = useState(String(item.reorderPoint));
  const [qty, setQty] = useState(String(item.reorderQty));
  const p = Math.floor(Number(point));
  const n = Math.floor(Number(qty));
  const valid = point.trim() !== '' && qty.trim() !== '' && p >= 0 && n >= 0;

  if (!editing) {
    return (
      <div class="inv-reorder">
        <span>
          Reorder at <strong>{qtyLabel(item, item.reorderPoint)}</strong> · order <strong>{qtyLabel(item, item.reorderQty)}</strong>
        </span>
        <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)} aria-label={`Edit the reorder point for ${itemLabel(item)}`}>
          Edit
        </Button>
      </div>
    );
  }
  return (
    <form
      class="inv-reorder inv-reorder--edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        updateItem(item.id, { reorderPoint: p, reorderQty: n });
        toast(`${itemLabel(item)}: reorder at ${qtyLabel(item, p)}, order ${qtyLabel(item, n)}`, { tone: 'success' });
        setEditing(false);
      }}
    >
      <Field label="Reorder at">
        <input class="input input--sm inv-qty inv-qty--sm" type="number" inputMode="numeric" min={0} step={1} value={point} data-autofocus onInput={(e) => setPoint((e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Order quantity">
        <input class="input input--sm inv-qty inv-qty--sm" type="number" inputMode="numeric" min={0} step={1} value={qty} onInput={(e) => setQty((e.target as HTMLInputElement).value)} />
      </Field>
      <div class="inv-reorder__actions">
        <Button size="sm" variant="primary" type="submit" disabled={!valid}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPoint(String(item.reorderPoint));
            setQty(String(item.reorderQty));
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function BomTable({ item, onOpenItem }: { item: Item; onOpenItem: (id: string) => void }) {
  const d = db.value;
  const cap = buildCapacity(d, item);
  if (!cap.lines.length) return <p class="muted">No bill of materials on file.</p>;
  return (
    <>
      <p class="inv-cap">
        <Icon name="hardhat" size={16} />
        <span>
          {cap.canBuild > 0 ? (
            <>
              Enough free stock to build <strong>{plural(cap.canBuild, 'lift')}</strong> now
            </>
          ) : (
            <strong>Not enough free stock to build one now</strong>
          )}
          {cap.limiting && (
            <span class="muted">
              {' '}
              — {itemLabel(cap.limiting.item)} runs out first ({qtyLabel(cap.limiting.item, cap.limiting.available)} free, {qtyLabel(cap.limiting.item, cap.limiting.perLift)} per lift)
            </span>
          )}
        </span>
      </p>
      <div class="table-wrap">
        <table class="table table--dense inv-bom">
          <caption class="sr-only">What it takes to build one {itemLabel(item)}</caption>
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col" class="is-right">
                Per lift
              </th>
              <th scope="col" class="is-right">
                Free now
              </th>
              <th scope="col" class="is-right">
                Enough for
              </th>
            </tr>
          </thead>
          <tbody>
            {cap.lines.map((l) => (
              <tr key={l.item.id} class={l.item.id === cap.limiting?.item.id ? 'inv-bom__limit' : undefined}>
                <td>
                  <button type="button" class="inv-link" onClick={() => onOpenItem(l.item.id)}>
                    {itemLabel(l.item)}
                  </button>
                  <span class="cell-sub">{l.item.id}</span>
                </td>
                <td class="is-right tabular">{qtyLabel(l.item, l.perLift)}</td>
                <td class="is-right tabular">{qtyLabel(l.item, l.available)}</td>
                <td class="is-right tabular">
                  {l.item.id === cap.limiting?.item.id && <span class="sr-only">Runs out first: </span>}
                  {plural(l.enoughFor, 'lift')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">A sample bill of materials — FiberSteel’s shop would set the real ones.</p>
    </>
  );
}

function ItemDrawer({ item, onClose, onAction, onOpenPO, onOpenItem }: { item: Item; onClose: () => void; onAction: (s: Sub) => void; onOpenPO: (id: string) => void; onOpenItem: (id: string) => void }) {
  const d = db.value;
  const vendor = d.vendors.find((v) => v.id === item.vendorId);
  const margin = item.price ? (item.price - item.cost) / item.price : 0;
  const level = item.stock[SHOP];
  const a = available(item, SHOP);
  const incoming = onOrder(d, item.id);
  const reservedFor = d.jobs
    .filter((j) => !closedJob.has(j.status))
    .flatMap((j) => j.parts.filter((p) => p.itemId === item.id && p.status === 'reserved').map((p) => ({ job: j, part: p })))
    .sort((x, y) => ((x.job.start ?? '9') < (y.job.start ?? '9') ? -1 : 1));
  const openPOs = d.pos.filter((p) => isOpenPO(p) && p.lines.some((l) => l.itemId === item.id && l.received < l.qty));
  const moves = d.moves.filter((m) => m.itemId === item.id).slice(0, 12);
  const builds = item.kind === 'lift' ? openBuildsFor(d, item.id) : undefined;
  const uses = item.kind === 'component' ? usedIn(d, item.id) : [];
  const soldBy = item.uom === 'ea' ? 'Each' : item.uom === 'ft' ? 'The foot' : 'The set';

  return (
    <Dialog drawer size="lg" title={itemLabel(item)} description={`${item.id} · ${item.category}`} onClose={onClose} headerExtra={<StatusBadge meta={statusMeta(item)} />}>
      <div class="inv-head">
        <Thumb item={item} size={72} />
        <Details
          columns={2}
          items={[
            ['Brand', item.brand],
            ['Type', kindLabel[item.kind]],
            ['Comes from', isShopBuilt(item) ? (item.kind === 'used' ? 'Taken in on trade (sample)' : 'Built in the FiberSteel shop') : vendor ? `${vendor.name} · ${vendor.terms}` : '—'],
            ['Sold by', soldBy],
            ...(item.capacity && (item.kind === 'lift' || item.kind === 'used') ? ([['Rated lift', `${number(item.capacity)} lb`]] as [string, string][]) : []),
            ...(item.kind === 'lift' ? ([['Stocking', item.buildToOrder ? 'Built to order' : 'Kept in stock']] as [string, string][]) : []),
          ]}
        />
      </div>

      <div class="inv-money">
        <div>
          <span class="inv-money__label">Price</span>
          <span class="inv-money__value">{money(item.price, item.price % 1 !== 0)}</span>
        </div>
        <div>
          <span class="inv-money__label">Cost</span>
          <span class="inv-money__value">{money(item.cost, item.cost % 1 !== 0)}</span>
        </div>
        <div>
          <span class="inv-money__label">Margin</span>
          <span class="inv-money__value">{percent(margin)}</span>
        </div>
      </div>
      <p class="muted small inv-money__note">{item.publicPrice ? 'The price is the one FiberSteel’s current site shows; the cost is a sample.' : 'Sample price and cost for the demo.'}</p>

      <h3 class="section-label">Stock at the {SHOP_NAME}</h3>
      <section class="inv-store" aria-label={`Stock at the ${SHOP_NAME}`}>
        <p class="inv-store__avail">
          {a < 0 ? (
            <strong class="is-bad">{qtyLabel(item, Math.abs(a))} short</strong>
          ) : (
            <>
              <strong>{qtyLabel(item, a)}</strong> free to use or sell
            </>
          )}
        </p>
        <dl class="inv-store__dl">
          <div>
            <dt>On hand</dt>
            <dd>{qtyLabel(item, level.onHand)}</dd>
          </div>
          <div>
            <dt>Set aside for jobs & builds</dt>
            <dd>{qtyLabel(item, level.reserved)}</dd>
          </div>
          <div>
            <dt>On display</dt>
            <dd>{qtyLabel(item, level.display)}</dd>
          </div>
          {incoming > 0 && (
            <div>
              <dt>On order</dt>
              <dd>{qtyLabel(item, incoming)}</dd>
            </div>
          )}
          {builds && builds.qty > 0 && (
            <div>
              <dt>Being built</dt>
              <dd>{plural(builds.qty, 'lift')}</dd>
            </div>
          )}
        </dl>
        {orderable(item) && !item.buildToOrder && <ReorderEditor item={item} />}
        <div class="inv-store__actions">
          <Button size="sm" icon="edit" onClick={() => onAction({ kind: 'adjust', itemId: item.id })}>
            Adjust count
          </Button>
          {orderable(item) && (
            <Button size="sm" icon="plus" onClick={() => onAction({ kind: 'po', preset: { vendorId: item.vendorId, itemIds: [item.id] } })}>
              Reorder
            </Button>
          )}
        </div>
        {isShopBuilt(item) && item.kind !== 'used' && <p class="muted small">Built in the shop: new stock comes from shop builds on the jobs board, not purchase orders.</p>}
      </section>

      {item.kind === 'lift' && (
        <>
          <h3 class="section-label">What it takes to build one</h3>
          <BomTable item={item} onOpenItem={onOpenItem} />
        </>
      )}

      {uses.length > 0 && (
        <>
          <h3 class="section-label">Used in</h3>
          <ul class="inv-chips" role="list">
            {uses.map((u) => (
              <li key={u.lift.id}>
                <button type="button" class="chip" onClick={() => onOpenItem(u.lift.id)}>
                  {itemLabel(u.lift)} <span class="muted">· {qtyLabel(item, u.perLift)} per lift</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {builds && builds.jobs.length > 0 && (
        <>
          <h3 class="section-label">Shop builds coming up</h3>
          <ul class="inv-list" role="list">
            {builds.jobs.map((j) => (
              <li key={j.id}>
                <Link to={`/office/jobs/?id=${j.id}`} class="inv-list__row">
                  <span class="inv-list__main">
                    <span class="inv-list__title">
                      {j.id} · {plural(j.qty ?? 1, 'lift')}
                    </span>
                    <span class="cell-sub">
                      {jobFor(j)} · {buildWhen([j])}
                    </span>
                  </span>
                  <span class="inv-list__meta">
                    <StatusBadge meta={jobStatusOf(j)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 class="section-label">Set aside for jobs</h3>
      {reservedFor.length === 0 ? (
        <p class="muted">Nothing set aside right now.</p>
      ) : (
        <ul class="inv-list" role="list">
          {reservedFor.map(({ job, part }, i) => (
            <li key={`${job.id}-${i}`}>
              <Link to={`/office/jobs/?id=${job.id}`} class="inv-list__row">
                <span class="inv-list__main">
                  <span class="inv-list__title">
                    {job.id} · {job.title}
                  </span>
                  <span class="cell-sub">
                    {jobFor(job)} · {job.start ? dayLabel(job.start) : 'Not scheduled yet'}
                  </span>
                </span>
                <span class="inv-list__meta">{qtyLabel(item, part.qty)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {orderable(item) && (
        <>
          <h3 class="section-label">On order</h3>
          {openPOs.length === 0 ? (
            <p class="muted">Not on any open purchase order.</p>
          ) : (
            <ul class="inv-list" role="list">
              {openPOs.map((p) => {
                const line = p.lines.find((l) => l.itemId === item.id)!;
                return (
                  <li key={p.id}>
                    <button type="button" class="inv-list__row" onClick={() => onOpenPO(p.id)}>
                      <span class="inv-list__main">
                        <span class="inv-list__title">
                          {p.id} · {d.vendors.find((v) => v.id === p.vendorId)?.name}
                        </span>
                        <span class="cell-sub">
                          {poStatusMeta[p.status].label}
                          {p.expectedOn ? ` · expected ${shortDate(p.expectedOn)}` : ''}
                        </span>
                      </span>
                      <span class="inv-list__meta">{qtyLabel(item, line.qty - line.received)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <h3 class="section-label">Recent movements</h3>
      {moves.length === 0 ? (
        <p class="muted">No stock movements in the last five weeks.</p>
      ) : (
        <div class="table-wrap">
          <table class="table table--dense inv-moves">
            <caption class="sr-only">Recent stock movements for {itemLabel(item)}</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col" class="is-right">
                  Change
                </th>
                <th scope="col">Type</th>
                <th scope="col" class="hide-sm">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td class="nowrap">
                    {shortDate(m.at)}
                    <span class="cell-sub">
                      {time(m.at)} · {firstName(d, m.by)}
                    </span>
                  </td>
                  <td class="is-right">
                    <Delta qty={m.qty} item={item} />
                  </td>
                  <td>
                    <StatusBadge meta={moveMetaFor(m)} />
                    {m.note && <span class="cell-sub">{m.note}</span>}
                  </td>
                  <td class="hide-sm">
                    <RefLink refId={m.ref} onOpenPO={onOpenPO} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}

/* ---------- Lifts & builds tab ---------- */

function LiftsTab({ onOpenItem, onAction }: { onOpenItem: (id: string) => void; onAction: (s: Sub) => void }) {
  const d = db.value;
  const lifts = d.items.filter((it) => it.kind === 'lift');
  const builds = d.jobs.filter(isOpenBuild).sort((a, b) => ((a.start ?? '9') < (b.start ?? '9') ? -1 : 1));
  const short = d.items
    .filter((it) => it.kind === 'component' && available(it, SHOP) < 0)
    .map((it) => ({ it, short: -available(it, SHOP), incoming: onOrder(d, it.id) }))
    .sort((a, b) => b.short - a.short);

  const columns: Column<Item>[] = [
    {
      key: 'lift',
      label: 'Lift',
      sortValue: (it) => it.capacity ?? 0,
      render: (it) => (
        <div class="item-cell">
          <Thumb item={it} />
          <span class="inv-product">
            <button type="button" class="inv-link" onClick={() => onOpenItem(it.id)}>
              {itemLabel(it)}
            </button>
            <span class="cell-sub">
              {it.id} · {it.buildToOrder ? 'Built to order' : 'Kept in stock'}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'finished',
      label: 'Finished lifts',
      sortValue: (it) => it.stock[SHOP].onHand,
      render: (it) => {
        const s = it.stock[SHOP];
        const extra = [s.reserved ? `${s.reserved} set aside` : '', s.display ? `${s.display} on display` : ''].filter(Boolean).join(' · ');
        return (
          <span class="inv-stock">
            <span>
              <strong class="tabular">{s.onHand}</strong> in the yard
            </span>
            {extra && <span class="cell-sub">{extra}</span>}
          </span>
        );
      },
    },
    {
      key: 'can',
      label: 'Could build now',
      sortValue: (it) => buildCapacity(d, it).canBuild,
      render: (it) => {
        const cap = buildCapacity(d, it);
        return (
          <span class="inv-stock">
            <strong class={cx('tabular', cap.canBuild === 0 && 'is-bad')}>{plural(cap.canBuild, 'lift')}</strong>
            {cap.limiting && <span class="cell-sub">Limited by: {itemLabel(cap.limiting.item)}</span>}
          </span>
        );
      },
    },
    {
      key: 'builds',
      label: 'In the shop',
      sortValue: (it) => openBuildsFor(d, it.id).qty,
      render: (it) => {
        const b = openBuildsFor(d, it.id);
        if (!b.qty) return <span class="muted">—</span>;
        return (
          <span class="inv-stock">
            <span class="tabular">{plural(b.qty, 'lift')}</span>
            <span class="cell-sub">{buildWhen(b.jobs)}</span>
          </span>
        );
      },
    },
    { key: 'price', label: 'List price', align: 'right', hide: 'sm', sortValue: (it) => it.price, render: (it) => <span class="tabular">{money(it.price, false)}</span> },
  ];

  return (
    <div class="stack">
      <p class="muted inv-intro">Each lift on the public site, what the shop could build from free stock today, and the builds that are coming up. Bills of materials, prices and counts are sample data.</p>
      <Card flush>
        <DataTable rows={lifts} columns={columns} rowKey={(it) => it.id} caption="Lifts and what the shop could build" onRowClick={(it) => onOpenItem(it.id)} initialSort={{ key: 'lift', dir: 'asc' }} />
      </Card>

      <div class="inv-two">
        <Card title="Shop builds coming up" subtitle={builds.length ? `${plural(builds.length, 'build')} · ${plural(builds.reduce((s, j) => s + (j.qty ?? 1), 0), 'lift')}` : 'Nothing waiting in the shop'} flush>
          {builds.length === 0 ? (
            <EmptyState icon="hardhat" title="No open builds" />
          ) : (
            <ul class="inv-list inv-list--card" role="list">
              {builds.slice(0, 10).map((j) => {
                const it = itemOf(d, j.itemId);
                const crew = j.crew.map((id) => d.staff.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
                return (
                  <li key={j.id}>
                    <Link to={`/office/jobs/?id=${j.id}`} class="inv-list__row">
                      <span class="inv-list__main">
                        <span class="inv-list__title">
                          {(j.qty ?? 1) > 1 ? `${j.qty} × ` : ''}
                          {it ? itemLabel(it) : j.title}
                        </span>
                        <span class="cell-sub">
                          {j.id} · {jobFor(j)} · {j.start ? dayLabel(j.start) : 'Not scheduled yet'}
                        </span>
                      </span>
                      <span class="inv-list__meta inv-list__meta--stack">
                        <StatusBadge meta={jobStatusOf(j)} />
                        {crew.length > 0 && <AvatarStack people={crew} size={22} />}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Short for scheduled work" subtitle={short.length ? 'More is set aside for builds and jobs than is on hand' : 'Every build and job has its parts'} flush>
          {short.length === 0 ? (
            <EmptyState icon="check-circle" title="Nothing short" />
          ) : (
            <ul class="inv-list inv-list--card" role="list">
              {short.map(({ it, short: n, incoming }) => (
                <li key={it.id} class="inv-short">
                  <button type="button" class="inv-list__row" onClick={() => onOpenItem(it.id)}>
                    <span class="inv-list__main">
                      <span class="inv-list__title">{itemLabel(it)}</span>
                      <span class="cell-sub">
                        <span class="is-bad">{qtyLabel(it, n)} short</span>
                        {incoming ? ` · ${qtyLabel(it, incoming)} on order` : ' · nothing on order'}
                      </span>
                    </span>
                  </button>
                  {orderable(it) && (
                    <Button size="sm" icon="plus" onClick={() => onAction({ kind: 'po', preset: { vendorId: it.vendorId, itemIds: [it.id] } })} aria-label={`Order ${itemLabel(it)}`}>
                      Order
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Orders tab ---------- */

type POFilter = 'open' | 'received' | 'cancelled' | 'all';

function OrdersTab({ onOpenPO, onOpenItem }: { onOpenPO: (id: string) => void; onOpenItem: (id: string) => void }) {
  const d = db.value;
  const [filter, setFilter] = useState<POFilter>('open');
  const t = today();
  const pos = d.pos;
  const counts: Record<POFilter, number> = {
    open: pos.filter(isOpenPO).length,
    received: pos.filter((p) => p.status === 'received').length,
    cancelled: pos.filter((p) => p.status === 'cancelled').length,
    all: pos.length,
  };
  const rows = pos.filter((p) => filter === 'all' || (filter === 'open' ? isOpenPO(p) : p.status === filter));
  const suggestions = reorderSuggestions(d);
  const vendorName = (id: string) => d.vendors.find((v) => v.id === id)?.name ?? id;

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po',
      label: 'Order',
      sortValue: (p) => p.id,
      render: (p) => (
        <>
          <button type="button" class="inv-link" onClick={() => onOpenPO(p.id)}>
            {p.id}
          </button>
          <span class="cell-sub">{vendorName(p.vendorId)}</span>
        </>
      ),
    },
    { key: 'status', label: 'Status', sortValue: (p) => p.status, render: (p) => <StatusBadge meta={poStatusMeta[p.status]} /> },
    { key: 'created', label: 'Created', hide: 'md', sortValue: (p) => p.createdAt, render: (p) => <span class="nowrap">{shortDate(p.createdAt)}</span> },
    {
      key: 'expected',
      label: 'Expected',
      sortValue: (p) => p.expectedOn ?? '',
      render: (p) => {
        if (p.status === 'received') return <span class="muted nowrap">Received {p.receivedOn ? shortDate(p.receivedOn) : ''}</span>;
        if (!p.expectedOn || p.status === 'cancelled' || p.status === 'draft') return <span class="muted">—</span>;
        const late = p.expectedOn < t;
        return (
          <span class={cx('nowrap inv-inline', late && 'is-bad')}>
            {late && <Icon name="alert" size={13} />}
            {shortDate(p.expectedOn)}
            {late ? ' · late' : ''}
          </span>
        );
      },
    },
    { key: 'lines', label: 'Lines', align: 'right', hide: 'sm', sortValue: (p) => p.lines.length, render: (p) => <span class="tabular">{p.lines.length}</span> },
    { key: 'total', label: 'Total', align: 'right', sortValue: poTotal, render: (p) => <span class="tabular">{money(poTotal(p))}</span> },
    {
      key: 'received',
      label: 'Received',
      hide: 'sm',
      sortValue: (p) => poReceivedQty(p) / Math.max(1, poOrderedQty(p)),
      render: (p) => (
        <span class="inv-progress">
          <Meter value={poReceivedQty(p)} max={poOrderedQty(p)} tone={p.status === 'received' ? 'green' : 'accent'} label={`${poReceivedQty(p)} of ${poOrderedQty(p)} received`} />
          <span class="cell-sub tabular">
            {poReceivedQty(p)} of {poOrderedQty(p)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div class="stack">
      {suggestions.length > 0 && (
        <Card title="Suggested reorders" subtitle="Components and resale stock below their reorder point that aren’t on an order yet. Each group becomes one draft order.">
          <ul class="inv-suggest" role="list">
            {suggestions.map((g) => (
              <li key={g.vendorId} class="inv-suggest__group">
                <div class="inv-suggest__head">
                  <div>
                    <p class="inv-suggest__vendor">{vendorName(g.vendorId)}</p>
                    <p class="muted small">{plural(g.lines.length, 'item')}</p>
                  </div>
                  <Button
                    size="sm"
                    icon="file"
                    onClick={() => {
                      const id = createPO({ vendorId: g.vendorId, lines: g.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })), notes: 'Suggested from low-stock alerts.' });
                      toast(`Draft ${id} created for ${vendorName(g.vendorId)}`, { tone: 'success' });
                      onOpenPO(id);
                    }}
                  >
                    Create draft order
                  </Button>
                </div>
                <ul class="inv-suggest__items" role="list">
                  {g.lines.map((l) => {
                    const it = itemOf(d, l.itemId)!;
                    return (
                      <li key={l.itemId}>
                        <button type="button" class="link-btn inv-suggest__item" onClick={() => onOpenItem(it.id)}>
                          {itemLabel(it)}
                        </button>
                        <span class="muted small">
                          {l.available < 0 ? `${qtyLabel(it, -l.available)} short` : `${qtyLabel(it, l.available)} free`} · reorder at {qtyLabel(it, it.reorderPoint)} · order {qtyLabel(it, l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div class="toolbar">
        <Chips<POFilter>
          label="Order status"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'open', label: 'Open', count: counts.open },
            { key: 'received', label: 'Received', count: counts.received },
            { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            { key: 'all', label: 'All', count: counts.all },
          ]}
        />
      </div>
      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          caption="Purchase orders"
          onRowClick={(p) => onOpenPO(p.id)}
          initialSort={{ key: 'created', dir: 'desc' }}
          empty={<EmptyState icon="file" title={filter === 'open' ? 'No open purchase orders' : 'No purchase orders here'} />}
        />
      </Card>
    </div>
  );
}

/* ---------- Purchase order drawer ---------- */

const toInt = (v: string | undefined) => (v === undefined || v.trim() === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0));

function PODrawer({ po, onClose, onEdit, onOpenItem }: { po: PurchaseOrder; onClose: () => void; onEdit: () => void; onOpenItem: (id: string) => void }) {
  const d = db.value;
  const vendor = d.vendors.find((v) => v.id === po.vendorId);
  const [receiving, setReceiving] = useState(false);
  const remaining = (p: PurchaseOrder) => Object.fromEntries(p.lines.map((l) => [l.itemId, String(Math.max(0, l.qty - l.received))]));
  const [qtys, setQtys] = useState<Record<string, string>>(() => remaining(po));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const bills = d.bills.filter((b) => b.poId === po.id);
  const outstanding = poOutstanding(po);
  const late = !!po.expectedOn && po.expectedOn < today() && (po.status === 'ordered' || po.status === 'partial');
  const selectedQty = po.lines.reduce((s, l) => s + Math.min(Math.max(0, l.qty - l.received), toInt(qtys[l.itemId])), 0);

  const receive = (all: boolean) => {
    const before = poReceivedQty(po);
    receivePO(po.id, all ? undefined : Object.fromEntries(po.lines.map((l) => [l.itemId, toInt(qtys[l.itemId])])));
    const after = db.value.pos.find((p) => p.id === po.id)!;
    const n = poReceivedQty(after) - before;
    const bill = db.value.bills.find((b) => b.poId === po.id);
    toast(`Received ${plural(n, 'item')} into stock${bill ? ` — bill ${bill.id} is waiting in Accounting` : ''}`, { tone: 'success' });
    setQtys(remaining(after));
    setReceiving(false);
  };

  const footer =
    po.status === 'draft' ? (
      <>
        <Button variant="ghost" icon="x-circle" onClick={() => setConfirmCancel(true)}>
          Cancel order
        </Button>
        <span class="spacer" />
        <Button icon="edit" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="primary"
          icon="send"
          onClick={() => {
            orderPO(po.id);
            toast(`${po.id} placed with ${vendor?.name ?? 'the vendor'} (simulated)`, { tone: 'success' });
          }}
        >
          Place order
        </Button>
      </>
    ) : (po.status === 'ordered' || po.status === 'partial') && !receiving ? (
      <>
        <Button variant="ghost" icon="x-circle" onClick={() => setConfirmCancel(true)}>
          Cancel order
        </Button>
        <span class="spacer" />
        <Button variant="primary" icon="download" onClick={() => setReceiving(true)}>
          Receive items
        </Button>
      </>
    ) : receiving ? (
      <>
        <Button variant="ghost" onClick={() => setReceiving(false)}>
          Back
        </Button>
        <span class="spacer" />
        <Button disabled={selectedQty === 0} onClick={() => receive(false)}>
          Receive {selectedQty ? plural(selectedQty, 'item') : 'selected'}
        </Button>
        <Button variant="primary" icon="check" onClick={() => receive(true)}>
          Receive all {outstanding}
        </Button>
      </>
    ) : undefined;

  return (
    <>
      <Dialog
        drawer
        size="lg"
        title={`${po.id} · ${vendor?.name ?? 'Vendor'}`}
        description={`Deliver to the ${SHOP_NAME} · created ${shortDate(po.createdAt)} by ${firstName(d, po.createdBy)}`}
        onClose={onClose}
        headerExtra={<StatusBadge meta={poStatusMeta[po.status]} />}
        footer={footer}
      >
        <div class="stack">
          {receiving && (
            <div class="callout callout--blue" role="status">
              <Icon name="info" size={18} />
              <div>
                <p class="callout__title">Check in what arrived</p>
                <p class="callout__text">Set how many of each line came in. Stock goes up right away and the vendor’s bill lands in Accounting for what you received.</p>
              </div>
            </div>
          )}
          <Details
            columns={2}
            items={[
              ['Vendor', vendor ? `${vendor.name} · ${vendor.terms}` : '—'],
              ['Deliver to', SHOP_NAME],
              ['Ordered', po.orderedOn ? shortDate(po.orderedOn) : 'Not yet'],
              ['Expected', po.expectedOn ? <span class={late ? 'is-bad' : undefined}>{`${shortDate(po.expectedOn)}${late ? ' · late' : ''}`}</span> : '—'],
              ['Received', po.receivedOn ? shortDate(po.receivedOn) : po.status === 'partial' ? `${poReceivedQty(po)} of ${poOrderedQty(po)} so far` : '—'],
              ['Total', money(poTotal(po))],
            ]}
          />
          {po.status !== 'draft' && po.status !== 'cancelled' && (
            <div class="inv-progress inv-progress--wide">
              <Meter value={poReceivedQty(po)} max={poOrderedQty(po)} tone={po.status === 'received' ? 'green' : 'accent'} label={`${poReceivedQty(po)} of ${poOrderedQty(po)} items received`} />
              <span class="muted small">
                {poReceivedQty(po)} of {poOrderedQty(po)} items received
              </span>
            </div>
          )}

          <div class="table-wrap">
            <table class="table table--dense inv-po-lines">
              <caption class="sr-only">Lines on {po.id}</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="is-right">
                    Ordered
                  </th>
                  <th scope="col" class="is-right">
                    Received
                  </th>
                  {receiving && (
                    <th scope="col" class="is-right">
                      Receive now
                    </th>
                  )}
                  <th scope="col" class="is-right hide-sm">
                    Cost
                  </th>
                  <th scope="col" class="is-right">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => {
                  const it = itemOf(d, l.itemId)!;
                  const left = Math.max(0, l.qty - l.received);
                  return (
                    <tr key={l.itemId}>
                      <td>
                        <button type="button" class="inv-link" onClick={() => onOpenItem(it.id)}>
                          {itemLabel(it)}
                        </button>
                        <span class="cell-sub">{it.id}</span>
                      </td>
                      <td class="is-right tabular">{qtyLabel(it, l.qty)}</td>
                      <td class="is-right tabular">
                        {l.received >= l.qty ? (
                          <span class="is-good inv-inline">
                            <Icon name="check" size={13} /> {qtyLabel(it, l.received)}
                          </span>
                        ) : (
                          qtyLabel(it, l.received)
                        )}
                      </td>
                      {receiving && (
                        <td class="is-right">
                          {left > 0 ? (
                            <input
                              class="input input--sm inv-qty inv-qty--sm"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={left}
                              step={1}
                              value={qtys[l.itemId] ?? ''}
                              aria-label={`Quantity of ${itemLabel(it)} received now (up to ${left})`}
                              onInput={(e) => setQtys({ ...qtys, [l.itemId]: (e.target as HTMLInputElement).value })}
                            />
                          ) : (
                            <span class="muted small">Done</span>
                          )}
                        </td>
                      )}
                      <td class="is-right tabular hide-sm">{money(l.cost)}</td>
                      <td class="is-right tabular">{money(l.qty * l.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {po.notes && (
            <div>
              <h3 class="section-label">Notes</h3>
              <p>{po.notes}</p>
            </div>
          )}

          {bills.length > 0 && (
            <div>
              <h3 class="section-label">Vendor bills</h3>
              <ul class="inv-list" role="list">
                {bills.map((b) => (
                  <li key={b.id}>
                    <Link to="/office/accounting/?tab=bills" class="inv-list__row">
                      <span class="inv-list__main">
                        <span class="inv-list__title">
                          {b.id} · {b.number}
                        </span>
                        <span class="cell-sub">
                          Due {shortDate(b.dueOn)} · {b.status === 'paid' ? `paid ${b.paidOn ? shortDate(b.paidOn) : ''}` : b.status === 'scheduled' ? 'payment scheduled' : 'open'}
                        </span>
                      </span>
                      <span class="inv-list__meta tabular">{money(b.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
      {confirmCancel && (
        <Dialog
          title={`Cancel ${po.id}?`}
          size="sm"
          class="inv-dialog"
          onClose={() => setConfirmCancel(false)}
          footer={
            <>
              <Button onClick={() => setConfirmCancel(false)}>Keep order</Button>
              <Button
                variant="danger"
                data-autofocus
                onClick={() => {
                  updatePO(po.id, { status: 'cancelled' });
                  setConfirmCancel(false);
                  toast(`${po.id} cancelled`);
                }}
              >
                Cancel order
              </Button>
            </>
          }
        >
          <p>
            {poReceivedQty(po) > 0
              ? `Items already received stay in stock. The remaining ${plural(outstanding, 'item')} won’t be expected anymore.`
              : `${vendor?.name ?? 'The vendor'} won’t be expecting this order. You can always start a new one.`}
          </p>
        </Dialog>
      )}
    </>
  );
}

/* ---------- Activity tab ---------- */

type MoveFilter = 'all' | StockMove['kind'];

function ActivityTab({ onOpenItem, onOpenPO }: { onOpenItem: (id: string) => void; onOpenPO: (id: string) => void }) {
  const d = db.value;
  const [kind, setKind] = useState<MoveFilter>('all');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = d.moves.filter((m) => {
    if (kind !== 'all' && m.kind !== kind) return false;
    if (!term) return true;
    const it = itemOf(d, m.itemId);
    return m.itemId.toLowerCase().includes(term) || (it && itemLabel(it).toLowerCase().includes(term)) || (m.ref ?? '').toLowerCase().includes(term) || (m.note ?? '').toLowerCase().includes(term);
  });

  const exportCsv = () => {
    downloadCsv(`fibersteel-stock-activity-${today()}.csv`, [
      ['Date', 'Time', 'SKU', 'Item', 'Change', 'Type', 'Reference', 'By', 'Note'],
      ...rows.map((m) => {
        const it = itemOf(d, m.itemId);
        return [m.at.slice(0, 10), m.at.slice(11, 16), m.itemId, it ? itemLabel(it) : '', m.qty, moveMetaFor(m).label, m.ref ?? '', firstName(d, m.by), m.note ?? ''];
      }),
    ]);
    toast(`Downloaded ${plural(rows.length, 'movement')} as CSV`);
  };

  const columns: Column<StockMove>[] = [
    {
      key: 'when',
      label: 'When',
      sortValue: (m) => m.at,
      render: (m) => (
        <span class="nowrap">
          {shortDate(m.at)}
          <span class="cell-sub">{time(m.at)}</span>
        </span>
      ),
    },
    {
      key: 'item',
      label: 'Item',
      sortValue: (m) => (itemOf(d, m.itemId) ? itemLabel(itemOf(d, m.itemId)!) : m.itemId),
      render: (m) => {
        const it = itemOf(d, m.itemId);
        return it ? (
          <>
            <button type="button" class="inv-link" onClick={() => onOpenItem(it.id)}>
              {itemLabel(it)}
            </button>
            <span class="cell-sub">{it.id}</span>
          </>
        ) : (
          m.itemId
        );
      },
    },
    { key: 'qty', label: 'Change', align: 'right', sortValue: (m) => m.qty, render: (m) => <Delta qty={m.qty} item={itemOf(d, m.itemId)} /> },
    { key: 'kind', label: 'Type', sortValue: (m) => moveMetaFor(m).label, render: (m) => <StatusBadge meta={moveMetaFor(m)} /> },
    { key: 'ref', label: 'Reference', hide: 'sm', sortValue: (m) => m.ref ?? '', render: (m) => <RefLink refId={m.ref} onOpenPO={onOpenPO} /> },
    { key: 'by', label: 'By', hide: 'md', sortValue: (m) => firstName(d, m.by), render: (m) => firstName(d, m.by) },
    { key: 'note', label: 'Note', hide: 'md', render: (m) => (m.note ? <span class="inv-note">{m.note}</span> : <span class="muted">—</span>) },
  ];

  return (
    <>
      <div class="toolbar">
        <SearchInput value={q} onInput={setQ} label="Search stock movements" placeholder="Item, SKU, job or PO" />
        <label class="inv-select">
          <span class="sr-only">Movement type</span>
          <select class="select" value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as MoveFilter)}>
            <option value="all">All movements</option>
            {(Object.keys(moveMeta) as StockMove['kind'][]).map((k) => (
              <option key={k} value={k}>
                {moveMeta[k].label}
              </option>
            ))}
          </select>
        </label>
        <span class="toolbar__spacer" />
        <Button icon="download" onClick={exportCsv} disabled={!rows.length}>
          Download CSV
        </Button>
      </div>
      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(m) => m.id}
          caption="Stock movements"
          initialSort={{ key: 'when', dir: 'desc' }}
          empty={<EmptyState icon="transfer" title="No movements match" />}
        />
      </Card>
    </>
  );
}

/* ---------- Vendors tab ---------- */

const vendorKindLabel: Record<Vendor['kind'], string> = {
  materials: 'Materials',
  components: 'Components',
  resale: 'Resale stock',
  services: 'Services',
  utilities: 'Utilities',
  property: 'Property',
};

function VendorsTab({ onNewPO }: { onNewPO: (vendorId: string) => void }) {
  const d = db.value;
  const suppliers = stockVendors(d);
  const rows = suppliers.map((v) => {
    const items = d.items.filter((it) => it.vendorId === v.id);
    const open = d.pos.filter((p) => p.vendorId === v.id && isOpenPO(p));
    const owed = d.bills.filter((b) => b.vendorId === v.id && b.status !== 'paid').reduce((s, b) => s + b.amount, 0);
    return { v, items, open, owed };
  });
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: 'vendor',
      label: 'Vendor',
      sortValue: (r) => r.v.name,
      render: (r) => (
        <>
          <span class="cell-main">{r.v.name}</span>
          <span class="cell-sub">{vendorKindLabel[r.v.kind] === r.v.category ? r.v.category : `${vendorKindLabel[r.v.kind]} · ${r.v.category}`}</span>
        </>
      ),
    },
    { key: 'terms', label: 'Terms', hide: 'sm', sortValue: (r) => r.v.terms, render: (r) => <span class="nowrap">{r.v.terms}</span> },
    { key: 'account', label: 'Account', hide: 'md', sortValue: (r) => r.v.account ?? '', render: (r) => r.v.account ?? <span class="muted">—</span> },
    { key: 'items', label: 'Items', align: 'right', sortValue: (r) => r.items.length, render: (r) => <span class="tabular">{r.items.length}</span> },
    {
      key: 'open',
      label: 'Open orders',
      align: 'right',
      sortValue: (r) => r.open.length,
      render: (r) => (r.open.length ? <span class="tabular">{r.open.length} · {money(r.open.reduce((s, p) => s + poTotal(p), 0), false)}</span> : <span class="muted">—</span>),
    },
    { key: 'owed', label: 'Bills owed', align: 'right', hide: 'sm', sortValue: (r) => r.owed, render: (r) => (r.owed ? <span class="tabular">{money(r.owed)}</span> : <span class="muted">—</span>) },
    {
      key: 'action',
      label: <span class="sr-only">Actions</span>,
      render: (r) => (
        <Button size="sm" icon="plus" onClick={() => onNewPO(r.v.id)} aria-label={`New purchase order for ${r.v.name}`}>
          Order
        </Button>
      ),
    },
  ];
  return (
    <>
      <Card flush>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.v.id} caption="Vendors FiberSteel buys stock from" initialSort={{ key: 'vendor', dir: 'asc' }} />
      </Card>
      <p class="acct-footnote inv-footnote">Sample suppliers with made-up terms and account numbers — FiberSteel’s real vendors would replace them. Bills from services (insurance, fuel, utilities) are under Accounting → Bills.</p>
    </>
  );
}

/* ---------- Page ---------- */

export default function Inventory() {
  const d = db.value;
  const params = route.value.params;
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'stock';
  const item = itemOf(d, params.get('id') ?? undefined);
  const po = d.pos.find((p) => p.id === params.get('po'));
  const [sub, setSub] = useState<Sub | null>(null);

  const value = d.items.reduce((s, it) => s + stockValue(it, 'all'), 0);
  const low = lowStock(d, 'all');
  const out = low.filter((it) => stockStatus(it, 'all') === 'out').length;
  const openOrders = d.pos.filter((p) => p.status === 'ordered' || p.status === 'partial');
  const drafts = d.pos.filter((p) => p.status === 'draft').length;
  const incoming = openOrders.reduce((s, p) => s + poOutstanding(p), 0);
  const finished = d.items.filter((it) => it.kind === 'lift');
  const inYard = finished.reduce((s, it) => s + it.stock[SHOP].onHand, 0);
  const setAside = finished.reduce((s, it) => s + Math.min(it.stock[SHOP].onHand, it.stock[SHOP].reserved), 0);
  const onDisplay = finished.reduce((s, it) => s + it.stock[SHOP].display, 0);
  const openBuilds = d.jobs.filter(isOpenBuild);
  const buildQty = openBuilds.reduce((s, j) => s + (j.qty ?? 1), 0);

  const openItem = (id: string) => setParams({ id });
  const openPO = (id: string) => setParams({ tab: 'orders', po: id, id: undefined });

  return (
    <div class="inventory">
      <PageHeader
        eyebrow={SHOP_NAME}
        title="Inventory"
        description="Finished lifts in the yard, the components they’re built from, dock steps and resale stock — what’s set aside for builds and jobs, and what’s on the way."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setSub({ kind: 'po' })}>
            New purchase order
          </Button>
        }
      />

      <div class="stats">
        <Stat label="Stock value at cost" icon="dollar" value={money(value, false)} hint="Sample costs" />
        <Stat label="Low or out of stock" icon="alert" value={number(low.length)} hint={out ? <span class="is-bad">{out} out of stock</span> : 'Nothing out of stock'} to="/office/inventory/?filter=low" />
        <Stat label="On order" icon="truck" value={number(incoming)} hint={`${plural(openOrders.length, 'open order')}${drafts ? ` · ${plural(drafts, 'draft')}` : ''}`} to="/office/inventory/?tab=orders" />
        <Stat
          label="Finished lifts in the yard"
          icon="lift"
          value={number(inYard)}
          hint={[setAside ? `${setAside} set aside` : '', onDisplay ? `${onDisplay} on display` : '', buildQty ? `${plural(buildQty, 'lift')} in the shop` : ''].filter(Boolean).join(' · ') || 'Nothing in the shop'}
          to="/office/inventory/?tab=lifts"
        />
      </div>

      <Tabs<Tab>
        label="Inventory views"
        idBase="inv"
        value={tab}
        onChange={(k) => setParams({ tab: k === 'stock' ? undefined : k, id: undefined, po: undefined, filter: k === 'stock' ? (params.get('filter') ?? undefined) : undefined, kind: k === 'stock' ? (params.get('kind') ?? undefined) : undefined }, { replace: true })}
        items={[
          { key: 'stock', label: 'Stock', icon: 'box' },
          { key: 'lifts', label: 'Lifts & builds', icon: 'hardhat' },
          { key: 'orders', label: 'Purchase orders', icon: 'file', count: d.pos.filter(isOpenPO).length },
          { key: 'activity', label: 'Activity', icon: 'transfer' },
          { key: 'vendors', label: 'Vendors', icon: 'truck' },
        ]}
      />
      <TabPanel idBase="inv" active={tab}>
        {tab === 'stock' && <StockTab onOpen={openItem} />}
        {tab === 'lifts' && <LiftsTab onOpenItem={openItem} onAction={setSub} />}
        {tab === 'orders' && <OrdersTab onOpenPO={openPO} onOpenItem={openItem} />}
        {tab === 'activity' && <ActivityTab onOpenItem={openItem} onOpenPO={openPO} />}
        {tab === 'vendors' && <VendorsTab onNewPO={(vendorId) => setSub({ kind: 'po', preset: { vendorId } })} />}
      </TabPanel>

      {po && <PODrawer key={po.id} po={po} onClose={() => setParams({ po: undefined }, { replace: true })} onEdit={() => setSub({ kind: 'po', poId: po.id })} onOpenItem={openItem} />}
      {item && <ItemDrawer key={item.id} item={item} onClose={() => setParams({ id: undefined }, { replace: true })} onAction={setSub} onOpenPO={openPO} onOpenItem={openItem} />}
      {sub?.kind === 'adjust' && <AdjustDialog itemId={sub.itemId} onClose={() => setSub(null)} />}
      {sub?.kind === 'po' && <PODialog poId={sub.poId} preset={sub.preset} onClose={() => setSub(null)} />}
    </div>
  );
}

