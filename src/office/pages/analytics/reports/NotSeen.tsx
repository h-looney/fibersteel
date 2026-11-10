/**
 * Not seen in a year — a sample idea, not FiberSteel policy: lake customers whose lift hasn't had a visit in twelve
 * months, so the service desk could offer a spring check-up while the 3- and 5-year parts are still covered.
 */
import { useMemo, useState } from 'preact/hooks';
import { openDialog } from '../../../dialogs';
import { addDays, diffDays } from '../../../lib/dates';
import { fromToday, plural, shortDate } from '../../../lib/format';
import { Badge, Button, Card, Chips, EmptyState, Link, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { downloadCSV } from '../facts';
import { notSeen } from '../metrics';

type Filter = 'three' | 'five' | 'recent' | 'all';

const ago = (days: number) => (days < 60 ? `${days} days` : days < 730 ? `${Math.round(days / 30.4)} months` : `${Math.floor(days / 365)}+ years`);

export default function NotSeen({ d, today }: ReportProps) {
  const [filter, setFilter] = useState<Filter>('three');
  const all = useMemo(() => notSeen(d, today), [d, today]);
  const open = all.filter((r) => !r.booked);
  const soon = (until?: string) => !!until && until >= today && until <= addDays(today, 120);
  const groups: Record<Filter, typeof all> = {
    three: open.filter((r) => soon(r.threeYearEnds)),
    five: open.filter((r) => soon(r.fiveYearEnds)),
    recent: open.filter((r) => r.lift.installedOn >= addDays(today, -3 * 365)),
    all: open,
  };
  const shown = groups[filter];
  const booked = all.filter((r) => r.booked).length;
  const where = (r: (typeof all)[number]) => (r.customer?.lake ? `${r.customer.lake.arm}${r.customer.lake.mm !== undefined ? `, MM ${r.customer.lake.mm}` : ''}` : (r.customer?.address.city ?? ''));

  return (
    <div class="report">
      <div class="callout callout--blue">
        <Icon name="sparkle" size={18} />
        <div>
          <p class="callout__title">A sample idea, not FiberSteel policy</p>
          <p class="callout__text">
            FiberSteel’s site doesn’t mention a yearly check-up. This list shows how FiberSteel mode could help if FiberSteel wanted one: lifts with no visit in twelve months, starting with the ones whose 3-year coverage (blower controller, bushings and hose) or 5-year coverage (galvanized parts) ends soon.
          </p>
        </div>
      </div>

      <div class="stats">
        <Stat label="3-year coverage ends soon" icon="shield" value={groups.three.length} hint="Within 4 months · no visit in a year" />
        <Stat label="5-year coverage ends soon" icon="shield" value={groups.five.length} hint="Galvanized parts · within 4 months" />
        <Stat label="Installed in the last 3 years" icon="lift" value={groups.recent.length} hint="No visit in 12 months" />
        <Stat label="Already booked" icon="check-circle" value={booked} hint="A service visit is on the schedule" />
      </div>

      <div class="toolbar">
        <Chips
          label="Which lifts"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'three', label: '3-year coverage ends soon', count: groups.three.length },
            { key: 'five', label: '5-year coverage ends soon', count: groups.five.length },
            { key: 'recent', label: 'Installed in the last 3 years', count: groups.recent.length },
            { key: 'all', label: 'All', count: groups.all.length },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`not-seen-in-a-year-${today}.csv`, [
              ['Customer', 'Phone', 'Email', 'Where', 'Lift', 'Serial', 'Installed', 'Last visit', '3-year coverage ends', '5-year coverage ends'],
              ...shown.map((r) => [r.customer?.name ?? '', r.customer?.phone ?? '', r.customer?.email ?? '', where(r), r.lift.model, r.lift.serial, r.lift.installedOn, r.lift.lastServiceOn ?? '', r.threeYearEnds ?? '', r.fiveYearEnds ?? '']),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <Card title="Lifts without a visit in a year" subtitle="Twelve months after the last visit (or the install). Lifts with a visit already booked are left out." flush>
        <DataTable
          caption="Lifts without a visit in a year"
          rows={shown}
          rowKey={(r) => r.lift.id}
          pageSize={15}
          initialSort={{ key: filter === 'five' ? 'five' : 'three', dir: 'asc' }}
          empty={<EmptyState icon="check-circle" title="Nobody in this group">Every lift here has had a visit in the last year, or has one booked.</EmptyState>}
          columns={[
            {
              key: 'customer',
              label: 'Customer',
              sortValue: (r) => r.customer?.name ?? '',
              render: (r) => (
                <span>
                  <Link class="cell-main" to={`/office/customers/?id=${r.lift.customerId}&lift=${r.lift.id}`}>
                    {r.customer?.name}
                  </Link>
                  <span class="cell-sub">{where(r)}</span>
                </span>
              ),
            },
            {
              key: 'lift',
              label: 'Lift',
              sortValue: (r) => r.lift.capacity,
              render: (r) => (
                <span>
                  {r.lift.model}
                  <span class="cell-sub">
                    Installed {shortDate(r.lift.installedOn, true)} · {r.lift.serial}
                  </span>
                </span>
              ),
              hide: 'sm',
            },
            { key: 'last', label: 'Last visit', sortValue: (r) => r.lastSeen, render: (r) => (r.lift.lastServiceOn ? `${ago(diffDays(today, r.lift.lastServiceOn))} ago` : <span class="muted">Not since the install</span>), hide: 'md' },
            {
              key: 'three',
              label: '3-year coverage',
              sortValue: (r) => r.threeYearEnds ?? '9999',
              render: (r) =>
                r.threeYearEnds ? (
                  soon(r.threeYearEnds) ? (
                    <Badge tone="amber" icon="clock">
                      {`Ends ${shortDate(r.threeYearEnds)}`}
                    </Badge>
                  ) : (
                    <span>
                      {shortDate(r.threeYearEnds)}
                      <span class="cell-sub">{fromToday(r.threeYearEnds)}</span>
                    </span>
                  )
                ) : (
                  <span class="muted">Ended or not covered</span>
                ),
            },
            {
              key: 'five',
              label: '5-year coverage',
              sortValue: (r) => r.fiveYearEnds ?? '9999',
              render: (r) => (r.fiveYearEnds ? soon(r.fiveYearEnds) ? <Badge tone="amber" icon="clock">{`Ends ${shortDate(r.fiveYearEnds)}`}</Badge> : shortDate(r.fiveYearEnds) : <span class="muted">Ended or not covered</span>),
              hide: 'md',
            },
            { key: 'pref', label: 'Prefers', sortValue: (r) => r.customer?.contactPref ?? '', render: (r) => (r.customer ? ({ phone: 'Phone', email: 'Email', text: 'Text' } as const)[r.customer.contactPref] : '—'), hide: 'md' },
            {
              key: 'act',
              label: <span class="sr-only">Actions</span>,
              align: 'right',
              render: (r) => (
                <Button size="sm" variant="ghost" icon="calendar-plus" aria-label={`Book a visit for ${r.customer?.name ?? 'this lift'}`} onClick={() => openDialog({ kind: 'job', preset: { type: 'service', customerId: r.lift.customerId, liftId: r.lift.id, title: `Check-up — ${r.customer?.name ?? r.lift.model}` } })}>
                  <span class="hide-sm">Book</span>
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> Coverage dates follow FiberSteel’s published warranty and apply to the original purchaser of a lift FiberSteel installed. {plural(all.length, 'lift')} in the sample registry have had no visit in a year.
      </p>
    </div>
  );
}
