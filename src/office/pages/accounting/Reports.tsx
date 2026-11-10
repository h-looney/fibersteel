/** Reports: profit & loss against the same period last year, sales tax by category, and receivables by customer — with CSV and print. */
import { useMemo, useRef } from 'preact/hooks';
import { site } from '../../../data/site';
import type { Customer, RevenueCategory } from '../../data/types';
import { addMonths, diffDays, inRange, today } from '../../lib/dates';
import { money } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, invoiceTotals, revenueEvents } from '../../selectors';
import { db, history } from '../../store';
import { Button, Card, Link, Segmented } from '../../ui/core';
import { cogsEvents, downloadCsv, isReceivable, OPEX_CATEGORIES, PERIODS, periodRange, printElement, profitAndLoss, REVENUE_CATEGORIES, STORE, type PeriodKey } from './helpers';

type PL = ReturnType<typeof profitAndLoss>;
const cents = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
const change = (now: number, before?: number) => (before === undefined || !before ? '—' : `${now >= before ? '+' : '−'}${Math.abs(Math.round(((now - before) / Math.abs(before)) * 100))}%`);

function ReportActions({ onCsv, onPrint, name }: { onCsv: () => void; onPrint: () => void; name: string }) {
  return (
    <>
      <Button size="sm" variant="ghost" icon="download" onClick={onCsv} aria-label={`Download ${name} as CSV`}>
        CSV
      </Button>
      <Button size="sm" variant="ghost" icon="printer" onClick={onPrint} aria-label={`Print ${name}`}>
        Print
      </Button>
    </>
  );
}

export function ReportsTab() {
  const d = db.value;
  const h = history.value;
  const t = today();
  const period = (param('period') as PeriodKey | undefined) ?? 'month';
  const range = periodRange(period, t);
  const prior = { from: addMonths(range.from, -12), to: addMonths(range.to, -12) };
  // Compare with last year only when the demo's history reaches back that far
  const hasPrior = prior.from >= h.from;

  const revenue = useMemo(() => revenueEvents(d, h), [d, h]);
  const cogs = useMemo(() => cogsEvents(d, h), [d, h]);
  const pl = useMemo(() => profitAndLoss(h, revenue, cogs, range.from, range.to), [d, h, revenue, cogs, range.from, range.to]);
  const before = useMemo(() => (hasPrior ? profitAndLoss(h, revenue, cogs, prior.from, prior.to) : undefined), [d, h, revenue, cogs, prior.from, prior.to, hasPrior]);

  // Sales tax: taxable and non-taxable sales by category, by invoice date
  const tax = useMemo(() => {
    const rows = Object.fromEntries(REVENUE_CATEGORIES.map((c) => [c, { taxable: 0, exempt: 0 }])) as Record<RevenueCategory, { taxable: number; exempt: number }>;
    let collected = 0;
    let count = 0;
    for (const inv of d.invoices) {
      if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void' || !inRange(inv.issuedOn, range.from, range.to)) continue;
      for (const l of inv.lines) rows[l.category][l.taxable ? 'taxable' : 'exempt'] += l.qty * l.rate;
      collected += invoiceTotals(inv).tax;
      count++;
    }
    return { rows, collected, count };
  }, [d.invoices, range.from, range.to]);
  const taxableTotal = REVENUE_CATEGORIES.reduce((s, c) => s + tax.rows[c].taxable, 0);
  const exemptTotal = REVENUE_CATEGORIES.reduce((s, c) => s + tax.rows[c].exempt, 0);
  const rate = d.settings.taxRates[STORE];

  // Receivables by customer
  const aging = useMemo(() => {
    const map = new Map<string, { customer?: Customer; b: number[] }>();
    for (const inv of d.invoices) {
      if (!isReceivable(d, inv)) continue;
      const late = diffDays(t, inv.dueOn);
      const i = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
      const row = map.get(inv.customerId) ?? { customer: customerOf(d, inv.customerId), b: [0, 0, 0, 0, 0] };
      row.b[i] += invoiceTotals(inv).balance;
      map.set(inv.customerId, row);
    }
    return [...map.entries()].map(([id, r]) => ({ id, ...r, total: r.b.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
  }, [d, t]);
  const agingTotals = [0, 1, 2, 3, 4].map((i) => aging.reduce((s, r) => s + r.b[i], 0));

  const plRef = useRef<HTMLDivElement>(null);
  const taxRef = useRef<HTMLDivElement>(null);
  const arRef = useRef<HTMLDivElement>(null);

  const plCsv = () => {
    const rows: (string | number)[][] = [['Line', range.label, ...(before ? ['Same period last year'] : [])]];
    const line = (label: string, get: (p: PL) => number) => rows.push([label, cents(get(pl)), ...(before ? [cents(get(before))] : [])]);
    REVENUE_CATEGORIES.forEach((c) => line(`Revenue: ${c}`, (p) => p.rev[c]));
    line('Total revenue', (p) => p.revenueTotal);
    line('Cost of goods sold', (p) => p.cost);
    line('Gross profit', (p) => p.gross);
    OPEX_CATEGORIES.forEach((c) => line(`Expense: ${c}`, (p) => p.opex[c]));
    line('Total operating expenses', (p) => p.opexTotal);
    line('Net income', (p) => p.net);
    downloadCsv(`fibersteel-profit-and-loss-${range.from}-to-${range.to}.csv`, rows);
  };
  const taxCsv = () =>
    downloadCsv(`fibersteel-sales-tax-${range.from}-to-${range.to}.csv`, [
      ['Category', 'Taxable sales', 'Non-taxable sales'],
      ...REVENUE_CATEGORIES.map((c) => [c, cents(tax.rows[c].taxable), cents(tax.rows[c].exempt)]),
      ['Total', cents(taxableTotal), cents(exemptTotal)],
      [`Tax collected (${(rate * 100).toFixed(3)}%, ${tax.count} invoices)`, cents(tax.collected), ''],
    ]);
  const arCsv = () =>
    downloadCsv(`fibersteel-receivables-by-customer-${t}.csv`, [
      ['Customer', 'Current', '1-30 days', '31-60 days', '61-90 days', 'Over 90 days', 'Total'],
      ...aging.map((r) => [r.customer?.name ?? r.id, ...r.b.map(cents), cents(r.total)]),
    ]);

  const money0 = (n: number) => money(n, false);
  const cols = before ? 3 : 1;
  const row = (label: string, get: (p: PL) => number, cls?: string, indent?: boolean) => (
    <tr class={cls}>
      <th scope="row" class={indent ? 'pl-indent' : undefined}>
        {label}
      </th>
      <td class="is-right tabular">{money0(get(pl))}</td>
      {before && (
        <>
          <td class="is-right tabular">{money0(get(before))}</td>
          <td class="is-right tabular pl-change">{change(get(pl), get(before))}</td>
        </>
      )}
    </tr>
  );
  const pctRow = (label: string, get: (p: PL) => number, cls: string) => (
    <tr class={cls}>
      <th scope="row">{label}</th>
      <td class={`is-right tabular${get(pl) < 0 ? ' is-bad' : ''}`}>
        {money0(get(pl))} <span class="pl-pct">{pct(get(pl), pl.revenueTotal)}</span>
      </td>
      {before && (
        <>
          <td class={`is-right tabular${get(before) < 0 ? ' is-bad' : ''}`}>
            {money0(get(before))} <span class="pl-pct">{pct(get(before), before.revenueTotal)}</span>
          </td>
          <td class="is-right tabular pl-change">{change(get(pl), get(before))}</td>
        </>
      )}
    </tr>
  );

  return (
    <div class="acct-reports">
      <div class="toolbar">
        <Segmented label="Report period" value={period} onChange={(k) => setParams({ period: k === 'month' ? undefined : k }, { replace: true })} items={PERIODS.map((p) => ({ key: p.key, label: p.label }))} />
        <span class="toolbar__spacer" />
        <span class="muted small">{range.label} · work counted when it’s completed · sample data</span>
      </div>

      <Card
        title="Profit & loss"
        subtitle={before ? `${range.label}, next to the same days last year` : `${range.label} · the demo’s history doesn’t reach back a full year for this period`}
        actions={<ReportActions name="profit and loss" onCsv={plCsv} onPrint={() => plRef.current && printElement(plRef.current, `Profit & loss — ${range.label}`)} />}
        flush
      >
        <div ref={plRef} class="report-print">
          <p class="report-print__title">
            {site.name} — Profit &amp; loss, {range.label} (sample data)
          </p>
          <div class="table-wrap">
            <table class="table pl-table">
              <caption class="sr-only">Profit and loss, {range.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col" class="is-right">
                    {range.label}
                  </th>
                  {before && (
                    <>
                      <th scope="col" class="is-right">
                        Same days last year
                      </th>
                      <th scope="col" class="is-right">
                        Change
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr class="pl-section">
                  <th scope="rowgroup" colSpan={cols + 1}>
                    Revenue
                  </th>
                </tr>
                {REVENUE_CATEGORIES.map((c) => row(c, (p) => p.rev[c], undefined, true))}
                {row('Total revenue', (p) => p.revenueTotal, 'pl-subtotal')}
                {row('Cost of goods sold', (p) => p.cost, 'pl-cost')}
                {pctRow('Gross profit', (p) => p.gross, 'pl-subtotal')}
                <tr class="pl-section">
                  <th scope="rowgroup" colSpan={cols + 1}>
                    Operating expenses
                  </th>
                </tr>
                {OPEX_CATEGORIES.map((c) => row(c, (p) => p.opex[c], undefined, true))}
                {row('Total operating expenses', (p) => p.opexTotal, 'pl-subtotal')}
                {pctRow('Net income', (p) => p.net, 'pl-total')}
              </tbody>
            </table>
          </div>
          <p class="report-note">Cost of goods is what the lifts, parts and resale items cost at sample costs. Operating expenses are sample monthly figures.</p>
        </div>
      </Card>

      <div class="acct-reports__pair">
        <Card title="Sales tax" subtitle={`Invoices dated ${range.label}`} actions={<ReportActions name="sales tax" onCsv={taxCsv} onPrint={() => taxRef.current && printElement(taxRef.current, `Sales tax — ${range.label}`)} />} flush>
          <div ref={taxRef} class="report-print">
            <p class="report-print__title">
              {site.name} — Sales tax, {range.label} (sample data)
            </p>
            <div class="table-wrap">
              <table class="table">
                <caption class="sr-only">Taxable and non-taxable sales by category</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" class="is-right">
                      Taxable
                    </th>
                    <th scope="col" class="is-right">
                      Non-taxable
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {REVENUE_CATEGORIES.map((c) => (
                    <tr key={c}>
                      <th scope="row">{c}</th>
                      <td class="is-right tabular">{tax.rows[c].taxable ? money0(tax.rows[c].taxable) : '—'}</td>
                      <td class="is-right tabular">{tax.rows[c].exempt ? money0(tax.rows[c].exempt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td class="is-right tabular">{money0(taxableTotal)}</td>
                    <td class="is-right tabular">{money0(exemptTotal)}</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Tax collected <span class="muted">· {(rate * 100).toFixed(3)}% · {tax.count} invoices</span>
                    </th>
                    <td class="is-right tabular">{money(tax.collected)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p class="report-note">A sample rate, and sample rules: lifts, parts, remotes and dock steps are taxed; installation, labor and sales to dealers aren’t. FiberSteel’s accountant would set the real ones.</p>
          </div>
        </Card>

        <Card
          title="Receivables by customer"
          subtitle={`${aging.length} customers and dealers owe ${money0(agingTotals.reduce((a, b) => a + b, 0))}`}
          actions={<ReportActions name="receivables by customer" onCsv={arCsv} onPrint={() => arRef.current && printElement(arRef.current, 'Receivables by customer')} />}
          flush
        >
          <div ref={arRef} class="report-print">
            <p class="report-print__title">
              {site.name} — Receivables by customer, as of today (sample data)
            </p>
            <div class="table-wrap ar-table">
              <table class="table table--dense">
                <caption class="sr-only">Unpaid balances by customer and age</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col" class="is-right">
                      Current
                    </th>
                    <th scope="col" class="is-right">
                      1–30
                    </th>
                    <th scope="col" class="is-right">
                      31–60
                    </th>
                    <th scope="col" class="is-right">
                      61–90
                    </th>
                    <th scope="col" class="is-right">
                      90+
                    </th>
                    <th scope="col" class="is-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aging.slice(0, 15).map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <Link to={r.customer?.kind === 'dealer' && r.customer.dealerId ? `/office/dealers/?id=${r.customer.dealerId}` : `/office/customers/?id=${r.id}`} class="cell-main">
                          {r.customer?.name ?? r.id}
                        </Link>
                        {r.customer?.kind === 'dealer' && <span class="cell-sub">Dealer</span>}
                      </th>
                      {r.b.map((v, i) => (
                        <td key={i} class={`is-right tabular${i > 1 && v > 0 ? ' is-bad' : ''}`}>
                          {v > 0 ? money0(v) : '—'}
                        </td>
                      ))}
                      <td class="is-right tabular">
                        <strong>{money0(r.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total{aging.length > 15 ? ` (${aging.length})` : ''}</th>
                    {agingTotals.map((v, i) => (
                      <td key={i} class="is-right tabular">
                        {money0(v)}
                      </td>
                    ))}
                    <td class="is-right tabular">{money0(agingTotals.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
