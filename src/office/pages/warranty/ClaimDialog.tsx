/** Start a warranty claim for a part on a lift. Opened via openDialog({ kind: 'claim', liftId?, jobId? }). */
import { useMemo, useState } from 'preact/hooks';
import { createClaim } from '../../actions';
import { issues } from '../../data/catalog';
import type { Component, Item } from '../../data/types';
import { money, shortDate } from '../../lib/format';
import { navigate } from '../../router';
import { customerOf, itemOf, jobOf, liftOf, warrantyState } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker, ItemPicker } from '../../ui/pickers';
import { StatusBadge, warrantyMeta } from '../../ui/status';
import { notCoveredReason, warrantyEligible } from '../customers/helpers';
import { componentLabel, components, partCoverage } from './helpers';

const OTHER = '__other';

export function ClaimDialog({ liftId, jobId, onClose }: { liftId?: string; jobId?: string; onClose: () => void }) {
  const d = db.value;
  const job = jobOf(d, jobId);
  const presetLift = liftId ?? job?.liftId;
  const jobIssue = job?.issue ? Object.entries(issues).find(([, def]) => def.label === job.issue) : undefined;
  const jobPart = job?.parts.map((p) => itemOf(d, p.itemId)).find((it) => it?.kind === 'component');

  const [customerId, setCustomerId] = useState<string | undefined>(presetLift ? liftOf(d, presetLift)?.customerId : job?.customerId);
  const [selLift, setSelLift] = useState<string | undefined>(presetLift);
  const [component, setComponent] = useState<Component>(jobIssue?.[1].component ?? 'Blower controller');
  const [issueKey, setIssueKey] = useState<string>(jobIssue?.[0] ?? OTHER);
  const [issueText, setIssueText] = useState(jobIssue ? '' : (job?.issue ?? ''));
  const [part, setPart] = useState(jobPart?.name ?? '');
  const [cost, setCost] = useState(jobPart ? String(jobPart.cost) : '');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);

  const customer = customerOf(d, customerId);
  const customerLifts = customerId ? d.lifts.filter((l) => l.customerId === customerId) : [];
  const lift = liftOf(d, selLift);
  const eligible = !!lift && warrantyEligible(lift);
  const check = lift ? partCoverage(lift, component) : undefined;
  const issueOptions = useMemo(() => Object.entries(issues).filter(([, def]) => def.component === component), [component]);
  const issueLabel = issueKey === OTHER ? issueText.trim() : (issues[issueKey]?.label ?? '');
  const canCreate = !!lift && eligible && part.trim().length > 0 && issueLabel.length > 0;

  const pickComponent = (c: Component) => {
    setComponent(c);
    const first = Object.entries(issues).find(([, def]) => def.component === c);
    setIssueKey(first?.[0] ?? OTHER);
  };
  const pickPart = (it: Item) => {
    setPart(it.name);
    setCost(String(it.cost));
  };

  const create = () => {
    setTried(true);
    if (!canCreate || !lift) return;
    const id = createClaim({ liftId: lift.id, jobId, issue: issueLabel, component, part: part.trim(), partCost: Math.max(0, Number(cost) || 0), notes: notes.trim() || undefined });
    toast(`${id} opened${component === 'Remote system' ? ' and referred to the remote’s maker' : ''}`);
    onClose();
    navigate(`/office/warranty/?id=${id}`);
  };

  return (
    <Dialog
      title="New warranty claim"
      description={job ? `From job ${job.id}` : 'A part FiberSteel’s warranty covers on a lift FiberSteel installed.'}
      onClose={onClose}
      size="md"
      class="cust-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={tried && !canCreate} onClick={create}>
            Open the claim
          </Button>
        </>
      }
    >
      <div class="stack">
        {presetLift && lift ? (
          <div class="picked">
            <span class="picked__icon">
              <Icon name="lift" size={16} />
            </span>
            <span class="picked__text">
              <strong>{lift.model}</strong>
              <span class="muted small">
                {customer?.name} · Serial {lift.serial} · installed {shortDate(lift.installedOn, true)}
              </span>
            </span>
            <StatusBadge meta={warrantyMeta[warrantyState(lift)]} />
          </div>
        ) : (
          <>
            <CustomerPicker
              value={customerId}
              label="Customer"
              kinds={['owner', 'marina']}
              autoFocus
              onChange={(id) => {
                setCustomerId(id);
                const ok = id ? d.lifts.filter((l) => l.customerId === id && warrantyEligible(l)) : [];
                setSelLift(ok.length === 1 ? ok[0].id : undefined);
              }}
            />
            {customer && (
              <fieldset class="claim-lifts">
                <legend class="field__label">Lift</legend>
                {customerLifts.length === 0 ? (
                  <p class="muted small">No lifts on file for this customer.</p>
                ) : (
                  customerLifts.map((l) => {
                    const ok = warrantyEligible(l);
                    return (
                      <label key={l.id} class={`claim-lifts__option${selLift === l.id ? ' is-selected' : ''}${ok ? '' : ' is-disabled'}`}>
                        <input type="radio" name="claim-lift" checked={selLift === l.id} disabled={!ok} onChange={() => setSelLift(l.id)} />
                        <span class="claim-lifts__text">
                          <strong>{l.model}</strong>
                          <span class="muted small">
                            Serial {l.serial} · installed {shortDate(l.installedOn, true)}
                            {ok ? '' : ` · ${l.installedBy !== 'FiberSteel' ? 'not a FiberSteel install' : 'not the original purchaser'}`}
                          </span>
                        </span>
                        <StatusBadge meta={warrantyMeta[warrantyState(l)]} />
                      </label>
                    );
                  })
                )}
                {tried && !lift && customerLifts.some(warrantyEligible) && <span class="field__error-text">Choose the lift the claim is for.</span>}
              </fieldset>
            )}
          </>
        )}

        {lift && !eligible && (
          <p class="callout callout--amber">
            <Icon name="alert" size={16} />
            <span>{notCoveredReason(lift)} Quote the repair instead.</span>
          </p>
        )}

        {(!lift || eligible) && (
          <>
            <div class="form-grid">
              <Field label="Part of the lift">
                <select class="select" value={component} onChange={(e) => pickComponent((e.target as HTMLSelectElement).value as Component)}>
                  {components.map((c) => (
                    <option key={c} value={c}>
                      {componentLabel[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="What happened">
                <select class="select" value={issueKey} onChange={(e) => setIssueKey((e.target as HTMLSelectElement).value)}>
                  {issueOptions.map(([key, def]) => (
                    <option key={key} value={key}>
                      {def.label}
                    </option>
                  ))}
                  <option value={OTHER}>Something else</option>
                </select>
              </Field>
              {issueKey === OTHER && (
                <Field label="Describe the problem" class="span-2">
                  <input class="input" value={issueText} aria-invalid={tried && !issueText.trim() ? 'true' : undefined} onInput={(e) => setIssueText((e.target as HTMLInputElement).value)} />
                  {tried && !issueText.trim() && <span class="field__error-text">Say what went wrong.</span>}
                </Field>
              )}
            </div>

            {check && (
              <p class={`cov-answer ${check.covered ? 'cov-answer--yes' : 'cov-answer--no'}`}>
                <Icon name={check.covered ? 'check-circle' : 'info'} size={18} />
                <span>{check.note}</span>
              </p>
            )}

            <ItemPicker label="Replacement part (from inventory)" filter={(it) => it.kind === 'component'} placeholder="Search components — or type it below" onSelect={pickPart} />
            <div class="form-grid">
              <Field label="Part">
                <input class="input" value={part} aria-invalid={tried && !part.trim() ? 'true' : undefined} placeholder="e.g. Blower" onInput={(e) => setPart((e.target as HTMLInputElement).value)} />
                {tried && !part.trim() && <span class="field__error-text">Name the part.</span>}
              </Field>
              <Field label="Part cost ($)" hint="FiberSteel’s cost (sample)">
                <input class="input" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onInput={(e) => setCost((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
            {Number(cost) > 0 && <p class="muted small">The warranty covers the part ({money(Number(cost) || 0)} at cost); the owner pays the service call and any labor.</p>}
            <Field label="Notes" optional>
              <textarea class="textarea" rows={3} value={notes} placeholder="What failed, photos taken, what the owner said…" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}
