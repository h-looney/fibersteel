/**
 * Dashboard: today at a glance, shaped by the signed-in profile's role — the whole business for full access, quotes
 * for sales, the service desk's day for service, money for the office.
 */
import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { billedElsewhere, orderStatusLabels } from '../../actions';
import type { DB, Job, JobType, LeadKind, Role, Section } from '../../data/types';
import { addDays, diffDays, now, startOfMonth, startOfWeek, today } from '../../lib/dates';
import { compactMoney, longDate, money, monthLong, monthShort, plural, relative, shortDate, time } from '../../lib/format';
import { sectionPath } from '../../router';
import { arAging, customerOf, dealerOf, invoiceStatus, invoiceTotals, jobsOn, lowStock, monthlyRevenue, revenueBetween, revenueEvents, staffOf } from '../../selectors';
import { switchProfile } from '../../shell/UserMenu';
import { can, db, history, me, setUI, ui } from '../../store';
import { BarChart, ChartFrame, Sparkline } from '../../ui/charts';
import { AvatarStack, Badge, Card, EmptyState, Link, LinkButton, Meter, PageHeader, Stat } from '../../ui/core';
import { Icon, type IconName } from '../../ui/Icon';
import { claimStatusMeta, jobStatusOf, jobTypeMeta, leadKindMeta, orderStatusMeta, StatusBadge } from '../../ui/status';
import { allFacts, bucketIndex, timeBuckets } from '../analytics/facts';
import { installsToPost, pendingCount } from '../website/data';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/* ---------- Who's looking ---------- */

type Focus = 'owner' | 'sales' | 'service' | 'office';
const focusOf = (role: Role): Focus => (role === 'sales' ? 'sales' : role === 'office' ? 'office' : role === 'owner' ? 'owner' : 'service');

const SERVICE_JOBS = new Set<JobType>(['service', 'warranty', 'remote']);
const requestKinds: Record<Focus, LeadKind[] | null> = { owner: null, office: null, sales: ['quote', 'dealer', 'question'], service: ['service', 'warranty'] };

/* ---------- Welcome & things to try ---------- */

/** Can this profile open the page a link points to? ('/office/jobs/?…' → jobs) */
const reachable = (to: string) => can(((to.split('?')[0].split('/')[2] || 'dashboard') as Section));
/** A link when the profile has the page; otherwise nothing to click */
const toIf = (to: string) => (reachable(to) ? to : undefined);

const tryItems: { key: string; label: string; to?: string; href?: string; run?: () => void }[] = [
  { key: 'web-request', label: 'Send a quote request from the public website’s lift-size calculator — and watch it land in the Inbox', href: `${BASE}/quote/` },
  { key: 'order', label: 'Accept a quote and order the lift: a shop build and an install go on the board', to: '/office/accounting/?tab=estimates' },
  { key: 'schedule', label: 'Schedule a job — drag it to a crew and a day', to: '/office/jobs/?view=schedule' },
  { key: 'complete', label: 'Sign in as Jesse and finish today’s install from the phone-friendly day view', run: () => switchProfile('jesse') },
  { key: 'register', label: 'Register a lift’s warranty from a website registration', to: '/office/warranty/' },
  { key: 'dealer-order', label: 'Place a dealer order and follow it from the shop to the truck', to: '/office/dealers/?tab=orders' },
  { key: 'payment', label: 'Record a payment on an open invoice', to: '/office/accounting/?tab=invoices' },
  { key: 'quickbooks', label: 'Connect QuickBooks (simulated) — or keep the books in FiberSteel mode', to: '/office/accounting/?tab=integrations' },
];

function Welcome() {
  const done = tryItems.filter((t) => ui.value.tried.includes(t.key)).length;
  return (
    <section class="welcome card" aria-labelledby="welcome-title">
      <div class="welcome__intro">
        <p class="welcome__kicker">
          <Icon name="info" size={16} /> Purely a demo
        </p>
        <h2 id="welcome-title" class="welcome__title">
          Welcome to FiberSteel mode
        </h2>
        <p class="welcome__text">
          An idea for the staff side of the new website: requests, the schedule, customers and their lifts, warranty, stock, dealers and the books in one place. It’s purely a demo with sample data — a real FiberSteel mode would be customized to how FiberSteel works. Anything you change stays in this browser.
        </p>
        <div class="welcome__progress">
          <Meter value={done} max={tryItems.length} label="Things tried" tone="green" />
          <span class="muted small">
            {done} of {tryItems.length} tried
          </span>
        </div>
      </div>
      <div class="welcome__list">
        <h3 class="section-label">Things to try</h3>
        <ul role="list">
          {tryItems.map((t) => {
            const isDone = ui.value.tried.includes(t.key);
            const content = (
              <>
                <span class={`welcome__check${isDone ? ' is-done' : ''}`} aria-hidden="true">
                  {isDone && <Icon name="check" size={12} stroke={3} />}
                </span>
                <span>{t.label}</span>
                <span class="sr-only">{isDone ? '(done)' : ''}</span>
              </>
            );
            return (
              <li key={t.key}>
                {t.href ? (
                  <a class="welcome__item" href={t.href}>
                    {content}
                  </a>
                ) : t.run ? (
                  <button type="button" class="welcome__item" onClick={t.run}>
                    {content}
                  </button>
                ) : reachable(t.to!) ? (
                  <Link class="welcome__item" to={t.to!}>
                    {content}
                  </Link>
                ) : (
                  <span class="welcome__item is-off">
                    {content}
                    <span class="welcome__off">Try it as Dean</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <button type="button" class="btn btn--ghost btn--sm btn--icon welcome__close" aria-label="Hide the welcome guide" onClick={() => setUI({ welcomeDismissed: true })}>
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}

/* ---------- Helpers ---------- */

interface Attention {
  icon: IconName;
  tone: 'red' | 'amber' | 'blue' | 'violet' | 'accent' | 'green' | 'teal';
  label: string;
  detail?: string;
  to: string;
}

/** A job's status badge; builds and dealer deliveries are billed elsewhere, so finished means done */
const statusOf = (j: Job) => jobStatusOf(j);

/** A list row that isn't a link (the profile can't open that page) */
function StaticRow({ class: className, children }: { to: string; class?: string; children: ComponentChildren }) {
  return <div class={className}>{children}</div>;
}

const whereOf = (d: DB, j: Job) => {
  const c = customerOf(d, j.customerId);
  return j.location ?? (c?.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}` : c?.address.city);
};

/* ---------- Dashboard ---------- */

export default function Dashboard() {
  const d = db.value;
  const h = history.value;
  const t = today();
  const user = me.value!;
  const focus = focusOf(user.role);

  const events = useMemo(() => revenueEvents(d, h), [d, h]);
  const from30 = addDays(t, -29);
  const rev30 = revenueBetween(events, from30, t, 'all');
  const rev30LastYear = revenueBetween(events, addDays(from30, -364), addDays(t, -364), 'all');
  const months = useMemo(() => monthlyRevenue(events, t, 12), [events, t]);
  const monthTotals = months.map((m) => m.direct + m.dealer);
  const currentKey = months[months.length - 1].key;

  // Today's schedule (the service desk sees the service crew's day)
  const todaysAll = jobsOn(d, t, 'all');
  const todays = focus === 'service' ? todaysAll.filter((j) => SERVICE_JOBS.has(j.type)) : todaysAll;
  const installsToday = todaysAll.filter((j) => j.type === 'install').length;
  const inProgress = todays.filter((j) => j.status === 'in-progress').length;
  const finished = todays.filter((j) => j.status === 'completed' || j.status === 'closed').length;

  // Requests
  const kinds = requestKinds[focus];
  const leads = kinds ? d.leads.filter((l) => kinds.includes(l.kind)) : d.leads;
  const newLeads = leads.filter((l) => l.stage === 'new');
  const weekLeads = leads.filter((l) => l.receivedAt.slice(0, 10) >= startOfWeek(t)).length;
  const recentLeads = leads.filter((l) => l.stage === 'new' || l.stage === 'contacted').slice(0, 5);

  // Money
  const aging = arAging(d, 'all', t);
  const receivable = aging.buckets.total;
  const overdue = aging.buckets.d30 + aging.buckets.d60 + aging.buckets.d90;
  const overdueInv = d.invoices.filter((i) => i.kind === 'invoice' && invoiceStatus(i, t) === 'overdue');
  const toInvoice = d.jobs.filter((j) => j.status === 'completed' && !billedElsewhere(j));
  const billsDue = d.bills.filter((b) => b.status !== 'paid' && b.dueOn <= addDays(t, 7));
  const paidThisWeek = d.invoices.flatMap((i) => i.payments).filter((p) => p.date >= startOfWeek(t) && p.date <= t);
  const quotesWaiting = d.invoices.filter((i) => i.kind === 'estimate' && invoiceStatus(i, t) === 'sent');
  const staleQuotes = quotesWaiting.filter((i) => diffDays(t, i.issuedOn) >= 3);

  // Work
  const openClaims = d.claims.filter((c) => c.status === 'open' || c.status === 'approved' || c.status === 'part-sent');
  const needsScheduling = d.jobs.filter((j) => j.status === 'requested' && (focus !== 'service' || SERVICE_JOBS.has(j.type)) && (focus !== 'sales' || j.type === 'site-visit' || j.type === 'install'));
  const onHold = d.jobs.filter((j) => j.status === 'on-hold' && (focus !== 'service' || SERVICE_JOBS.has(j.type)));
  const low = lowStock(d, 'all');
  const lowParts = low.filter((i) => i.kind === 'component');
  const unregistered = d.lifts.filter((l) => l.installedBy === 'FiberSteel' && !l.registered && l.installedOn >= addDays(t, -365));
  const installsSoon = d.jobs.filter((j) => j.type === 'install' && (j.status === 'scheduled' || j.status === 'requested') && (!j.start || j.start.slice(0, 10) <= addDays(t, 14)));

  // Dealers
  const openOrders = d.dealerOrders.filter((o) => o.status === 'quote' || o.status === 'confirmed' || o.status === 'building' || o.status === 'ready').sort((a, b) => (a.shipOn ?? '9').localeCompare(b.shipOn ?? '9'));
  const readyOrders = openOrders.filter((o) => o.status === 'ready');
  const prospects = d.dealers.filter((x) => x.status === 'prospect');

  // Website (the Website section's lists; a local stand-in until they load)
  const toPost: Job[] = installsToPost.value;
  const pending = typeof pendingCount?.value === 'number' ? (pendingCount.value as number) : 0;

  const attention: (Attention & { for: Focus[] })[] = [];
  const add = (forWho: Focus[], a: Attention | false | 0 | undefined) => a && attention.push({ ...a, for: forWho });
  add(['owner', 'office'], overdueInv.length > 0 && { icon: 'alert', tone: 'red', label: `${plural(overdueInv.length, 'invoice')} overdue`, detail: money(overdueInv.reduce((s, i) => s + invoiceTotals(i).balance, 0), false), to: '/office/accounting/?tab=invoices&filter=overdue' });
  add(['owner', 'service', 'sales'], needsScheduling.length > 0 && { icon: 'calendar-plus', tone: 'amber', label: `${plural(needsScheduling.length, 'job')} waiting to be scheduled`, detail: [...new Set(needsScheduling.map((j) => jobTypeMeta[j.type].label.toLowerCase()))].slice(0, 3).join(', '), to: '/office/jobs/?view=schedule' });
  add(['owner', 'service'], onHold.length > 0 && { icon: 'clock', tone: 'amber', label: `${plural(onHold.length, 'job')} on hold`, detail: onHold[0].holdReason?.split(' — ')[0].replace(/\.$/, ''), to: '/office/jobs/?view=list&status=on-hold' });
  add(['owner', 'office'], toInvoice.length > 0 && { icon: 'receipt', tone: 'blue', label: `${plural(toInvoice.length, 'finished job')} ready to invoice`, to: '/office/jobs/?view=list&status=completed' });
  add(['owner', 'office', 'sales'], readyOrders.length > 0 && { icon: 'truck', tone: 'teal', label: `${plural(readyOrders.length, 'dealer order')} ready to ship`, detail: readyOrders.map((o) => dealerOf(d, o.dealerId)?.name).filter(Boolean).slice(0, 2).join(', '), to: '/office/dealers/?tab=orders' });
  add(['owner', 'sales'], staleQuotes.length > 0 && { icon: 'file', tone: 'accent', label: `${plural(staleQuotes.length, 'quote')} waiting 3+ days for a reply`, to: '/office/accounting/?tab=estimates' });
  add(['owner', 'sales'], prospects.length > 0 && { icon: 'handshake', tone: 'violet', label: `${plural(prospects.length, 'dealer prospect')} to follow up`, detail: prospects.slice(0, 2).map((p) => p.name).join(', '), to: '/office/dealers/' });
  add(['owner', 'service'], (focus === 'service' ? lowParts : low).length > 0 && { icon: 'box', tone: 'amber', label: `${plural((focus === 'service' ? lowParts : low).length, 'item')} low on stock`, detail: (focus === 'service' ? lowParts : low).slice(0, 2).map((i) => i.name.split(' — ')[0]).join(', '), to: '/office/inventory/?filter=low' });
  add(['owner', 'service'], openClaims.length > 0 && { icon: 'shield', tone: 'green', label: `${plural(openClaims.length, 'warranty claim')} still open`, to: '/office/warranty/?tab=claims' });
  add(['owner', 'service'], unregistered.length > 0 && { icon: 'shield', tone: 'violet', label: `${plural(unregistered.length, 'recent install')} not registered`, detail: 'Installed by FiberSteel in the last year, no warranty registration', to: '/office/warranty/?filter=unregistered' });
  add(['office'], billsDue.length > 0 && { icon: 'bank', tone: 'amber', label: `${plural(billsDue.length, 'bill')} due within a week`, detail: money(billsDue.reduce((s, b) => s + b.amount, 0), false), to: '/office/accounting/?tab=bills' });
  if (can('website')) {
    add(['owner', 'sales', 'office', 'service'], pending > 0 && { icon: 'globe', tone: 'violet', label: `${plural(pending, 'website change')} waiting to be published`, to: '/office/website/' });
  }
  const shownAttention = attention.filter((a) => a.for.includes(focus));

  // This week in the shop (full access)
  const weekStart = startOfWeek(t);
  const builds = d.jobs.filter((j) => j.type === 'build' && j.start && j.start.slice(0, 10) >= weekStart && j.start.slice(0, 10) <= addDays(weekStart, 6) && j.status !== 'cancelled').sort((a, b) => a.start!.localeCompare(b.start!));
  const buildsDone = builds.filter((j) => j.status === 'completed' || j.status === 'closed').length;

  // Service desk: the last 12 weeks of calls
  const facts = useMemo(() => (focus === 'service' ? allFacts(d, h) : undefined), [d, h, focus]);
  const weeks = timeBuckets(addDays(t, -83), t);
  const paid = weeks.map(() => 0);
  const warranty = weeks.map(() => 0);
  if (facts) {
    for (const f of facts.jobs) {
      if (f.type !== 'service' && f.type !== 'warranty') continue;
      const i = bucketIndex(weeks, f.day);
      if (i >= 0) (f.type === 'warranty' ? warranty : paid)[i]++;
    }
  }

  const monthStart = startOfMonth(t);
  const monthEvents = events.filter((e) => e.day >= monthStart && e.day <= t);
  const monthDealer = monthEvents.filter((e) => e.category === 'Dealer sales').reduce((s, e) => s + e.amount, 0);
  const monthTotal = monthEvents.reduce((s, e) => s + e.amount, 0);
  const monthDirect = monthTotal - monthDealer;

  const hour = +now().slice(11, 13);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const summary =
    focus === 'service'
      ? `${plural(newLeads.length, 'new service request')} · ${plural(todays.length, 'service job')} today · ${plural(openClaims.length, 'open warranty claim')}`
      : focus === 'office'
        ? `${money(overdue, false)} overdue · ${plural(toInvoice.length, 'job')} ready to invoice · ${plural(billsDue.length, 'bill')} due this week`
        : focus === 'sales'
          ? `${plural(newLeads.length, 'new request')} · ${plural(quotesWaiting.length, 'quote')} out · ${plural(installsSoon.length, 'install')} in the next two weeks`
          : `${plural(newLeads.length, 'new request')} · ${plural(todaysAll.length, 'job')} on today’s schedule · ${money(overdue, false)} overdue`;

  const revenueStat = (
    <Stat
      label="Revenue, last 30 days"
      icon="dollar"
      value={money(rev30, false)}
      delta={rev30LastYear ? rev30 / rev30LastYear - 1 : undefined}
      deltaLabel="vs. same days last year"
      to={toIf('/office/analytics/')}
      spark={<Sparkline values={monthTotals} label={`Monthly revenue, last 12 months, ending ${compactMoney(monthTotals[monthTotals.length - 1])} this month`} />}
    />
  );

  return (
    <div class="dashboard">
      <PageHeader eyebrow={`${longDate(t)} · Camdenton`} title={`${greeting}, ${user.name.split(' ')[0]}`} description={summary} />

      {!ui.value.welcomeDismissed && <Welcome />}

      <div class="stats">
        {focus === 'owner' && (
          <>
            {revenueStat}
            <Stat label="Jobs today" icon="clipboard" value={todaysAll.length} hint={`${plural(installsToday, 'install')} on the water · ${inProgress} in progress · ${finished} done`} to={toIf('/office/jobs/?view=schedule')} />
            <Stat label="New requests" icon="inbox" value={newLeads.length} hint={`${weekLeads} received this week`} to={toIf('/office/inbox/')} />
            <Stat label="Receivables" icon="receipt" value={money(receivable, false)} hint={<span class={overdue ? 'is-bad' : undefined}>{money(overdue, false)} overdue</span>} to="/office/accounting/?tab=invoices" />
          </>
        )}
        {focus === 'sales' && (
          <>
            <Stat label="New requests" icon="inbox" value={newLeads.length} hint={`${weekLeads} received this week`} to={toIf('/office/inbox/')} />
            <Stat label="Quotes out" icon="file" value={quotesWaiting.length} hint={`${money(quotesWaiting.reduce((s, i) => s + invoiceTotals(i).subtotal, 0), false)} · ${staleQuotes.length} waiting 3+ days`} to="/office/accounting/?tab=estimates" />
            <Stat label="Installs coming up" icon="lift" value={installsSoon.length} hint="Scheduled or waiting, next two weeks" to={toIf('/office/jobs/?view=schedule')} />
            {revenueStat}
          </>
        )}
        {focus === 'service' && (
          <>
            <Stat label="Service jobs today" icon="wrench" value={todays.length} hint={`${inProgress} in progress · ${finished} done`} to={toIf('/office/jobs/?view=schedule')} />
            <Stat label="Service requests" icon="inbox" value={newLeads.length} hint={`${weekLeads} received this week`} to={toIf('/office/inbox/')} />
            <Stat label="Open warranty claims" icon="shield" value={openClaims.length} hint={`${openClaims.filter((c) => c.status === 'open').length} new · ${openClaims.filter((c) => c.status !== 'open').length} approved or part sent`} to={toIf('/office/warranty/?tab=claims')} />
            <Stat label="Parts low on stock" icon="box" value={lowParts.length} hint={lowParts.length ? lowParts.slice(0, 2).map((i) => i.name.split(' — ')[0]).join(', ') : 'All above the reorder point'} to="/office/inventory/?filter=low" />
          </>
        )}
        {focus === 'office' && (
          <>
            <Stat label="Receivables" icon="receipt" value={money(receivable, false)} hint={<span class={overdue ? 'is-bad' : undefined}>{money(overdue, false)} overdue</span>} to="/office/accounting/?tab=invoices" />
            <Stat label="Ready to invoice" icon="clipboard" value={toInvoice.length} hint="Finished jobs not billed yet" to={toIf('/office/jobs/?view=list&status=completed')} />
            <Stat label="Bills due this week" icon="bank" value={money(billsDue.reduce((s, b) => s + b.amount, 0), false)} hint={plural(billsDue.length, 'bill')} to="/office/accounting/?tab=bills" />
            <Stat label="Payments this week" icon="dollar" value={money(paidThisWeek.reduce((s, p) => s + p.amount, 0), false)} hint={plural(paidThisWeek.length, 'payment')} to="/office/accounting/?tab=invoices" />
          </>
        )}
      </div>

      <div class="dash-grid">
        <div class="dash-main">
          <Card
            title={focus === 'service' ? 'The service crew today' : 'Today’s schedule'}
            subtitle={todays.length ? `${plural(todays.length, 'job')} · ${plural(new Set(todays.flatMap((j) => j.crew)).size, 'person', 'people')} out` : undefined}
            actions={
              can('jobs') ? (
                <Link class="card-link" to="/office/jobs/?view=schedule">
                  Open schedule <Icon name="arrow-right" size={14} />
                </Link>
              ) : undefined
            }
            flush
          >
            {todays.length === 0 ? (
              <EmptyState icon="calendar" title="Nothing on the schedule today" />
            ) : (
              <ul class="agenda" role="list">
                {todays.map((j) => {
                  const c = customerOf(d, j.customerId);
                  const type = jobTypeMeta[j.type];
                  const where = j.type === 'build' ? 'In the shop' : whereOf(d, j);
                  const Row = can('jobs') ? Link : StaticRow;
                  return (
                    <li key={j.id}>
                      <Row to={`/office/jobs/?id=${j.id}`} class="agenda__row">
                        <span class="agenda__time">
                          {time(j.start!)}
                          <span class="agenda__dur">{j.hours} h</span>
                        </span>
                        <span class={`agenda__bar agenda__bar--${type.tone}`} aria-hidden="true" />
                        <span class="agenda__main">
                          <span class="agenda__title">{j.title}</span>
                          <span class="agenda__meta">
                            <Icon name={type.icon} size={13} /> {type.label}
                            <span class="dot-sep" />
                            {where ?? c?.name}
                          </span>
                        </span>
                        <AvatarStack people={j.crew.map((id) => staffOf(d, id)!).filter(Boolean)} size={26} />
                        <span class="agenda__status">
                          <StatusBadge meta={statusOf(j)} />
                        </span>
                      </Row>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {focus === 'owner' && (
            <Card
              title="In the shop this week"
              subtitle={builds.length ? `${buildsDone} of ${plural(builds.length, 'build')} done · ${Math.round(builds.reduce((s, j) => s + j.hours, 0))} hours booked` : undefined}
              actions={
                <Link class="card-link" to="/office/jobs/?view=list">
                  All jobs <Icon name="arrow-right" size={14} />
                </Link>
              }
              flush
            >
              {builds.length === 0 ? (
                <EmptyState icon="hardhat" title="No builds on the schedule this week" />
              ) : (
                <ul class="mini-list" role="list">
                  {builds.slice(0, 6).map((j) => (
                    <li key={j.id}>
                      <Link to={`/office/jobs/?id=${j.id}`} class="mini-list__row">
                        <span class="mini-list__icon mini-list__icon--violet">
                          <Icon name="hardhat" size={15} />
                        </span>
                        <span class="mini-list__main">
                          <span class="mini-list__title">{j.title}</span>
                          <span class="mini-list__sub">
                            {shortDate(j.start!)} · {j.crew.map((id) => staffOf(d, id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Not assigned'}
                            {j.dealerOrderId ? ` · dealer order ${j.dealerOrderId}` : ''}
                          </span>
                        </span>
                        <StatusBadge meta={statusOf(j)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {focus === 'service' ? (
            <ChartFrame
              title="Service calls, last 12 weeks"
              subtitle="Paid service and warranty work — service runs with the boating season"
              legend={[
                { label: 'Paid service', color: 'var(--series-1)' },
                { label: 'Warranty', color: 'var(--series-3)' },
              ]}
              table={{ columns: ['Week', 'Paid service', 'Warranty'], rows: weeks.map((w, i) => [w.title, paid[i], warranty[i]]) }}
            >
              <BarChart
                ariaLabel="Service and warranty calls per week, last 12 weeks"
                categories={weeks.map((w) => w.label)}
                titles={weeks.map((w) => w.title)}
                series={[
                  { key: 'paid', label: 'Paid service', color: 'var(--series-1)', values: paid },
                  { key: 'warranty', label: 'Warranty', color: 'var(--series-3)', values: warranty },
                ]}
                format={(n) => plural(n, 'call')}
                axisFormat={(n) => String(n)}
                height={230}
              />
            </ChartFrame>
          ) : (
            <ChartFrame
              title="Revenue by month"
              subtitle="Last 12 months, lake customers and dealers — work is counted when it’s completed"
              legend={[
                { label: 'Lake customers', color: 'var(--series-1)' },
                { label: 'Dealers', color: 'var(--series-2)' },
              ]}
              table={{ columns: ['Month', 'Lake customers', 'Dealers', 'Total'], rows: months.map((m) => [monthLong(m.key), money(m.direct, false), money(m.dealer, false), money(m.direct + m.dealer, false)]) }}
            >
              <BarChart
                ariaLabel="Revenue by month for the last 12 months, lake customers and dealers"
                categories={months.map((m) => monthShort(m.key))}
                titles={months.map((m) => (m.key === currentKey ? `${monthLong(m.key)} (to date)` : monthLong(m.key)))}
                series={[
                  { key: 'direct', label: 'Lake customers', color: 'var(--series-1)', values: months.map((m) => m.direct) },
                  { key: 'dealer', label: 'Dealers', color: 'var(--series-2)', values: months.map((m) => m.dealer) },
                ]}
                format={(n) => money(n, false)}
                axisFormat={compactMoney}
                labelIndex={months.length - 1}
                height={250}
              />
            </ChartFrame>
          )}
        </div>

        <div class="dash-side">
          {can('inbox') && (
            <Card
              title={focus === 'service' ? 'Service & warranty requests' : 'New requests'}
              subtitle={newLeads.length ? `${newLeads.length} waiting for a first reply` : 'All caught up'}
              actions={
                <Link class="card-link" to="/office/inbox/">
                  Inbox <Icon name="arrow-right" size={14} />
                </Link>
              }
              flush
            >
              {recentLeads.length === 0 ? (
                <EmptyState icon="inbox" title="No open requests" />
              ) : (
                <ul class="mini-list" role="list">
                  {recentLeads.map((l) => (
                    <li key={l.id}>
                      <Link to={`/office/inbox/?id=${l.id}`} class="mini-list__row">
                        <span class={`mini-list__icon mini-list__icon--${leadKindMeta[l.kind].tone}`}>
                          <Icon name={leadKindMeta[l.kind].icon} size={15} />
                        </span>
                        <span class="mini-list__main">
                          <span class="mini-list__title">
                            {l.unread && <span class="unread-dot" aria-label="Unread" />}
                            {l.name}
                          </span>
                          <span class="mini-list__sub">
                            <span class="sr-only">{leadKindMeta[l.kind].label}: </span>
                            {l.summary}
                          </span>
                        </span>
                        <span class="mini-list__time">{relative(l.receivedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Needs attention" subtitle={shownAttention.length ? undefined : 'Nothing urgent'} flush>
            {shownAttention.length === 0 ? (
              <EmptyState icon="check-circle" title="You’re all caught up" />
            ) : (
              <ul class="mini-list mini-list--wrap" role="list">
                {shownAttention.map((a) => {
                  const Row = reachable(a.to) ? Link : StaticRow;
                  return (
                    <li key={a.label}>
                      <Row to={a.to} class="mini-list__row">
                        <span class={`mini-list__icon mini-list__icon--${a.tone}`}>
                          <Icon name={a.icon} size={15} />
                        </span>
                        <span class="mini-list__main">
                          <span class="mini-list__title">{a.label}</span>
                          {a.detail && <span class="mini-list__sub">{a.detail}</span>}
                        </span>
                        {reachable(a.to) ? <Icon name="chevron-right" size={16} class="mini-list__chev" /> : <span />}
                      </Row>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {focus === 'service' && can('warranty') && (
            <Card
              title="Open warranty claims"
              subtitle="Parts only — the owner pays the service call and labor"
              actions={
                <Link class="card-link" to="/office/warranty/?tab=claims">
                  Warranty <Icon name="arrow-right" size={14} />
                </Link>
              }
              flush
            >
              {openClaims.length === 0 ? (
                <EmptyState icon="shield" title="No open claims" />
              ) : (
                <ul class="mini-list" role="list">
                  {openClaims.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link to={`/office/warranty/?tab=claims&id=${c.id}`} class="mini-list__row">
                        <span class="mini-list__icon mini-list__icon--green">
                          <Icon name="shield" size={15} />
                        </span>
                        <span class="mini-list__main">
                          <span class="mini-list__title">{customerOf(d, c.customerId)?.name ?? c.id}</span>
                          <span class="mini-list__sub">
                            {c.component} · {c.part}
                          </span>
                        </span>
                        <StatusBadge meta={claimStatusMeta[c.status]} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {can('website') && toPost.length > 0 && (
            <Card
              title="Installs to post"
              subtitle="Finished installs that could go on “Lifts we’ve installed” — town only, with the owner’s OK"
              actions={
                <Link class="card-link" to="/office/website/?tab=installs">
                  Website <Icon name="arrow-right" size={14} />
                </Link>
              }
              flush
            >
              <ul class="mini-list" role="list">
                {toPost.slice(0, 4).map((j) => (
                  <li key={j.id}>
                    <Link to={`/office/website/?tab=installs&job=${j.id}`} class="mini-list__row">
                      <span class="mini-list__icon mini-list__icon--blue">
                        <Icon name="camera" size={15} />
                      </span>
                      <span class="mini-list__main">
                        <span class="mini-list__title">{j.title}</span>
                        <span class="mini-list__sub">
                          Finished {j.completedAt ? shortDate(j.completedAt) : ''}
                          {j.photos ? ` · ${plural(j.photos, 'photo')} from the crew` : ''}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={16} class="mini-list__chev" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {focus !== 'service' && can('dealers') && (
            <Card
              title="Dealer orders"
              subtitle={openOrders.length ? `${plural(openOrders.length, 'order')} in progress` : 'Nothing in progress'}
              actions={
                <Link class="card-link" to="/office/dealers/?tab=orders">
                  Dealers <Icon name="arrow-right" size={14} />
                </Link>
              }
              flush
            >
              {openOrders.length === 0 ? (
                <EmptyState icon="handshake" title="No open dealer orders" />
              ) : (
                <ul class="mini-list" role="list">
                  {openOrders.slice(0, 5).map((o) => {
                    const units = o.lines.reduce((s, l) => s + l.qty, 0);
                    return (
                      <li key={o.id}>
                        <Link to={`/office/dealers/?tab=orders&id=${o.id}`} class="mini-list__row">
                          <span class={`mini-list__icon mini-list__icon--${orderStatusMeta[o.status].tone}`}>
                            <Icon name={orderStatusMeta[o.status].icon} size={15} />
                          </span>
                          <span class="mini-list__main">
                            <span class="mini-list__title">{dealerOf(d, o.dealerId)?.name ?? o.dealerId}</span>
                            <span class="mini-list__sub">
                              <strong class="mini-list__status">{orderStatusLabels[o.status]}</strong> · {o.id} · {plural(units, 'unit')}
                              {o.shipOn ? ` · ship by ${shortDate(o.shipOn)}` : ''}
                            </span>
                          </span>
                          <Icon name="chevron-right" size={16} class="mini-list__chev" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {(focus === 'owner' || focus === 'office') && (
            <Card title="This month" subtitle={monthLong(currentKey)}>
              <ul class="channel-split" role="list">
                {[
                  { key: 'direct', label: 'Lake customers', value: monthDirect, tone: 'accent' as const, note: `${plural(d.jobs.filter((j) => j.type === 'install' && j.completedAt && j.completedAt.slice(0, 10) >= monthStart).length, 'install')} finished` },
                  { key: 'dealer', label: 'Dealers', value: monthDealer, tone: 'blue' as const, note: `${plural(d.dealerOrders.filter((o) => o.shippedOn && o.shippedOn >= monthStart).length, 'order')} shipped` },
                ].map((r) => (
                  <li key={r.key}>
                    <div class="row row--between">
                      <span class="channel-split__name">{r.label}</span>
                      <span class="channel-split__value">{money(r.value, false)}</span>
                    </div>
                    <Meter value={r.value} max={monthTotal || 1} label={`${r.label}: share of this month’s revenue`} tone={r.tone} />
                    <p class="muted small">
                      {Math.round((r.value / (monthTotal || 1)) * 100)}% of revenue · {r.note}
                    </p>
                  </li>
                ))}
              </ul>
              {can('analytics') && (
                <LinkButton variant="ghost" size="sm" icon="chart" to={sectionPath('analytics')}>
                  See all reports
                </LinkButton>
              )}
            </Card>
          )}
        </div>
      </div>

      <p class="demo-footnote">
        <Badge tone="neutral" icon="info">
          Sample data
        </Badge>{' '}
        Customers, jobs and figures are invented for this demo. Dean is the only real name, used for a sign-in profile; the rest of the team are placeholders.
      </p>
    </div>
  );
}
