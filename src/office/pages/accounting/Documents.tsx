/** Invoices and quotes (estimates in the data): filtered lists plus a printable document view. */
import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { acceptEstimate, convertEstimate, declineEstimate, orderFromEstimate, sendInvoice, sendReminder, voidInvoice } from '../../actions';
import { prettyPhone, site } from '../../../data/site';
import { cancellation } from '../../../data/warranty';
import type { Customer, Invoice, Job } from '../../data/types';
import { addDays, diffDays, today } from '../../lib/dates';
import { fromToday, money, plural, relative, shortDate } from '../../lib/format';
import { openDialog } from '../../dialogs';
import { param, setParams } from '../../router';
import { customerOf, daysOverdue, dealerOf, invoiceStatus, invoiceTotals, jobOf, staffOf, type InvoiceStatus } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Avatar, Button, Card, Chips, EmptyState, Field, Link, LinkButton, Menu, SearchInput, type MenuItem } from '../../ui/core';
import { Confirm, Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { invoiceStatusMeta, StatusBadge } from '../../ui/status';
import { isDeposit, isReceivable, METHOD_LABELS, pendingInstall, printElement, sum } from './helpers';

interface Row {
  inv: Invoice;
  status: InvoiceStatus;
  total: number;
  balance: number;
  customer?: Customer;
  job?: Job;
}

const statusOrder: Record<InvoiceStatus, number> = { overdue: 0, partial: 1, open: 2, sent: 2, draft: 3, expired: 4, accepted: 5, paid: 6, declined: 7, void: 8 };

function useRows(kind: 'invoice' | 'estimate'): Row[] {
  const d = db.value;
  const t = today();
  return useMemo(
    () =>
      d.invoices
        .filter((i) => i.kind === kind)
        .map((inv) => {
          const totals = invoiceTotals(inv);
          return { inv, status: invoiceStatus(inv, t), total: totals.total, balance: totals.balance, customer: customerOf(d, inv.customerId), job: jobOf(d, inv.jobId) };
        }),
    [d, kind, t],
  );
}

/** Where a customer is: dealers and marinas by town, lake owners by their spot on the lake */
const customerWhere = (c?: Customer) =>
  !c ? '' : c.kind === 'dealer' ? `Dealer · ${c.address.city}${c.address.state ? `, ${c.address.state}` : ''}` : c.lake ? `${c.lake.arm}${c.lake.mm !== undefined ? `, MM ${c.lake.mm}` : ''}` : c.address.city;

const matchesSearch = (r: Row, q: string) => {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return r.inv.id.toLowerCase().includes(term) || (r.customer?.name.toLowerCase().includes(term) ?? false) || (r.job?.id.toLowerCase().includes(term) ?? false) || (r.inv.dealerOrderId?.toLowerCase().includes(term) ?? false);
};

const docPath = (inv: Invoice) => `/office/accounting/?tab=${inv.kind === 'estimate' ? 'estimates' : 'invoices'}&id=${inv.id}`;

/** Open a document over the current list, keeping its filters (modified clicks still open a new tab) */
const openDoc = (e: MouseEvent, id: string) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  setParams({ id });
};

/* ---------- Invoices ---------- */

type InvoiceFilter = 'all' | 'draft' | 'open' | 'overdue' | 'paid';

const inFilter = (s: InvoiceStatus, f: InvoiceFilter) =>
  f === 'all' ? true : f === 'open' ? s === 'open' || s === 'partial' : f === 'draft' ? s === 'draft' : f === 'overdue' ? s === 'overdue' : s === 'paid';

export function InvoicesTab() {
  const d = db.value;
  const t = today();
  const rows = useRows('invoice');
  const filter = (param('filter') as InvoiceFilter | undefined) ?? 'all';
  const [q, setQ] = useState('');
  const synced = d.books.connected;

  const count = (f: InvoiceFilter) => rows.filter((r) => inFilter(r.status, f)).length;
  const receivable = sum(rows.filter((r) => isReceivable(d, r.inv)).map((r) => r.balance));
  const deposits = sum(rows.filter((r) => isDeposit(d, r.inv)).map((r) => r.balance));
  const overdueTotal = sum(rows.filter((r) => r.status === 'overdue').map((r) => r.balance));
  const collected = sum(rows.flatMap((r) => r.inv.payments.filter((p) => p.date >= addDays(t, -30)).map((p) => p.amount)));
  const visible = rows.filter((r) => inFilter(r.status, filter) && matchesSearch(r, q));

  const columns: Column<Row>[] = [
    {
      key: 'id',
      label: 'Invoice',
      sortValue: (r) => r.inv.id,
      render: (r) => (
        <>
          <Link to={docPath(r.inv)} class="cell-main" onClick={(e) => openDoc(e, r.inv.id)}>
            {r.inv.id}
          </Link>
          <span class="cell-sub">
            {isDeposit(d, r.inv)
              ? `Deposit · ${pendingInstall(d, r.inv)?.id} not installed yet`
              : r.inv.dealerOrderId
                ? `Dealer order ${r.inv.dealerOrderId}`
                : r.job
                  ? `${r.job.id} · ${r.job.title}`
                  : (r.inv.memo ?? r.inv.lines[0]?.description ?? 'Invoice')}
          </span>
        </>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortValue: (r) => r.customer?.name ?? '',
      render: (r) => (
        <>
          <span class="cell-main">{r.customer?.name ?? '—'}</span>
          <span class="cell-sub">{customerWhere(r.customer)}</span>
        </>
      ),
    },
    { key: 'issued', label: 'Issued', sortValue: (r) => r.inv.issuedOn, render: (r) => <span class="nowrap">{shortDate(r.inv.issuedOn)}</span> },
    {
      key: 'due',
      label: 'Due',
      hide: 'sm',
      sortValue: (r) => r.inv.dueOn,
      render: (r) => (
        <>
          <span class="nowrap">{shortDate(r.inv.dueOn)}</span>
          {r.status === 'overdue' && <span class="cell-sub is-bad nowrap">{plural(daysOverdue(r.inv, t), 'day')} late</span>}
          {(r.status === 'open' || r.status === 'partial') && <span class="cell-sub nowrap">{r.inv.dueOn === t ? 'due today' : `due ${fromToday(r.inv.dueOn)}`}</span>}
        </>
      ),
    },
    { key: 'total', label: 'Total', align: 'right', sortValue: (r) => r.total, render: (r) => money(r.total) },
    { key: 'balance', label: 'Balance', align: 'right', sortValue: (r) => r.balance, render: (r) => (r.balance > 0.004 && r.status !== 'void' ? <strong>{money(r.balance)}</strong> : <span class="muted">—</span>) },
    { key: 'status', label: 'Status', sortValue: (r) => statusOrder[r.status], render: (r) => <StatusBadge meta={invoiceStatusMeta[r.status]} /> },
  ];
  if (synced) {
    columns.push({
      key: 'sync',
      label: 'QuickBooks',
      hide: 'md',
      align: 'center',
      sortValue: (r) => (r.inv.syncedAt ? 1 : 0),
      render: (r) =>
        r.inv.syncedAt ? (
          <span class="sync-ok" title={`Synced ${relative(r.inv.syncedAt)}`}>
            <Icon name="check-circle" size={16} />
            <span class="sr-only">Synced</span>
          </span>
        ) : (
          <span class="muted small">{r.inv.status === 'draft' ? 'Draft' : 'Pending'}</span>
        ),
    });
  }

  return (
    <>
      <div class="acct-summary">
        <div>
          <span class="acct-summary__label">Receivables</span>
          <span class="acct-summary__value">{money(receivable, false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Overdue</span>
          <span class={`acct-summary__value${overdueTotal ? ' is-bad' : ''}`}>{money(overdueTotal, false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Deposits on lifts not installed yet</span>
          <span class="acct-summary__value">{money(deposits, false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Collected, last 30 days</span>
          <span class="acct-summary__value">{money(collected, false)}</span>
        </div>
      </div>

      <div class="toolbar">
        <Chips
          label="Filter invoices"
          value={filter}
          onChange={(k) => setParams({ filter: k === 'all' ? undefined : k }, { replace: true })}
          items={[
            { key: 'all', label: 'All', count: count('all') },
            { key: 'draft', label: 'Draft', count: count('draft') },
            { key: 'open', label: 'Open', count: count('open') },
            { key: 'overdue', label: 'Overdue', count: count('overdue') },
            { key: 'paid', label: 'Paid', count: count('paid') },
          ]}
        />
        <span class="toolbar__spacer" />
        <SearchInput value={q} onInput={setQ} label="Search invoices" placeholder="Invoice #, customer or job" />
        <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'invoice', preset: { kind: 'invoice' } })}>
          New invoice
        </Button>
      </div>

      <Card flush>
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(r) => r.inv.id}
          caption="Invoices"
          initialSort={{ key: filter === 'overdue' ? 'due' : 'issued', dir: filter === 'overdue' ? 'asc' : 'desc' }}
          onRowClick={(r) => setParams({ id: r.inv.id })}
          rowClass={(r) => (r.status === 'void' ? 'is-void' : undefined)}
          empty={<EmptyState icon="receipt" title={q ? `No invoices match “${q}”` : 'No invoices here'} />}
        />
      </Card>
    </>
  );
}

/* ---------- Quotes (estimates in the data) ---------- */

type EstimateFilter = 'all' | 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export function EstimatesTab() {
  const d = db.value;
  const t = today();
  const rows = useRows('estimate');
  const filter = (param('filter') as EstimateFilter | undefined) ?? 'all';
  const [q, setQ] = useState('');

  const count = (f: EstimateFilter) => rows.filter((r) => f === 'all' || r.status === f).length;
  const open = rows.filter((r) => r.status === 'sent');
  // Won and lost quote requests in the last 90 days (a request is won when the lift is ordered)
  const decided = d.leads.filter((l) => l.kind === 'quote' && (l.stage === 'won' || l.stage === 'lost') && l.closedAt && diffDays(t, l.closedAt.slice(0, 10)) <= 90);
  const won = decided.filter((l) => l.stage === 'won');
  const winRate = decided.length ? won.length / decided.length : undefined;
  const expiring = open.filter((r) => diffDays(r.inv.dueOn, t) <= 7).length;
  const visible = rows.filter((r) => (filter === 'all' || r.status === filter) && matchesSearch(r, q));

  const columns: Column<Row>[] = [
    {
      key: 'id',
      label: 'Quote',
      sortValue: (r) => r.inv.id,
      render: (r) => (
        <>
          <Link to={docPath(r.inv)} class="cell-main" onClick={(e) => openDoc(e, r.inv.id)}>
            {r.inv.id}
          </Link>
          <span class="cell-sub">{r.inv.lines.find((l) => l.category === 'Lifts' || l.category === 'Dealer sales')?.description ?? r.inv.lines[0]?.description ?? 'Quote'}</span>
        </>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortValue: (r) => r.customer?.name ?? '',
      render: (r) => (
        <>
          <span class="cell-main">{r.customer?.name ?? '—'}</span>
          <span class="cell-sub">{customerWhere(r.customer)}</span>
        </>
      ),
    },
    { key: 'issued', label: 'Sent', sortValue: (r) => r.inv.issuedOn, render: (r) => <span class="nowrap">{shortDate(r.inv.issuedOn)}</span> },
    {
      key: 'valid',
      label: 'Good until',
      hide: 'sm',
      sortValue: (r) => r.inv.dueOn,
      render: (r) => (
        <>
          <span class="nowrap">{shortDate(r.inv.dueOn)}</span>
          {r.status === 'sent' && <span class="cell-sub nowrap">{diffDays(r.inv.dueOn, t) <= 7 ? `expires ${fromToday(r.inv.dueOn)}` : `${diffDays(r.inv.dueOn, t)} days left`}</span>}
        </>
      ),
    },
    { key: 'total', label: 'Total', align: 'right', sortValue: (r) => r.total, render: (r) => money(r.total) },
    { key: 'status', label: 'Status', sortValue: (r) => statusOrder[r.status], render: (r) => <StatusBadge meta={invoiceStatusMeta[r.status]} /> },
    {
      key: 'by',
      label: 'Prepared by',
      hide: 'md',
      sortValue: (r) => staffOf(d, r.inv.salesperson)?.name ?? '',
      render: (r) => {
        const person = staffOf(d, r.inv.salesperson);
        return person ? (
          <span class="person-cell">
            <Avatar person={person} size={22} />
            {person.name.split(' ')[0]}
          </span>
        ) : (
          <span class="muted">—</span>
        );
      },
    },
  ];

  return (
    <>
      <div class="acct-summary">
        <div>
          <span class="acct-summary__label">Waiting on customers</span>
          <span class="acct-summary__value">{money(sum(open.map((r) => r.total)), false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Lifts ordered, last 90 days</span>
          <span class="acct-summary__value">{money(sum(won.map((l) => l.value ?? 0)), false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Quote requests won, last 90 days</span>
          <span class="acct-summary__value">{winRate === undefined ? '—' : `${Math.round(winRate * 100)}%`}</span>
        </div>
        <div>
          <span class="acct-summary__label">Expiring within a week</span>
          <span class="acct-summary__value">{expiring}</span>
        </div>
      </div>

      <div class="toolbar">
        <Chips
          label="Filter quotes"
          value={filter}
          onChange={(k) => setParams({ filter: k === 'all' ? undefined : k }, { replace: true })}
          items={[
            { key: 'all', label: 'All', count: count('all') },
            { key: 'sent', label: 'Waiting', count: count('sent') },
            { key: 'accepted', label: 'Accepted', count: count('accepted') },
            { key: 'declined', label: 'Declined', count: count('declined') },
            { key: 'expired', label: 'Expired', count: count('expired') },
            { key: 'draft', label: 'Draft', count: count('draft') },
          ]}
        />
        <span class="toolbar__spacer" />
        <SearchInput value={q} onInput={setQ} label="Search quotes" placeholder="Quote # or customer" />
        <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'invoice', preset: { kind: 'estimate' } })}>
          New quote
        </Button>
      </div>

      <Card flush>
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(r) => r.inv.id}
          caption="Quotes"
          initialSort={{ key: 'issued', dir: 'desc' }}
          onRowClick={(r) => setParams({ id: r.inv.id })}
          empty={<EmptyState icon="file" title={q ? `No quotes match “${q}”` : 'No quotes here'} />}
        />
      </Card>
    </>
  );
}

/* ---------- Document view ---------- */

const DECLINE_REASONS = ['Went with another lift company', 'Over budget', 'Waiting until next season', 'Bought a used lift', 'Sold the boat', 'No longer needed'];

function DeclineDialog({ estimate, onClose }: { estimate: Invoice; onClose: () => void }) {
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  return (
    <Dialog
      title={`Decline ${estimate.id}?`}
      class="acct-dialog"
      description="The request is marked lost with this reason, which shows up in the lead reports."
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              declineEstimate(estimate.id, reason);
              toast(`${estimate.id} marked declined — ${reason.toLowerCase()}`);
              onClose();
            }}
          >
            Mark declined
          </Button>
        </>
      }
    >
      <Field label="Reason">
        <select class="select" value={reason} data-autofocus onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
          {DECLINE_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
    </Dialog>
  );
}

export function DocumentDrawer({ doc, onClose }: { doc: Invoice; onClose: () => void }) {
  const d = db.value;
  const t = today();
  const paper = useRef<HTMLElement>(null);
  const [confirm, setConfirm] = useState<'void' | 'decline' | null>(null);
  const status = invoiceStatus(doc, t);
  const totals = invoiceTotals(doc);
  const customer = customerOf(d, doc.customerId);
  const job = jobOf(d, doc.jobId);
  const lead = doc.leadId ? d.leads.find((l) => l.id === doc.leadId) : undefined;
  const order = doc.dealerOrderId ? d.dealerOrders.find((o) => o.id === doc.dealerOrderId) : undefined;
  const dealer = order ? dealerOf(d, order.dealerId) : customer?.dealerId ? dealerOf(d, customer.dealerId) : undefined;
  const isEstimate = doc.kind === 'estimate';
  const noun = isEstimate ? 'Quote' : 'Invoice';
  const contact = customer?.email || customer?.name || 'the customer';
  const taxable = doc.lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.rate, 0);
  const taxedLine = (l: (typeof doc.lines)[number]) => l.taxable && l.qty * l.rate !== 0;
  const deposit = isDeposit(d, doc);
  const depositFor = deposit ? pendingInstall(d, doc) : undefined;
  const sourceEstimate = doc.memo?.match(/From (?:quote|estimate) (EST-\d+)/)?.[1];
  // An accepted quote may already be billed (deposit invoice) and in the shop
  const billedOn = isEstimate
    ? d.invoices.find((i) => i.kind === 'invoice' && i.status !== 'void' && ((doc.leadId && i.leadId === doc.leadId) || i.memo === `From quote ${doc.id}`))
    : undefined;
  const orderJobs = isEstimate && doc.leadId ? d.jobs.filter((j) => j.leadId === doc.leadId && j.status !== 'cancelled') : [];
  const installJob = orderJobs.find((j) => j.type === 'install');
  const buildJob = orderJobs.find((j) => j.type === 'build');
  const liftLine = doc.lines.find((l) => l.itemId && d.items.find((i) => i.id === l.itemId)?.kind === 'lift');

  const send = () => {
    sendInvoice(doc.id);
    toast(`${noun} ${doc.id} sent to ${contact} (simulated — nothing leaves this browser)`);
  };
  const print = () => paper.current && printElement(paper.current, `${noun} ${doc.id} — ${site.name}`);

  const actions: ComponentChildren[] = [];
  const more: (MenuItem | 'divider')[] = [];

  if (!isEstimate) {
    if (status === 'draft') {
      actions.push(
        <Button key="send" variant="primary" icon="send" onClick={send}>
          Send invoice
        </Button>,
        <Button key="edit" icon="edit" onClick={() => openDialog({ kind: 'invoice', invoiceId: doc.id })}>
          Edit
        </Button>,
      );
    }
    if (status === 'open' || status === 'partial' || status === 'overdue' || status === 'draft') {
      actions.push(
        <Button key="pay" variant={status === 'draft' ? 'secondary' : 'primary'} icon="dollar" onClick={() => openDialog({ kind: 'payment', invoiceId: doc.id })}>
          Record payment
        </Button>,
      );
    }
    if (status === 'overdue') {
      actions.push(
        <Button
          key="remind"
          icon="bell"
          onClick={() => {
            sendReminder(doc.id);
            toast(`Reminder sent to ${contact} (simulated)`);
          }}
        >
          Send reminder
        </Button>,
      );
    }
    if (status !== 'draft' && status !== 'void') more.push({ label: 'Resend invoice', icon: 'send', onSelect: send });
    if (status !== 'void' && status !== 'paid' && totals.paid === 0) more.push({ label: 'Void invoice', icon: 'x-circle', onSelect: () => setConfirm('void'), danger: true });
  } else {
    if (status === 'draft') {
      actions.push(
        <Button key="send" variant="primary" icon="send" onClick={send}>
          Send quote
        </Button>,
        <Button key="edit" icon="edit" onClick={() => openDialog({ kind: 'invoice', invoiceId: doc.id })}>
          Edit
        </Button>,
      );
    }
    if (status === 'sent' || status === 'expired') {
      actions.push(
        <Button
          key="accept"
          variant="primary"
          icon="check"
          onClick={() => {
            acceptEstimate(doc.id);
            toast(`${doc.id} accepted — order the lift to put it in the shop.`, { tone: 'success' });
          }}
        >
          Mark accepted
        </Button>,
        <Button key="decline" icon="x-circle" onClick={() => setConfirm('decline')}>
          Declined
        </Button>,
      );
      more.push({ label: 'Resend quote', icon: 'send', onSelect: send });
    }
    if (status === 'accepted') {
      actions.push(
        installJob ? (
          <LinkButton key="job" variant="primary" icon="clipboard" to={`/office/jobs/?id=${installJob.id}`}>
            View install {installJob.id}
          </LinkButton>
        ) : liftLine ? (
          <Button
            key="order"
            variant="primary"
            icon="hardhat"
            onClick={() => {
              const { buildId, installId } = orderFromEstimate(doc.id);
              toast(buildId && installId ? `Ordered: shop build ${buildId} and install ${installId} are waiting to be scheduled` : 'Ordered', { tone: 'success' });
            }}
          >
            Order the lift
          </Button>
        ) : (
          <Button key="schedule" variant="primary" icon="calendar-plus" onClick={() => openDialog({ kind: 'job', preset: { type: 'install', customerId: doc.customerId, leadId: doc.leadId } })}>
            Schedule the work
          </Button>
        ),
        billedOn ? (
          <Button key="billed" icon="receipt" onClick={() => setParams({ tab: 'invoices', id: billedOn.id })}>
            View invoice {billedOn.id}
          </Button>
        ) : (
          <Button
            key="convert"
            icon="receipt"
            onClick={() => {
              const id = convertEstimate(doc.id);
              toast(`Invoice ${id} created from ${doc.id}`, { tone: 'success' });
              setParams({ tab: 'invoices', id });
            }}
          >
            Invoice a deposit
          </Button>
        ),
      );
    }
  }

  const terms = isEstimate
    ? `This quote is good until ${shortDate(doc.dueOn, true)}.`
    : deposit
      ? 'Deposit now; the balance is due when the lift is installed.'
      : doc.dueOn <= doc.issuedOn
        ? 'Payment is due on receipt.'
        : `Payment is due by ${shortDate(doc.dueOn, true)}.`;

  return (
    <Dialog
      title={`${noun} ${doc.id}`}
      description={`${customer?.name ?? 'Customer'} · ${money(totals.total)}`}
      onClose={onClose}
      drawer
      size="lg"
      class="doc-drawer"
      headerExtra={<StatusBadge meta={invoiceStatusMeta[status]} />}
    >
      <div class="doc-actions">
        {actions}
        <Button icon="printer" onClick={print}>
          Print or save PDF
        </Button>
        {more.length > 0 && <Menu label={`More ${noun.toLowerCase()} actions`} items={more} />}
      </div>

      {status === 'overdue' && (
        <p class="callout callout--amber doc-callout">
          <Icon name="alert" size={18} />
          <span>
            <span class="callout__title">{daysOverdue(doc, t)} days past due.</span>{' '}
            <span class="callout__text">{doc.remindedAt ? `Last reminder sent ${relative(doc.remindedAt)}.` : 'No reminder sent yet.'}</span>
          </span>
        </p>
      )}
      {deposit && (
        <p class="callout callout--blue doc-callout">
          <Icon name="info" size={18} />
          <span class="callout__text">
            Deposit invoice — the rest is due when {depositFor?.id ?? 'the install'} is finished{depositFor?.start ? ` (scheduled ${shortDate(depositFor.start)})` : ''}.
          </span>
        </p>
      )}
      {status === 'accepted' && (
        <p class="callout callout--green doc-callout">
          <Icon name="check-circle" size={18} />
          <span class="callout__text">
            Accepted{doc.acceptedOn ? ` on ${shortDate(doc.acceptedOn)}` : ''}.{' '}
            {installJob
              ? `In the works: ${buildJob ? `shop build ${buildJob.id}, ` : ''}install ${installJob.id}${installJob.start ? ` on ${shortDate(installJob.start)}` : ' (not scheduled yet)'}${billedOn ? ` · billed on ${billedOn.id}` : ''}.`
              : liftLine
                ? 'Order the lift to put the build and the install on the schedule.'
                : 'Schedule the work next.'}
          </span>
        </p>
      )}

      <article class="doc-paper" ref={paper} aria-label={`${noun} ${doc.id}`}>
        <header class="doc-paper__head">
          <div>
            <p class="doc-wordmark">{site.legalName}</p>
            <p class="doc-paper__addr">
              {site.address.street}
              <br />
              {site.address.city}, {site.address.state} {site.address.zip}
              <br />
              Sales {prettyPhone(site.sales.phone)} · Service {prettyPhone(site.service.phone)}
            </p>
          </div>
          <div class="doc-paper__title">
            <p class="doc-paper__kind">{noun}</p>
            <dl class="doc-facts">
              <div>
                <dt>{noun} no.</dt>
                <dd>{doc.id}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{shortDate(doc.issuedOn, true)}</dd>
              </div>
              <div>
                <dt>{isEstimate ? 'Good until' : 'Due'}</dt>
                <dd>{doc.dueOn <= doc.issuedOn && !isEstimate ? 'On receipt' : shortDate(doc.dueOn, true)}</dd>
              </div>
              {job && (
                <div>
                  <dt>Job</dt>
                  <dd>{job.id}</dd>
                </div>
              )}
              {order && (
                <div>
                  <dt>Dealer order</dt>
                  <dd>{order.id}</dd>
                </div>
              )}
            </dl>
          </div>
        </header>

        <section class="doc-paper__parties">
          <div>
            <p class="doc-label">{isEstimate ? 'Prepared for' : 'Bill to'}</p>
            <p>
              <strong>{customer?.name}</strong>
              {customer?.contact && (
                <>
                  <br />
                  Attn: {customer.contact}
                </>
              )}
              {customer?.address.street && (
                <>
                  <br />
                  {customer.address.street}
                  <br />
                  {customer.address.city}, {customer.address.state} {customer.address.zip}
                </>
              )}
              {!customer?.address.street && customer?.address.city && (
                <>
                  <br />
                  {customer.address.city}, {customer.address.state}
                </>
              )}
              {customer?.email && (
                <>
                  <br />
                  {customer.email}
                </>
              )}
            </p>
          </div>
          {(job || customer?.lake || lead?.boat) && (
            <div>
              <p class="doc-label">{job ? 'Work' : 'For'}</p>
              <p>
                {job ? job.title : lead?.boat ? `A ${lead.boat.lengthFt} ft ${lead.boat.type.toLowerCase()}` : 'The lift'}
                {job?.completedAt && (
                  <>
                    <br />
                    Completed {shortDate(job.completedAt, true)}
                  </>
                )}
                {customer?.lake && (
                  <>
                    <br />
                    Dock: {customer.lake.arm}
                    {customer.lake.mm !== undefined ? `, MM ${customer.lake.mm}` : ''}
                    {customer.lake.cove ? ` · ${customer.lake.cove}` : ''}
                  </>
                )}
              </p>
            </div>
          )}
        </section>

        <table class="doc-lines">
          <caption class="sr-only">{noun} lines</caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" class="is-right">
                Qty
              </th>
              <th scope="col" class="is-right">
                Rate
              </th>
              <th scope="col" class="is-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.description}
                  {taxedLine(l) && (
                    <span class="doc-taxmark" title="Taxable">
                      {' '}
                      *
                    </span>
                  )}
                </td>
                <td class="is-right tabular">{l.qty}</td>
                <td class="is-right tabular">{money(l.rate)}</td>
                <td class="is-right tabular">{money(l.qty * l.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div class="doc-paper__sum">
          <div class="doc-paper__note">
            {doc.memo && <p>{doc.memo}</p>}
            <p class="doc-terms">
              {terms} {taxable > 0 ? '* Taxable item.' : ''}
            </p>
            {isEstimate && <p class="doc-terms doc-terms--fine">Cancellations (from FiberSteel’s warranty page): {cancellation}</p>}
          </div>
          <dl class="doc-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>{taxable > 0 ? `Sales tax (${(doc.taxRate * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}% of ${money(taxable)})` : 'Sales tax (nothing taxable)'}</dt>
              <dd>{money(totals.tax)}</dd>
            </div>
            <div class="doc-totals__total">
              <dt>Total</dt>
              <dd>{money(totals.total)}</dd>
            </div>
            {doc.payments.map((p) => (
              <div key={p.id} class="doc-totals__pay">
                <dt>
                  Paid {shortDate(p.date)} · {METHOD_LABELS[p.method]}
                  {p.ref ? ` ${p.ref}` : ''}
                </dt>
                <dd>−{money(p.amount)}</dd>
              </div>
            ))}
            {!isEstimate && (
              <div class="doc-totals__due">
                <dt>Balance due</dt>
                <dd>{money(status === 'void' ? 0 : totals.balance)}</dd>
              </div>
            )}
          </dl>
        </div>
        {status === 'void' && <p class="doc-void">Void</p>}
        <footer class="doc-paper__foot">{d.settings.invoiceFooter} · A sample document from the FiberSteel mode demo — the names, prices and tax rate are made up.</footer>
      </article>

      <section class="doc-meta" aria-label="Related records and history">
        <div>
          <h3 class="section-label">Related</h3>
          <ul class="doc-links" role="list">
            {customer && (
              <li>
                <Icon name="user" size={16} />
                <Link to={`/office/customers/?id=${customer.id}`}>{customer.name}</Link>
              </li>
            )}
            {dealer && (
              <li>
                <Icon name="handshake" size={16} />
                <Link to={`/office/dealers/?id=${dealer.id}`}>Dealer account · {dealer.name}</Link>
              </li>
            )}
            {order && (
              <li>
                <Icon name="truck" size={16} />
                <Link to={`/office/dealers/?tab=orders&id=${order.id}`}>Dealer order {order.id}</Link>
              </li>
            )}
            {job && (
              <li>
                <Icon name="clipboard" size={16} />
                <Link to={`/office/jobs/?id=${job.id}`}>
                  {job.id} — {job.title}
                </Link>
              </li>
            )}
            {lead && (
              <li>
                <Icon name="inbox" size={16} />
                <Link to={`/office/inbox/?id=${lead.id}`}>Request {lead.id}</Link>
              </li>
            )}
            {billedOn && (
              <li>
                <Icon name="receipt" size={16} />
                <Link to={`/office/accounting/?tab=invoices&id=${billedOn.id}`}>Invoice {billedOn.id}</Link>
              </li>
            )}
            {!job &&
              orderJobs.map((j) => (
                <li key={j.id}>
                  <Icon name="clipboard" size={16} />
                  <Link to={`/office/jobs/?id=${j.id}`}>
                    {j.id} — {j.title}
                  </Link>
                </li>
              ))}
            {sourceEstimate && (
              <li>
                <Icon name="file" size={16} />
                <Link to={`/office/accounting/?tab=estimates&id=${sourceEstimate}`}>Quote {sourceEstimate}</Link>
              </li>
            )}
            {!customer && !job && !lead && !order && <li class="muted">Nothing linked</li>}
          </ul>
        </div>
        <div>
          <h3 class="section-label">History</h3>
          <ul class="doc-history" role="list">
            <li>
              Created {shortDate(doc.issuedOn, true)}
              {staffOf(d, doc.salesperson) ? ` by ${staffOf(d, doc.salesperson)!.name}` : ''}
            </li>
            {doc.sentAt && <li>Sent {relative(doc.sentAt)}</li>}
            {doc.remindedAt && <li>Reminder sent {relative(doc.remindedAt)}</li>}
            {doc.acceptedOn && <li>Accepted {shortDate(doc.acceptedOn, true)}</li>}
            {doc.payments.map((p) => (
              <li key={p.id}>
                {money(p.amount)} received {shortDate(p.date, true)} ({METHOD_LABELS[p.method].toLowerCase()})
              </li>
            ))}
            {d.books.connected && <li>{doc.syncedAt ? `Synced to QuickBooks ${relative(doc.syncedAt)}` : 'Not synced to QuickBooks yet'}</li>}
          </ul>
        </div>
      </section>

      {confirm === 'void' && (
        <Confirm
          title={`Void ${doc.id}?`}
          confirmLabel="Void invoice"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            voidInvoice(doc.id);
            toast(`${doc.id} voided — it stays on record but no longer counts as owed.`);
          }}
        >
          <p>The invoice stays on record marked void and drops out of receivables and revenue.</p>
        </Confirm>
      )}
      {confirm === 'decline' && <DeclineDialog estimate={doc} onClose={() => setConfirm(null)} />}
    </Dialog>
  );
}
