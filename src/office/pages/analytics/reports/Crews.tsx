/** Crews & shop: install, service and build times against the estimate, on-time arrival and return trips. */
import { useMemo, useState } from 'preact/hooks';
import { jobTypeLabels } from '../../../data/catalog';
import { decimal, money, percent, plural, shortDate } from '../../../lib/format';
import { ChartFrame, HBarChart, LineChart } from '../../../ui/charts';
import { Avatar, Badge, Button, Card, EmptyState, Segmented, Stat } from '../../../ui/core';
import { Dialog } from '../../../ui/Dialog';
import { Icon } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { avg, bucketIndex, downloadCSV, sum, timeBuckets, within } from '../facts';
import { crewStats, installCrews, ratedStaff, type CrewRow, type CrewWork } from '../metrics';

const h1 = (n: number) => `${decimal(n)} h`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v * 100).toFixed(0)}%`;
const vsEstimate = (r: Pick<CrewRow, 'actual' | 'estimated'>) => (r.estimated ? r.actual / r.estimated - 1 : 0);
const returnRate = (r: CrewRow) => (r.service ? r.returns / r.service : 0);

export default function Crews({ d, facts, range }: ReportProps) {
  const [work, setWork] = useState<CrewWork>('all');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => crewStats(d, facts, range, work), [d, facts, range.from, range.to, work]);
  const crews = useMemo(() => installCrews(d, facts, range).sort((a, b) => a.hours / a.est - b.hours / b.est), [d, facts, range.from, range.to]);
  const rated = new Set(ratedStaff(d).map((s) => s.id));
  const jobs = within(facts.jobs, range.from, range.to).filter((f) => f.crew.some((id) => rated.has(id)));
  const installs = jobs.filter((f) => f.type === 'install');
  const service = jobs.filter((f) => f.type === 'service' || f.type === 'warranty' || f.type === 'remote');
  const builds = jobs.filter((f) => f.type === 'build');
  const ratio = (list: typeof jobs) => (sum(list.map((f) => f.estHours)) ? sum(list.map((f) => f.hours)) / sum(list.map((f) => f.estHours)) - 1 : 0);
  const field = [...installs, ...service];
  const returns = service.filter((f) => f.callback).length;

  const servicers = rows.filter((r) => r.service > 0).sort((a, b) => a.serviceHours - b.serviceHours);
  const shop = rows.filter((r) => r.builds > 0).sort((a, b) => vsEstimate(a) - vsEstimate(b));

  // Plain-language observations, computed from the numbers above
  const insights: string[] = [];
  if (crews.length > 1) {
    const best = crews[0];
    const diff = best.hours / best.est - 1;
    insights.push(
      Math.abs(diff) < 0.01
        ? `${best.label} come in right on the estimate for installs, across ${plural(best.installs, 'install')}.`
        : `${best.label} ${diff < 0 ? 'finish installs fastest against the estimate' : 'are closest to the estimate on installs'} — ${percent(Math.abs(diff))} ${diff < 0 ? 'under' : 'over'} across ${plural(best.installs, 'install')}.`,
    );
  }
  if (servicers.length > 1) {
    const fastest = servicers[0];
    insights.push(`${fastest.name.split(' ')[0]} has the quickest service visits at ${h1(fastest.serviceHours)} on average (${plural(fastest.service, 'visit')}).`);
    const most = [...servicers].filter((r) => r.service >= 12).sort((a, b) => returnRate(b) - returnRate(a))[0];
    if (most && returnRate(most) > 0.04) insights.push(`${most.name.split(' ')[0]} has the most return trips — ${percent(returnRate(most))} of service visits went back for an earlier job.${most.id === fastest.id ? ' Speed may be costing a few second visits.' : ''}`);
  }
  if (builds.length) {
    const b = ratio(builds);
    insights.push(`Shop builds ran ${Math.abs(b) < 0.02 ? 'right on the estimate' : `${percent(Math.abs(b))} ${b < 0 ? 'under' : 'over'} the estimate`} across ${plural(builds.length, 'build')}.`);
  }

  const detail = open ? rows.find((r) => r.id === open) : undefined;

  return (
    <div class="report">
      <div class="toolbar">
        <Segmented
          label="Kind of work"
          value={work}
          onChange={setWork}
          items={[
            { key: 'all', label: 'All work' },
            { key: 'install', label: 'Installs' },
            { key: 'service', label: 'Service' },
            { key: 'build', label: 'Shop builds' },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`crews-${range.from}-to-${range.to}.csv`, [
              ['Person', 'Team', 'Jobs', 'Installs', 'Avg install hours', 'Service visits', 'Avg service hours', 'Shop builds', 'Avg build hours', 'Vs estimate %', 'On time %', 'Return trips %', 'Billed as lead'],
              ...rows.map((r) => [r.name, r.team, r.jobs, r.installs, +r.installHours.toFixed(2), r.service, +r.serviceHours.toFixed(2), r.builds, +r.buildHours.toFixed(2), +(vsEstimate(r) * 100).toFixed(1), +((r.onTime / Math.max(1, r.timed)) * 100).toFixed(1), +(returnRate(r) * 100).toFixed(1), Math.round(r.revenue)]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Average install" icon="lift" value={installs.length ? h1(avg(installs.map((f) => f.hours))) : '—'} hint={`${plural(installs.length, 'install')} · ${signed(ratio(installs))} vs. estimate`} />
        <Stat label="Average service visit" icon="wrench" value={service.length ? h1(avg(service.map((f) => f.hours))) : '—'} hint={`${plural(service.length, 'visit')} · ${signed(ratio(service))} vs. estimate`} />
        <Stat label="Shop builds" icon="hardhat" value={builds.length.toLocaleString()} hint={builds.length ? `${h1(avg(builds.map((f) => f.hours)))} average · ${signed(ratio(builds))} vs. estimate` : 'None in this range'} />
        <Stat label="On-time arrival" icon="clock" value={field.length ? percent(field.filter((f) => f.onTime).length / field.length) : '—'} hint="Installs and service, within 15 minutes of the window" />
        <Stat label="Return trips" icon="undo" value={service.length ? percent(returns / service.length) : '—'} hint={`${plural(returns, 'visit')} went back for an earlier job`} />
      </div>

      {insights.length > 0 && (
        <div class="callout callout--blue insights">
          <Icon name="sparkle" size={18} />
          <div>
            <p class="callout__title">What stands out</p>
            <ul role="list">
              {insights.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div class="grid-2">
        {(work === 'all' || work === 'install') && (
          <ChartFrame
            title="Installs by crew"
            subtitle="Average hours on the water per install, against the estimate for the lift sizes each crew installed"
            table={{ columns: ['Crew', 'Installs', 'Average hours', 'Average estimate', 'On time'], rows: crews.map((c) => [c.label, c.installs, decimal(c.hours), decimal(c.est), percent(c.onTime)]) }}
          >
            {crews.length ? (
              <HBarChart
                ariaLabel="Average install hours by crew"
                rows={crews.map((c) => ({ key: c.key, label: c.label, sub: `${plural(c.installs, 'install')} · estimate ${h1(c.est)}`, value: c.hours, note: `· ${signed(c.hours / c.est - 1)}` }))}
                format={h1}
                reference={installs.length ? { value: avg(installs.map((f) => f.estHours)), label: `Average estimate ${h1(avg(installs.map((f) => f.estHours)))}` } : undefined}
                onSelect={(key) => setOpen(key.split('+')[0])}
              />
            ) : (
              <EmptyState icon="lift" title="No installs in this range" />
            )}
          </ChartFrame>
        )}
        {(work === 'all' || work === 'service') && (
          <ChartFrame
            title="Service visits by technician"
            subtitle="Service, warranty and remote installs. The line marks the average estimate."
            table={{ columns: ['Technician', 'Visits', 'Average hours', 'Average estimate', 'Return trips'], rows: servicers.map((r) => [r.name, r.service, decimal(r.serviceHours), decimal(r.serviceEst), percent(returnRate(r))]) }}
          >
            {servicers.length ? (
              <HBarChart
                ariaLabel="Average service visit hours by technician"
                rows={servicers.map((r) => ({ key: r.id, label: r.name, sub: `${plural(r.service, 'visit')} · ${percent(returnRate(r))} return trips`, value: r.serviceHours }))}
                format={h1}
                color="var(--series-2)"
                reference={servicers.length ? { value: avg(service.map((f) => f.estHours)), label: `Estimate ${h1(avg(service.map((f) => f.estHours)))}` } : undefined}
                onSelect={setOpen}
              />
            ) : (
              <EmptyState icon="wrench" title="No service visits in this range" />
            )}
          </ChartFrame>
        )}
        {(work === 'all' || work === 'build') && (
          <ChartFrame
            title="Shop builds"
            subtitle="Hours against the estimate for the lift sizes built (bigger lifts take longer)"
            table={{ columns: ['Builder', 'Builds', 'Average hours', 'Average estimate', 'Vs estimate'], rows: shop.map((r) => [r.name, r.builds, decimal(r.buildHours), decimal(r.buildEst), signed(vsEstimate(r))]) }}
          >
            {shop.length ? (
              <HBarChart
                ariaLabel="Shop build hours against the estimate"
                rows={shop.map((r) => ({ key: r.id, label: r.name, sub: `${plural(r.builds, 'build')} · ${signed(vsEstimate(r))} vs. estimate`, value: r.buildHours }))}
                format={h1}
                color="var(--series-3)"
                onSelect={setOpen}
              />
            ) : (
              <EmptyState icon="hardhat" title="No shop builds in this range" />
            )}
          </ChartFrame>
        )}
      </div>

      <Card title="Scorecard" subtitle="Select a person for their trend and recent jobs" flush>
        <DataTable
          caption="Crew and shop scorecard"
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpen(r.id)}
          initialSort={{ key: 'jobs', dir: 'desc' }}
          empty={<EmptyState icon="users" title="No crew or shop work in this range" />}
          columns={[
            {
              key: 'name',
              label: 'Person',
              sortValue: (r) => r.name,
              render: (r) => (
                <button type="button" class="tech-cell" onClick={() => setOpen(r.id)}>
                  <Avatar person={d.staff.find((s) => s.id === r.id)} size={30} />
                  <span>
                    <span class="cell-main">{r.name}</span>
                    <span class="cell-sub">
                      {r.title} · {r.team}
                    </span>
                  </span>
                </button>
              ),
            },
            { key: 'jobs', label: 'Jobs', align: 'right', sortValue: (r) => r.jobs, render: (r) => r.jobs },
            { key: 'install', label: 'Install avg', align: 'right', sortValue: (r) => r.installHours, render: (r) => (r.installs ? `${h1(r.installHours)} · ${r.installs}` : '—'), hide: 'sm' },
            { key: 'service', label: 'Service avg', align: 'right', sortValue: (r) => r.serviceHours, render: (r) => (r.service ? `${h1(r.serviceHours)} · ${r.service}` : '—'), hide: 'sm' },
            { key: 'build', label: 'Build avg', align: 'right', sortValue: (r) => r.buildHours, render: (r) => (r.builds ? `${h1(r.buildHours)} · ${r.builds}` : '—'), hide: 'md' },
            {
              key: 'ratio',
              label: 'Vs. estimate',
              align: 'right',
              sortValue: vsEstimate,
              render: (r) => {
                const v = vsEstimate(r);
                return <span class={v > 0.08 ? 'is-bad' : v < -0.03 ? 'is-good' : undefined}>{signed(v)}</span>;
              },
            },
            { key: 'onTime', label: 'On time', align: 'right', sortValue: (r) => r.onTime / Math.max(1, r.timed), render: (r) => percent(r.onTime / Math.max(1, r.timed)), hide: 'md' },
            {
              key: 'returns',
              label: 'Return trips',
              align: 'right',
              hide: 'sm',
              sortValue: returnRate,
              render: (r) =>
                r.service ? (
                  <span class="nowrap">
                    {percent(returnRate(r))}
                    {returnRate(r) >= 0.08 && (
                      <Badge tone="amber" icon="alert" class="ml-6">
                        High
                      </Badge>
                    )}
                  </span>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> Times come from the start and finish on each job (crews confirm them when they close out on a phone). Estimates are sample time standards by job type and lift size. Everyone rated here is a placeholder — FiberSteel’s team isn’t listed publicly — and the figures are made up for the demo.
      </p>

      {detail && <PersonDetail row={detail} props={{ d, facts, range }} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PersonDetail({ row, props, onClose }: { row: CrewRow; props: Pick<ReportProps, 'd' | 'facts' | 'range'>; onClose: () => void }) {
  const { d, facts, range } = props;
  const person = d.staff.find((s) => s.id === row.id);
  const mine = within(facts.jobs, range.from, range.to).filter((f) => f.crew.includes(row.id));
  const buckets = timeBuckets(range.from, range.to);
  const over = buckets.map(() => ({ hours: 0, est: 0 }));
  for (const f of mine) {
    const i = bucketIndex(buckets, f.day);
    if (i < 0) continue;
    over[i].hours += f.hours;
    over[i].est += f.estHours;
  }
  const types = (['site-visit', 'build', 'install', 'service', 'warranty', 'remote', 'delivery'] as const)
    .map((t) => {
      const l = mine.filter((f) => f.type === t);
      return { type: t, count: l.length, hours: avg(l.map((f) => f.hours)), est: avg(l.map((f) => f.estHours)) };
    })
    .filter((x) => x.count);
  const recent = [...mine].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 12);
  return (
    <Dialog title={row.name} description={`${row.title} · ${range.label}`} onClose={onClose} drawer size="lg" headerExtra={<Avatar person={person} size={40} />}>
      <div class="stats stats--compact">
        <Stat label="Jobs" value={row.jobs} />
        <Stat label="Vs. estimate" value={signed(vsEstimate(row))} />
        <Stat label="On time" value={percent(row.onTime / Math.max(1, row.timed))} />
        <Stat label="Billed as lead" value={money(row.revenue, false)} hint="Installation and service charges" />
      </div>
      <ChartFrame
        title="Hours against the estimate"
        level={3}
        table={{ columns: ['Period', 'Hours', 'Estimate'], rows: buckets.map((b, i) => [b.title, decimal(over[i].hours), decimal(over[i].est)]) }}
        legend={[
          { label: 'Hours worked', color: 'var(--series-1)', kind: 'line' },
          { label: 'Estimate', color: 'var(--series-muted)', kind: 'line' },
        ]}
      >
        <LineChart
          ariaLabel={`${row.name}: hours worked against the estimate over time`}
          categories={buckets.map((b) => b.label)}
          titles={buckets.map((b) => b.title)}
          series={[
            { key: 'hours', label: 'Hours worked', color: 'var(--series-1)', values: over.map((o) => o.hours) },
            { key: 'est', label: 'Estimate', color: 'var(--series-muted)', values: over.map((o) => o.est) },
          ]}
          format={h1}
          height={180}
        />
      </ChartFrame>
      <h3 class="section-label">By job type</h3>
      <div class="table-wrap">
        <table class="table table--dense">
          <caption class="sr-only">Jobs by type</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col" class="is-right">
                Jobs
              </th>
              <th scope="col" class="is-right">
                Average
              </th>
              <th scope="col" class="is-right">
                Estimate
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.type}>
                <th scope="row">{jobTypeLabels[t.type]}</th>
                <td class="is-right">{t.count}</td>
                <td class="is-right">{h1(t.hours)}</td>
                <td class="is-right">{h1(t.est)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 class="section-label">Recent jobs</h3>
      <ul class="recent-jobs" role="list">
        {recent.map((f) => (
          <li key={f.id}>
            <span class="recent-jobs__date">{shortDate(f.day)}</span>
            <span class="recent-jobs__main">
              {jobTypeLabels[f.type]}
              {f.crew.length > 1 && f.crew[0] !== row.id ? ` · with ${d.staff.find((s) => s.id === f.crew[0])?.name.split(' ')[0] ?? ''}` : ''}
              {f.callback && (
                <Badge tone="amber" icon="undo" class="ml-6">
                  Return trip
                </Badge>
              )}
            </span>
            <span class={`recent-jobs__hours ${f.hours > f.estHours * 1.15 ? 'is-bad' : ''}`}>
              {h1(f.hours)} <span class="muted">/ {h1(f.estHours)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p class="muted small" style={{ marginTop: '12px' }}>
        Showing the latest {recent.length} of {mine.length} jobs · {decimal(sum(mine.map((f) => f.hours)))} hours in all
      </p>
    </Dialog>
  );
}
