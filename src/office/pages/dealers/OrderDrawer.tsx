/** A dealer order, start to finish: lines at dealer pricing, the shop builds, shipping, and the invoice. */
import { useState } from 'preact/hooks';
import { orderStatusLabels, setDealerOrderStatus, updateDealerOrder } from '../../actions';
import type { Job } from '../../data/types';
import { openDialog } from '../../dialogs';
import { dayTime, money, plural, shortDate } from '../../lib/format';
import { firstName, invoiceStatus, invoiceTotals } from '../../selectors';
import { can, db } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Details, EmptyState, Link } from '../../ui/core';
import { Confirm, Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { invoiceStatusMeta, jobStatusOf, orderStatusMeta, StatusBadge } from '../../ui/status';
import { orderSteps, orderTotal, orderUnits, shipLabels } from './helpers';

export function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const d = db.value;
  const order = d.dealerOrders.find((o) => o.id === id);
  const [cancelling, setCancelling] = useState(false);
  const [notes, setNotes] = useState(order?.notes ?? '');

  if (!order) {
    return (
      <Dialog title="Order not found" onClose={onClose} drawer size="md">
        <EmptyState icon="box" title="We couldn’t find that order">
          It may have been removed when the demo data was reset.
        </EmptyState>
      </Dialog>
    );
  }

  const dealer = d.dealers.find((x) => x.id === order.dealerId);
  const jobs = order.jobIds.map((j) => d.jobs.find((x) => x.id === j)).filter((j): j is Job => !!j);
  const builds = jobs.filter((j) => j.type === 'build');
  const delivery = jobs.find((j) => j.type === 'delivery' && j.status !== 'cancelled');
  const buildsLeft = builds.filter((j) => j.status !== 'completed' && j.status !== 'closed' && j.status !== 'cancelled').length;
  const invoice = order.invoiceId ? d.invoices.find((i) => i.id === order.invoiceId) : undefined;
  const steps = orderSteps(order);
  const cancelled = order.status === 'cancelled';
  const current = steps.findIndex((s) => s.key === order.status);
  const total = orderTotal(order);

  const move = (status: Parameters<typeof setDealerOrderStatus>[1], message: string) => {
    setDealerOrderStatus(order.id, status);
    toast(message, { tone: 'success' });
  };

  const footer = (() => {
    switch (order.status) {
      case 'quote':
        return (
          <>
            <Button variant="ghost" onClick={() => setCancelling(true)}>
              Cancel order…
            </Button>
            <Button icon="edit" onClick={() => openDialog({ kind: 'dealer-order', orderId: order.id })}>
              Edit
            </Button>
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                setDealerOrderStatus(order.id, 'confirmed');
                const after = db.value.dealerOrders.find((o) => o.id === order.id);
                const n = after?.jobIds.filter((j) => db.value.jobs.find((x) => x.id === j)?.type === 'build').length ?? 0;
                toast(after?.status === 'ready' ? `${order.id} confirmed — everything is in stock, ready to ship` : `${order.id} confirmed — ${plural(n, 'shop build')} added to the schedule`, { tone: 'success' });
              }}
            >
              Confirm the order
            </Button>
          </>
        );
      case 'confirmed':
      case 'building':
        return (
          <>
            <Button variant="ghost" onClick={() => setCancelling(true)}>
              Cancel order…
            </Button>
            <Button icon="box" onClick={() => move('ready', `${order.id} marked ready to ship`)}>
              Mark ready to ship
            </Button>
          </>
        );
      case 'ready':
        return (
          <>
            <Button variant="ghost" onClick={() => setCancelling(true)}>
              Cancel order…
            </Button>
            {order.ship === 'freight' ? (
              <Button variant="primary" icon="truck" onClick={() => move('shipped', `${order.id} shipped — the dealer is invoiced`)}>
                Mark shipped
              </Button>
            ) : (
              <Button variant="primary" icon="check-circle" onClick={() => move('delivered', `${order.id} ${order.ship === 'pickup' ? 'picked up' : 'delivered'} — the dealer is invoiced`)}>
                {order.ship === 'pickup' ? 'Mark picked up' : 'Mark delivered'}
              </Button>
            )}
          </>
        );
      case 'shipped':
        return (
          <Button variant="primary" icon="check-circle" onClick={() => move('delivered', `${order.id} delivered`)}>
            Mark delivered
          </Button>
        );
      default:
        return <span class="muted small">{cancelled ? 'This order was cancelled.' : 'Delivered — this order is complete.'}</span>;
    }
  })();

  return (
    <Dialog
      title={`${order.id} · ${dealer?.name ?? 'Dealer'}`}
      description={`Placed ${shortDate(order.placedOn, true)} · ${shipLabels[order.ship]}${order.shipOn && !order.shippedOn ? ` · ship by ${shortDate(order.shipOn, true)}` : ''}`}
      onClose={onClose}
      drawer
      size="lg"
      headerExtra={<StatusBadge meta={orderStatusMeta[order.status]} />}
      footer={footer}
    >
      <div class="stack">
        <ol class={`claim-steps${cancelled ? ' is-denied' : ''}`} aria-label="Order progress" tabIndex={-1} data-autofocus>
          {steps.map((s, i) => {
            const done = !cancelled && i <= current;
            return (
              <li key={s.key} class={done ? 'is-done' : undefined} aria-current={!cancelled && i === current ? 'step' : undefined}>
                <span class="claim-steps__dot" aria-hidden="true">
                  {done && <Icon name="check" size={11} stroke={3} />}
                </span>
                <span class="claim-steps__label">{s.label}</span>
              </li>
            );
          })}
        </ol>
        {cancelled && (
          <p class="callout callout--amber">
            <Icon name="x-circle" size={16} />
            <span>Cancelled. Open shop builds were cancelled with it and their reserved components went back on the shelf.</span>
          </p>
        )}

        <div class="table-wrap deal-lines">
          <table class="table table--dense">
            <caption class="sr-only">Lines on {order.id}</caption>
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
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l, k) => {
                const it = d.items.find((i) => i.id === l.itemId);
                return (
                  <tr key={`${l.itemId}-${k}`}>
                    <td>
                      <span class="cell-main cell-main--plain">{it?.name ?? l.itemId}</span>
                      <span class="cell-sub">
                        {l.itemId}
                        {it ? ` · list ${money(it.price, false)}` : ''}
                      </span>
                    </td>
                    <td class="num tabular">{l.qty}</td>
                    <td class="num tabular">{money(l.rate, false)}</td>
                    <td class="num tabular">{money(l.qty * l.rate, false)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3} class="num">
                  Total · {plural(orderUnits(order), 'item')}
                </th>
                <td class="num tabular">
                  <strong>{money(total, false)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <Details
          columns={2}
          items={[
            ['Dealer', dealer ? <Link to={`/office/dealers/?id=${dealer.id}`}>{dealer.name}</Link> : '—'],
            ['Contact', dealer ? `${dealer.contact} · ${dealer.phone}` : '—'],
            ['Shipping', shipLabels[order.ship]],
            ['Ship by', order.shipOn ? shortDate(order.shipOn, true) : '—'],
            ['Shipped', order.shippedOn ? shortDate(order.shippedOn, true) : 'Not yet'],
            ['Delivered', order.deliveredOn ? shortDate(order.deliveredOn, true) : 'Not yet'],
            ['Status', orderStatusLabels[order.status]],
          ]}
        />

        <section aria-labelledby="order-work">
          <h3 class="section-label" id="order-work">
            Shop & delivery
          </h3>
          {jobs.length === 0 ? (
            <p class="muted small">
              {order.status === 'quote'
                ? 'Shop builds are added when the order is confirmed (for lifts that aren’t already in stock).'
                : order.status === 'confirmed'
                  ? 'No shop builds on the schedule yet.'
                  : 'No shop jobs on this order.'}
            </p>
          ) : (
            <ul class="rec-list rec-list--boxed" role="list">
              {jobs.map((j) => {
                const body = (
                  <>
                    <span class="rec-list__icon rec-list__icon--violet">
                      <Icon name={j.type === 'delivery' ? 'truck' : 'hardhat'} size={15} />
                    </span>
                    <span class="rec-list__main">
                      <span class="rec-list__title">{j.title}</span>
                      <span class="rec-list__sub">
                        {j.id} · {j.start ? dayTime(j.start) : 'Not scheduled yet'}
                        {j.crew.length ? ` · ${j.crew.map((c) => firstName(d, c)).join(' & ')}` : ''}
                      </span>
                    </span>
                    {j.status === 'completed' || j.status === 'closed' ? (
                      <Badge tone="green" icon="check-circle">
                        {j.type === 'build' ? 'Built' : 'Done'}
                      </Badge>
                    ) : (
                      <StatusBadge meta={jobStatusOf(j)} />
                    )}
                  </>
                );
                return (
                  <li key={j.id}>
                    {can('jobs') ? (
                      <Link to={`/office/jobs/?id=${j.id}`} class="rec-list__row">
                        {body}
                      </Link>
                    ) : (
                      <div class="rec-list__row">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {(order.status === 'confirmed' || order.status === 'building') && buildsLeft > 0 && (
            <p class="muted small deal-note">
              Waiting on the shop: {plural(buildsLeft, 'build')} to finish. The order is ready to ship when the last one is done{delivery ? '' : ', and a delivery job is added then'}.
            </p>
          )}
        </section>

        <section aria-labelledby="order-invoice">
          <h3 class="section-label" id="order-invoice">
            Invoice
          </h3>
          {invoice ? (
            <div class="picked">
              <span class="picked__icon">
                <Icon name="receipt" size={16} />
              </span>
              <span class="picked__text">
                <strong>{can('accounting') ? <Link to={`/office/accounting/?tab=invoices&id=${invoice.id}`}>{invoice.id}</Link> : invoice.id}</strong>
                <span class="muted small">
                  {money(invoiceTotals(invoice).total)} · due {shortDate(invoice.dueOn, true)} · balance {money(invoiceTotals(invoice).balance)}
                </span>
              </span>
              <StatusBadge meta={invoiceStatusMeta[invoiceStatus(invoice)]} />
            </div>
          ) : (
            <p class="muted small">The dealer is invoiced when the order ships or is handed over.</p>
          )}
        </section>

        <div class="field">
          <label class="field__label" for="order-notes">
            Notes
          </label>
          <textarea id="order-notes" class="textarea" rows={3} value={notes} placeholder="Bunk setups, the freight carrier, what the dealer asked for…" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
          <div class="row">
            <Button
              size="sm"
              disabled={notes === (order.notes ?? '')}
              onClick={() => {
                updateDealerOrder(order.id, { notes: notes.trim() || undefined });
                toast('Order notes saved');
              }}
            >
              Save notes
            </Button>
          </div>
        </div>
        <p class="muted small">Sample order on a sample dealer account — the prices are list prices less the account’s sample discount.</p>
      </div>

      {cancelling && (
        <Confirm title={`Cancel ${order.id}?`} confirmLabel="Cancel the order" danger onClose={() => setCancelling(false)} onConfirm={() => move('cancelled', `${order.id} cancelled`)}>
          <p>Open shop builds are cancelled with it, and the components they reserved go back on the shelf.{order.invoiceId ? ' The invoice stays — void it in Accounting if needed.' : ''}</p>
        </Confirm>
      )}
    </Dialog>
  );
}
