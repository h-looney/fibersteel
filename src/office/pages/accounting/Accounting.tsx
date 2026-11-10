/**
 * Accounting: invoices, quotes (estimates in the data), bills, banking and reports — with the books kept here or
 * synced to QuickBooks Online. Every number is sample data.
 *   /office/accounting/?tab=overview|invoices|estimates|bills|banking|reports|integrations
 *   &id=INV-…|EST-… opens a document; &filter=… narrows a list
 */
import { syncQuickBooks } from '../../actions';
import { today } from '../../lib/dates';
import { relative } from '../../lib/format';
import { openDialog } from '../../dialogs';
import { param, setParams } from '../../router';
import { invoiceStatus } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, PageHeader, TabPanel, Tabs } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { BankingTab } from './Banking';
import { BillsTab } from './Bills';
import { DocumentDrawer, EstimatesTab, InvoicesTab } from './Documents';
import { billState } from './helpers';
import { IntegrationsTab } from './Integrations';
import { Overview } from './Overview';
import { ReportsTab } from './Reports';

/** Small count pill on a tab, with the meaning spelled out for screen readers */
const flag = (n: number, what: string) =>
  n > 0 ? (
    <>
      <span class="tabs__count" aria-hidden="true">
        {n}
      </span>
      <span class="sr-only">
        , {n} {what}
      </span>
    </>
  ) : null;

type TabKey = 'overview' | 'invoices' | 'estimates' | 'bills' | 'banking' | 'reports' | 'integrations';
const TAB_KEYS: TabKey[] = ['overview', 'invoices', 'estimates', 'bills', 'banking', 'reports', 'integrations'];

function BooksBanner({ onIntegrations }: { onIntegrations: () => void }) {
  const books = db.value.books;
  if (books.connected) {
    return (
      <div class="books-banner books-banner--synced">
        <span class="books-banner__icon">
          <Icon name="refresh" size={18} />
        </span>
        <p class="books-banner__text">
          <strong>Synced with QuickBooks Online</strong>
          <span>
            {books.company} · last sync {books.lastSyncAt ? relative(books.lastSyncAt) : 'never'}
            {books.autoSync ? ' · automatic' : ' · manual'}
          </span>
        </p>
        <div class="books-banner__actions">
          <Button
            size="sm"
            icon="refresh"
            onClick={() => {
              syncQuickBooks();
              toast('Sync finished — QuickBooks is up to date (simulated)', { tone: 'success' });
            }}
          >
            Sync now
          </Button>
          <Button size="sm" variant="ghost" onClick={onIntegrations}>
            Sync settings
          </Button>
        </div>
      </div>
    );
  }
  const chosen = books.mode === 'quickbooks';
  return (
    <div class="books-banner">
      <span class="books-banner__icon">
        <Icon name={chosen ? 'link' : 'bank'} size={18} />
      </span>
      <p class="books-banner__text">
        <strong>{chosen ? 'QuickBooks chosen — not connected yet' : 'Books are kept in FiberSteel mode'}</strong>
        <span>{chosen ? 'Connect to start sending invoices and payments to QuickBooks.' : 'Invoices, bills, banking and reports all live here. Already on QuickBooks? Connect it instead.'}</span>
      </p>
      <div class="books-banner__actions">
        <Button size="sm" icon="link" onClick={onIntegrations}>
          {chosen ? 'Connect QuickBooks' : 'In-house or QuickBooks?'}
        </Button>
      </div>
    </div>
  );
}

export default function Accounting() {
  const d = db.value;
  const t = today();
  const requested = param('tab') as TabKey | undefined;
  const tab: TabKey = requested && TAB_KEYS.includes(requested) ? requested : 'overview';
  const id = param('id');
  const doc = id ? d.invoices.find((i) => i.id === id) : undefined;

  const overdue = d.invoices.filter((i) => i.kind === 'invoice' && invoiceStatus(i, t) === 'overdue').length;
  const waiting = d.invoices.filter((i) => i.kind === 'estimate' && invoiceStatus(i, t) === 'sent').length;
  const billsLate = d.bills.filter((b) => billState(b, t) === 'overdue').length;
  const toReview = d.txns.filter((x) => !x.reviewed).length;

  const go = (k: TabKey) => setParams({ tab: k === 'overview' ? undefined : k, id: undefined, filter: undefined, account: undefined, period: undefined });

  return (
    <div class="accounting">
      <PageHeader
        eyebrow="Books"
        title="Accounting"
        description="Invoices, quotes, bills, banking and reports — kept right here or synced to QuickBooks. Every number is sample data."
        actions={
          <>
            <Button icon="file" onClick={() => openDialog({ kind: 'invoice', preset: { kind: 'estimate' } })}>
              New quote
            </Button>
            <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'invoice', preset: { kind: 'invoice' } })}>
              New invoice
            </Button>
          </>
        }
      />

      <BooksBanner onIntegrations={() => go('integrations')} />

      <Tabs<TabKey>
        label="Accounting sections"
        idBase="acct"
        value={tab}
        onChange={go}
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'invoices', label: <>Invoices{flag(overdue, 'overdue')}</> },
          { key: 'estimates', label: <>Quotes{flag(waiting, 'waiting on customers')}</> },
          { key: 'bills', label: <>Bills{flag(billsLate, 'overdue')}</> },
          { key: 'banking', label: <>Banking{flag(toReview, 'to review')}</> },
          { key: 'reports', label: 'Reports' },
          { key: 'integrations', label: 'Integrations' },
        ]}
      />
      <TabPanel idBase="acct" active={tab}>
        {tab === 'overview' && <Overview />}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'estimates' && <EstimatesTab />}
        {tab === 'bills' && <BillsTab />}
        {tab === 'banking' && <BankingTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'integrations' && <IntegrationsTab />}
      </TabPanel>

      {doc && <DocumentDrawer key={doc.id} doc={doc} onClose={() => setParams({ id: undefined })} />}
    </div>
  );
}
