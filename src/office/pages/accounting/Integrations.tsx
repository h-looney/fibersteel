/**
 * Where the books live: in-house in FiberSteel mode, or QuickBooks Online with FiberSteel mode syncing to it (simulated).
 * The connection is simulated — nothing leaves the browser.
 */
import { useEffect, useState } from 'preact/hooks';
import { connectQuickBooks, disconnectQuickBooks, setBooksMode, syncQuickBooks, updateBooks } from '../../actions';
import type { BooksState } from '../../data/types';
import { relative, shortDate } from '../../lib/format';
import { db, me } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, Switch } from '../../ui/core';
import { Confirm, Dialog } from '../../ui/Dialog';
import { Icon, type IconName } from '../../ui/Icon';
import { CHART_OF_ACCOUNTS } from './helpers';

const SYNC_ITEMS: { key: keyof BooksState['sync']; label: string; description: string }[] = [
  { key: 'customers', label: 'Customers', description: 'New and updated customers, with billing addresses' },
  { key: 'items', label: 'Products & services', description: 'The catalog, prices and inventory items' },
  { key: 'invoices', label: 'Invoices & quotes', description: 'Sent as soon as they’re issued' },
  { key: 'payments', label: 'Payments', description: 'Card, check, cash and ACH payments, applied to invoices' },
  { key: 'bills', label: 'Bills', description: 'Vendor bills and bill payments (optional)' },
];

const levelIcon: Record<BooksState['log'][number]['level'], { icon: IconName; label: string; cls: string }> = {
  ok: { icon: 'check-circle', label: 'Success', cls: 'is-ok' },
  warn: { icon: 'alert', label: 'Warning', cls: 'is-warn' },
  error: { icon: 'x-circle', label: 'Error', cls: 'is-error' },
};

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const d = db.value;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [company, setCompany] = useState('FiberSteel Boat Lifts, LLC');
  const [progress, setProgress] = useState(0);
  const user = me.value;

  useEffect(() => {
    if (step !== 3) return;
    const timers = [
      setTimeout(() => setProgress(1), 700),
      setTimeout(() => setProgress(2), 1500),
      setTimeout(() => setProgress(3), 2300),
      setTimeout(() => {
        connectQuickBooks(company);
        setStep(4);
      }, 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const tasks = ['Connecting to QuickBooks Online', `Matching ${d.customers.length.toLocaleString()} customers and ${d.items.length} products`, 'Sending recent invoices and payments'];
  const footer =
    step === 1 ? (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => setStep(2)}>
          Continue
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button onClick={() => setStep(1)}>Back</Button>
        <Button variant="primary" icon="link" onClick={() => setStep(3)}>
          Connect
        </Button>
      </>
    ) : step === 4 ? (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    ) : (
      <Button onClick={onClose}>Cancel</Button>
    );

  return (
    <Dialog class="acct-dialog" title="Connect QuickBooks Online" description={step < 4 ? `Step ${Math.min(step, 3)} of 3 · simulated in this demo` : 'All set'} onClose={onClose} size="md" footer={footer}>
      {step === 1 && (
        <div class="stack">
          <p>In the live version this step opens Intuit’s secure sign-in window. FiberSteel mode never sees your QuickBooks password.</p>
          <p class="connect-signed">
            <Icon name="user" size={16} /> Signed in as <strong>{user?.name ?? 'you'}</strong>
          </p>
          <fieldset class="connect-companies">
            <legend class="field__label">Choose the company to connect</legend>
            {['FiberSteel Boat Lifts, LLC', 'FiberSteel Boat Lifts, LLC (sandbox)'].map((c) => (
              <label key={c} class="connect-company">
                <input type="radio" name="qb-company" checked={company === c} onChange={() => setCompany(c)} />
                <span>
                  <strong>{c}</strong>
                  <span class="muted small">{c.includes('sandbox') ? 'Test company — safe for trying things out' : 'QuickBooks Online Plus · 2 locations'}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {step === 2 && (
        <div class="stack">
          <p>
            FiberSteel mode is asking to connect to <strong>{company}</strong>. It will be able to:
          </p>
          <ul class="connect-perms" role="list">
            <li>
              <Icon name="check" size={16} /> Read and update customers, products and services
            </li>
            <li>
              <Icon name="check" size={16} /> Create invoices, quotes and payments
            </li>
            <li>
              <Icon name="check" size={16} /> Create vendor bills and bill payments{d.books.sync.bills ? '' : ' (off until you turn it on)'}
            </li>
            <li>
              <Icon name="check" size={16} /> Read your chart of accounts for mapping
            </li>
          </ul>
          <p class="callout">
            <Icon name="lock" size={18} />
            <span class="callout__text">It can’t see bank logins or payroll, and you can disconnect at any time from either side.</span>
          </p>
        </div>
      )}
      {step === 3 && (
        <ol class="connect-progress" role="list" aria-live="polite">
          {tasks.map((label, i) => (
            <li key={label} class={i < progress ? 'is-done' : i === progress ? 'is-active' : undefined}>
              <span class="connect-progress__icon" aria-hidden="true">
                {i < progress ? <Icon name="check" size={14} stroke={2.6} /> : i === progress ? <span class="spinner" /> : null}
              </span>
              <span>
                {label}
                <span class="sr-only">{i < progress ? ' — done' : i === progress ? ' — in progress' : ''}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {step === 4 && (
        <div class="stack connect-done">
          <span class="connect-done__icon" aria-hidden="true">
            <Icon name="check" size={26} stroke={2.4} />
          </span>
          <p class="connect-done__title">Connected to “{company}”</p>
          <p class="muted">The first sync is finished. From now on new customers, invoices and payments go to QuickBooks as they happen — check the sync log on this page any time.</p>
        </div>
      )}
    </Dialog>
  );
}

export function IntegrationsTab() {
  const d = db.value;
  const books = d.books;
  const [connecting, setConnecting] = useState(false);
  const [confirm, setConfirm] = useState<'disconnect' | 'in-house' | null>(null);
  const [allLog, setAllLog] = useState(false);
  const log = allLog ? books.log : books.log.slice(0, 8);

  const chooseInHouse = () => {
    if (books.mode === 'in-house') return;
    if (books.connected) setConfirm('in-house');
    else setBooksMode('in-house');
  };
  const chooseQuickBooks = () => {
    if (books.mode !== 'quickbooks') setBooksMode('quickbooks');
  };
  const sync = () => {
    syncQuickBooks();
    toast('Sync finished — QuickBooks is up to date (simulated)', { tone: 'success' });
  };

  return (
    <div class="acct-integrations">
      <section class="books-choice" aria-labelledby="books-choice-title">
        <h2 id="books-choice-title" class="acct-h2">
          How do you want to keep your books?
        </h2>
        <p class="muted">Either way, the day-to-day — quotes, invoices, payments and bills — happens here. The difference is where your general ledger lives.</p>
        <div class="books-options" role="radiogroup" aria-labelledby="books-choice-title">
          <label class={`books-option${books.mode === 'in-house' ? ' is-selected' : ''}`}>
            <input type="radio" name="books-mode" class="sr-only" checked={books.mode === 'in-house'} onChange={chooseInHouse} />
            <span class="books-option__head">
              <span class="books-option__icon">
                <Icon name="store" size={20} />
              </span>
              <span>
                <span class="books-option__title">In-house with FiberSteel mode</span>
                <span class="books-option__text">FiberSteel mode is the accounting system — one program to keep up.</span>
              </span>
              {books.mode === 'in-house' && (
                <Badge tone="green" icon="check">
                  Current
                </Badge>
              )}
            </span>
            <ul class="books-option__list" role="list">
              <li>Invoices, quotes and payments</li>
              <li>Bills, bank feeds and reconciliation</li>
              <li>Profit &amp; loss, sales tax and receivables reports</li>
              <li>A read-only login for your accountant</li>
            </ul>
          </label>
          <label class={`books-option${books.mode === 'quickbooks' ? ' is-selected' : ''}`}>
            <input type="radio" name="books-mode" class="sr-only" checked={books.mode === 'quickbooks'} onChange={chooseQuickBooks} />
            <span class="books-option__head">
              <span class="books-option__icon">
                <Icon name="refresh" size={20} />
              </span>
              <span>
                <span class="books-option__title">QuickBooks Online</span>
                <span class="books-option__text">Keep QuickBooks as the general ledger; FiberSteel mode keeps it up to date.</span>
              </span>
              {books.mode === 'quickbooks' && (
                <Badge tone={books.connected ? 'green' : 'amber'} icon={books.connected ? 'check' : 'clock'}>
                  {books.connected ? 'Current' : 'Not connected'}
                </Badge>
              )}
            </span>
            <ul class="books-option__list" role="list">
              <li>Customers, products and services sync both ways</li>
              <li>Invoices, quotes and payments sync as they happen</li>
              <li>Bills too, if you want them</li>
              <li>Your accountant keeps working in QuickBooks</li>
            </ul>
          </label>
        </div>
      </section>

      {books.connected ? (
        <Card
          title="QuickBooks Online"
          subtitle={`Connected to “${books.company}”${books.connectedAt ? ` since ${shortDate(books.connectedAt)}` : ''} · last sync ${books.lastSyncAt ? relative(books.lastSyncAt) : 'never'}`}
          actions={
            <>
              <Button icon="refresh" onClick={sync}>
                Sync now
              </Button>
              <Button variant="ghost" onClick={() => setConfirm('disconnect')}>
                Disconnect
              </Button>
            </>
          }
          class="qb-card"
        >
          <div class="qb-settings">
            <div>
              <h3 class="section-label">What syncs</h3>
              <Switch checked={books.autoSync} onChange={(v) => updateBooks({ autoSync: v })} label="Sync automatically" description="Push changes as they happen. Turn off to sync by hand with “Sync now”." />
              {SYNC_ITEMS.map((s) => (
                <Switch key={s.key} checked={books.sync[s.key]} onChange={(v) => updateBooks({ sync: { ...books.sync, [s.key]: v } })} label={s.label} description={s.description} />
              ))}
            </div>
            <div>
              <h3 class="section-label">Account mapping</h3>
              <p class="muted small qb-map-intro">Where each kind of FiberSteel mode money lands in the QuickBooks chart of accounts.</p>
              <div class="table-wrap">
                <table class="table table--dense qb-map">
                  <caption class="sr-only">QuickBooks account mapping</caption>
                  <thead>
                    <tr>
                      <th scope="col">In FiberSteel mode</th>
                      <th scope="col">QuickBooks account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.mapping.map((m) => (
                      <tr key={m.key}>
                        <th scope="row">{m.label}</th>
                        <td>
                          <select
                            class="select select--sm"
                            value={m.account}
                            aria-label={`QuickBooks account for ${m.label}`}
                            onChange={(e) => {
                              const account = (e.target as HTMLSelectElement).value;
                              updateBooks({ mapping: books.mapping.map((x) => (x.key === m.key ? { ...x, account } : x)) });
                              toast(`${m.label} now maps to ${account}`);
                            }}
                          >
                            {CHART_OF_ACCOUNTS.map((g) => (
                              <optgroup key={g.group} label={g.group}>
                                {g.accounts.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            {!CHART_OF_ACCOUNTS.some((g) => g.accounts.includes(m.account)) && <option value={m.account}>{m.account}</option>}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h3 class="section-label">Sync log</h3>
          {books.log.length === 0 ? (
            <p class="muted">Nothing synced yet.</p>
          ) : (
            <>
              <ul class="sync-log" role="list">
                {log.map((entry) => (
                  <li key={entry.id} class={levelIcon[entry.level].cls}>
                    <Icon name={levelIcon[entry.level].icon} size={16} label={levelIcon[entry.level].label} />
                    <span class="sync-log__text">{entry.text}</span>
                    <span class="sync-log__time">{relative(entry.at)}</span>
                  </li>
                ))}
              </ul>
              {books.log.length > 8 && (
                <Button size="sm" variant="ghost" onClick={() => setAllLog(!allLog)}>
                  {allLog ? 'Show fewer' : `Show all ${books.log.length} entries`}
                </Button>
              )}
            </>
          )}
        </Card>
      ) : (
        <Card title="QuickBooks Online" subtitle={books.mode === 'quickbooks' ? 'Chosen — connect to start syncing' : 'Not connected'} class="qb-card">
          <div class="qb-pitch">
            <div>
              <p>Connect once and FiberSteel mode keeps QuickBooks current: new customers, invoices and payments flow over automatically, so nobody types anything twice.</p>
              <ul class="qb-steps" role="list">
                <li>
                  <span class="qb-steps__n">1</span> Sign in with your Intuit account
                </li>
                <li>
                  <span class="qb-steps__n">2</span> Pick the company and approve access
                </li>
                <li>
                  <span class="qb-steps__n">3</span> FiberSteel mode matches customers and products, then starts syncing
                </li>
              </ul>
            </div>
            <div class="qb-pitch__cta">
              <Button variant="primary" icon="link" onClick={() => setConnecting(true)}>
                Connect QuickBooks
              </Button>
              <p class="muted small">Simulated in this demo — no data leaves your browser.</p>
            </div>
          </div>
        </Card>
      )}

      <h2 class="acct-h2">Other connections</h2>
      <ul class="integrations-grid" role="list">
        <li class="integration">
          <span class="integration__icon">
            <Icon name="bank" size={20} />
          </span>
          <span class="integration__body">
            <span class="integration__title">Bank feeds</span>
            <span class="integration__text">Operating ••4821, Payroll ••9033, Savings ••7710 and the card ••1170 update every morning.</span>
          </span>
          <Badge tone="green" icon="check">
            Connected (demo)
          </Badge>
        </li>
        <li class="integration">
          <span class="integration__icon">
            <Icon name="refresh" size={20} />
          </span>
          <span class="integration__body">
            <span class="integration__title">Xero</span>
            <span class="integration__text">The same two-way sync for businesses that use Xero.</span>
          </span>
          <Button size="sm" disabled>
            Available on request
          </Button>
        </li>
        <li class="integration">
          <span class="integration__icon">
            <Icon name="book" size={20} />
          </span>
          <span class="integration__body">
            <span class="integration__title">QuickBooks Desktop</span>
            <span class="integration__text">Syncs through the QuickBooks Web Connector on the office computer.</span>
          </span>
          <Button size="sm" disabled>
            Available on request
          </Button>
        </li>
      </ul>

      {connecting && <ConnectDialog onClose={() => setConnecting(false)} />}
      {confirm === 'disconnect' && (
        <Confirm
          title="Disconnect QuickBooks?"
          confirmLabel="Disconnect"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            disconnectQuickBooks();
            toast('QuickBooks disconnected — the books stay in FiberSteel mode.');
          }}
        >
          <p>Syncing stops right away. Nothing is deleted in FiberSteel mode or in QuickBooks, and you can reconnect later.</p>
        </Confirm>
      )}
      {confirm === 'in-house' && (
        <Confirm
          title="Keep the books in-house?"
          confirmLabel="Switch to in-house"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            disconnectQuickBooks();
            toast('Books are now kept in FiberSteel mode. QuickBooks is disconnected.');
          }}
        >
          <p>This disconnects QuickBooks. Everything already synced stays in both places.</p>
        </Confirm>
      )}
    </div>
  );
}
