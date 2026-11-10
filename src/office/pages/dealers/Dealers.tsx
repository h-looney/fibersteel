/**
 * Dealers: the dealer accounts, the lifts they order (built in the shop, shipped or handed over, invoiced at dealer
 * pricing), and businesses asking to become dealers. Every account here is a sample — the real dealer list on the
 * public site is edited under Website → Dealer list, and never gets invented numbers attached.
 *   /office/dealers/?tab=accounts|orders|prospects  ·  ?id=D-… (a dealer)  ·  ?tab=orders&id=DO-… (an order)
 */
import { useMemo, useState } from 'preact/hooks';
import { createDealerFromLead } from '../../actions';
import type { Dealer, DealerOrder, DealerOrderStatus, Lead } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addDays, today } from '../../lib/dates';
import { money, plural, relative, shortDate } from '../../lib/format';
import { navigate, param, setParams } from '../../router';
import { can, db, history } from '../../store';
import { toast } from '../../toast';
import { Button, Chips, EmptyState, Link, PageHeader, SearchInput, Stat, TabPanel, Tabs } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { dealerStatusMeta, leadStageMeta, orderStatusMeta, StatusBadge } from '../../ui/status';
import { DealerDetail } from './DealerDetail';
import { dealerRollup, IN_WORK, OPEN_ORDERS, orderStatuses, orderSummary, orderTotal, pct, shipLabels } from './helpers';
import { OrderDrawer } from './OrderDrawer';

type Tab = 'accounts' | 'orders' | 'prospects';
type OrderFilter = 'open' | DealerOrderStatus | 'all';

export default function Dealers() {
  const id = param('id');
  if (id && !id.startsWith('DO-')) return <DealerDetail key={id} id={id} />;
  return <DealersHome />;
}

function DealersHome() {
  const d = db.value;
  const h = history.value;
  const orderId = param('id');
  const requested = param('tab') as Tab | undefined;
  const tab: Tab = orderId ? 'orders' : requested === 'orders' || requested === 'prospects' ? requested : 'accounts';

  const active = d.dealers.filter((x) => x.status === 'active');
  const openOrders = d.dealerOrders.filter((o) => OPEN_ORDERS.includes(o.status));
  const ready = d.dealerOrders.filter((o) => o.status === 'ready');
  const inWork = d.dealerOrders.filter((o) => IN_WORK.includes(o.status));
  const prospectLeads = d.leads.filter((l) => l.kind === 'dealer' && l.stage !== 'won' && l.stage !== 'lost' && l.stage !== 'closed');
  const prospects = d.dealers.filter((x) => x.status === 'prospect');
  const since = addDays(today(), -365);
  const sales12 = useMemo(() => {
    let s = h.sales.filter((x) => x.channel === 'dealer' && x.day >= since).reduce((n, x) => n + x.revenue, 0);
    for (const o of d.dealerOrders) if (o.status !== 'cancelled' && o.status !== 'quote' && o.placedOn >= since) s += orderTotal(o);
    return s;
  }, [d.dealerOrders, h.sales, since]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Dealers"
        description="Dealer accounts and the lifts they order — built in the shop, shipped or handed over, and invoiced at dealer pricing."
        actions={
          <>
            <Button icon="plus" onClick={() => openDialog({ kind: 'dealer' })}>
              Add dealer
            </Button>
            <Button variant="primary" icon="box" onClick={() => openDialog({ kind: 'dealer-order' })}>
              New order
            </Button>
          </>
        }
      />

      <p class="callout callout--blue deal-sample">
        <Icon name="info" size={16} />
        <span>
          <strong>Sample accounts.</strong> These dealers, their orders and their discounts are invented for the demo — they aren’t FiberSteel’s dealers. The dealer list on the public site is kept
          separately{can('website') ? (
            <>
              , under <Link to="/office/website/?tab=dealers">Website → Dealer list</Link>
            </>
          ) : (
            ', under Website → Dealer list'
          )}
          .
        </span>
      </p>

      <div class="stats cust-stats">
        <Stat label="Active dealers" icon="handshake" value={active.length} hint={`${plural(prospects.length, 'prospect')} · ${d.dealers.filter((x) => x.status === 'paused').length} paused`} to="/office/dealers/" />
        <Stat label="Orders in the works" icon="hardhat" value={inWork.length} hint={inWork.length ? money(inWork.reduce((s, o) => s + orderTotal(o), 0), false) : 'Nothing in the shop'} to="/office/dealers/?tab=orders" />
        <Stat label="Ready to ship" icon="truck" value={ready.length} hint={ready.length ? 'Built and waiting' : 'Nothing waiting'} to="/office/dealers/?tab=orders&status=ready" />
        <Stat label="Dealer sales, 12 months" icon="chart" value={money(sales12, false)} hint="Sample accounts" />
      </div>

      <Tabs<Tab>
        label="Dealer views"
        idBase="dealers"
        value={tab}
        onChange={(k) => setParams({ tab: k === 'accounts' ? undefined : k, id: undefined, status: undefined }, { replace: true })}
        items={[
          { key: 'accounts', label: 'Accounts', icon: 'handshake', count: d.dealers.length },
          { key: 'orders', label: 'Orders', icon: 'box', count: openOrders.length },
          { key: 'prospects', label: 'Prospects', icon: 'sparkle', count: prospectLeads.length + prospects.filter((p) => !prospectLeads.some((l) => l.dealerId === p.id)).length },
        ]}
      />
      <TabPanel idBase="dealers" active={tab}>
        {tab === 'accounts' && <Accounts />}
        {tab === 'orders' && <Orders />}
        {tab === 'prospects' && <Prospects leads={prospectLeads} />}
      </TabPanel>

      {orderId && <OrderDrawer key={orderId} id={orderId} onClose={() => setParams({ id: undefined })} />}
    </>
  );
}

/* ---------- Accounts ---------- */

function Accounts() {
  const d = db.value;
  const h = history.value;
  const [q, setQ] = useState('');
  const rolls = useMemo(() => new Map(d.dealers.map((x) => [x.id, dealerRollup(d, h, x)])), [d, h]);
  const term = q.trim().toLowerCase();
  const rows = d.dealers.filter((x) => !term || `${x.name} ${x.contact} ${x.city} ${x.state} ${x.area} ${x.id}`.toLowerCase().includes(term));

  const columns: Column<Dealer>[] = [
    {
      key: 'name',
      label: 'Dealer',
      sortValue: (x) => x.name.toLowerCase(),
      render: (x) => (
        <>
          <Link to={`/office/dealers/?id=${x.id}`} class="cell-main">
            {x.name}
          </Link>
          <span class="cell-sub">{x.contact}</span>
        </>
      ),
    },
    {
      key: 'where',
      label: 'Where',
      sortValue: (x) => `${x.state} ${x.city}`,
      render: (x) => (
        <>
          <span>{[x.city, x.state].filter(Boolean).join(', ')}</span>
          <span class="cell-sub">{x.area}</span>
        </>
      ),
      hide: 'sm',
    },
    { key: 'status', label: 'Status', sortValue: (x) => x.status, render: (x) => <StatusBadge meta={dealerStatusMeta[x.status]} /> },
    { key: 'discount', label: 'Discount', align: 'right', sortValue: (x) => x.discount, render: (x) => <span class="tabular">{pct(x.discount)}</span>, hide: 'md' },
    {
      key: 'open',
      label: 'Open orders',
      align: 'right',
      sortValue: (x) => rolls.get(x.id)?.open.length ?? 0,
      render: (x) => {
        const r = rolls.get(x.id);
        return r?.open.length ? <span class="tabular">{r.open.length}</span> : <span class="muted">—</span>;
      },
    },
    {
      key: 'sales',
      label: 'Last 12 months',
      align: 'right',
      sortValue: (x) => rolls.get(x.id)?.sales12 ?? 0,
      render: (x) => {
        const r = rolls.get(x.id);
        return r?.sales12 ? (
          <>
            <span class="tabular">{money(r.sales12, false)}</span>
            <span class="cell-sub">{plural(r.units12, 'item')}</span>
          </>
        ) : (
          <span class="muted">—</span>
        );
      },
      hide: 'sm',
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      sortValue: (x) => rolls.get(x.id)?.balance ?? 0,
      render: (x) => {
        const r = rolls.get(x.id);
        if (!r || r.balance <= 0.004) return <span class="muted">—</span>;
        return (
          <>
            <span class="tabular">{money(r.balance, false)}</span>
            {r.overdue > 0.004 && <span class="cell-sub is-bad">{money(r.overdue, false)} overdue</span>}
          </>
        );
      },
      hide: 'md',
    },
  ];

  return (
    <section class="card card--flush" aria-label="Dealer accounts">
      <div class="cust-toolbar">
        <SearchInput value={q} onInput={setQ} label="Search dealers" placeholder="Dealer, contact or area" class="cust-toolbar__search" />
      </div>
      <DataTable<Dealer>
        rows={rows}
        columns={columns}
        rowKey={(x) => x.id}
        caption="Dealer accounts"
        initialSort={{ key: 'name', dir: 'asc' }}
        onRowClick={(x) => navigate(`/office/dealers/?id=${x.id}`)}
        empty={
          <EmptyState
            icon="handshake"
            title="No dealers match"
            action={
              <Button size="sm" icon="plus" onClick={() => openDialog({ kind: 'dealer' })}>
                Add dealer
              </Button>
            }
          />
        }
      />
    </section>
  );
}

/* ---------- Orders ---------- */

function Orders() {
  const d = db.value;
  const sp = param('status') as OrderFilter | undefined;
  const filter: OrderFilter = sp && (sp === 'open' || sp === 'all' || orderStatuses.includes(sp as DealerOrderStatus)) ? sp : 'open';
  const [q, setQ] = useState('');
  const count = (s: DealerOrderStatus) => d.dealerOrders.filter((o) => o.status === s).length;
  const term = q.trim().toLowerCase();
  const rows = d.dealerOrders.filter((o) => {
    if (filter === 'open' && !OPEN_ORDERS.includes(o.status)) return false;
    if (filter === 'building' && o.status !== 'building' && o.status !== 'confirmed') return false;
    if (filter !== 'open' && filter !== 'all' && filter !== 'building' && o.status !== filter) return false;
    if (term) {
      const x = d.dealers.find((dl) => dl.id === o.dealerId);
      if (!`${o.id} ${x?.name ?? ''} ${orderSummary(d, o)}`.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const columns: Column<DealerOrder>[] = [
    {
      key: 'id',
      label: 'Order',
      sortValue: (o) => o.id,
      render: (o) => (
        <>
          <button type="button" class="cell-main link-plain" onClick={() => setParams({ id: o.id })}>
            {o.id}
          </button>
          <span class="cell-sub">{orderSummary(d, o)}</span>
        </>
      ),
    },
    {
      key: 'dealer',
      label: 'Dealer',
      sortValue: (o) => d.dealers.find((x) => x.id === o.dealerId)?.name ?? '',
      render: (o) => {
        const x = d.dealers.find((dl) => dl.id === o.dealerId);
        return x ? <span>{x.name}</span> : <span class="muted">—</span>;
      },
      hide: 'sm',
    },
    { key: 'placed', label: 'Placed', sortValue: (o) => o.placedOn, render: (o) => <span class="nowrap">{shortDate(o.placedOn, true)}</span>, hide: 'md' },
    {
      key: 'ship',
      label: 'Shipping',
      sortValue: (o) => o.shippedOn ?? o.shipOn ?? '',
      render: (o) => (
        <>
          <span>{shipLabels[o.ship]}</span>
          <span class="cell-sub">{o.shippedOn ? `Shipped ${shortDate(o.shippedOn)}` : o.shipOn ? `By ${shortDate(o.shipOn)}` : ''}</span>
        </>
      ),
      hide: 'md',
    },
    { key: 'total', label: 'Total', align: 'right', sortValue: (o) => orderTotal(o), render: (o) => <span class="tabular">{money(orderTotal(o), false)}</span> },
    { key: 'status', label: 'Status', sortValue: (o) => orderStatuses.indexOf(o.status), render: (o) => <StatusBadge meta={orderStatusMeta[o.status]} /> },
  ];

  return (
    <section class="card card--flush" aria-label="Dealer orders">
      <div class="cust-toolbar">
        <Chips<OrderFilter>
          label="Order status"
          value={filter}
          onChange={(f) => setParams({ status: f === 'open' ? undefined : f }, { replace: true })}
          items={[
            { key: 'open', label: 'Open', count: d.dealerOrders.filter((o) => OPEN_ORDERS.includes(o.status)).length },
            { key: 'quote', label: 'Quotes', count: count('quote') },
            { key: 'building', label: 'Confirmed & building', count: count('building') + count('confirmed') },
            { key: 'ready', label: 'Ready to ship', count: count('ready') },
            { key: 'shipped', label: 'Shipped', count: count('shipped') },
            { key: 'delivered', label: 'Delivered', count: count('delivered') },
            { key: 'all', label: 'All', count: d.dealerOrders.length },
          ]}
        />
        <SearchInput value={q} onInput={setQ} label="Search orders" placeholder="Order, dealer or size" class="cust-toolbar__search" />
      </div>
      <DataTable<DealerOrder>
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        caption="Dealer orders"
        initialSort={{ key: 'placed', dir: 'desc' }}
        onRowClick={(o) => setParams({ id: o.id })}
        empty={
          <EmptyState
            icon="box"
            title="No orders here"
            action={
              <Button size="sm" icon="plus" onClick={() => openDialog({ kind: 'dealer-order' })}>
                New dealer order
              </Button>
            }
          >
            Try another filter, or take a new order.
          </EmptyState>
        }
      />
    </section>
  );
}

/* ---------- Prospects ---------- */

function Prospects({ leads }: { leads: Lead[] }) {
  const d = db.value;
  const field = (l: Lead, label: string) => l.fields.find(([k]) => k === label)?.[1];
  const accountsOnly = d.dealers.filter((x) => x.status === 'prospect' && !leads.some((l) => l.dealerId === x.id));
  const sorted = [...leads].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

  return (
    <div class="stack">
      <section class="card card--flush" aria-label="Become-a-dealer requests">
        <header class="card__head">
          <div>
            <h2 class="card__title">Asking to become a dealer</h2>
            <p class="card__sub">From the public site’s Become a dealer form, calls and boat shows. The requests themselves live in the inbox.</p>
          </div>
        </header>
        {sorted.length === 0 ? (
          <EmptyState icon="sparkle" title="No open dealer requests">
            New become-a-dealer requests show up here and in the inbox.
          </EmptyState>
        ) : (
          <ul class="rec-list" role="list">
            {sorted.map((l) => {
              const business = field(l, 'Business') ?? l.summary.replace(/^Become a dealer · /, '');
              const account = l.dealerId ? d.dealers.find((x) => x.id === l.dealerId) : undefined;
              return (
                <li key={l.id} class="deal-prospect">
                  <span class="rec-list__icon rec-list__icon--violet">
                    <Icon name="handshake" size={15} />
                  </span>
                  <span class="rec-list__main">
                    <span class="rec-list__title">{business}</span>
                    <span class="rec-list__sub">
                      {l.name}
                      {field(l, 'Type of business') ? ` · ${field(l, 'Type of business')}` : ''}
                      {field(l, 'Lakes / areas served') ? ` · ${field(l, 'Lakes / areas served')}` : l.location ? ` · ${l.location}` : ''} · received {relative(l.receivedAt)}
                    </span>
                  </span>
                  <span class="deal-prospect__actions">
                    <StatusBadge meta={leadStageMeta[l.stage]} />
                    {can('inbox') && (
                      <Link to={`/office/inbox/?id=${l.id}`} class="btn btn--ghost btn--sm">
                        Open request
                      </Link>
                    )}
                    {account ? (
                      <Link to={`/office/dealers/?id=${account.id}`} class="btn btn--secondary btn--sm">
                        Account {account.id}
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        onClick={() => {
                          const id = createDealerFromLead(l.id);
                          toast(`Prospect account ${id} created for ${business}`, { tone: 'success' });
                          navigate(`/office/dealers/?id=${id}`);
                        }}
                      >
                        Create account
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {accountsOnly.length > 0 && (
        <section class="card card--flush" aria-label="Prospect accounts">
          <header class="card__head">
            <div>
              <h2 class="card__title">Prospect accounts</h2>
              <p class="card__sub">Set up, but no orders yet.</p>
            </div>
          </header>
          <ul class="rec-list" role="list">
            {accountsOnly.map((x) => (
              <li key={x.id}>
                <Link to={`/office/dealers/?id=${x.id}`} class="rec-list__row">
                  <span class="rec-list__icon rec-list__icon--violet">
                    <Icon name="sparkle" size={15} />
                  </span>
                  <span class="rec-list__main">
                    <span class="rec-list__title">{x.name}</span>
                    <span class="rec-list__sub">
                      {x.contact} · {[x.city, x.state].filter(Boolean).join(', ')} · since {shortDate(x.since, true)}
                    </span>
                  </span>
                  <StatusBadge meta={dealerStatusMeta[x.status]} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
