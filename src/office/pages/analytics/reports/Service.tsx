/** Service: calls by the part of the lift involved and by problem, warranty claims, and lifts that keep needing a visit. */
import { useMemo } from 'preact/hooks';
import { issues } from '../../../data/catalog';
import { openDialog } from '../../../dialogs';
import { decimal, money, percent, plural, shortDate } from '../../../lib/format';
import { navigate } from '../../../router';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Badge, Button, Card, EmptyState, Link, Menu, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { claimStatusMeta, StatusBadge } from '../../../ui/status';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { bucketIndex, downloadCSV, sum, timeBuckets } from '../facts';
import { liftsInService, repeatLifts, reportLiftName, serviceStats } from '../metrics';
import { STAND_IN_NOTE } from '../standIns';

/** Which warranty term covers each part of the lift (FiberSteel's Warranty page) */
const TERM: Record<string, string> = {
  'Poly tank': 'Lifetime',
  'Lift frame': 'Lifetime',
  'Galvanized part': '5 years',
  'Blower controller': '3 years',
  Bushings: '3 years',
  Hose: '3 years',
  'Remote system': 'The remote’s maker',
};

export default function Service({ d, h, facts, range, today }: ReportProps) {
  const s = useMemo(() => serviceStats(facts, range), [facts, range.from, range.to]);
  const repeats = useMemo(() => repeatLifts(d, facts, today), [d, facts, today]);
  const base = liftsInService(d, h, range.to);
  const perYear = s.total ? (s.total / Math.max(1, base)) * 100 * (365 / Math.max(1, range.days)) : 0;
  const claims = d.claims.filter((c) => c.openedOn >= range.from && c.openedOn <= range.to);
  const claimsCovered = claims.filter((c) => c.status !== 'denied' && c.status !== 'referred');

  // Calls over time: paid service and warranty
  const buckets = timeBuckets(range.from, range.to);
  const paid = buckets.map(() => 0);
  const warranty = buckets.map(() => 0);
  for (const f of s.calls) {
    const i = bucketIndex(buckets, f.day);
    if (i >= 0) (f.type === 'warranty' ? warranty : paid)[i]++;
  }

  const components = [...s.byComponent].sort((a, b) => b.calls - a.calls);

  return (
    <div class="report">
      <div class="toolbar">
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`service-${range.from}-to-${range.to}.csv`, [
              ['Part of the lift', 'Calls', 'Under warranty', 'Return trips', 'Warranty term'],
              ...components.map((c) => [c.label, c.calls, c.warranty, c.returns, TERM[c.key] ?? '']),
              [],
              ['Problem', 'Calls'],
              ...s.byIssue.map((r) => [r.label, r.calls]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Service & warranty calls" icon="wrench" value={s.total.toLocaleString()} hint={`${decimal(perYear)} a year per 100 lifts in service`} />
        <Stat label="Under warranty" icon="shield" value={s.total ? percent(s.warranty / s.total) : '—'} hint={`${plural(s.warranty, 'call')} · parts covered, the owner pays the call and labor`} />
        <Stat label="Return trips" icon="undo" value={s.total ? percent(s.returns / s.total) : '—'} hint={`${plural(s.returns, 'visit')} went back for an earlier job`} />
        <Stat label="Warranty parts" icon="dollar" value={money(sum(claimsCovered.map((c) => c.partCost)), false)} hint={`${plural(claims.length, 'claim')} opened · at FiberSteel’s cost`} to="/office/warranty/?tab=claims" />
      </div>

      <div class="grid-2">
        <ChartFrame
          title="Calls by the part of the lift"
          subtitle="What the call was about, with the warranty term that covers it"
          table={{ columns: ['Part of the lift', 'Calls', 'Under warranty', 'Warranty term'], rows: components.map((c) => [c.label, c.calls, c.warranty, TERM[c.key] ?? '']) }}
        >
          {components.length ? (
            <HBarChart
              ariaLabel="Service calls by the part of the lift"
              rows={components.map((c) => ({ key: c.key, label: c.label, sub: `Warranty: ${TERM[c.key] ?? '—'}`, value: c.calls, note: `· ${percent(c.calls / Math.max(1, s.total))}` }))}
              format={(n) => String(n)}
            />
          ) : (
            <EmptyState icon="check-circle" title="No service calls in this range" />
          )}
        </ChartFrame>
        <ChartFrame title="Most common problems" subtitle="Share of service and warranty calls" table={{ columns: ['Problem', 'Part of the lift', 'Calls', 'Share'], rows: s.byIssue.map((r) => [r.label, r.component ?? '', r.calls, percent(r.calls / Math.max(1, s.total))]) }}>
          {s.byIssue.length ? (
            <HBarChart ariaLabel="Most common problems" rows={s.byIssue.slice(0, 9).map((r) => ({ key: r.key, label: r.label, value: r.calls, note: `· ${percent(r.calls / Math.max(1, s.total))}` }))} format={(n) => String(n)} color="var(--series-2)" />
          ) : (
            <EmptyState icon="check-circle" title="No service calls in this range" />
          )}
        </ChartFrame>
      </div>

      <ChartFrame
        title="Calls over time"
        subtitle={`${range.days <= 120 ? 'Weekly' : 'Monthly'} — service runs with the boating season`}
        legend={[
          { label: 'Paid service', color: 'var(--series-1)' },
          { label: 'Warranty', color: 'var(--series-3)' },
        ]}
        table={{ columns: ['Period', 'Paid service', 'Warranty', 'Total'], rows: buckets.map((b, i) => [b.title, paid[i], warranty[i], paid[i] + warranty[i]]) }}
      >
        <BarChart
          ariaLabel="Service and warranty calls over time"
          categories={buckets.map((b) => b.label)}
          titles={buckets.map((b) => b.title)}
          series={[
            { key: 'paid', label: 'Paid service', color: 'var(--series-1)', values: paid },
            { key: 'warranty', label: 'Warranty', color: 'var(--series-3)', values: warranty },
          ]}
          format={(n) => plural(n, 'call')}
          axisFormat={(n) => String(n)}
          height={230}
        />
      </ChartFrame>

      <div class="callout callout--amber">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Sample data</p>
          <p class="callout__text">{STAND_IN_NOTE}</p>
        </div>
      </div>

      <Card title="Lifts that keep needing a visit" subtitle="Three or more service or warranty calls in the last 12 months — worth a closer look at the setup" flush>
        <DataTable
          caption="Lifts with repeat service visits"
          rows={repeats}
          rowKey={(r) => r.lift.id}
          pageSize={10}
          initialSort={{ key: 'visits', dir: 'desc' }}
          empty={<EmptyState icon="check-circle" title="No repeat visits">No lift has needed three or more calls in the last year.</EmptyState>}
          columns={[
            {
              key: 'customer',
              label: 'Customer',
              sortValue: (r) => r.customer?.name ?? '',
              render: (r) => (
                <span>
                  <Link class="cell-main" to={`/office/customers/?id=${r.lift.customerId}&lift=${r.lift.id}`}>
                    {r.customer?.name ?? r.lift.customerId}
                  </Link>
                  <span class="cell-sub">{r.customer?.lake ? `${r.customer.lake.arm}${r.customer.lake.mm !== undefined ? `, MM ${r.customer.lake.mm}` : ''}` : r.customer?.address.city}</span>
                </span>
              ),
            },
            {
              key: 'lift',
              label: 'Lift',
              sortValue: (r) => reportLiftName(d, r.lift),
              // The lift under its stand-in size name (standIns.ts)
              render: (r) => (
                <span>
                  {reportLiftName(d, r.lift)}
                  <span class="cell-sub">
                    {r.lift.installedBy === 'FiberSteel' ? 'Installed by FiberSteel' : r.lift.installedBy === 'Dealer' ? 'Installed by a dealer' : 'Installed by someone else'} · {r.lift.installedOn.slice(0, 4)}
                  </span>
                </span>
              ),
              hide: 'sm',
            },
            { key: 'visits', label: 'Visits', align: 'right', sortValue: (r) => r.visits, render: (r) => <strong>{r.visits}</strong> },
            { key: 'warranty', label: 'Warranty', align: 'right', sortValue: (r) => r.warranty, render: (r) => r.warranty, hide: 'md' },
            {
              key: 'last',
              label: 'Last problem',
              sortValue: (r) => r.last.day,
              render: (r) => (
                <span>
                  {issues[r.last.issue ?? '']?.label ?? r.last.component ?? 'Service'}
                  <span class="cell-sub">{shortDate(r.last.day)}</span>
                </span>
              ),
              hide: 'sm',
            },
            {
              key: 'act',
              label: <span class="sr-only">Actions</span>,
              align: 'right',
              render: (r) => (
                <Menu
                  label={`Actions for ${r.customer?.name ?? 'this lift'}`}
                  size="sm"
                  items={[
                    { label: 'Book a service visit', icon: 'calendar-plus', onSelect: () => openDialog({ kind: 'job', preset: { type: 'service', customerId: r.lift.customerId, liftId: r.lift.id } }) },
                    { label: 'Open the customer', icon: 'user', onSelect: () => navigate(`/office/customers/?id=${r.lift.customerId}&lift=${r.lift.id}`) },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card title="Warranty claims in this range" subtitle="Parts only — the owner pays the service call and labor" flush>
        <DataTable
          caption="Warranty claims"
          dense
          rows={claims}
          rowKey={(c) => c.id}
          pageSize={8}
          initialSort={{ key: 'opened', dir: 'desc' }}
          empty={<EmptyState icon="shield" title="No warranty claims in this range">Claims are kept from the detailed records (the last few weeks).</EmptyState>}
          columns={[
            { key: 'id', label: 'Claim', sortValue: (c) => c.id, render: (c) => <Link to={`/office/warranty/?tab=claims&id=${c.id}`}>{c.id}</Link> },
            { key: 'opened', label: 'Opened', sortValue: (c) => c.openedOn, render: (c) => shortDate(c.openedOn), hide: 'sm' },
            { key: 'component', label: 'Part of the lift', sortValue: (c) => c.component, render: (c) => c.component },
            { key: 'part', label: 'Part', sortValue: (c) => c.part, render: (c) => c.part, hide: 'md' },
            { key: 'cost', label: 'Part cost', align: 'right', sortValue: (c) => c.partCost, render: (c) => money(c.partCost, false), hide: 'sm' },
            { key: 'status', label: 'Status', sortValue: (c) => c.status, render: (c) => <StatusBadge meta={claimStatusMeta[c.status]} /> },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> FiberSteel’s warranty, as its site states it: lifetime on the polyethylene tanks and lift frame, 5 years on hot-dipped galvanized parts, 3 years on the blower controller, bushings and hose — to the original purchaser, for lifts FiberSteel installed. Remote systems are covered by their makers. <Badge tone="neutral">{plural(base, 'lift')} in service</Badge>
      </p>
    </div>
  );
}
