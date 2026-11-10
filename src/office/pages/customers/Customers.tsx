/** Customers & lifts: the list, and each customer's record (?id=C-…, &lift=LF-… to open one lift). */
import { useMemo, useState } from 'preact/hooks';
import { arms } from '../../data/people';
import type { Customer } from '../../data/types';
import { openDialog } from '../../dialogs';
import { money, phone, plural, shortDate } from '../../lib/format';
import { navigate, param, setParams } from '../../router';
import { db } from '../../store';
import { Button, Checkbox, Chips, EmptyState, Link, PageHeader, SearchInput, Stat } from '../../ui/core';
import { DataTable, type Column } from '../../ui/Table';
import { CustomerDetail } from './CustomerDetail';
import { customerSummaries, kindLabels, kindPlural, needsRegistration, whereText } from './helpers';
import { TagList } from './parts';

export default function Customers() {
  const id = param('id');
  if (id) return <CustomerDetail key={id} id={id} />;
  return <CustomerList key={param('filter') ?? 'all'} />;
}

type KindFilter = 'all' | Customer['kind'];

function CustomerList() {
  const d = db.value;
  const initial = param('filter');
  const [q, setQ] = useState(param('q') ?? '');
  const [kind, setKind] = useState<KindFilter>(initial === 'owner' || initial === 'marina' || initial === 'dealer' ? initial : 'all');
  const [arm, setArm] = useState('');
  const [balanceOnly, setBalanceOnly] = useState(initial === 'balance');
  const [unregisteredOnly, setUnregisteredOnly] = useState(initial === 'unregistered');
  const [remoteOnly, setRemoteOnly] = useState(false);

  const summaries = useMemo(() => customerSummaries(d), [d]);
  const all = useMemo(() => d.customers.filter((c) => !c.tags.includes('Counter sales')), [d.customers]);
  const liftsBySerial = useMemo(() => new Map(d.lifts.map((l) => [l.serial.toLowerCase(), l.customerId])), [d.lifts]);

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const serialMatch = term.length >= 4 ? liftsBySerial.get(term) : undefined;
  const rows = useMemo(
    () =>
      all.filter((c) => {
        if (kind !== 'all' && c.kind !== kind) return false;
        if (arm && c.lake?.arm !== arm) return false;
        const s = summaries.get(c.id);
        if (balanceOnly && !(s && s.open > 0.004)) return false;
        if (unregisteredOnly && !(s && s.unregistered > 0)) return false;
        if (remoteOnly && !s?.lifts.some((l) => l.remote)) return false;
        if (term) {
          if (serialMatch) return c.id === serialMatch;
          const lake = c.lake ? `${c.lake.arm} mm ${c.lake.mm ?? ''} ${c.lake.cove ?? ''}` : '';
          const hay = `${c.name} ${c.contact ?? ''} ${c.email} ${c.address.street} ${c.address.city} ${c.address.zip} ${lake} ${c.id}`.toLowerCase();
          if (!hay.includes(term) && !(digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))) return false;
        }
        return true;
      }),
    [all, kind, arm, balanceOnly, unregisteredOnly, remoteOnly, term, digits, serialMatch, summaries],
  );

  const stats = useMemo(() => {
    let lifts = 0;
    let fs = 0;
    let unregistered = 0;
    let open = 0;
    let overdue = 0;
    for (const c of all) {
      const s = summaries.get(c.id);
      if (!s) continue;
      lifts += s.lifts.length;
      fs += s.lifts.filter((l) => l.installedBy === 'FiberSteel').length;
      unregistered += s.lifts.filter(needsRegistration).length;
      open += s.open;
      overdue += s.overdue;
    }
    return { lifts, fs, unregistered, open, overdue };
  }, [all, summaries]);

  const counts = useMemo(() => {
    const m: Record<KindFilter, number> = { all: all.length, owner: 0, marina: 0, dealer: 0 };
    for (const c of all) m[c.kind]++;
    return m;
  }, [all]);

  const filtered = !!(term || kind !== 'all' || arm || balanceOnly || unregisteredOnly || remoteOnly);
  const clear = () => {
    setQ('');
    setKind('all');
    setArm('');
    setBalanceOnly(false);
    setUnregisteredOnly(false);
    setRemoteOnly(false);
    if (initial) setParams({ filter: undefined }, { replace: true });
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      label: 'Customer',
      sortValue: (c) => c.name.toLowerCase(),
      render: (c) => (
        <>
          <Link to={`/office/customers/?id=${c.id}`} class="cell-main">
            {c.name}
          </Link>
          <span class="cell-sub">
            {c.kind !== 'owner' ? `${kindLabels[c.kind]}${c.contact ? ` · ${c.contact}` : ''}` : c.address.city || '—'}
          </span>
        </>
      ),
    },
    {
      key: 'where',
      label: 'Where',
      sortValue: (c) => (c.lake ? `${c.lake.arm} ${String(c.lake.mm ?? 0).padStart(5, '0')}` : `~${c.address.city}`),
      render: (c) => (c.lake ? <span>{whereText(c)}</span> : <span class="muted">{c.address.city ? `${c.address.city}, ${c.address.state}` : '—'}</span>),
      hide: 'sm',
    },
    { key: 'phone', label: 'Phone', render: (c) => <span class="tabular nowrap">{c.phone ? phone(c.phone) : '—'}</span>, hide: 'md' },
    {
      key: 'lifts',
      label: 'Lifts',
      sortValue: (c) => summaries.get(c.id)?.lifts.length ?? 0,
      render: (c) => {
        const s = summaries.get(c.id);
        if (!s?.lifts.length) return <span class="muted">—</span>;
        const first = [...s.lifts].sort((a, b) => (a.installedOn < b.installedOn ? 1 : -1))[0];
        return (
          <>
            <span class="cell-main cell-main--plain">{s.lifts.length > 1 ? plural(s.lifts.length, 'lift') : first.model}</span>
            <span class="cell-sub">
              {s.lifts.length > 1 ? `Newest: ${first.model}` : `Serial ${first.serial}`}
              {s.unregistered > 0 && <span class="is-warn"> · {s.unregistered === 1 && s.lifts.length === 1 ? 'not registered' : `${s.unregistered} not registered`}</span>}
            </span>
          </>
        );
      },
    },
    {
      key: 'service',
      label: 'Last service',
      sortValue: (c) => summaries.get(c.id)?.lastService ?? '',
      render: (c) => {
        const s = summaries.get(c.id)?.lastService;
        return s ? <span class="nowrap">{shortDate(s, true)}</span> : <span class="muted">—</span>;
      },
      hide: 'md',
    },
    {
      key: 'balance',
      label: 'Open balance',
      align: 'right',
      sortValue: (c) => summaries.get(c.id)?.open ?? 0,
      render: (c) => {
        const s = summaries.get(c.id);
        if (!s || s.open <= 0.004) return <span class="muted">—</span>;
        return (
          <>
            <span class="tabular">{money(s.open)}</span>
            {s.overdue > 0.004 && <span class="cell-sub is-bad">{money(s.overdue, false)} overdue</span>}
          </>
        );
      },
    },
    { key: 'tags', label: 'Tags', render: (c) => <TagList tags={c.tags} max={2} />, hide: 'md' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Customers & lifts"
        description="Lake owners, marinas and dealers — with every lift at their dock, its warranty, visits, invoices and conversations in one record."
        actions={
          <>
            <Button icon="lift" onClick={() => openDialog({ kind: 'lift' })}>
              Add a lift
            </Button>
            <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'customer' })}>
              New customer
            </Button>
          </>
        }
      />

      <div class="stats cust-stats">
        <Stat label="Customers" icon="users" value={all.length.toLocaleString()} hint={`${counts.owner.toLocaleString()} owners · ${counts.marina} marinas · ${counts.dealer} dealers`} />
        <Stat label="Lifts on record" icon="lift" value={stats.lifts.toLocaleString()} hint={`${stats.fs.toLocaleString()} installed by FiberSteel`} />
        <Stat
          label="Warranty not registered"
          icon="alert"
          value={stats.unregistered.toLocaleString()}
          hint={stats.unregistered ? 'FiberSteel installs, original owners' : 'All registered'}
          to="/office/customers/?filter=unregistered"
        />
        <Stat label="Open balances" icon="receipt" value={money(stats.open, false)} hint={<span class={stats.overdue > 0 ? 'is-bad' : undefined}>{money(stats.overdue, false)} overdue</span>} to="/office/customers/?filter=balance" />
      </div>

      <section class="card card--flush" aria-label="Customer list">
        <div class="cust-toolbar">
          <SearchInput value={q} onInput={setQ} label="Search customers" placeholder="Name, phone, email, cove or serial" class="cust-toolbar__search" />
          <Chips<KindFilter>
            label="Customer type"
            value={kind}
            onChange={setKind}
            items={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'owner', label: kindPlural.owner, count: counts.owner },
              { key: 'marina', label: kindPlural.marina, count: counts.marina },
              { key: 'dealer', label: kindPlural.dealer, count: counts.dealer },
            ]}
          />
          <label class="cust-toolbar__tag">
            <span class="sr-only">Lake arm</span>
            <select class="select select--sm" value={arm} onChange={(e) => setArm((e.target as HTMLSelectElement).value)}>
              <option value="">Any arm of the lake</option>
              {arms.map((a) => (
                <option key={a.arm}>{a.arm}</option>
              ))}
            </select>
          </label>
          <div class="cust-toolbar__checks">
            <Checkbox checked={balanceOnly} onChange={setBalanceOnly}>
              Open balance
            </Checkbox>
            <Checkbox checked={unregisteredOnly} onChange={setUnregisteredOnly}>
              Warranty not registered
            </Checkbox>
            <Checkbox checked={remoteOnly} onChange={setRemoteOnly}>
              Has a remote
            </Checkbox>
          </div>
        </div>
        <p class="cust-count" aria-live="polite">
          {serialMatch ? `Serial ${q.trim().toUpperCase()} — ` : ''}
          {plural(rows.length, 'customer')}
          {filtered && (
            <>
              {' '}
              ·{' '}
              <button type="button" class="link-btn" onClick={clear}>
                Clear filters
              </button>
            </>
          )}
        </p>
        <DataTable<Customer>
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          caption="Customers"
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={(c) => navigate(`/office/customers/?id=${c.id}${serialMatch ? `&lift=${d.lifts.find((l) => l.serial.toLowerCase() === term)?.id ?? ''}` : ''}`)}
          empty={
            <EmptyState
              icon="users"
              title="No customers match"
              action={
                <Button size="sm" onClick={clear}>
                  Clear filters
                </Button>
              }
            >
              Try a different name, phone number, cove or serial number.
            </EmptyState>
          }
        />
      </section>
      <p class="cust-footnote">Sample data: every customer is fictional (555-01xx phone numbers, example.com emails), and so are the lifts, serial numbers and balances.</p>
    </>
  );
}
