/** Bills (accounts payable): what FiberSteel owes vendors (sample vendors), with pay and schedule actions. */
import { useMemo, useState } from 'preact/hooks';
import { payBill, scheduleBill } from '../../actions';
import type { Bill, ExpenseCategory } from '../../data/types';
import { addDays, diffDays, startOfMonth, today } from '../../lib/dates';
import { fromToday, money, plural, shortDate } from '../../lib/format';
import { navigate, param, setParams } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, Chips, EmptyState, Field, Menu, SearchInput, type Tone } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import type { IconName } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { billState, createBill, EXPENSE_CATEGORIES, sum, type BillState } from './helpers';

const stateMeta: Record<BillState, { label: string; tone: Tone; icon: IconName }> = {
  open: { label: 'Open', tone: 'blue', icon: 'clock' },
  scheduled: { label: 'Scheduled', tone: 'teal', icon: 'calendar' },
  overdue: { label: 'Overdue', tone: 'red', icon: 'alert' },
  paid: { label: 'Paid', tone: 'green', icon: 'check-circle' },
};

type BillFilter = 'all' | 'unpaid' | 'overdue' | 'scheduled' | 'paid';

const inFilter = (s: BillState, f: BillFilter) => (f === 'all' ? true : f === 'unpaid' ? s !== 'paid' : s === f);

interface Row {
  bill: Bill;
  state: BillState;
  vendor: string;
}

function NewBillDialog({ onClose }: { onClose: () => void }) {
  const d = db.value;
  const vendors = [...d.vendors].sort((a, b) => a.name.localeCompare(b.name));
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const vendor = d.vendors.find((v) => v.id === vendorId);
  const termsDays = (t?: string) => (t === 'Net 30' ? 30 : t === 'Net 15' ? 15 : 0);
  const [number, setNumber] = useState('');
  const [issuedOn, setIssuedOn] = useState(today());
  const [dueOn, setDueOn] = useState<string | undefined>();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | undefined>();
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const due = dueOn ?? addDays(issuedOn, termsDays(vendor?.terms));
  const cat = category ?? vendor?.category ?? 'Shop supplies & tools';

  const save = () => {
    const value = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (!vendor) return setError('Choose a vendor.');
    if (!number.trim()) return setError('Enter the vendor’s bill or invoice number.');
    if (!(value > 0)) return setError('Enter the amount owed.');
    createBill({ vendorId, number: number.trim(), issuedOn, dueOn: due, amount: value, category: cat, store: 'camdenton', memo: memo.trim() || undefined });
    toast(`Bill ${number.trim()} from ${vendor.name} added — ${money(value)} due ${shortDate(due)}`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Add a bill"
      class="acct-dialog"
      description="Enter a vendor bill so it shows up in payables and on the overview."
      onClose={onClose}
      size="md"
      footer={
        <>
          {error && (
            <p class="inv-editor__error" role="alert">
              {error}
            </p>
          )}
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Add bill
          </Button>
        </>
      }
    >
      <form
        class="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Vendor" class="span-2" hint={vendor ? `${vendor.terms} · usually ${vendor.category.toLowerCase()}` : undefined}>
          <select class="select" value={vendorId} data-autofocus onChange={(e) => setVendorId((e.target as HTMLSelectElement).value)}>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bill number">
          <input class="input" value={number} onInput={(e) => setNumber((e.target as HTMLInputElement).value)} placeholder="From the vendor’s invoice" />
        </Field>
        <Field label="Amount">
          <span class="money-input">
            <span aria-hidden="true">$</span>
            <input class="input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
          </span>
        </Field>
        <Field label="Bill date">
          <input class="input" type="date" value={issuedOn} onInput={(e) => setIssuedOn((e.target as HTMLInputElement).value || today())} />
        </Field>
        <Field label="Due date" hint={dueOn ? 'Set by hand' : `From ${vendor?.terms ?? 'terms'}`}>
          <input class="input" type="date" value={due} min={issuedOn} onInput={(e) => setDueOn((e.target as HTMLInputElement).value || undefined)} />
        </Field>
        <Field label="Category">
          <select class="select" value={cat} onChange={(e) => setCategory((e.target as HTMLSelectElement).value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Memo" optional class="span-2">
          <input class="input" value={memo} onInput={(e) => setMemo((e.target as HTMLInputElement).value)} placeholder="What it’s for" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function ScheduleDialog({ bill, vendor, onClose }: { bill: Bill; vendor: string; onClose: () => void }) {
  const [date, setDate] = useState(bill.dueOn < today() ? today() : bill.dueOn);
  return (
    <Dialog
      title="Schedule a payment"
      class="acct-dialog"
      description={`${vendor} · ${money(bill.amount)} · bill ${bill.number}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="calendar"
            onClick={() => {
              scheduleBill(bill.id, date);
              toast(`Payment to ${vendor} scheduled for ${shortDate(date)}`);
              onClose();
            }}
          >
            Schedule
          </Button>
        </>
      }
    >
      <Field label="Pay on" hint={`Due ${shortDate(bill.dueOn)} · paid by ACH from Operating checking`}>
        <input class="input" type="date" value={date} min={today()} data-autofocus onInput={(e) => setDate((e.target as HTMLInputElement).value || today())} />
      </Field>
    </Dialog>
  );
}

export function BillsTab() {
  const d = db.value;
  const t = today();
  const filter = (param('filter') as BillFilter | undefined) ?? 'unpaid';
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'new' } | { kind: 'schedule'; bill: Bill } | null>(null);

  const rows: Row[] = useMemo(
    () =>
      d.bills.map((bill) => ({ bill, state: billState(bill, t), vendor: d.vendors.find((v) => v.id === bill.vendorId)?.name ?? 'Vendor' })),
    [d.bills, d.vendors, t],
  );
  const term = q.trim().toLowerCase();
  const visible = rows.filter((r) => inFilter(r.state, filter) && (!term || r.vendor.toLowerCase().includes(term) || r.bill.number.toLowerCase().includes(term) || (r.bill.memo ?? '').toLowerCase().includes(term)));
  const count = (f: BillFilter) => rows.filter((r) => inFilter(r.state, f)).length;

  const dueSoon = sum(rows.filter((r) => r.state !== 'paid' && r.bill.dueOn <= addDays(t, 14)).map((r) => r.bill.amount));
  const overdue = sum(rows.filter((r) => r.state === 'overdue').map((r) => r.bill.amount));
  const scheduled = sum(rows.filter((r) => r.state === 'scheduled').map((r) => r.bill.amount));
  const paidThisMonth = sum(rows.filter((r) => r.state === 'paid' && (r.bill.paidOn ?? '') >= startOfMonth(t)).map((r) => r.bill.amount));

  const pay = (r: Row) => {
    payBill(r.bill.id);
    toast(`Paid ${money(r.bill.amount)} to ${r.vendor} from Operating checking (simulated)`, { tone: 'success' });
  };

  const columns: Column<Row>[] = [
    {
      key: 'vendor',
      label: 'Vendor',
      sortValue: (r) => r.vendor,
      render: (r) => (
        <>
          <span class="cell-main">{r.vendor}</span>
          <span class="cell-sub">{r.bill.memo ?? r.bill.category}</span>
        </>
      ),
    },
    { key: 'number', label: 'Bill #', hide: 'sm', sortValue: (r) => r.bill.number, render: (r) => <span class="tabular nowrap">{r.bill.number}</span> },
    { key: 'category', label: 'Category', hide: 'md', sortValue: (r) => r.bill.category, render: (r) => <span class="nowrap">{r.bill.category}</span> },
    { key: 'issued', label: 'Bill date', hide: 'md', sortValue: (r) => r.bill.issuedOn, render: (r) => <span class="nowrap">{shortDate(r.bill.issuedOn)}</span> },
    {
      key: 'due',
      label: 'Due',
      sortValue: (r) => r.bill.dueOn,
      render: (r) => (
        <>
          <span class="nowrap">{shortDate(r.bill.dueOn)}</span>
          <span class={`cell-sub nowrap${r.state === 'overdue' ? ' is-bad' : ''}`}>
            {r.state === 'paid' ? `Paid ${shortDate(r.bill.paidOn ?? r.bill.dueOn)}` : r.state === 'scheduled' ? `Paying ${shortDate(r.bill.scheduledOn ?? r.bill.dueOn)}` : r.state === 'overdue' ? `${plural(diffDays(t, r.bill.dueOn), 'day')} late` : `due ${fromToday(r.bill.dueOn)}`}
          </span>
        </>
      ),
    },
    { key: 'amount', label: 'Amount', align: 'right', sortValue: (r) => r.bill.amount, render: (r) => money(r.bill.amount) },
    {
      key: 'status',
      label: 'Status',
      sortValue: (r) => ['overdue', 'open', 'scheduled', 'paid'].indexOf(r.state),
      render: (r) => (
        <Badge tone={stateMeta[r.state].tone} icon={stateMeta[r.state].icon}>
          {stateMeta[r.state].label}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: <span class="sr-only">Actions</span>,
      align: 'right',
      render: (r) =>
        r.state === 'paid' ? (
          r.bill.poId ? (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/office/inventory/?tab=orders&po=${r.bill.poId}`)}>
              {r.bill.poId}
            </Button>
          ) : null
        ) : (
          <span class="row-actions">
            <Button size="sm" onClick={() => pay(r)} aria-label={`Pay ${money(r.bill.amount)} to ${r.vendor}`}>
              Pay now
            </Button>
            <Menu
              label={`More actions for ${r.vendor} bill ${r.bill.number}`}
              size="sm"
              items={[
                { label: r.state === 'scheduled' ? 'Change payment date' : 'Schedule payment…', icon: 'calendar', onSelect: () => setDialog({ kind: 'schedule', bill: r.bill }) },
                ...(r.bill.poId ? [{ label: `View ${r.bill.poId}`, icon: 'box' as const, onSelect: () => navigate(`/office/inventory/?tab=orders&po=${r.bill.poId}`) }] : []),
              ]}
            />
          </span>
        ),
    },
  ];

  return (
    <>
      <div class="acct-summary">
        <div>
          <span class="acct-summary__label">Due in the next 14 days</span>
          <span class="acct-summary__value">{money(dueSoon, false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Overdue</span>
          <span class={`acct-summary__value${overdue ? ' is-bad' : ''}`}>{money(overdue, false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Scheduled</span>
          <span class="acct-summary__value">{money(scheduled, false)}</span>
        </div>
        <div>
          <span class="acct-summary__label">Paid this month</span>
          <span class="acct-summary__value">{money(paidThisMonth, false)}</span>
        </div>
      </div>

      <div class="toolbar">
        <Chips
          label="Filter bills"
          value={filter}
          onChange={(k) => setParams({ filter: k === 'unpaid' ? undefined : k }, { replace: true })}
          items={[
            { key: 'unpaid', label: 'To pay', count: count('unpaid') },
            { key: 'overdue', label: 'Overdue', count: count('overdue') },
            { key: 'scheduled', label: 'Scheduled', count: count('scheduled') },
            { key: 'paid', label: 'Paid', count: count('paid') },
            { key: 'all', label: 'All', count: count('all') },
          ]}
        />
        <span class="toolbar__spacer" />
        <SearchInput value={q} onInput={setQ} label="Search bills" placeholder="Vendor, bill # or memo" />
        <Button variant="primary" icon="plus" onClick={() => setDialog({ kind: 'new' })}>
          Add bill
        </Button>
      </div>

      <Card flush>
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(r) => r.bill.id}
          caption="Bills"
          initialSort={{ key: 'due', dir: filter === 'paid' ? 'desc' : 'asc' }}
          empty={<EmptyState icon="receipt" title={q ? `No bills match “${q}”` : filter === 'overdue' ? 'Nothing overdue' : 'No bills here'} />}
        />
      </Card>
      <p class="acct-footnote">Sample vendors and amounts. Bills for stock arrive with purchase orders received in Inventory.</p>

      {dialog?.kind === 'new' && <NewBillDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'schedule' && <ScheduleDialog bill={dialog.bill} vendor={d.vendors.find((v) => v.id === dialog.bill.vendorId)?.name ?? 'Vendor'} onClose={() => setDialog(null)} />}
    </>
  );
}
