/** Requests & conversion: where requests come from, how fast they get a reply, and how many quotes are won. */
import { useMemo } from 'preact/hooks';
import type { LeadSource } from '../../../data/types';
import { decimal, duration, money, percent, plural } from '../../../lib/format';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Button, Card, EmptyState, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { leadKindMeta, sourceLabels } from '../../../ui/status';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { bucketIndex, downloadCSV, isLive, timeBuckets } from '../facts';
import { leadStats } from '../metrics';

const mins = (m: number | undefined) => (m === undefined ? '—' : duration(Math.round(m)));
const sourceLabel = (s: string) => sourceLabels[s as LeadSource] ?? s;

export default function Leads({ facts, range }: ReportProps) {
  const s = useMemo(() => leadStats(facts, range), [facts, range.from, range.to]);
  const prev = useMemo(() => (range.prev ? leadStats(facts, { ...range, from: range.prev.from, to: range.prev.to }) : undefined), [facts, range.from, range.to]);
  const sources = [...s.bySource].sort((a, b) => b.total - a.total);
  const fast = s.buckets[0];
  const slow = s.buckets[s.buckets.length - 1];

  const buckets = timeBuckets(range.from, range.to);
  const quotes = buckets.map(() => 0);
  const other = buckets.map(() => 0);
  for (const l of s.list) {
    const i = bucketIndex(buckets, l.day);
    if (i < 0) continue;
    (l.kind === 'quote' ? quotes : other)[i]++;
  }

  return (
    <div class="report">
      <div class="toolbar">
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`requests-${range.from}-to-${range.to}.csv`, [
              ['Source', 'Requests', 'Quote requests', 'Quotes won', 'Quotes lost', 'Open', 'Quote win rate %', 'Median first reply (min)', 'Won value'],
              ...sources.map((r) => [sourceLabel(r.source), r.total, r.quotes, r.won, r.lost, r.open, +(r.winRate * 100).toFixed(1), r.medianResponse !== undefined ? Math.round(r.medianResponse) : '', Math.round(r.wonValue)]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Requests received" icon="inbox" value={s.total.toLocaleString()} delta={prev?.total ? s.total / prev.total - 1 : undefined} deltaLabel="vs. last year" hint={`${plural(s.quotes, 'quote request')} · ${s.service} service`} />
        <Stat label="Quote requests won" icon="check-circle" value={percent(s.quoteWinRate)} hint={prev ? `${percent(prev.quoteWinRate)} the same dates last year` : `${s.open} still open`} />
        <Stat label="Median first reply" icon="clock" value={mins(s.medianResponse)} deltaGood="down" delta={prev?.medianResponse ? s.medianResponse / prev.medianResponse - 1 : undefined} deltaLabel="vs. last year" hint="Website and Facebook requests" />
        <Stat label="Won from quotes" icon="dollar" value={money(s.wonValue, false)} hint="Quoted value of the requests won" />
      </div>

      {fast.decided >= 5 && slow.decided >= 5 && fast.winRate > slow.winRate && (
        <div class="callout callout--green insights">
          <Icon name="zap" size={18} />
          <div>
            <p class="callout__title">A fast reply wins more lifts</p>
            <p class="callout__text">
              Quote requests answered within an hour were won {percent(fast.winRate)} of the time, against {percent(slow.winRate)} when the first reply took more than a day. Requests that arrive in the evening are the ones that wait — a next-morning call list in the Inbox would help.
            </p>
          </div>
        </div>
      )}

      <div class="grid-2">
        <ChartFrame
          title="Requests by source"
          subtitle="The win rate counts quote requests that ended (won or lost)"
          table={{ columns: ['Source', 'Requests', 'Quote win rate'], rows: sources.map((r) => [sourceLabel(r.source), r.total, r.quotes ? percent(r.winRate) : '—']) }}
        >
          {sources.length ? (
            <HBarChart ariaLabel="Requests by source" rows={sources.map((r) => ({ key: r.source, label: sourceLabel(r.source), sub: r.quotes ? `${percent(r.winRate)} of quotes won` : undefined, value: r.total }))} format={(n) => String(n)} />
          ) : (
            <EmptyState icon="inbox" title="No requests in this range" />
          )}
        </ChartFrame>
        <ChartFrame title="Quotes won by first-reply time" subtitle="Quote requests from the website and Facebook" table={{ columns: ['First reply', 'Requests', 'Win rate'], rows: s.buckets.map((b) => [b.label, b.count, b.decided ? percent(b.winRate) : '—']) }}>
          <HBarChart ariaLabel="Quote win rate by how fast the first reply came" rows={s.buckets.map((b) => ({ key: b.key, label: b.label, sub: plural(b.count, 'request'), value: b.winRate * 100 }))} format={(n) => `${decimal(n).replace(/\.0$/, '')}%`} color="var(--series-3)" />
        </ChartFrame>
      </div>

      <div class="grid-2 grid-2--wide">
        <ChartFrame
          title="Requests over time"
          subtitle={range.days <= 120 ? 'Weekly' : 'Monthly'}
          legend={[
            { label: 'Quote requests', color: 'var(--series-1)' },
            { label: 'Service, warranty & other', color: 'var(--series-2)' },
          ]}
          table={{ columns: ['Period', 'Quote requests', 'Service, warranty & other'], rows: buckets.map((b, i) => [b.title, quotes[i], other[i]]) }}
        >
          <BarChart
            ariaLabel="Requests over time"
            categories={buckets.map((b) => b.label)}
            titles={buckets.map((b) => b.title)}
            series={[
              { key: 'q', label: 'Quote requests', color: 'var(--series-1)', values: quotes },
              { key: 'o', label: 'Service, warranty & other', color: 'var(--series-2)', values: other },
            ]}
            format={(n) => plural(n, 'request')}
            axisFormat={(n) => String(n)}
            height={230}
          />
        </ChartFrame>
        <ChartFrame title="Requests by kind" subtitle={range.label} table={{ columns: ['Kind', 'Requests', 'Share'], rows: s.kinds.map((k) => [leadKindMeta[k.kind].label, k.total, percent(k.total / Math.max(1, s.total))]) }}>
          <HBarChart
            ariaLabel="Requests by kind"
            rows={s.kinds
              .filter((k) => k.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((k) => ({ key: k.kind, label: leadKindMeta[k.kind].label, value: k.total, note: `· ${percent(k.total / Math.max(1, s.total))}` }))}
            format={(n) => String(n)}
            color="var(--series-2)"
          />
        </ChartFrame>
      </div>

      <Card title="By source" flush>
        <DataTable
          caption="Requests by source"
          rows={sources}
          rowKey={(r) => r.source}
          initialSort={{ key: 'total', dir: 'desc' }}
          columns={[
            { key: 'source', label: 'Source', sortValue: (r) => sourceLabel(r.source), render: (r) => <span class="cell-main">{sourceLabel(r.source)}</span> },
            { key: 'total', label: 'Requests', align: 'right', sortValue: (r) => r.total, render: (r) => r.total },
            { key: 'quotes', label: 'Quotes', align: 'right', sortValue: (r) => r.quotes, render: (r) => r.quotes, hide: 'sm' },
            { key: 'won', label: 'Won', align: 'right', sortValue: (r) => r.won, render: (r) => r.won },
            { key: 'open', label: 'Open', align: 'right', sortValue: (r) => r.open, render: (r) => r.open, hide: 'sm' },
            { key: 'rate', label: 'Win rate', align: 'right', sortValue: (r) => r.winRate, render: (r) => (r.quotes ? percent(r.winRate) : '—') },
            { key: 'reply', label: 'Median reply', align: 'right', sortValue: (r) => r.medianResponse ?? -1, render: (r) => (isLive(r.source) ? <span class="muted">Live</span> : mins(r.medianResponse)), hide: 'md' },
            { key: 'value', label: 'Won value', align: 'right', sortValue: (r) => r.wonValue, render: (r) => money(r.wonValue, false), hide: 'md' },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> Phone calls, walk-ins and boat-show conversations are answered on the spot, so they have no reply time. A quote request counts as won when the customer accepts the quote and orders the lift.
      </p>
    </div>
  );
}
