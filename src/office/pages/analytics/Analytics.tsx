/** Analytics: reports on the work, the sales and the requests, filtered by date range. */
import type { FunctionComponent } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import type { DB, History, RangeKey } from '../../data/types';
import { today as todayFn } from '../../lib/dates';
import { param, setParams } from '../../router';
import { db, history, setUI, ui } from '../../store';
import { Button, PageHeader, TabPanel, Tabs } from '../../ui/core';
import { Icon, type IconName } from '../../ui/Icon';
import { allFacts, rangeOptions, resolveRange, type Facts, type Range } from './facts';
import Crews from './reports/Crews';
import DealerSales from './reports/DealerSales';
import InventoryHealth from './reports/InventoryHealth';
import Leads from './reports/Leads';
import NotSeen from './reports/NotSeen';
import Overview from './reports/Overview';
import Service from './reports/Service';
import SizesSold from './reports/SizesSold';

export interface ReportProps {
  d: DB;
  h: History;
  facts: Facts;
  range: Range;
  today: string;
}

export type ReportKey = 'overview' | 'crews' | 'service' | 'sizes' | 'leads' | 'dealers' | 'inventory' | 'not-seen';

export const reports: { key: ReportKey; label: string; icon: IconName; blurb: string; usesRange: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', blurb: 'Revenue, installs, service and requests at a glance', usesRange: true },
  { key: 'crews', label: 'Crews & shop', icon: 'hardhat', blurb: 'Install, service and shop-build times against the estimate, on-time arrival and return trips', usesRange: true },
  { key: 'service', label: 'Service', icon: 'wrench', blurb: 'Service and warranty calls by the part of the lift involved and the problem, and lifts that keep needing a visit', usesRange: true },
  { key: 'sizes', label: 'Sizes sold', icon: 'lift', blurb: 'Which lifts and add-ons sell, to lake customers and to dealers, by units, revenue and margin', usesRange: true },
  { key: 'leads', label: 'Requests & conversion', icon: 'inbox', blurb: 'Where requests come from, how fast they get a reply, and how many quotes are won', usesRange: true },
  { key: 'dealers', label: 'Dealer sales', icon: 'handshake', blurb: 'What each dealer account orders and when', usesRange: true },
  { key: 'inventory', label: 'Inventory health', icon: 'box', blurb: 'Components and products: what’s used, what’s sitting, what’s about to run out', usesRange: true },
  { key: 'not-seen', label: 'Not seen in a year', icon: 'calendar', blurb: 'Lake customers whose lift hasn’t had a visit in 12 months — a sample idea for check-up calls', usesRange: false },
];

const components: Record<ReportKey, FunctionComponent<ReportProps>> = {
  overview: Overview,
  crews: Crews,
  service: Service,
  sizes: SizesSold,
  leads: Leads,
  dealers: DealerSales,
  inventory: InventoryHealth,
  'not-seen': NotSeen,
};

export default function Analytics() {
  const d = db.value;
  const h = history.value;
  const today = todayFn();
  const key = (reports.some((r) => r.key === param('report')) ? param('report') : 'overview') as ReportKey;
  const meta = reports.find((r) => r.key === key)!;
  const { range: rangeKey, rangeFrom, rangeTo } = ui.value;
  const range = resolveRange(rangeKey, today, h.from, rangeFrom, rangeTo);
  const facts = useMemo(() => allFacts(d, h), [d, h]);
  const Report = components[key];

  // Keep the chosen report's tab in view when the tab strip scrolls sideways (phones)
  useEffect(() => {
    const tab = document.getElementById(`report-tab-${key}`);
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const left = tab.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Math.max(0, left - 16);
  }, [key]);

  return (
    <div class="analytics">
      <PageHeader
        eyebrow="Business"
        title="Analytics"
        description="Every report reads from the same requests, jobs, sales and dealer orders the team works with each day. In this demo the figures are sample data."
        actions={
          <Button icon="printer" onClick={() => window.print()}>
            Print
          </Button>
        }
      />

      <div class="filters no-print" role="group" aria-label="Report filters">
        <label class="filters__field">
          <span class="filters__label">
            <Icon name="calendar" size={15} /> Date range
          </span>
          <select class="select" value={rangeKey} disabled={!meta.usesRange} onChange={(e) => setUI({ range: (e.target as HTMLSelectElement).value as RangeKey })}>
            {rangeOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {rangeKey === 'custom' && meta.usesRange && (
          <>
            <label class="filters__field">
              <span class="filters__label">From</span>
              <input class="input" type="date" min={h.from} max={today} value={range.from} onChange={(e) => setUI({ rangeFrom: (e.target as HTMLInputElement).value, rangeTo: range.to })} />
            </label>
            <label class="filters__field">
              <span class="filters__label">To</span>
              <input class="input" type="date" min={range.from} max={today} value={range.to} onChange={(e) => setUI({ rangeTo: (e.target as HTMLInputElement).value, rangeFrom: range.from })} />
            </label>
          </>
        )}
        <p class="filters__note">
          {meta.usesRange ? (
            <>
              <strong>{range.label}</strong> · {range.days} days{range.prev ? ' · compared with the same dates last year' : ''}
            </>
          ) : (
            'This report looks at today, so the date range doesn’t apply.'
          )}
        </p>
      </div>

      <Tabs items={reports.map((r) => ({ key: r.key, label: r.label, icon: r.icon }))} value={key} onChange={(k) => setParams({ report: k === 'overview' ? undefined : k })} label="Reports" idBase="report" />
      <TabPanel idBase="report" active={key}>
        <p class="report-blurb">{meta.blurb}</p>
        <Report d={d} h={h} facts={facts} range={range} today={today} />
      </TabPanel>
    </div>
  );
}
