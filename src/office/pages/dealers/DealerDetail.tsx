/** One dealer account: contact, sample terms, orders, invoices and notes (?id=D-…, &order=DO-… opens an order). */
import { useMemo, useState } from 'preact/hooks';
import { updateDealer } from '../../actions';
import type { DealerOrder, Invoice } from '../../data/types';
import { openDialog } from '../../dialogs';
import { money, phone, plural, shortDate, telHref } from '../../lib/format';
import { param, setParams } from '../../router';
import { invoiceStatus, invoiceTotals } from '../../selectors';
import { can, db, history } from '../../store';
import { toast } from '../../toast';
import { Button, Card, Details, EmptyState, Link, LinkButton, Menu, PageHeader, Stat } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { DataTable } from '../../ui/Table';
import { dealerStatusMeta, invoiceStatusMeta, orderStatusMeta, StatusBadge } from '../../ui/status';
import { dealerRollup, orderSummary, orderTotal, pct, shipLabels } from './helpers';
import { OrderDrawer } from './OrderDrawer';

export function DealerDetail({ id }: { id: string }) {
  const d = db.value;
  const h = history.value;
  const dealer = d.dealers.find((x) => x.id === id);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const roll = useMemo(() => (dealer ? dealerRollup(d, h, dealer) : undefined), [d, h, dealer]);
  const invoices = useMemo(() => (dealer ? d.invoices.filter((i) => i.customerId === dealer.customerId).sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : -1)) : []), [d.invoices, dealer]);
  const orderId = param('order');

  if (!dealer || !roll) {
    return (
      <>
        <Link to="/office/dealers/" class="back-link">
          <Icon name="arrow-left" size={16} /> All dealers
        </Link>
        <PageHeader title="Dealer not found" />
        <EmptyState icon="handshake" title="We couldn’t find that dealer" action={<LinkButton to="/office/dealers/">Back to dealers</LinkButton>}>
          The record may have been removed when the demo data was reset.
        </EmptyState>
      </>
    );
  }

  const setStatus = (status: typeof dealer.status) => {
    updateDealer(dealer.id, { status });
    toast(`${dealer.name} is now ${dealerStatusMeta[status].label.toLowerCase()}`);
  };

  return (
    <div class="deal-detail">
      <Link to="/office/dealers/" class="back-link">
        <Icon name="arrow-left" size={16} /> All dealers
      </Link>
      <PageHeader
        eyebrow={`Dealer · since ${dealer.since.slice(0, 4)}`}
        title={dealer.name}
        description={`${dealer.city}${dealer.state && !dealer.city.endsWith(dealer.state) ? `, ${dealer.state}` : ''} · ${dealer.area || 'Area not set'}`}
        actions={
          <>
            <Menu
              label="Change the dealer’s status"
              icon="sliders"
              buttonLabel="Status"
              variant="secondary"
              items={(['active', 'prospect', 'paused'] as const)
                .filter((s) => s !== dealer.status)
                .map((s) => ({ label: s === 'active' ? 'Make active' : s === 'paused' ? 'Pause the account' : 'Back to prospect', icon: dealerStatusMeta[s].icon, onSelect: () => setStatus(s) }))}
            />
            <Button icon="edit" onClick={() => openDialog({ kind: 'dealer', dealerId: dealer.id })}>
              Edit
            </Button>
            <Button variant="primary" icon="plus" disabled={dealer.status === 'paused'} onClick={() => openDialog({ kind: 'dealer-order', dealerId: dealer.id })}>
              New order
            </Button>
          </>
        }
      />
      <div class="deal-head-badges">
        <StatusBadge meta={dealerStatusMeta[dealer.status]} />
        <span class="muted small">Sample account — the name, terms and numbers are made up for the demo.</span>
      </div>

      <div class="stats cust-stats">
        <Stat label="Open orders" icon="box" value={roll.open.length} hint={roll.open.length ? money(roll.open.reduce((s, o) => s + orderTotal(o), 0), false) : 'Nothing open'} />
        <Stat label="Ordered, last 12 months" icon="lift" value={plural(roll.units12, 'item')} hint={money(roll.sales12, false)} />
        <Stat label="Balance" icon="receipt" value={money(roll.balance, false)} hint={<span class={roll.overdue > 0.004 ? 'is-bad' : undefined}>{roll.overdue > 0.004 ? `${money(roll.overdue, false)} overdue` : 'Nothing overdue'}</span>} />
        <Stat label="Last order" icon="calendar" value={roll.lastOrder ? shortDate(roll.lastOrder) : '—'} hint={roll.lastOrder ? roll.lastOrder.slice(0, 4) : 'No orders yet'} />
      </div>

      <div class="cust-layout">
        <aside class="cust-side" aria-label="Dealer details">
          <Card title="Contact">
            <ul class="contact-list" role="list">
              <li>
                <Icon name="user" size={16} />
                <span>{dealer.contact}</span>
              </li>
              {dealer.phone && (
                <li>
                  <Icon name="phone" size={16} />
                  <a href={telHref(dealer.phone)}>{phone(dealer.phone)}</a>
                </li>
              )}
              {dealer.email && (
                <li>
                  <Icon name="mail" size={16} />
                  <a href={`mailto:${dealer.email}`} class="contact-list__email">
                    {dealer.email}
                  </a>
                </li>
              )}
              <li>
                <Icon name="map" size={16} />
                <span>{dealer.area || 'Area not set'}</span>
              </li>
            </ul>
          </Card>
          <Card title="Terms">
            <Details
              items={[
                ['Dealer discount', `${pct(dealer.discount)} off list (sample)`],
                ['Invoice terms', 'Net 30 (sample)'],
                ['Billing record', can('customers') ? <Link to={`/office/customers/?id=${dealer.customerId}`}>{dealer.customerId}</Link> : dealer.customerId],
                ['Account', dealer.id],
              ]}
            />
          </Card>
          <Card
            title="Notes"
            actions={
              !editingNotes && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="edit"
                  onClick={() => {
                    setNotesDraft(dealer.notes ?? '');
                    setEditingNotes(true);
                  }}
                >
                  Edit
                </Button>
              )
            }
          >
            {editingNotes ? (
              <div class="stack-sm">
                <label class="sr-only" for="dealer-notes">
                  Notes
                </label>
                <textarea id="dealer-notes" class="textarea" rows={4} value={notesDraft} onInput={(e) => setNotesDraft((e.target as HTMLTextAreaElement).value)} />
                <div class="row">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      updateDealer(dealer.id, { notes: notesDraft.trim() || undefined });
                      setEditingNotes(false);
                      toast('Notes saved');
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : dealer.notes ? (
              <p class="cust-notes">{dealer.notes}</p>
            ) : (
              <p class="muted">No notes yet.</p>
            )}
          </Card>
        </aside>

        <div class="cust-main stack">
          <Card title="Orders" subtitle={plural(roll.orders.length, 'order') + ' on record'} flush>
            <DataTable<DealerOrder>
              rows={roll.orders}
              rowKey={(o) => o.id}
              caption={`Orders from ${dealer.name}`}
              pageSize={10}
              initialSort={{ key: 'placed', dir: 'desc' }}
              onRowClick={(o) => setParams({ order: o.id })}
              empty={
                <EmptyState icon="box" title="No orders yet">
                  New orders show up here as quotes until they’re confirmed.
                </EmptyState>
              }
              columns={[
                {
                  key: 'id',
                  label: 'Order',
                  sortValue: (o) => o.id,
                  render: (o) => (
                    <>
                      <button type="button" class="cell-main link-plain" onClick={() => setParams({ order: o.id })}>
                        {o.id}
                      </button>
                      <span class="cell-sub">{orderSummary(d, o)}</span>
                    </>
                  ),
                },
                { key: 'placed', label: 'Placed', sortValue: (o) => o.placedOn, render: (o) => <span class="nowrap">{shortDate(o.placedOn, true)}</span>, hide: 'sm' },
                { key: 'ship', label: 'Shipping', render: (o) => shipLabels[o.ship], hide: 'md' },
                { key: 'total', label: 'Total', align: 'right', sortValue: (o) => orderTotal(o), render: (o) => <span class="tabular">{money(orderTotal(o), false)}</span> },
                { key: 'status', label: 'Status', render: (o) => <StatusBadge meta={orderStatusMeta[o.status]} /> },
              ]}
            />
          </Card>

          <Card title="Invoices" subtitle={roll.balance > 0.004 ? `${money(roll.balance)} open` : 'Nothing due'} flush>
            <DataTable<Invoice>
              rows={invoices}
              rowKey={(i) => i.id}
              caption={`Invoices for ${dealer.name}`}
              pageSize={10}
              initialSort={{ key: 'issued', dir: 'desc' }}
              empty={<EmptyState icon="receipt" title="No invoices yet" />}
              columns={[
                {
                  key: 'number',
                  label: 'Number',
                  sortValue: (i) => i.id,
                  render: (i) =>
                    can('accounting') ? (
                      <Link to={`/office/accounting/?tab=invoices&id=${i.id}`} class="cell-main">
                        {i.id}
                      </Link>
                    ) : (
                      <span class="cell-main">{i.id}</span>
                    ),
                },
                { key: 'order', label: 'Order', render: (i) => (i.dealerOrderId ? <span class="tabular">{i.dealerOrderId}</span> : <span class="muted">—</span>), hide: 'sm' },
                { key: 'issued', label: 'Issued', sortValue: (i) => i.issuedOn, render: (i) => <span class="nowrap">{shortDate(i.issuedOn, true)}</span> },
                { key: 'total', label: 'Total', align: 'right', sortValue: (i) => invoiceTotals(i).total, render: (i) => money(invoiceTotals(i).total, false) },
                { key: 'balance', label: 'Balance', align: 'right', sortValue: (i) => invoiceTotals(i).balance, render: (i) => money(invoiceTotals(i).balance, false), hide: 'sm' },
                { key: 'status', label: 'Status', render: (i) => <StatusBadge meta={invoiceStatusMeta[invoiceStatus(i)]} /> },
              ]}
            />
          </Card>
        </div>
      </div>

      {orderId && <OrderDrawer key={orderId} id={orderId} onClose={() => setParams({ order: undefined })} />}
    </div>
  );
}
