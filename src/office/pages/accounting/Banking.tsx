/** Banking: account balances, the transaction feed to review and categorize, and reconciliation. */
import { useState } from 'preact/hooks';
import { categorizeTxn } from '../../actions';
import type { BankAccount, BankTxn } from '../../data/types';
import { today } from '../../lib/dates';
import { money, plural, shortDate } from '../../lib/format';
import { param, setParams } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, Chips, EmptyState, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { reconcileAccount, sum, TXN_CATEGORIES } from './helpers';

const round2 = (n: number) => Math.round(n * 100) / 100;
const kindLabel: Record<BankAccount['kind'], string> = { checking: 'Checking', savings: 'Savings', credit: 'Credit card' };

function ReconcileDialog({ account, onClose }: { account: BankAccount; onClose: () => void }) {
  const d = db.value;
  const pending = d.txns.filter((t) => t.accountId === account.id && !t.reviewed);
  const cleared = round2(account.balance - sum(pending.map((t) => t.amount)));
  const [through, setThrough] = useState(today());
  const [statement, setStatement] = useState(cleared.toFixed(2));
  const diff = round2((parseFloat(statement) || 0) - cleared);
  const balanced = Math.abs(diff) < 0.005;

  return (
    <Dialog
      title={`Reconcile ${account.name}`}
      class="acct-dialog"
      description={`••${account.mask} · compare FiberSteel mode with the bank statement`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!balanced}
            onClick={() => {
              reconcileAccount(account.id, through);
              toast(`${account.name} reconciled through ${shortDate(through)} (simulated)`, { tone: 'success' });
              onClose();
            }}
          >
            Finish reconciliation
          </Button>
        </>
      }
    >
      <div class="stack">
        <div class="form-grid">
          <Field label="Statement end date">
            <input class="input" type="date" value={through} max={today()} onInput={(e) => setThrough((e.target as HTMLInputElement).value || today())} />
          </Field>
          <Field label="Statement ending balance">
            <span class="money-input">
              <span aria-hidden="true">$</span>
              <input class="input" type="number" step="0.01" inputMode="decimal" value={statement} data-autofocus onInput={(e) => setStatement((e.target as HTMLInputElement).value)} />
            </span>
          </Field>
        </div>
        <dl class="pay-summary">
          <div>
            <dt>Balance in FiberSteel mode</dt>
            <dd class="tabular">{money(account.balance)}</dd>
          </div>
          <div>
            <dt>Waiting for review ({pending.length})</dt>
            <dd class="tabular">{money(sum(pending.map((t) => t.amount)))}</dd>
          </div>
          <div>
            <dt>Cleared balance</dt>
            <dd class="tabular">{money(cleared)}</dd>
          </div>
          <div class={`pay-summary__balance${balanced ? '' : ' is-bad'}`}>
            <dt>Difference</dt>
            <dd class="tabular">{money(diff)}</dd>
          </div>
        </dl>
        <p class={`callout ${balanced ? 'callout--green' : 'callout--amber'}`}>
          <Icon name={balanced ? 'check-circle' : 'alert'} size={18} />
          <span class="callout__text">
            {balanced
              ? 'Everything matches. Finishing marks the transactions through that date as reconciled.'
              : 'The difference has to be $0.00 to finish. Look for a missing deposit or a transaction that posted twice.'}
          </span>
        </p>
      </div>
    </Dialog>
  );
}

function matchLabel(t: BankTxn) {
  switch (t.match?.kind) {
    case 'invoice':
      return `Matched to ${t.match.id}`;
    case 'bill':
      return 'Matched to a bill';
    case 'payroll':
      return 'Payroll run';
    case 'transfer':
      return 'Transfer between accounts';
    case 'deposit':
      return 'Customer payments';
    default:
      return undefined;
  }
}

export function BankingTab() {
  const d = db.value;
  const accountId = param('account') ?? d.accounts[0]?.id;
  const account = d.accounts.find((a) => a.id === accountId) ?? d.accounts[0];
  const [view, setView] = useState<'all' | 'review'>('all');
  const [reconcile, setReconcile] = useState(false);

  const txns = d.txns.filter((t) => t.accountId === account.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const toReview = txns.filter((t) => !t.reviewed);
  const visible = view === 'review' ? toReview : txns;
  const total = d.accounts.filter((a) => a.kind !== 'credit').reduce((s, a) => s + a.balance, 0);

  const columns: Column<BankTxn>[] = [
    { key: 'date', label: 'Date', sortValue: (t) => t.date, render: (t) => <span class="nowrap">{shortDate(t.date)}</span> },
    {
      key: 'desc',
      label: 'Description',
      sortValue: (t) => t.description,
      render: (t) => (
        <>
          <span class="cell-main">{t.description}</span>
          {matchLabel(t) && (
            <span class="cell-sub txn-match">
              <Icon name="link" size={12} />
              {matchLabel(t)}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortValue: (t) => t.category ?? '',
      render: (t) =>
        t.reviewed ? (
          <span>{t.category ?? 'Uncategorized'}</span>
        ) : (
          <select
            class="select select--sm txn-cat"
            value={t.category ?? ''}
            aria-label={`Category for ${t.description} on ${shortDate(t.date)}`}
            onChange={(e) => {
              const value = (e.target as HTMLSelectElement).value;
              if (!value) return;
              categorizeTxn(t.id, value);
              toast(`Categorized as ${value}`);
            }}
          >
            <option value="">Choose a category…</option>
            {TXN_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortValue: (t) => t.amount,
      render: (t) => <span class={`tabular${t.amount > 0 ? ' txn-in' : ''}`}>{t.amount > 0 ? `+${money(t.amount)}` : `−${money(-t.amount)}`}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (t) => (t.reviewed ? 1 : 0),
      render: (t) =>
        t.reviewed ? (
          <Badge tone="green" icon="check">
            Reviewed
          </Badge>
        ) : (
          <span class="row-actions">
            <Badge tone="amber" icon="eye">
              To review
            </Badge>
            {t.category && (
              <Button size="sm" variant="ghost" onClick={() => categorizeTxn(t.id, t.category!)}>
                Mark reviewed
              </Button>
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <ul class="bank-cards" role="list" aria-label="Bank and card accounts">
        {d.accounts.map((a) => {
          const pending = d.txns.filter((t) => t.accountId === a.id && !t.reviewed).length;
          return (
            <li key={a.id}>
              <button type="button" class="bank-card" aria-pressed={a.id === account.id} onClick={() => setParams({ account: a.id }, { replace: true })}>
                <span class="bank-card__top">
                  <Icon name={a.kind === 'credit' ? 'card' : 'bank'} size={18} />
                  <span class="bank-card__kind">{kindLabel[a.kind]}</span>
                  <span class="bank-card__mask">••{a.mask}</span>
                </span>
                <span class="bank-card__name">{a.name}</span>
                <span class="bank-card__balance tabular">{a.kind === 'credit' ? money(-a.balance) : money(a.balance)}</span>
                <span class="bank-card__sub">{a.kind === 'credit' ? 'Balance owed' : 'Current balance'}</span>
                {pending > 0 && <span class="bank-card__pending">{plural(pending, 'transaction')} to review</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p class="acct-footnote">
        Cash on hand across checking and savings: <strong>{money(total)}</strong>. Bank feeds are connected in this demo — in the live version transactions arrive on their own each morning.
      </p>

      <Card
        title={`${account.name} ••${account.mask}`}
        subtitle={toReview.length ? `${plural(toReview.length, 'transaction')} waiting for review` : 'Everything is reviewed'}
        actions={
          <>
            <Chips
              label="Show transactions"
              value={view}
              onChange={setView}
              items={[
                { key: 'all', label: 'All', count: txns.length },
                { key: 'review', label: 'To review', count: toReview.length },
              ]}
            />
            <Button icon="check-circle" onClick={() => setReconcile(true)}>
              Reconcile
            </Button>
          </>
        }
        flush
        class="bank-txns"
      >
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(t) => t.id}
          caption={`${account.name} transactions`}
          initialSort={{ key: 'date', dir: 'desc' }}
          pageSize={20}
          empty={<EmptyState icon="check-circle" title={view === 'review' ? 'Nothing left to review' : 'No transactions yet'} />}
        />
      </Card>

      {reconcile && <ReconcileDialog account={account} onClose={() => setReconcile(false)} />}
    </>
  );
}
