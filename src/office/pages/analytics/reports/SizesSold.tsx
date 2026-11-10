/** Sizes sold: which lifts and add-ons sell — to lake customers and to dealers — by units, revenue or margin. */
import { useMemo, useState } from 'preact/hooks';
import { compact, compactMoney, money, percent, plural } from '../../../lib/format';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Badge, Button, Card, EmptyState, Segmented, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { bucketIndex, downloadCSV, sum, timeBuckets, within } from '../facts';
import { sizesSold, type SoldRow } from '../metrics';
import { STAND_IN_NOTE } from '../standIns';

type Metric = 'units' | 'revenue' | 'margin';

export default function SizesSold({ d, facts, range }: ReportProps) {
  const [metric, setMetric] = useState<Metric>('units');
  const [by, setBy] = useState<'size' | 'category'>('size');
  const [what, setWhat] = useState<'lifts' | 'all'>('lifts');
  const rows = useMemo(() => sizesSold(d, facts, range, by, what), [d, facts, range.from, range.to, by, what]);
  const prev = useMemo(() => (range.prev ? sizesSold(d, facts, { ...range, from: range.prev.from, to: range.prev.to }, 'category', what) : undefined), [d, facts, range.from, range.to, what]);
  const valueOf = (r: SoldRow) => (metric === 'units' ? r.units : metric === 'revenue' ? r.revenue : r.revenue - r.cost);
  const fmt = (n: number) => (metric === 'units' ? compact(n) : money(n, false));
  const ranked = [...rows].sort((a, b) => valueOf(b) - valueOf(a));

  const units = sum(rows.map((r) => r.units));
  const dealerUnits = sum(rows.map((r) => r.dealer));
  const revenue = sum(rows.map((r) => r.revenue));
  const cost = sum(rows.map((r) => r.cost));
  const prevUnits = prev ? sum(prev.map((r) => r.units)) : 0;
  const prevRevenue = prev ? sum(prev.map((r) => r.revenue)) : 0;

  // Units over time, lake customers and dealers
  const buckets = timeBuckets(range.from, range.to);
  const direct = buckets.map(() => 0);
  const dealer = buckets.map(() => 0);
  const counted = new Set(d.items.filter((i) => what === 'all' || i.kind === 'lift').map((i) => i.id));
  for (const s of within(facts.sales, range.from, range.to)) {
    if (!counted.has(s.itemId)) continue;
    const i = bucketIndex(buckets, s.day);
    if (i >= 0) (s.channel === 'dealer' ? dealer : direct)[i] += s.qty;
  }

  const top = ranked.slice(0, 10);
  const split = metric === 'units';
  const noun = what === 'lifts' ? 'lift' : 'item';

  return (
    <div class="report">
      <div class="toolbar">
        <Segmented
          label="What to count"
          value={what}
          onChange={setWhat}
          items={[
            { key: 'lifts', label: 'Lifts' },
            { key: 'all', label: 'Everything sold' },
          ]}
        />
        <Segmented
          label="Measure"
          value={metric}
          onChange={setMetric}
          items={[
            { key: 'units', label: 'Units' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'margin', label: 'Gross margin' },
          ]}
        />
        <Segmented
          label="Group by"
          value={by}
          onChange={setBy}
          items={[
            { key: 'size', label: what === 'lifts' ? 'Size' : 'Item' },
            { key: 'category', label: 'Category' },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`sizes-sold-${range.from}-to-${range.to}.csv`, [
              ['Rank', by === 'size' ? 'Lift or item (stand-in)' : 'Category', 'Units', 'Lake customers', 'Dealers', 'Revenue', 'Gross margin %', 'Average price'],
              ...ranked.map((r, i) => [i + 1, r.label, r.units, r.direct, r.dealer, Math.round(r.revenue), +(r.margin * 100).toFixed(1), Math.round(r.avgPrice)]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label={what === 'lifts' ? 'Lifts sold' : 'Units sold'} icon="lift" value={units.toLocaleString()} delta={prevUnits ? units / prevUnits - 1 : undefined} deltaLabel="vs. last year" hint={`${percent(dealerUnits / Math.max(1, units))} through dealers`} />
        <Stat label="Revenue" icon="dollar" value={money(revenue, false)} delta={prevRevenue ? revenue / prevRevenue - 1 : undefined} deltaLabel="vs. last year" />
        <Stat label="Average selling price" icon="tag" value={units ? money(revenue / units, false) : '—'} hint="Dealer prices are below list" />
        <Stat label="Gross margin" icon="trend" value={revenue ? percent((revenue - cost) / revenue) : '—'} hint={`${money(revenue - cost, false)} over sample costs`} />
      </div>

      <div class="callout callout--amber">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Sample data — stand-in names</p>
          <p class="callout__text">{STAND_IN_NOTE}</p>
        </div>
      </div>

      <div class="grid-2">
        <ChartFrame
          title={`Top ${by === 'size' ? (what === 'lifts' ? 'lifts' : 'items') : 'categories'} by ${metric === 'units' ? 'units sold' : metric === 'revenue' ? 'revenue' : 'gross margin'}`}
          subtitle={split ? 'Split into lake customers and dealers' : range.label}
          legend={split ? [{ label: 'Lake customers', color: 'var(--series-1)' }, { label: 'Dealers', color: 'var(--series-2)' }] : undefined}
          table={{ columns: ['Rank', 'Name', 'Units', 'Lake customers', 'Dealers', 'Revenue', 'Gross margin'], rows: top.map((r, i) => [i + 1, r.label, r.units, r.direct, r.dealer, money(r.revenue, false), percent(r.margin)]) }}
        >
          {top.length ? (
            <HBarChart
              ariaLabel={`Top sellers by ${metric}`}
              rows={top.map((r, i) => ({ key: r.key, label: `${i + 1}. ${r.label}`, sub: by === 'size' ? r.category : undefined, value: split ? r.direct : valueOf(r), value2: split ? r.dealer : undefined }))}
              format={fmt}
              labels={['Lake customers', 'Dealers']}
            />
          ) : (
            <EmptyState icon="lift" title="Nothing sold in this range" />
          )}
        </ChartFrame>
        <ChartFrame
          title={`${what === 'lifts' ? 'Lifts' : 'Units'} sold over time`}
          subtitle={`${range.days <= 120 ? 'Weekly' : 'Monthly'} — installs count on the day they’re finished, dealer orders when they ship`}
          legend={[
            { label: 'Lake customers', color: 'var(--series-1)' },
            { label: 'Dealers', color: 'var(--series-2)' },
          ]}
          table={{ columns: ['Period', 'Lake customers', 'Dealers', 'Total'], rows: buckets.map((b, i) => [b.title, direct[i], dealer[i], direct[i] + dealer[i]]) }}
        >
          <BarChart
            ariaLabel={`${what === 'lifts' ? 'Lifts' : 'Units'} sold over time, lake customers and dealers`}
            categories={buckets.map((b) => b.label)}
            titles={buckets.map((b) => b.title)}
            series={[
              { key: 'direct', label: 'Lake customers', color: 'var(--series-1)', values: direct },
              { key: 'dealer', label: 'Dealers', color: 'var(--series-2)', values: dealer },
            ]}
            format={(n) => plural(n, noun)}
            axisFormat={(n) => compact(n)}
            height={260}
          />
        </ChartFrame>
      </div>

      <Card title={what === 'lifts' ? 'Every lift sold' : 'Everything sold'} subtitle="Stand-in names, without links — see the note above" flush>
        <DataTable
          caption={what === 'lifts' ? 'Lifts sold' : 'Items sold'}
          rows={ranked}
          rowKey={(r) => r.key}
          initialSort={{ key: 'value', dir: 'desc' }}
          empty={<EmptyState icon="lift" title="Nothing sold in this range" />}
          columns={[
            {
              key: 'label',
              label: by === 'size' ? (what === 'lifts' ? 'Lift' : 'Item') : 'Category',
              sortValue: (r) => r.label,
              render: (r) =>
                r.itemId ? (
                  <span>
                    <span class="cell-main">{r.label}</span>
                    <span class="cell-sub">{r.category}</span>
                  </span>
                ) : (
                  <span class="cell-main">{r.label}</span>
                ),
            },
            { key: 'value', label: 'Units', align: 'right', sortValue: (r) => r.units, render: (r) => <strong>{r.units}</strong> },
            { key: 'split', label: 'Lake / dealers', align: 'right', render: (r) => `${r.direct} / ${r.dealer}`, hide: 'sm' },
            { key: 'revenue', label: 'Revenue', align: 'right', sortValue: (r) => r.revenue, render: (r) => money(r.revenue, false) },
            { key: 'margin', label: 'Margin', align: 'right', sortValue: (r) => r.margin, render: (r) => percent(r.margin), hide: 'sm' },
            { key: 'price', label: 'Avg price', align: 'right', sortValue: (r) => r.avgPrice, render: (r) => compactMoney(r.avgPrice), hide: 'md' },
            ...(by === 'size'
              ? [
                  {
                    key: 'stock',
                    label: 'Stock',
                    align: 'right' as const,
                    sortValue: (r: SoldRow) => (r.buildToOrder ? -1 : (r.daysOfSupply ?? 9999)),
                    render: (r: SoldRow) =>
                      r.buildToOrder ? (
                        <span class="muted">Built to order</span>
                      ) : r.daysOfSupply !== undefined && r.daysOfSupply < 21 ? (
                        <Badge tone="amber" icon="alert">
                          {`${r.available ?? 0} · ${Math.round(r.daysOfSupply)} days`}
                        </Badge>
                      ) : r.available !== undefined ? (
                        `${r.available} on hand`
                      ) : (
                        '—'
                      ),
                    hide: 'md' as const,
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> Counts what was delivered: lake installs on the day they were finished, dealer orders when they shipped, add-ons on the sale date. In the demo’s sample catalog most sizes are built to order, so “Stock” only applies to the ones kept on hand. Days of supply = what’s available now ÷ the average daily sales in this range.
      </p>
    </div>
  );
}
