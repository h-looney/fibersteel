/** Accounting overview: this month's numbers, 12-month income vs. expenses, revenue by category, receivables and bills. */
import { useMemo } from 'preact/hooks';
import { payBill } from '../../actions';
import { addDays, addMonths, startOfMonth, startOfYear, today } from '../../lib/dates';
import { compactMoney, fromToday, money, monthLong, monthShort, plural, shortDate } from '../../lib/format';
import { customerOf, monthlyRevenue, revenueBetween, revenueEvents } from '../../selectors';
import { db, history } from '../../store';
import { toast } from '../../toast';
import { BarChart, ChartFrame, HBarChart } from '../../ui/charts';
import { Badge, Button, Card, EmptyState, Link, Stat } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { agingBuckets, billState, cogsEvents, costBetween, METHOD_LABELS, monthTotals, opexFor, REVENUE_CATEGORIES, revenueByCategory, sum, whenDay } from './helpers';

export function Overview() {
  const d = db.value;
  const h = history.value;
  const store = 'all' as const;
  const t = today();

  const revenue = useMemo(() => revenueEvents(d, h), [d, h]);
  const cogs = useMemo(() => cogsEvents(d, h), [d, h]);

  const monthStart = startOfMonth(t);
  const mtd = revenueBetween(revenue, monthStart, t, store);
  // Year-over-year: through yesterday (today's work isn't finished), and only once a week of the month has passed
  const dayOfMonth = +t.slice(8, 10);
  const through = addDays(t, -1);
  const mtdToYesterday = revenueBetween(revenue, monthStart, through, store);
  const lastYear = dayOfMonth >= 7 ? revenueBetween(revenue, addMonths(monthStart, -12), addMonths(through, -12), store) : 0;
  const cogsMtd = costBetween(cogs, monthStart, t, store);
  const opexMtd = sum(Object.values(opexFor(h, [t.slice(0, 7)], store, t)));
  const expenses = cogsMtd + opexMtd;
  const net = mtd - expenses;

  const cash = d.accounts.filter((a) => a.kind !== 'credit').reduce((s, a) => s + a.balance, 0);
  const cardOwed = -d.accounts.filter((a) => a.kind === 'credit').reduce((s, a) => s + a.balance, 0);

  const aging = agingBuckets(d, t);
  const receivable = sum(aging.map((b) => b.amount));
  const overdue = sum(aging.slice(1).map((b) => b.amount));

  const billsDue = d.bills
    .filter((b) => b.status !== 'paid' && b.dueOn <= addDays(t, 14))
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
  const billsOverdue = billsDue.filter((b) => billState(b, t) === 'overdue');

  const keys = useMemo(() => monthlyRevenue(revenue, t, 12).map((m) => m.key), [revenue, t]);
  const months = useMemo(() => keys.map((k) => monthTotals(h, revenue, cogs, k, store, t)), [keys, d, h, revenue, cogs, store, t]);
  const yearCats = revenueByCategory(revenue, startOfYear(t), t, store);
  const yearTotal = sum(Object.values(yearCats)) || 1;

  const payments = d.invoices
    .flatMap((inv) => inv.payments.map((p) => ({ p, inv })))
    .sort((a, b) => (a.p.date < b.p.date ? 1 : a.p.date > b.p.date ? -1 : 0))
    .slice(0, 6);

  const lastKey = keys[keys.length - 1];

  return (
    <div class="acct-overview">
      <div class="stats acct-stats">
        <Stat
          label="Revenue this month"
          icon="dollar"
          value={money(mtd, false)}
          delta={lastYear ? mtdToYesterday / lastYear - 1 : undefined}
          deltaLabel="vs. same days last year"
          hint={dayOfMonth < 7 ? 'Year-over-year comparison starts on the 7th' : undefined}
          to="/office/accounting/?tab=reports"
        />
        <Stat label="Expenses this month" icon="receipt" value={money(expenses, false)} hint={`${money(cogsMtd, false)} cost of goods · ${money(opexMtd, false)} operating`} to="/office/accounting/?tab=reports" />
        <Stat label="Net profit this month" icon="trend" value={money(net, false)} hint={mtd ? `${net < 0 ? 'Loss — ' : ''}${Math.round((net / mtd) * 100)}% margin` : undefined} to="/office/accounting/?tab=reports" />
        <Stat label="Cash on hand" icon="bank" value={money(cash, false)} hint={`Checking & savings · ${money(cardOwed, false)} on the card`} to="/office/accounting/?tab=banking" />
        <Stat label="Receivables" icon="file" value={money(receivable, false)} hint={<span class={overdue ? 'is-bad' : undefined}>{money(overdue, false)} overdue</span>} to="/office/accounting/?tab=invoices&filter=overdue" />
        <Stat
          label="Bills due in 14 days"
          icon="calendar"
          value={money(sum(billsDue.map((b) => b.amount)), false)}
          hint={
            <>
              {plural(billsDue.length, 'bill')}
              {billsOverdue.length > 0 && <span class="is-bad"> · {billsOverdue.length} overdue</span>}
            </>
          }
          to="/office/accounting/?tab=bills"
        />
      </div>

      <div class="acct-grid">
        <div class="acct-col">
          <ChartFrame
            title="Income vs. expenses"
            subtitle="Last 12 months · expenses include cost of goods sold · sample data"
            legend={[
              { label: 'Income', color: 'var(--series-1)' },
              { label: 'Expenses', color: 'var(--series-2)' },
            ]}
            table={{
              columns: ['Month', 'Income', 'Expenses', 'Net'],
              rows: keys.map((k, i) => [k === lastKey ? `${monthLong(k)} (to date)` : monthLong(k), money(months[i].income, false), money(months[i].expenses, false), money(months[i].income - months[i].expenses, false)]),
            }}
          >
            <BarChart
              ariaLabel="Income and expenses by month for the last 12 months"
              categories={keys.map(monthShort)}
              titles={keys.map((k) => (k === lastKey ? `${monthLong(k)} (to date)` : monthLong(k)))}
              stacked={false}
              series={[
                { key: 'income', label: 'Income', color: 'var(--series-1)', values: months.map((m) => m.income) },
                { key: 'expenses', label: 'Expenses', color: 'var(--series-2)', values: months.map((m) => m.expenses) },
              ]}
              format={(n) => money(n, false)}
              axisFormat={compactMoney}
              height={260}
            />
          </ChartFrame>

          <ChartFrame
            title="Revenue by category"
            subtitle={`${t.slice(0, 4)} so far · lake sales, installs and service, and sales to dealers`}
            table={{
              columns: ['Category', 'Revenue', 'Share'],
              rows: REVENUE_CATEGORIES.map((c) => [c, money(yearCats[c], false), `${Math.round((yearCats[c] / yearTotal) * 100)}%`]),
            }}
          >
            <HBarChart
              ariaLabel={`Revenue by category for ${t.slice(0, 4)}`}
              rows={REVENUE_CATEGORIES.map((c) => ({ key: c, label: c, value: yearCats[c], note: `· ${Math.round((yearCats[c] / yearTotal) * 100)}%` })).sort((a, b) => b.value - a.value)}
              format={(n) => money(n, false)}
            />
          </ChartFrame>
        </div>

        <div class="acct-col">
          <ChartFrame
            title="Receivables aging"
            subtitle={`${money(receivable, false)} outstanding · ${money(overdue, false)} past due`}
            table={{ columns: ['Age', 'Balance', 'Invoices'], rows: aging.map((b) => [b.label, money(b.amount, false), b.count]) }}
            actions={
              <Link class="card-link" to="/office/accounting/?tab=invoices&filter=overdue">
                Overdue <Icon name="arrow-right" size={14} />
              </Link>
            }
          >
            <HBarChart
              ariaLabel="Unpaid invoice balances by how late they are"
              rows={aging.map((b) => ({ key: b.key, label: b.label, value: b.amount, sub: plural(b.count, 'invoice') }))}
              format={(n) => money(n, false)}
            />
          </ChartFrame>

          <Card
            title="Bills coming due"
            subtitle={billsDue.length ? `Next 14 days${billsOverdue.length ? ` · ${billsOverdue.length} overdue` : ''}` : 'Nothing due in the next two weeks'}
            actions={
              <Link class="card-link" to="/office/accounting/?tab=bills">
                All bills <Icon name="arrow-right" size={14} />
              </Link>
            }
            flush
          >
            {billsDue.length === 0 ? (
              <EmptyState icon="check-circle" title="No bills due soon" />
            ) : (
              <ul class="acct-list" role="list">
                {billsDue.slice(0, 6).map((b) => {
                  const vendor = d.vendors.find((v) => v.id === b.vendorId);
                  const state = billState(b, t);
                  return (
                    <li key={b.id} class="acct-list__row">
                      <span class="acct-list__main">
                        <span class="acct-list__title">{vendor?.name ?? 'Vendor'}</span>
                        <span class={`acct-list__sub${state === 'overdue' ? ' is-bad' : ''}`}>
                          {state === 'overdue' ? `Overdue — was due ${shortDate(b.dueOn)}` : state === 'scheduled' ? `Scheduled for ${shortDate(b.scheduledOn ?? b.dueOn)}` : `Due ${fromToday(b.dueOn)}`}
                          {' · '}
                          {b.category}
                        </span>
                      </span>
                      <span class="acct-list__amount tabular">{money(b.amount)}</span>
                      {state !== 'scheduled' ? (
                        <Button
                          size="sm"
                          aria-label={`Pay ${money(b.amount)} to ${vendor?.name ?? 'vendor'}`}
                          onClick={() => {
                            payBill(b.id);
                            toast(`Paid ${money(b.amount)} to ${vendor?.name ?? 'vendor'} from Operating checking (simulated)`, { tone: 'success' });
                          }}
                        >
                          Pay
                        </Button>
                      ) : (
                        <Badge tone="teal" icon="calendar">
                          Scheduled
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Recent payments" subtitle="Money received from customers and dealers" flush>
            {payments.length === 0 ? (
              <EmptyState icon="dollar" title="No payments yet" />
            ) : (
              <ul class="acct-list" role="list">
                {payments.map(({ p, inv }) => (
                  <li key={p.id}>
                    <Link to={`/office/accounting/?tab=invoices&id=${inv.id}`} class="acct-list__row acct-list__row--link">
                      <span class="acct-list__main">
                        <span class="acct-list__title">{customerOf(d, inv.customerId)?.name ?? 'Customer'}</span>
                        <span class="acct-list__sub">
                          {inv.id} · {METHOD_LABELS[p.method]}
                          {p.ref ? ` ${p.ref}` : ''} · {whenDay(p.date, t)}
                        </span>
                      </span>
                      <span class="acct-list__amount acct-list__amount--in tabular">+{money(p.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
