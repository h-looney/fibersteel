/** Inventory health: components and products — what's used, what's sitting, and what's about to run out. */
import { useMemo, useState } from 'preact/hooks';
import { money, plural, shortDate } from '../../../lib/format';
import { ChartFrame, HBarChart } from '../../../ui/charts';
import { Badge, Button, Card, Chips, EmptyState, Link, Stat, type Tone } from '../../../ui/core';
import { Icon, type IconName } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { downloadCSV, median, sum } from '../facts';
import { inventoryHealth, type Health } from '../metrics';
import { isStandIn, reportCategory, reportItemName, STAND_IN_NOTE } from '../standIns';

const healthMeta: Record<Health, { label: string; tone: Tone; icon: IconName }> = {
  out: { label: 'Out of stock', tone: 'red', icon: 'x-circle' },
  low: { label: 'Low', tone: 'amber', icon: 'alert' },
  slow: { label: 'Sitting', tone: 'violet', icon: 'clock' },
  overstock: { label: 'More than a year’s worth', tone: 'blue', icon: 'layers' },
  healthy: { label: 'Healthy', tone: 'green', icon: 'check' },
  special: { label: 'Built to order', tone: 'neutral', icon: 'hardhat' },
  single: { label: 'Used · one of a kind', tone: 'neutral', icon: 'tag' },
};

export default function InventoryHealth({ d, h, facts, range, today }: ReportProps) {
  const [filter, setFilter] = useState<'all' | Health>('all');
  const rows = useMemo(() => inventoryHealth(d, h, facts, range, today), [d, h, facts, range.from, range.to, today]);
  const counts = (x: Health) => rows.filter((r) => r.health === x).length;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.health === filter);
  const slow = rows.filter((r) => r.health === 'slow');
  const components = rows.filter((r) => r.item.kind === 'component' && r.daysOfSupply !== undefined).map((r) => r.daysOfSupply!);

  const byCategory = new Map<string, number>();
  for (const r of rows) {
    if (r.value <= 0) continue;
    const c = r.item.kind === 'component' ? r.item.category : reportCategory(r.item);
    byCategory.set(c, (byCategory.get(c) ?? 0) + r.value);
  }
  const valueByCat = [...byCategory.entries()].map(([key, value]) => ({ key, label: key, value })).sort((a, b) => b.value - a.value);
  const name = (r: (typeof rows)[number]) => reportItemName(d, r.item);

  return (
    <div class="report">
      <div class="toolbar">
        <Chips
          label="Stock health"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'all', label: 'All items', count: rows.length },
            { key: 'low', label: 'Low', count: counts('low') },
            { key: 'out', label: 'Out', count: counts('out') },
            { key: 'slow', label: 'Sitting', count: counts('slow') },
            { key: 'overstock', label: 'A year’s worth or more', count: counts('overstock') },
            { key: 'special', label: 'Built to order', count: counts('special') },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`inventory-health-${today}.csv`, [
              ['SKU', 'Item', 'Category', 'On hand', 'Available', `Used or sold (${range.label})`, 'Last used', 'Days of supply', 'Value at cost', 'Status'],
              ...rows.map((r) => [isStandIn(r.item) ? '' : r.item.id, name(r), isStandIn(r.item) ? reportCategory(r.item) : r.item.category, r.onHand, r.available, r.used, r.lastUsed ?? '', r.daysOfSupply !== undefined ? Math.round(r.daysOfSupply) : '', Math.round(r.value), healthMeta[r.health].label]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Stock value at cost" icon="box" value={money(sum(rows.map((r) => r.value)), false)} hint="Components, finished lifts and add-ons" />
        <Stat label="Low or out of stock" icon="alert" value={counts('low') + counts('out')} hint="At or below the reorder point" to="/office/inventory/?filter=low" />
        <Stat label="Sitting" icon="clock" value={slow.length} hint={`${money(sum(slow.map((r) => r.value)), false)} tied up · nothing used in 120+ days`} />
        <Stat label="Components: days of supply" icon="calendar" value={components.length ? `${Math.round(median(components))} days` : '—'} hint="Median, at the pace of this range" />
      </div>

      <div class="callout callout--amber">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Sample data — stand-in names</p>
          <p class="callout__text">{STAND_IN_NOTE}</p>
        </div>
      </div>

      <ChartFrame title="Stock value by category" subtitle="At sample costs" table={{ columns: ['Category', 'Value at cost'], rows: valueByCat.map((c) => [c.label, money(c.value, false)]) }}>
        <HBarChart ariaLabel="Stock value by category" rows={valueByCat} format={(n) => money(n, false)} />
      </ChartFrame>

      <Card title="Items" subtitle={`${plural(shown.length, 'item')} · use measured over ${range.label.toLowerCase()}`} flush>
        <DataTable
          caption="Inventory health by item"
          rows={shown}
          rowKey={(r) => r.item.id}
          initialSort={{ key: 'value', dir: 'desc' }}
          empty={<EmptyState icon="check-circle" title="Nothing in this group" />}
          columns={[
            {
              key: 'item',
              label: 'Item',
              sortValue: (r) => name(r),
              // Lifts and add-ons under stand-in names, without the link or SKU that would name them (standIns.ts)
              render: (r) =>
                isStandIn(r.item) ? (
                  <span>
                    <span class="cell-main">{name(r)}</span>
                    <span class="cell-sub">{reportCategory(r.item)}</span>
                  </span>
                ) : (
                  <span>
                    <Link class="cell-main" to={`/office/inventory/?id=${r.item.id}`}>
                      {r.item.name}
                    </Link>
                    <span class="cell-sub">
                      {r.item.id} · {r.item.category}
                    </span>
                  </span>
                ),
            },
            { key: 'onHand', label: 'On hand', align: 'right', sortValue: (r) => r.onHand, render: (r) => `${r.onHand.toLocaleString()}${r.item.uom === 'ft' ? ' ft' : ''}` },
            { key: 'used', label: 'Used or sold', align: 'right', sortValue: (r) => r.used, render: (r) => r.used.toLocaleString() },
            { key: 'last', label: 'Last used', sortValue: (r) => r.lastUsed ?? '', render: (r) => (r.lastUsed ? shortDate(r.lastUsed) : <span class="muted">Not in the records</span>), hide: 'sm' },
            { key: 'supply', label: 'Days of supply', align: 'right', sortValue: (r) => r.daysOfSupply ?? 99999, render: (r) => (r.daysOfSupply === undefined ? '—' : Math.round(r.daysOfSupply).toLocaleString()), hide: 'md' },
            { key: 'value', label: 'Value', align: 'right', sortValue: (r) => r.value, render: (r) => money(r.value, false) },
            {
              key: 'status',
              label: 'Status',
              sortValue: (r) => r.health,
              render: (r) => (
                <Badge tone={healthMeta[r.health].tone} icon={healthMeta[r.health].icon}>
                  {healthMeta[r.health].label}
                </Badge>
              ),
            },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> “Used” counts what left stock: components that went into shop builds and service calls, finished lifts that went out on installs and dealer orders, and add-ons sold. Days of supply = what’s available now ÷ the average daily use in this range. Costs and stock levels are sample data.
      </p>
    </div>
  );
}
