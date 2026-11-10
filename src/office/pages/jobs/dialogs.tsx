/** Small dialogs used by the board and the job page: put on hold, mark complete. */
import { useState } from 'preact/hooks';
import { completeJob, setJobStatus } from '../../actions';
import type { Job } from '../../data/types';
import { diffMinutes } from '../../lib/dates';
import { duration } from '../../lib/format';
import { customerOf } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { closeOutAction, defaultTimes } from './helpers';

const HOLD_REASONS = ['Waiting on parts', 'Waiting on the customer', 'Weather or the lake level', 'Waiting on the dock to be ready', 'Other'];

/** What finishing each kind of job does, in plain words */
export const finishNotes: Record<Job['type'], string> = {
  'site-visit': 'The next step is the quote, written from what was measured.',
  build: 'The finished lift goes into stock, and the components reserved for it are used up.',
  install: 'The lift is added to the customer’s record — its warranty dates start today — and the finished lift comes out of stock.',
  service: 'Reserved parts are marked used, and the lift’s last-service date is updated.',
  warranty: 'Reserved parts are marked used and a warranty claim is opened for the part. The part is covered; the owner pays the service call and labor.',
  delivery: 'For a dealer order, the lifts leave stock and the dealer is invoiced.',
  remote: 'The remote is recorded on the customer’s lift.',
};

/** Whether the owner signs off on this kind of job (shop builds and site visits don't need it) */
export const needsSignature = (job: Job) => job.type !== 'build' && job.type !== 'site-visit';

export function HoldDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const [reason, setReason] = useState(HOLD_REASONS[0]);
  const [details, setDetails] = useState('');
  const submit = (e?: Event) => {
    e?.preventDefault();
    const text = details.trim();
    setJobStatus(job.id, 'on-hold', { holdReason: text ? `${reason} — ${text}` : reason });
    toast(`${job.id} is on hold`);
    onClose();
  };
  return (
    <Dialog
      title="Put this job on hold"
      description={`${job.id} · ${job.title}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()}>
            Put on hold
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={submit}>
        <Field label="Reason">
          <select class="select" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
            {HOLD_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Details" optional hint="Shown on the board so everyone knows what it’s waiting for.">
          <textarea class="textarea" rows={3} value={details} placeholder="e.g. Tanks arrive Thursday" onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </form>
    </Dialog>
  );
}

export function CompleteDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const c = customerOf(db.value, job.customerId);
  const times = defaultTimes(job);
  const signs = needsSignature(job);
  const [arrived, setArrived] = useState(times.arrivedAt);
  const [finished, setFinished] = useState(times.finishedAt);
  const [note, setNote] = useState('');
  const [signer, setSigner] = useState(signs ? (c?.contact ?? c?.name.split(' & ')[0] ?? '') : '');
  const mins = arrived && finished ? diffMinutes(finished, arrived) : 0;
  const valid = mins > 0;

  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!valid) return;
    completeJob(job.id, { arrivedAt: arrived, finishedAt: finished, note: note.trim() || undefined, signature: signer.trim() ? { name: signer.trim() } : undefined });
    const next = closeOutAction(job);
    toast(`${job.id} marked complete`, { tone: 'success', action: { label: next.label, run: next.run } });
    onClose();
  };

  return (
    <Dialog
      title="Mark job complete"
      description={`${job.id} · ${job.title}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!valid} onClick={() => submit()}>
            Mark complete
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={submit}>
        <div class="form-grid">
          <Field label={job.type === 'build' ? 'Started' : 'Arrived'}>
            <input class="input" type="datetime-local" value={arrived} onInput={(e) => setArrived((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Finished" hint={valid ? `${job.type === 'build' ? 'Time in the shop' : 'Time on site'}: ${duration(mins)}` : 'Finish time must be after the start.'}>
            <input class="input" type="datetime-local" value={finished} aria-invalid={!valid} onInput={(e) => setFinished((e.target as HTMLInputElement).value)} />
          </Field>
          {signs && (
            <Field label="Signed off by" optional class="span-2" hint="Owners usually sign on the crew’s phone (My day). You can record the name here.">
              <input class="input" value={signer} onInput={(e) => setSigner((e.target as HTMLInputElement).value)} />
            </Field>
          )}
          <Field label="Completion note" optional class="span-2">
            <textarea class="textarea" rows={3} value={note} placeholder={job.type === 'build' ? 'Serial tagged, where it’s staged in the yard' : 'What was done, anything to follow up on'} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
          </Field>
        </div>
        <p class="muted small">{finishNotes[job.type]}</p>
      </form>
    </Dialog>
  );
}
