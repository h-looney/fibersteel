/**
 * Dealer helpers: order math, statuses and per-dealer roll-ups. Every dealer account, order and number here is
 * sample data — the real dealers on FiberSteel's public list never get invented numbers attached.
 */
import type { DB, Dealer, DealerOrder, DealerOrderStatus, History } from '../../data/types';
import { addDays, today } from '../../lib/dates';
import { invoiceTotals } from '../../selectors';

export const OPEN_ORDERS: DealerOrderStatus[] = ['quote', 'confirmed', 'building', 'ready'];
export const IN_WORK: DealerOrderStatus[] = ['confirmed', 'building', 'ready'];
export const orderStatuses: DealerOrderStatus[] = ['quote', 'confirmed', 'building', 'ready', 'shipped', 'delivered', 'cancelled'];

export const shipLabels: Record<DealerOrder['ship'], string> = { freight: 'Freight', pickup: 'Dealer pickup', delivery: 'FiberSteel delivers' };

/** The steps an order goes through — freight orders ship, then arrive; pickups and deliveries are handed over */
export function orderSteps(o: DealerOrder): { key: DealerOrderStatus; label: string }[] {
  const last = o.ship === 'freight' ? [{ key: 'shipped' as const, label: 'Shipped' }, { key: 'delivered' as const, label: 'Delivered' }] : [{ key: 'delivered' as const, label: o.ship === 'pickup' ? 'Picked up' : 'Delivered' }];
  return [{ key: 'quote', label: 'Quote' }, { key: 'confirmed', label: 'Confirmed' }, { key: 'building', label: 'Building' }, { key: 'ready', label: 'Ready' }, ...last];
}

export const orderTotal = (o: Pick<DealerOrder, 'lines'>) => o.lines.reduce((s, l) => s + l.qty * l.rate, 0);
export const orderUnits = (o: Pick<DealerOrder, 'lines'>) => o.lines.reduce((s, l) => s + l.qty, 0);

/** "2 × 10,000 lb lift, 1 × Dock steps" — lines for the same item counted together */
export function orderSummary(d: DB, o: Pick<DealerOrder, 'lines'>) {
  const qty = new Map<string, number>();
  for (const l of o.lines) qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.qty);
  return [...qty].map(([id, n]) => `${n} × ${d.items.find((i) => i.id === id)?.name ?? id}`).join(', ');
}

export interface DealerRollup {
  orders: DealerOrder[];
  open: DealerOrder[];
  lastOrder?: string;
  /** Last 12 months, from the sample history plus orders on record */
  sales12: number;
  units12: number;
  balance: number;
  overdue: number;
}

export function dealerRollup(d: DB, h: History, dealer: Dealer): DealerRollup {
  const t = today();
  const from = addDays(t, -365);
  const orders = d.dealerOrders.filter((o) => o.dealerId === dealer.id).sort((a, b) => (a.placedOn < b.placedOn ? 1 : -1));
  let sales12 = 0;
  let units12 = 0;
  for (const s of h.sales) {
    if (s.channel !== 'dealer' || s.dealerId !== dealer.id || s.day < from) continue;
    sales12 += s.revenue;
    units12 += s.qty;
  }
  for (const o of orders) {
    if (o.status === 'cancelled' || o.status === 'quote' || o.placedOn < from) continue;
    sales12 += orderTotal(o);
    units12 += orderUnits(o);
  }
  let balance = 0;
  let overdue = 0;
  for (const inv of d.invoices) {
    if (inv.customerId !== dealer.customerId || inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const b = invoiceTotals(inv).balance;
    balance += b;
    if (b > 0.004 && inv.dueOn < t) overdue += b;
  }
  const lastHist = h.sales.filter((s) => s.dealerId === dealer.id).reduce<string | undefined>((m, s) => (!m || s.day > m ? s.day : m), undefined);
  const lastOrder = [orders[0]?.placedOn, lastHist].filter(Boolean).sort().pop();
  return { orders, open: orders.filter((o) => OPEN_ORDERS.includes(o.status)), lastOrder, sales12, units12, balance, overdue };
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
