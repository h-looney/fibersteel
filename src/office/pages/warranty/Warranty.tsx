/**
 * Warranty: FiberSteel's published warranty worked out for every lift — claims for replaced parts, registrations,
 * and a coverage check for any lift and part.
 *   /office/warranty/?tab=claims|registrations|coverage   (&id=WC-… opens a claim · &lift=LF-… checks a lift)
 */
import { useMemo, useState } from 'preact/hooks';
import { registerLift } from '../../actions';
import { cancellation, keyPoints, remoteWarranty, terms } from '../../../data/warranty';
import type { ClaimStatus, Component, Lift, WarrantyClaim } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addDays, today } from '../../lib/dates';
import { money, plural, relative, shortDate, telHref } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, liftOf, warrantyState, type WarrantyState } from '../../selectors';
import { can, db } from '../../store';
import { toast } from '../../toast';
import { Button, Card, Chips, Details, EmptyState, Link, PageHeader, SearchInput, Stat, TabPanel, Tabs } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { claimStatusMeta, leadStageMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { installedByText, needsRegistration, warrantyEligible, whereText } from '../customers/helpers';
import { ClaimDrawer } from './ClaimDrawer';
import { claimOrder, componentLabel, components, OPEN_CLAIMS, partCoverage } from './helpers';

type Tab = 'claims' | 'registrations' | 'coverage';
type ClaimFilter = 'open' | ClaimStatus | 'all';
const claimFilters: ClaimFilter[] = ['open', ...claimOrder, 'all'];
const stateOrder: Record<WarrantyState, number> = { expiring: 0, active: 1, 'lifetime-only': 2, 'not-eligible': 3 };

export default function Warranty() {
  const d = db.value;
  const t = today();
  const claimId = param('id');
  const requested = param('tab') as Tab | undefined;
  const tab: Tab = claimId ? 'claims' : requested === 'registrations' || requested === 'coverage' ? requested : param('lift') ? 'coverage' : 'claims';

  const eligible = useMemo(() => d.lifts.filter(warrantyEligible), [d.lifts]);
  const expiring = eligible.filter((l) => warrantyState(l) === 'expiring').length;
  const unregistered = eligible.filter((l) => !l.registered).length;
  const openClaims = d.claims.filter((c) => OPEN_CLAIMS.includes(c.status));
  const since = addDays(t, -90);
  const replaced90 = d.claims.filter((c) => c.status === 'replaced' && c.updatedOn >= since);
  const waiting = d.leads.filter((l) => l.kind === 'warranty' && l.stage !== 'closed' && l.stage !== 'lost' && l.stage !== 'won').length;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Warranty"
        description="FiberSteel’s published warranty, worked out for every lift: lifetime on the tanks and frame, 5 years on galvanized parts, 3 years on the blower controller, bushings and hose — the part only, for the original purchaser of a lift FiberSteel installed."
        actions={
          <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'claim' })}>
            New claim
          </Button>
        }
      />

      <div class="stats cust-stats">
        <Stat
          label="Lifts under the warranty"
          icon="shield"
          value={eligible.length.toLocaleString()}
          hint={expiring ? `${plural(expiring, 'lift')} with a 3- or 5-year term ending in 90 days` : 'FiberSteel installs, original owners'}
          to="/office/warranty/?tab=coverage"
        />
        <Stat
          label="Not registered"
          icon="alert"
          value={unregistered}
          hint={waiting ? `${plural(waiting, 'website registration')} waiting` : 'No website registrations waiting'}
          to="/office/warranty/?tab=registrations"
        />
        <Stat label="Open claims" icon="file" value={openClaims.length} hint={openClaims.length ? `${money(openClaims.reduce((s, c) => s + c.partCost, 0), false)} in parts, at cost` : 'Nothing waiting'} to="/office/warranty/" />
        <Stat label="Parts replaced" icon="wrench" value={replaced90.length} hint={`Last 90 days · ${money(replaced90.reduce((s, c) => s + c.partCost, 0), false)} at cost`} to="/office/warranty/?status=replaced" />
      </div>

      <Tabs<Tab>
        label="Warranty views"
        idBase="warranty"
        value={tab}
        onChange={(k) => setParams({ tab: k === 'claims' ? undefined : k, id: undefined, status: undefined, lift: undefined }, { replace: true })}
        items={[
          { key: 'claims', label: 'Claims', icon: 'file', count: openClaims.length },
          { key: 'registrations', label: 'Registrations', icon: 'shield', count: unregistered },
          { key: 'coverage', label: 'Coverage check', icon: 'search' },
        ]}
      />
      <TabPanel idBase="warranty" active={tab}>
        {tab === 'claims' && <Claims claims={d.claims} />}
        {tab === 'registrations' && <Registrations />}
        {tab === 'coverage' && <CoverageCheck />}
      </TabPanel>

      {claimId && <ClaimDrawer key={claimId} id={claimId} onClose={() => setParams({ id: undefined })} />}
    </>
  );
}

/* ---------- Claims ---------- */

function Claims({ claims }: { claims: WarrantyClaim[] }) {
  const d = db.value;
  const sp = param('status') as ClaimFilter | undefined;
  const filter: ClaimFilter = sp && claimFilters.includes(sp) ? sp : 'open';
  const [q, setQ] = useState('');

  const byStatus = useMemo(() => {
    const m = new Map<ClaimStatus, { count: number; amount: number }>();
    for (const c of claims) {
      const e = m.get(c.status) ?? { count: 0, amount: 0 };
      e.count++;
      e.amount += c.partCost;
      m.set(c.status, e);
    }
    return m;
  }, [claims]);

  const term = q.trim().toLowerCase();
  const rows = claims.filter((c) => {
    if (filter === 'open' && !OPEN_CLAIMS.includes(c.status)) return false;
    if (filter !== 'open' && filter !== 'all' && c.status !== filter) return false;
    if (term) {
      const l = liftOf(d, c.liftId);
      const hay = `${c.id} ${customerOf(d, c.customerId)?.name ?? ''} ${l?.model ?? ''} ${l?.serial ?? ''} ${c.part} ${c.component} ${c.issue} ${c.coveredBy}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const count = (s: ClaimStatus) => byStatus.get(s)?.count ?? 0;
  const openCost = OPEN_CLAIMS.reduce((s, st) => s + (byStatus.get(st)?.amount ?? 0), 0);

  const columns: Column<WarrantyClaim>[] = [
    {
      key: 'id',
      label: 'Claim',
      sortValue: (c) => c.id,
      render: (c) => (
        <>
          <button type="button" class="cell-main link-plain" onClick={() => setParams({ id: c.id })}>
            {c.id}
          </button>
          <span class="cell-sub nowrap">{c.jobId ? `From ${c.jobId}` : 'Started by hand'}</span>
        </>
      ),
    },
    {
      key: 'customer',
      label: 'Customer & lift',
      sortValue: (c) => customerOf(d, c.customerId)?.name ?? '',
      render: (c) => {
        const l = liftOf(d, c.liftId);
        return (
          <>
            <span class="cell-main cell-main--plain">{customerOf(d, c.customerId)?.name ?? '—'}</span>
            <span class="cell-sub">{l ? `${l.model} · ${l.serial}` : '—'}</span>
          </>
        );
      },
    },
    {
      key: 'part',
      label: 'Part',
      sortValue: (c) => c.component,
      render: (c) => (
        <>
          <span>{c.part}</span>
          <span class="cell-sub">
            {componentLabel[c.component]} · {c.issue}
          </span>
        </>
      ),
      hide: 'sm',
    },
    { key: 'by', label: 'Covered by', sortValue: (c) => c.coveredBy, render: (c) => c.coveredBy, hide: 'md' },
    { key: 'opened', label: 'Opened', sortValue: (c) => c.openedOn, render: (c) => <span class="nowrap">{shortDate(c.openedOn, true)}</span>, hide: 'md' },
    { key: 'status', label: 'Status', sortValue: (c) => claimOrder.indexOf(c.status), render: (c) => <StatusBadge meta={claimStatusMeta[c.status]} /> },
    {
      key: 'cost',
      label: 'Part cost',
      align: 'right',
      sortValue: (c) => c.partCost,
      render: (c) => (c.status === 'referred' || c.status === 'denied' ? <span class="muted">—</span> : <span class="tabular">{money(c.partCost)}</span>),
    },
  ];

  return (
    <div class="stack">
      <ul class="claim-summary" role="list" aria-label="Claims by status">
        {claimOrder.map((s) => (
          <li key={s}>
            <button type="button" class={`claim-summary__item${filter === s ? ' is-active' : ''}`} aria-pressed={filter === s} onClick={() => setParams({ status: s }, { replace: true })}>
              <StatusBadge meta={claimStatusMeta[s]} />
              <span class="claim-summary__count">{count(s)}</span>
              <span class="claim-summary__amount">{s === 'referred' || s === 'denied' ? '—' : `${money(byStatus.get(s)?.amount ?? 0, false)} in parts`}</span>
            </button>
          </li>
        ))}
      </ul>

      <section class="card card--flush" aria-label="Warranty claims">
        <div class="cust-toolbar">
          <Chips<ClaimFilter>
            label="Claim status"
            value={filter}
            onChange={(f) => setParams({ status: f === 'open' ? undefined : f }, { replace: true })}
            items={[
              { key: 'open', label: 'Open', count: OPEN_CLAIMS.reduce((n, s) => n + count(s), 0) },
              { key: 'replaced', label: 'Replaced', count: count('replaced') },
              { key: 'referred', label: 'Referred', count: count('referred') },
              { key: 'denied', label: 'Not covered', count: count('denied') },
              { key: 'all', label: 'All', count: claims.length },
            ]}
          />
          <SearchInput value={q} onInput={setQ} label="Search claims" placeholder="Claim, customer, serial or part" class="cust-toolbar__search" />
        </div>
        <p class="cust-count">
          {plural(rows.length, 'claim')} · {money(openCost, false)} in parts on open claims (at FiberSteel’s cost)
        </p>
        <DataTable<WarrantyClaim>
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          caption="Warranty claims"
          initialSort={{ key: 'opened', dir: 'desc' }}
          onRowClick={(c) => setParams({ id: c.id })}
          empty={
            <EmptyState
              icon="file"
              title="No claims here"
              action={
                <Button size="sm" icon="plus" onClick={() => openDialog({ kind: 'claim' })}>
                  New claim
                </Button>
              }
            >
              A claim opens when a warranty job is finished, or start one by hand.
            </EmptyState>
          }
        />
      </section>
    </div>
  );
}

/* ---------- Registrations ---------- */

function Registrations() {
  const d = db.value;
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const waiting = d.leads.filter((l) => l.kind === 'warranty' && l.stage !== 'closed' && l.stage !== 'lost' && l.stage !== 'won').sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  const term = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      d.lifts.filter((l) => {
        if (!needsRegistration(l)) return false;
        if (term) {
          const c = customerOf(d, l.customerId);
          const hay = `${c?.name ?? ''} ${l.model} ${l.serial} ${c ? whereText(c) : ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      }),
    [d, term],
  );
  const picked = rows.filter((l) => selected.has(l.id));

  const registerMany = () => {
    picked.forEach((l) => registerLift(l.id));
    toast(`${plural(picked.length, 'lift')} registered for the warranty`, { tone: 'success' });
    setSelected(new Set());
  };

  const columns: Column<Lift>[] = [
    {
      key: 'customer',
      label: 'Customer',
      sortValue: (l) => customerOf(d, l.customerId)?.name.toLowerCase() ?? '',
      render: (l) => {
        const c = customerOf(d, l.customerId);
        return (
          <>
            {c ? (
              <Link to={`/office/customers/?id=${c.id}&lift=${l.id}`} class="cell-main">
                {c.name}
              </Link>
            ) : (
              <span class="cell-main">Unknown</span>
            )}
            <span class="cell-sub">{c ? whereText(c) : ''}</span>
          </>
        );
      },
    },
    {
      key: 'lift',
      label: 'Lift',
      sortValue: (l) => l.capacity,
      render: (l) => (
        <>
          <span class="cell-main cell-main--plain">{l.model}</span>
          <span class="cell-sub">Serial {l.serial}</span>
        </>
      ),
    },
    { key: 'installed', label: 'Installed', sortValue: (l) => l.installedOn, render: (l) => <span class="nowrap">{shortDate(l.installedOn, true)}</span>, hide: 'sm' },
    { key: 'state', label: 'Coverage', sortValue: (l) => stateOrder[warrantyState(l)], render: (l) => <StatusBadge meta={warrantyMeta[warrantyState(l)]} />, hide: 'md' },
    {
      key: 'register',
      label: <span class="sr-only">Register</span>,
      render: (l) => (
        <Button
          size="sm"
          onClick={() => {
            registerLift(l.id);
            toast(`${l.model} (${l.serial}) registered`, { tone: 'success' });
          }}
        >
          Register
        </Button>
      ),
    },
  ];

  return (
    <div class="stack">
      <Card title="From the website" subtitle={waiting.length ? `${plural(waiting.length, 'registration')} waiting in the inbox` : 'Nothing waiting'} flush>
        {waiting.length === 0 ? (
          <EmptyState icon="shield" title="No website registrations waiting">
            Owners register on the public site’s Register your lift page; each one lands in the inbox for the team to match to a lift.
          </EmptyState>
        ) : (
          <ul class="rec-list" role="list">
            {waiting.map((l) => {
              const body = (
                <>
                  <span class="rec-list__icon rec-list__icon--green">
                    <Icon name="shield" size={15} />
                  </span>
                  <span class="rec-list__main">
                    <span class="rec-list__title">
                      {l.name} — {l.summary}
                    </span>
                    <span class="rec-list__sub">
                      {l.id} · received {relative(l.receivedAt)}
                      {l.fields.find(([k]) => k === 'Serial or order number')?.[1] ? ` · serial ${l.fields.find(([k]) => k === 'Serial or order number')![1]}` : ''}
                    </span>
                  </span>
                  <StatusBadge meta={leadStageMeta[l.stage]} />
                </>
              );
              return (
                <li key={l.id}>
                  {can('inbox') ? (
                    <Link to={`/office/inbox/?id=${l.id}`} class="rec-list__row">
                      {body}
                    </Link>
                  ) : (
                    <div class="rec-list__row">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section class="card card--flush" aria-label="Lifts not registered">
        <header class="card__head">
          <div>
            <h2 class="card__title">Lifts not registered</h2>
            <p class="card__sub">FiberSteel installs whose original owners haven’t registered yet — the warranty takes effect on proof of original ownership.</p>
          </div>
        </header>
        <div class="cust-toolbar">
          <SearchInput value={q} onInput={setQ} label="Search lifts not registered" placeholder="Customer, cove or serial" class="cust-toolbar__search" />
        </div>
        {selected.size > 0 && (
          <div class="bulk-bar" role="region" aria-label="Bulk actions">
            <span>
              <strong>{selected.size}</strong> selected
            </span>
            <Button size="sm" variant="primary" icon="shield" disabled={!picked.length} onClick={registerMany}>
              Register {picked.length}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
        <DataTable<Lift>
          rows={rows}
          columns={columns}
          rowKey={(l) => l.id}
          caption="Lifts not registered for the warranty"
          initialSort={{ key: 'installed', dir: 'desc' }}
          selected={selected}
          onSelect={setSelected}
          empty={
            <EmptyState icon="shield" title="Every lift is registered">
              Every FiberSteel install with its original owner is registered.
            </EmptyState>
          }
        />
      </section>
    </div>
  );
}

/* ---------- Coverage check ---------- */

function CoverageCheck() {
  const d = db.value;
  const liftId = param('lift');
  const lift = liftOf(d, liftId);
  const [q, setQ] = useState('');
  const [component, setComponent] = useState<Component>('Blower controller');
  const term = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (term.length < 2) return [];
    const digits = term.replace(/\D/g, '');
    const out: Lift[] = [];
    for (const l of d.lifts) {
      const c = customerOf(d, l.customerId);
      const hay = `${l.serial} ${l.model} ${c?.name ?? ''} ${c ? whereText(c) : ''}`.toLowerCase();
      if (hay.includes(term) || (digits.length >= 4 && c?.phone.replace(/\D/g, '').includes(digits))) out.push(l);
      if (out.length >= 8) break;
    }
    return out;
  }, [d, term]);

  return (
    <div class="coverage-check">
      <div class="coverage-check__main stack">
        <Card title="Check a lift">
          {lift ? (
            <LiftCoverage lift={lift} component={component} onComponent={setComponent} />
          ) : (
            <div class="stack">
              <SearchInput value={q} onInput={setQ} label="Find a lift" placeholder="Serial number, customer, phone or cove" />
              {term.length >= 2 && matches.length === 0 && <p class="muted">No lifts match.</p>}
              {matches.length > 0 && (
                <ul class="rec-list rec-list--boxed" role="list" aria-label="Matching lifts">
                  {matches.map((l) => {
                    const c = customerOf(d, l.customerId);
                    return (
                      <li key={l.id}>
                        <button type="button" class="rec-list__row rec-list__row--btn" onClick={() => setParams({ lift: l.id }, { replace: true })}>
                          <span class="rec-list__icon">
                            <Icon name="lift" size={15} />
                          </span>
                          <span class="rec-list__main">
                            <span class="rec-list__title">
                              {l.model} · {l.serial}
                            </span>
                            <span class="rec-list__sub">
                              {c?.name ?? '—'} · installed {shortDate(l.installedOn, true)}
                            </span>
                          </span>
                          <StatusBadge meta={warrantyMeta[warrantyState(l)]} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {term.length < 2 && <p class="muted small">Type a serial number or the owner’s name — or open a lift from a customer’s record.</p>}
            </div>
          )}
        </Card>
      </div>

      <aside class="coverage-check__side stack" aria-label="FiberSteel’s published warranty">
        <Card title="The published warranty" subtitle="From FiberSteel’s Warranty page">
          <ul class="terms-list" role="list">
            {keyPoints.map((p) => (
              <li key={p}>
                <Icon name="check" size={14} stroke={2.4} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <details class="terms-full">
            <summary>
              <Icon name="chevron-right" size={14} class="terms-full__chev" /> The full text
            </summary>
            {terms.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p>
              <strong>Cancellations:</strong> {cancellation}
            </p>
          </details>
        </Card>
        <Card title="Remote systems" subtitle="Handled by their makers, per the Warranty page">
          <ul class="terms-contacts" role="list">
            {remoteWarranty.map((r) => (
              <li key={r.system}>
                <strong>{r.system}</strong>
                <span class="muted small">{r.who}</span>
                <a href={telHref(r.phone)} class="tabular">
                  {r.phone}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function LiftCoverage({ lift, component, onComponent }: { lift: Lift; component: Component; onComponent: (c: Component) => void }) {
  const d = db.value;
  const c = customerOf(d, lift.customerId);
  const state = warrantyState(lift);
  const check = partCoverage(lift, component);
  return (
    <div class="stack">
      <div class="picked picked--wrap">
        <span class="picked__icon">
          <Icon name="lift" size={16} />
        </span>
        <span class="picked__text">
          <strong>
            {lift.model} · {lift.serial}
          </strong>
          <span class="muted small">
            {c ? <Link to={`/office/customers/?id=${c.id}&lift=${lift.id}`}>{c.name}</Link> : '—'} · installed {shortDate(lift.installedOn, true)} by {installedByText(lift, d.dealers)}
            {lift.originalOwner ? '' : ' · not the original purchaser'}
          </span>
        </span>
        <StatusBadge meta={warrantyMeta[state]} />
        <Button size="sm" variant="ghost" onClick={() => setParams({ lift: undefined }, { replace: true })}>
          Change
        </Button>
      </div>

      <div class="table-wrap">
        <table class="table coverage-table">
          <caption class="sr-only">Warranty coverage by part for {lift.model}, serial {lift.serial}</caption>
          <thead>
            <tr>
              <th scope="col">Part</th>
              <th scope="col" class="cov-term">
                Term
              </th>
              <th scope="col">Ends</th>
              <th scope="col">Today</th>
            </tr>
          </thead>
          <tbody>
            {components.map((comp) => {
              const p = partCoverage(lift, comp);
              return (
                <tr key={comp} class={comp === component ? 'is-current' : undefined}>
                  <th scope="row">
                    <button type="button" class="link-plain" aria-pressed={comp === component} onClick={() => onComponent(comp)}>
                      {componentLabel[comp]}
                    </button>
                  </th>
                  <td class="cov-term">{p.term}</td>
                  <td class="nowrap">{comp === 'Remote system' ? '—' : !warrantyEligible(lift) ? '—' : p.until ? shortDate(p.until, true) : 'Lifetime'}</td>
                  <td>
                    {p.covered ? (
                      <span class="cov-yes">
                        <Icon name="check-circle" size={15} /> <span class="cov-label">Covered</span>
                      </span>
                    ) : (
                      <span class="cov-no">
                        <Icon name="minus" size={15} /> <span class="cov-label">{comp === 'Remote system' ? 'Maker’s warranty' : 'Not covered'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div class={`cov-answer ${check.covered ? 'cov-answer--yes' : 'cov-answer--no'}`} role="status">
        <Icon name={check.covered ? 'check-circle' : 'info'} size={18} />
        <div>
          <p class="cov-answer__title">
            {componentLabel[component]}: {check.covered ? 'covered' : component === 'Remote system' ? 'the remote maker’s warranty' : 'not covered'}
          </p>
          <p>{check.note}</p>
        </div>
      </div>

      <Details
        columns={2}
        items={[
          ['Registered', lift.registered ? `Yes · ${lift.registrationNo}` : warrantyEligible(lift) ? 'Not yet' : 'Not applicable'],
          ['Remote', lift.remote ? `${lift.remote.brand} · ${lift.remote.valves}-valve` : 'None'],
          ['Claims on this lift', plural(d.claims.filter((x) => x.liftId === lift.id).length, 'claim')],
          ['Last serviced', lift.lastServiceOn ? shortDate(lift.lastServiceOn, true) : 'No visits on file'],
        ]}
      />
      <div class="row">
        {warrantyEligible(lift) && !lift.registered && (
          <Button
            size="sm"
            variant="primary"
            icon="shield"
            onClick={() => {
              registerLift(lift.id);
              toast(`${lift.model} (${lift.serial}) registered`, { tone: 'success' });
            }}
          >
            Register the warranty
          </Button>
        )}
        {warrantyEligible(lift) && (
          <Button size="sm" icon="file" onClick={() => openDialog({ kind: 'claim', liftId: lift.id })}>
            Start a claim
          </Button>
        )}
        {can('jobs') && c && (
          <Button size="sm" icon="calendar-plus" onClick={() => openDialog({ kind: 'job', preset: { type: check.covered ? 'warranty' : 'service', customerId: c.id, liftId: lift.id } })}>
            {check.covered ? 'Book a warranty visit' : 'Book service'}
          </Button>
        )}
      </div>
    </div>
  );
}
