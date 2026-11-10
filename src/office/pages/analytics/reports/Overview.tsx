/** Analytics overview: the headline numbers for the selected range, plus a guide to every report. */
import { useMemo } from 'preact/hooks';
import type { RevenueCategory } from '../../../data/types';
import { compactMoney, decimal, duration, money, percent, plural } from '../../../lib/format';
import { setParams } from '../../../router';
import { revenueEvents } from '../../../selectors';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { reports, type ReportProps } from '../Analytics';
import { avg, bucketIndex, sum, timeBuckets, within } from '../facts';
import { crewStats, dealerStats, inventoryHealth, leadStats, notSeen, serviceStats, sizesSold } from '../metrics';

const CATEGORIES: RevenueCategory[] = ['Lifts', 'Installation', 'Service', 'Parts', 'Remotes & add-ons', 'Dealer sales'];

export default function Overview({ d, h, facts, range, today }: ReportProps) {
  const events = useMemo(() => revenueEvents(d, h), [d, h]);
  const inRange = (from: string, to: string) => events.filter((e) => e.day >= from && e.day <= to);
  const cur = inRange(range.from, range.to);
  const revenue = sum(cur.map((e) => e.amount));
  const prevRevenue = range.prev ? sum(inRange(range.prev.from, range.prev.to).map((e) => e.amount)) : 0;
  const dealerRevenue = sum(cur.filter((e) => e.category === 'Dealer sales').map((e) => e.amount));

  const jobs = within(facts.jobs, range.from, range.to);
  const prevJobs = range.prev ? within(facts.jobs, range.prev.from, range.prev.to) : [];
  const installs = jobs.filter((f) => f.type === 'install');
  const prevInstalls = prevJobs.filter((f) => f.type === 'install');
  const service = serviceStats(facts, range);
  const leads = leadStats(facts, range);

  // Revenue over time, lake customers and dealers (+ the same dates last year)
  const buckets = timeBuckets(range.from, range.to);
  const direct = buckets.map(() => 0);
  const dealer = buckets.map(() => 0);
  for (const e of cur) {
    const i = bucketIndex(buckets, e.day);
    if (i >= 0) (e.category === 'Dealer sales' ? dealer : direct)[i] += e.amount;
  }
  const lastYear = range.prev
    ? buckets.map((b) => {
        const f = `${+b.from.slice(0, 4) - 1}${b.from.slice(4)}`;
        const t = `${+b.to.slice(0, 4) - 1}${b.to.slice(4)}`;
        return f >= h.from ? sum(inRange(f, t).map((e) => e.amount)) : null;
      })
    : undefined;

  const categories = CATEGORIES.map((c) => ({ key: c, label: c, value: sum(cur.filter((e) => e.category === c).map((e) => e.amount)) }));

  // One headline per report for the library
  const crews = crewStats(d, facts, range);
  const installAvg = avg(installs.map((f) => f.hours));
  const installEst = avg(installs.map((f) => f.estHours));
  const topComponent = [...service.byComponent].sort((a, b) => b.calls - a.calls)[0];
  const sold = sizesSold(d, facts, range, 'category', 'lifts');
  const liftUnits = sum(sold.map((r) => r.units));
  const dealerUnits = sum(sold.map((r) => r.dealer));
  const dealers = dealerStats(d, facts, range);
  const health = inventoryHealth(d, h, facts, range, today);
  const short = health.filter((r) => r.health === 'low' || r.health === 'out');
  const seen = notSeen(d, today).filter((r) => !r.booked);
  const headline: Record<string, string> = {
    crews: installs.length
      ? `Installs average ${decimal(installAvg)} h against a ${decimal(installEst)} h estimate · ${plural(crews.length, 'person', 'people')} rated`
      : 'No installs in this range',
    service: topComponent ? `Most calls involve the ${topComponent.label.toLowerCase()} (${percent(topComponent.calls / Math.max(1, service.total))}) · ${percent(service.warranty / Math.max(1, service.total))} under warranty` : 'No service calls in this range',
    sizes: liftUnits ? `${plural(liftUnits, 'lift')} sold · ${percent(dealerUnits / liftUnits)} through dealers` : 'No lift sales in this range',
    leads: `${percent(leads.quoteWinRate)} of quote requests won · median first reply ${duration(Math.round(leads.medianResponse))}`,
    dealers: dealers.revenue ? `${money(dealers.revenue, false)} from ${plural(dealers.ordering, 'dealer')} · ${plural(dealers.units, 'unit')} shipped` : 'No dealer orders in this range',
    inventory: short.length ? `${plural(short.length, 'item')} low or out of stock` : 'Nothing below its reorder point',
    'not-seen': `${plural(seen.length, 'lift')} without a visit in 12 months, not yet booked`,
  };

  return (
    <div class="report">
      <div class="stats">
        <Stat label="Revenue" icon="dollar" value={money(revenue, false)} delta={prevRevenue ? revenue / prevRevenue - 1 : undefined} deltaLabel="vs. last year" hint={range.prev ? `${percent(dealerRevenue / Math.max(1, revenue))} from dealers` : 'No prior-year data for this range'} />
        <Stat label="Lifts installed" icon="lift" value={installs.length.toLocaleString()} delta={prevInstalls.length ? installs.length / prevInstalls.length - 1 : undefined} deltaLabel="vs. last year" hint="By FiberSteel’s crews, on the lake" />
        <Stat label="Service & warranty calls" icon="wrench" value={service.total.toLocaleString()} hint={`${plural(service.warranty, 'warranty call')} · ${plural(service.returns, 'return trip')}`} />
        <Stat label="Quote requests won" icon="check-circle" value={percent(leads.quoteWinRate)} hint={`${plural(leads.quotes, 'quote request')} · ${leads.open} still open`} />
        <Stat label="Median first reply" icon="clock" value={duration(Math.round(leads.medianResponse))} hint="Website and Facebook requests" />
      </div>

      <div class="grid-2 grid-2--wide">
        <ChartFrame
          title="Revenue over time"
          subtitle={`${range.days <= 120 ? 'Weekly' : 'Monthly'}, lake customers and dealers${lastYear ? ' — the line shows the same dates last year' : ''}. Work counts when it’s completed.`}
          legend={[
            { label: 'Lake customers', color: 'var(--series-1)' },
            { label: 'Dealers', color: 'var(--series-2)' },
            ...(lastYear ? [{ label: 'Last year', color: 'var(--series-muted)', kind: 'line' as const }] : []),
          ]}
          table={{
            columns: ['Period', 'Lake customers', 'Dealers', 'Total', ...(lastYear ? ['Last year'] : [])],
            rows: buckets.map((b, i) => [b.title, money(direct[i], false), money(dealer[i], false), money(direct[i] + dealer[i], false), ...(lastYear ? [lastYear[i] === null ? '—' : money(lastYear[i]!, false)] : [])]),
          }}
        >
          <BarChart
            ariaLabel="Revenue over time, lake customers and dealers"
            categories={buckets.map((b) => b.label)}
            titles={buckets.map((b) => b.title)}
            series={[
              { key: 'direct', label: 'Lake customers', color: 'var(--series-1)', values: direct },
              { key: 'dealer', label: 'Dealers', color: 'var(--series-2)', values: dealer },
            ]}
            overlay={lastYear ? { label: 'Last year', color: 'var(--series-muted)', values: lastYear } : undefined}
            format={(n) => money(n, false)}
            axisFormat={compactMoney}
            height={270}
          />
        </ChartFrame>
        <ChartFrame title="Revenue by type" subtitle={range.label} table={{ columns: ['Type', 'Revenue', 'Share'], rows: categories.map((c) => [c.label, money(c.value, false), percent(c.value / Math.max(1, revenue))]) }}>
          <HBarChart
            ariaLabel="Revenue by type"
            rows={categories
              .filter((c) => c.value > 0)
              .sort((a, b) => b.value - a.value)
              .map((c) => ({ ...c, note: `· ${percent(c.value / Math.max(1, revenue))}` }))}
            format={(n) => money(n, false)}
          />
        </ChartFrame>
      </div>

      <h2 class="section-title">All reports</h2>
      <ul class="report-library" role="list">
        {reports
          .filter((r) => r.key !== 'overview')
          .map((r) => (
            <li key={r.key}>
              <button type="button" class="report-card" onClick={() => setParams({ report: r.key }, { scroll: true })}>
                <span class="report-card__icon">
                  <Icon name={r.icon} size={18} />
                </span>
                <span class="report-card__title">{r.label}</span>
                <span class="report-card__blurb">{r.blurb}</span>
                <span class="report-card__headline">{headline[r.key]}</span>
                <span class="report-card__go">
                  Open report <Icon name="arrow-right" size={14} />
                </span>
              </button>
            </li>
          ))}
      </ul>
      <p class="report-note">
        <Icon name="info" size={14} /> Sample data: every customer, job and figure here is made up for the demo. Lift work peaks in spring, so the same dates last year are the fairest comparison.
      </p>
    </div>
  );
}
