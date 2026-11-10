/** A warranty claim, start to finish: the lift, the part, who covers it, and the next step. */
import { useState } from 'preact/hooks';
import { setClaimStatus } from '../../actions';
import type { ClaimStatus } from '../../data/types';
import { money, shortDate, telHref } from '../../lib/format';
import { customerOf, jobOf, liftOf, warrantyState } from '../../selectors';
import { can, db } from '../../store';
import { toast } from '../../toast';
import { Button, Details, EmptyState, Field, Link } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { claimStatusMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { installedByText } from '../customers/helpers';
import { componentLabel, partCoverage, remoteContact } from './helpers';

const steps: { key: ClaimStatus; label: string }[] = [
  { key: 'open', label: 'Opened' },
  { key: 'approved', label: 'Approved' },
  { key: 'part-sent', label: 'Part sent' },
  { key: 'replaced', label: 'Replaced' },
];

export function ClaimDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const d = db.value;
  const claim = d.claims.find((c) => c.id === id);
  const [mode, setMode] = useState<'idle' | 'deny' | 'cost'>('idle');
  const [reason, setReason] = useState('');
  const [cost, setCost] = useState(claim ? String(claim.partCost) : '0');
  const [notes, setNotes] = useState(claim?.notes ?? '');

  if (!claim) {
    return (
      <Dialog title="Claim not found" onClose={onClose} drawer size="md">
        <EmptyState icon="file" title="We couldn’t find that claim">
          It may have been removed when the demo data was reset.
        </EmptyState>
      </Dialog>
    );
  }

  const lift = liftOf(d, claim.liftId);
  const customer = customerOf(d, claim.customerId);
  const job = jobOf(d, claim.jobId);
  const ended = claim.status === 'denied' || claim.status === 'referred';
  const current = steps.findIndex((s) => s.key === claim.status);
  const coverage = lift ? partCoverage(lift, claim.component, claim.openedOn) : undefined;
  const contact = claim.component === 'Remote system' ? remoteContact(lift?.remote?.brand) : undefined;

  const move = (status: ClaimStatus, message: string, patch = {}) => {
    setClaimStatus(claim.id, status, patch);
    setMode('idle');
    toast(message);
  };

  const footer = (() => {
    if (mode === 'deny') {
      return (
        <>
          <Field label="Reason" class="claim-inline-field claim-inline-field--wide">
            <input class="input" value={reason} placeholder="e.g. The 3-year term had ended" data-autofocus onInput={(e) => setReason((e.target as HTMLInputElement).value)} />
          </Field>
          <span class="spacer" />
          <Button onClick={() => setMode('idle')}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => move('denied', `${claim.id} marked not covered`, { notes: [claim.notes, `Not covered: ${reason.trim()}`].filter(Boolean).join('\n') })}>
            Mark not covered
          </Button>
        </>
      );
    }
    if (mode === 'cost') {
      return (
        <>
          <Field label="Part cost ($)" class="claim-inline-field">
            <input class="input" type="number" min="0" step="0.01" inputMode="decimal" value={cost} data-autofocus onInput={(e) => setCost((e.target as HTMLInputElement).value)} />
          </Field>
          <span class="spacer" />
          <Button onClick={() => setMode('idle')}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!(Number(cost) >= 0)}
            onClick={() => move(claim.status, `Part cost on ${claim.id} set to ${money(Number(cost) || 0)}`, { partCost: Math.round((Number(cost) || 0) * 100) / 100 })}
          >
            Save cost
          </Button>
        </>
      );
    }
    switch (claim.status) {
      case 'open':
        return (
          <>
            <Button variant="ghost" onClick={() => setMode('deny')}>
              Not covered…
            </Button>
            {claim.component === 'Remote system' ? (
              <Button variant="primary" icon="external" onClick={() => move('referred', `${claim.id} referred to the remote’s maker`)}>
                Refer to the maker
              </Button>
            ) : (
              <Button variant="primary" icon="check" onClick={() => move('approved', `${claim.id} approved`)}>
                Approve
              </Button>
            )}
          </>
        );
      case 'approved':
        return (
          <>
            <Button icon="truck" onClick={() => move('part-sent', `Part sent for ${claim.id}`)}>
              Part sent
            </Button>
            <Button variant="primary" icon="check-circle" onClick={() => move('replaced', `${claim.id} — part replaced`)}>
              Mark replaced
            </Button>
          </>
        );
      case 'part-sent':
        return (
          <Button variant="primary" icon="check-circle" onClick={() => move('replaced', `${claim.id} — part replaced`)}>
            Mark replaced
          </Button>
        );
      case 'denied':
      case 'referred':
        return (
          <Button icon="undo" onClick={() => move('open', `${claim.id} reopened`)}>
            Reopen
          </Button>
        );
      default:
        return <span class="muted small">The part was replaced — this claim is closed.</span>;
    }
  })();

  return (
    <Dialog
      title={`${claim.id} · ${claim.part}`}
      description={`${componentLabel[claim.component]} · covered by ${claim.coveredBy}`}
      onClose={onClose}
      drawer
      size="md"
      headerExtra={<StatusBadge meta={claimStatusMeta[claim.status]} />}
      footer={footer}
    >
      <div class="stack">
        <ol class={`claim-steps${ended ? ' is-denied' : ''}`} aria-label="Claim progress" tabIndex={-1} data-autofocus>
          {steps.map((s, i) => {
            const done = !ended && i <= current;
            return (
              <li key={s.key} class={done ? 'is-done' : undefined} aria-current={!ended && i === current ? 'step' : undefined}>
                <span class="claim-steps__dot" aria-hidden="true">
                  {done && <Icon name="check" size={11} stroke={3} />}
                </span>
                <span class="claim-steps__label">{s.label}</span>
              </li>
            );
          })}
        </ol>
        {claim.status === 'denied' && (
          <p class="callout callout--amber">
            <Icon name="x-circle" size={16} />
            <span>Marked not covered — the part, the service call and the labor are billable. Reopen it if something changes.</span>
          </p>
        )}
        {claim.status === 'referred' && (
          <p class="callout callout--blue">
            <Icon name="external" size={16} />
            <span>
              Referred to the remote’s maker.
              {contact ? (
                <>
                  {' '}
                  {contact.who}:{' '}
                  <a href={telHref(contact.phone)} class="tabular">
                    {contact.phone}
                  </a>
                </>
              ) : (
                ' FiberSteel’s site doesn’t list a warranty contact for this remote.'
              )}
            </span>
          </p>
        )}

        <Details
          columns={2}
          items={[
            ['Customer', customer ? <Link to={`/office/customers/?id=${customer.id}${lift ? `&lift=${lift.id}` : ''}`}>{customer.name}</Link> : '—'],
            ['Lift', lift ? lift.model : '—'],
            ['Serial number', lift ? <span class="tabular">{lift.serial}</span> : '—'],
            ['Coverage', lift ? <StatusBadge meta={warrantyMeta[warrantyState(lift)]} /> : '—'],
            ['Installed', lift ? `${shortDate(lift.installedOn, true)} by ${installedByText(lift, d.dealers)}` : '—'],
            ['Original owner', lift ? (lift.originalOwner ? 'Yes' : 'No') : '—'],
            ['Issue', claim.issue],
            ['Part', claim.part],
            ['Opened', shortDate(claim.openedOn, true)],
            ['Last update', shortDate(claim.updatedOn, true)],
            [
              'Part cost',
              <span>
                <span class="tabular">{money(claim.partCost)}</span>{' '}
                <button type="button" class="link-btn" onClick={() => setMode('cost')}>
                  Edit
                </button>
              </span>,
            ],
            ['Service job', job ? can('jobs') ? <Link to={`/office/jobs/?id=${job.id}`}>{job.id}</Link> : job.id : 'None linked'],
          ]}
        />

        {coverage && (
          <p class={`cov-answer ${coverage.covered ? 'cov-answer--yes' : 'cov-answer--no'}`}>
            <Icon name={coverage.covered ? 'check-circle' : 'info'} size={18} />
            <span>
              <strong>When it was opened:</strong> {coverage.note}
            </span>
          </p>
        )}
        <p class="muted small">FiberSteel’s warranty covers the cost of the part only. All warranty decisions are approved by an authorized FiberSteel representative.</p>

        <div class="field">
          <label class="field__label" for="claim-notes">
            Notes
          </label>
          <textarea id="claim-notes" class="textarea" rows={4} value={notes} placeholder="What failed, photos taken, what was replaced…" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
          <div class="row">
            <Button
              size="sm"
              disabled={notes === (claim.notes ?? '')}
              onClick={() => {
                setClaimStatus(claim.id, claim.status, { notes: notes.trim() || undefined });
                toast('Claim notes saved');
              }}
            >
              Save notes
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
