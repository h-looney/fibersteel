/** Dealer sales: what each dealer account orders and when. The accounts are samples, never FiberSteel's real dealers. */
import { useMemo } from 'preact/hooks';
import { compactMoney, money, percent, plural, shortDate } from '../../../lib/format';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Button, Card, EmptyState, Link, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { dealerStatusMeta, orderStatusMeta, StatusBadge } from '../../../ui/status';
import { DataTable } from '../../../ui/Table';
import type { DealerOrderStatus } from '../../../data/types';
import type { ReportProps } from '../Analytics';
import { bucketIndex, downloadCSV, sum, timeBuckets } from '../facts';
import { dealerStats } from '../metrics';

const PIPELINE: DealerOrderStatus[] = ['quote', 'confirmed', 'building', 'ready', 'shipped'];

/** "Lake town, IA" — the town, with the state unless the town already carries it */
const place = (x: { city: string; state: string }) => (x.city.endsWith(`, ${x.state}`) || !x.state ? x.city : `${x.city}, ${x.state}`);

export default function DealerSales({ d, facts, range }: ReportProps) {
  const s = useMemo(() => dealerStats(d, facts, range), [d, facts, range.from, range.to]);
  const prev = useMemo(() => (range.prev ? dealerStats(d, facts, { ...range, from: range.prev.from, to: range.prev.to }) : undefined), [d, facts, range.from, range.to]);
  const rows = [...s.rows].sort((a, b) => b.revenue - a.revenue);
  const total = s.revenue + s.directRevenue;

  const buckets = timeBuckets(range.from, range.to);
  const series = buckets.map(() => 0);
  for (const x of s.sales) {
    const i = bucketIndex(buckets, x.day);
    if (i >= 0) series[i] += x.revenue;
  }

  // Orders in progress right now (live records)
  const pipeline = PIPELINE.map((st) => {
    const list = d.dealerOrders.filter((o) => o.status === st);
    return { status: st, count: list.length, value: sum(list.map((o) => sum(o.lines.map((l) => l.qty * l.rate)))) };
  });

  return (
    <div class="report">
      <div class="toolbar">
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`dealer-sales-${range.from}-to-${range.to}.csv`, [
              ['Dealer (sample account)', 'State', 'Status', 'Orders', 'Units', 'Revenue', 'Last order'],
              ...rows.map((r) => [r.dealer.name, r.dealer.state, dealerStatusMeta[r.dealer.status].label, r.orders, r.units, Math.round(r.revenue), r.last ?? '']),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Dealer revenue" icon="dollar" value={money(s.revenue, false)} delta={prev?.revenue ? s.revenue / prev.revenue - 1 : undefined} deltaLabel="vs. last year" hint={`${percent(s.revenue / Math.max(1, total))} of lift and product sales`} />
        <Stat label="Units shipped" icon="truck" value={s.units.toLocaleString()} hint={`${plural(s.orders, 'order')}`} />
        <Stat label="Dealers ordering" icon="handshake" value={`${s.ordering} of ${d.dealers.filter((x) => x.status === 'active').length}`} hint="Active sample accounts" to="/office/dealers/" />
        <Stat label="Average order" icon="receipt" value={s.orders ? money(s.revenue / s.orders, false) : '—'} hint="At dealer prices" />
      </div>

      <div class="grid-2">
        <ChartFrame title="Revenue by dealer" subtitle="Sample accounts" table={{ columns: ['Dealer', 'Orders', 'Units', 'Revenue'], rows: rows.map((r) => [r.dealer.name, r.orders, r.units, money(r.revenue, false)]) }}>
          {rows.some((r) => r.revenue > 0) ? (
            <HBarChart
              ariaLabel="Dealer revenue by account"
              rows={rows
                .filter((r) => r.revenue > 0)
                .map((r) => ({ key: r.dealer.id, label: r.dealer.name, sub: `${place(r.dealer)} · ${plural(r.orders, 'order')}`, value: r.revenue }))}
              format={(n) => money(n, false)}
            />
          ) : (
            <EmptyState icon="handshake" title="No dealer orders in this range" />
          )}
        </ChartFrame>
        <ChartFrame title="What dealers order" subtitle="Units by category" table={{ columns: ['Category', 'Units', 'Share'], rows: s.categories.map((c) => [c.label, c.units, percent(c.units / Math.max(1, s.units))]) }}>
          {s.categories.length ? (
            <HBarChart ariaLabel="Dealer units by category" rows={s.categories.map((c) => ({ key: c.key, label: c.label, value: c.units, note: `· ${percent(c.units / Math.max(1, s.units))}` }))} format={(n) => String(n)} color="var(--series-2)" />
          ) : (
            <EmptyState icon="box" title="Nothing shipped in this range" />
          )}
        </ChartFrame>
      </div>

      <div class="grid-2 grid-2--wide">
        <ChartFrame title="Dealer revenue over time" subtitle={`${range.days <= 120 ? 'Weekly' : 'Monthly'} — dealers stock up in late winter and spring`} table={{ columns: ['Period', 'Revenue'], rows: buckets.map((b, i) => [b.title, money(series[i], false)]) }}>
          <BarChart
            ariaLabel="Dealer revenue over time"
            categories={buckets.map((b) => b.label)}
            titles={buckets.map((b) => b.title)}
            series={[{ key: 'dealer', label: 'Dealer revenue', color: 'var(--series-2)', values: series }]}
            format={(n) => money(n, false)}
            axisFormat={compactMoney}
            height={230}
          />
        </ChartFrame>
        <Card title="Orders in progress" subtitle="Right now, whatever the date range">
          <ul class="pipeline" role="list">
            {pipeline.map((p) => (
              <li key={p.status}>
                <Link class="pipeline__row" to={`/office/dealers/?tab=orders&status=${p.status}`}>
                  <StatusBadge meta={orderStatusMeta[p.status]} />
                  <span class="pipeline__count">{plural(p.count, 'order')}</span>
                  <span class="pipeline__value">{money(p.value, false)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Dealer accounts" flush>
        <DataTable
          caption="Dealer accounts and their orders"
          rows={rows}
          rowKey={(r) => r.dealer.id}
          initialSort={{ key: 'revenue', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              label: 'Dealer',
              sortValue: (r) => r.dealer.name,
              render: (r) => (
                <span>
                  <Link class="cell-main" to={`/office/dealers/?id=${r.dealer.id}`}>
                    {r.dealer.name}
                  </Link>
                  <span class="cell-sub">
                    {place(r.dealer)} · {r.dealer.area}
                  </span>
                </span>
              ),
            },
            { key: 'status', label: 'Status', sortValue: (r) => r.dealer.status, render: (r) => <StatusBadge meta={dealerStatusMeta[r.dealer.status]} />, hide: 'sm' },
            { key: 'orders', label: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => r.orders },
            { key: 'units', label: 'Units', align: 'right', sortValue: (r) => r.units, render: (r) => r.units, hide: 'sm' },
            { key: 'revenue', label: 'Revenue', align: 'right', sortValue: (r) => r.revenue, render: (r) => money(r.revenue, false) },
            { key: 'last', label: 'Last order', sortValue: (r) => r.last ?? '', render: (r) => (r.last ? shortDate(r.last) : <span class="muted">None in range</span>), hide: 'md' },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> The dealer accounts here are invented samples, so no made-up numbers are tied to a real business. FiberSteel’s real dealer list stays on the website (Website → Dealer list). Dealer revenue counts orders when they ship.
      </p>
    </div>
  );
}
