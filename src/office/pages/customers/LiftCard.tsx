/** One lift at a customer's dock: the boat and slip it was set up for, warranty coverage by part, claims and visits. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { registerLift, remoteValves, transferLift } from '../../actions';
import { useAssets } from '../../assets';
import type { Lift } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addDays } from '../../lib/dates';
import { shortDate } from '../../lib/format';
import { navigate } from '../../router';
import { firstName, itemOf, itemPhotoKey, liftCoverage, serviceFeeApplies, warrantyState } from '../../selectors';
import { can, db, history } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, cx, Details, Link, Menu, type MenuItem } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker } from '../../ui/pickers';
import { claimStatusMeta, jobTypeMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { boatText, installedByText, liftKindLabels, notCoveredReason, serviceHistory, slipText, warrantyEligible } from './helpers';
import { CoverageBar } from './parts';

export function LiftCard({ lift, focused }: { lift: Lift; focused?: boolean }) {
  const d = db.value;
  const { photos } = useAssets();
  const ref = useRef<HTMLElement>(null);
  const [transfer, setTransfer] = useState(false);
  const customer = d.customers.find((c) => c.id === lift.customerId);
  const item = itemOf(d, lift.itemId);
  const photoKey = itemPhotoKey(item);
  const photo = photoKey ? photos[photoKey] : undefined;
  const state = warrantyState(lift);
  const eligible = warrantyEligible(lift);
  const coverage = liftCoverage(lift);
  const claims = d.claims.filter((c) => c.liftId === lift.id);
  const visits = useMemo(() => serviceHistory(d, history.value, { liftId: lift.id }), [d, lift.id]);
  const titleId = `lift-${lift.id}-title`;
  const feeFrom = addDays(lift.installedOn, 365);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focused]);

  const register = () => {
    registerLift(lift.id);
    toast(`${lift.model} (${lift.serial}) registered for the warranty`, { tone: 'success' });
  };

  const more: MenuItem[] = [
    { label: 'Edit lift details', icon: 'edit', onSelect: () => openDialog({ kind: 'lift', liftId: lift.id }) },
    ...(can('jobs') && customer && !lift.remote && lift.kind !== 'pwc'
      ? [{ label: 'Fit a remote control', icon: 'remote' as const, onSelect: () => openDialog({ kind: 'job', preset: { type: 'remote', customerId: customer.id, liftId: lift.id, itemId: `R-ADM${remoteValves(lift.capacity)}` } }) }]
      : []),
    ...(can('warranty') ? [{ label: 'Check coverage', icon: 'shield' as const, onSelect: () => navigate(`/office/warranty/?tab=coverage&lift=${lift.id}`) }] : []),
    { label: 'Move to a new owner…', icon: 'transfer', onSelect: () => setTransfer(true) },
  ];

  return (
    <article ref={ref} id={`lift-${lift.id}`} class={cx('lift-card card', focused && 'is-focused')} aria-labelledby={titleId}>
      <header class="lift-card__head">
        {photo ? (
          <img class="thumb lift-card__thumb" src={photo} alt="" width={56} height={56} loading="lazy" />
        ) : (
          <span class="thumb lift-card__thumb">
            <Icon name="lift" size={22} />
          </span>
        )}
        <div class="lift-card__title">
          <h3 id={titleId}>{lift.model}</h3>
          <p class="muted small">
            {liftKindLabels[lift.kind]} · Serial <span class="tabular">{lift.serial}</span>
          </p>
        </div>
        <StatusBadge meta={warrantyMeta[state]} />
      </header>

      <Details
        columns={2}
        items={[
          ['Installed', `${shortDate(lift.installedOn, true)} by ${installedByText(lift, d.dealers)}`],
          ['Original owner', lift.originalOwner ? 'Yes' : 'No — came with the house or bought used'],
          [
            'Warranty registration',
            eligible ? (
              lift.registered ? (
                <span class="reg-yes">
                  <Icon name="check" size={14} stroke={2.4} /> Registered · <span class="tabular">{lift.registrationNo}</span>
                </span>
              ) : (
                <span class="reg-no">
                  <Icon name="alert" size={14} /> Not registered yet
                </span>
              )
            ) : (
              'Not applicable'
            ),
          ],
          ['Boat', boatText(lift) || <span class="muted">Not on file</span>],
          ['Slip', slipText(lift) || <span class="muted">Not on file</span>],
          ['Bunks', lift.bunks],
          ['Extras', lift.extras.length ? lift.extras.join(', ') : 'None'],
          ['Remote', lift.remote ? `${lift.remote.brand} · ${lift.remote.valves}-valve · since ${shortDate(lift.remote.installedOn, true)}` : 'None'],
          ['Last serviced', lift.lastServiceOn ? shortDate(lift.lastServiceOn, true) : 'No visits on file'],
        ]}
      />

      {eligible ? (
        <div class="coverage" role="group" aria-label={`Warranty coverage for the ${lift.model}`}>
          <p class="coverage__lifetime">
            <Icon name="shield" size={14} />
            <span>
              <strong>Tanks &amp; frame: lifetime</strong> — for as long as the original purchaser owns the lift
            </span>
          </p>
          <CoverageBar label="Galvanized parts" from={lift.installedOn} until={coverage[1].until!} />
          <CoverageBar label="Blower, bushings & hose" from={lift.installedOn} until={coverage[2].until!} />
          <p class="coverage__note">
            Parts only: the owner pays the service call and any labor.{' '}
            {serviceFeeApplies(lift) ? 'Service calls carry the $95 fee (it’s been more than a year since the install).' : `The $95 service-call fee starts ${shortDate(feeFrom, true)}, a year after the install.`}
          </p>
        </div>
      ) : (
        <p class="callout lift-card__note">
          <Icon name="info" size={16} />
          <span>{notCoveredReason(lift)}</span>
        </p>
      )}

      <div class="lift-card__actions">
        {eligible && !lift.registered && (
          <Button size="sm" variant="primary" icon="shield" onClick={register}>
            Register the warranty
          </Button>
        )}
        {eligible && can('warranty') && (
          <Button size="sm" icon="file" onClick={() => openDialog({ kind: 'claim', liftId: lift.id })}>
            Start a claim
          </Button>
        )}
        {can('jobs') && customer && (
          <Button size="sm" icon="calendar-plus" onClick={() => openDialog({ kind: 'job', preset: { type: 'service', customerId: customer.id, liftId: lift.id } })}>
            Book service
          </Button>
        )}
        <Menu label={`More for the ${lift.model}`} size="sm" items={more} />
      </div>

      {claims.length > 0 && (
        <div class="lift-card__section">
          <h4 class="section-label">Warranty claims</h4>
          <ul class="lift-card__list" role="list">
            {claims.map((c) => (
              <li key={c.id}>
                {can('warranty') ? <Link to={`/office/warranty/?id=${c.id}`}>{c.id}</Link> : c.id}
                <span class="muted">
                  {' '}
                  · {c.part} · opened {shortDate(c.openedOn, true)}
                </span>
                <StatusBadge meta={claimStatusMeta[c.status]} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <details class="lift-card__history">
        <summary>
          <Icon name="chevron-right" size={14} class="lift-card__chev" />
          Visits <span class="pill-count">{visits.length}</span>
        </summary>
        {visits.length === 0 ? (
          <p class="muted small">No visits on file.</p>
        ) : (
          <ul class="lift-card__list" role="list">
            {visits.slice(0, 12).map((v) => (
              <li key={v.id}>
                <span class="nowrap tabular">{shortDate(v.day, true)}</span>
                <Badge tone={jobTypeMeta[v.type].tone}>{jobTypeMeta[v.type].label}</Badge>
                <span class="lift-card__visit">
                  {v.jobId && can('jobs') ? <Link to={`/office/jobs/?id=${v.jobId}`}>{v.title}</Link> : v.title}
                  {v.detail && <span class="muted small"> · {v.detail}</span>}
                  {v.techs.length > 0 && <span class="muted small"> · {v.techs.map((t) => firstName(d, t)).join(', ')}</span>}
                </span>
              </li>
            ))}
            {visits.length > 12 && <li class="muted small">…and {visits.length - 12} earlier visits (see the Visits tab)</li>}
          </ul>
        )}
      </details>

      {transfer && <TransferDialog lift={lift} onClose={() => setTransfer(false)} />}
    </article>
  );
}

/** The lift went with the house: move it to the new owner's record. */
function TransferDialog({ lift, onClose }: { lift: Lift; onClose: () => void }) {
  const [to, setTo] = useState<string | undefined>();
  const target = db.value.customers.find((c) => c.id === to);
  const same = to === lift.customerId;
  return (
    <Dialog
      title="Move this lift to a new owner"
      description={`${lift.model} · serial ${lift.serial}`}
      onClose={onClose}
      size="md"
      class="cust-dialog lift-move"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="transfer"
            disabled={!to || same}
            onClick={() => {
              transferLift(lift.id, to!);
              toast(`${lift.model} moved to ${target?.name ?? 'the new owner'}`);
              onClose();
              navigate(`/office/customers/?id=${to}&lift=${lift.id}`);
            }}
          >
            Move the lift
          </Button>
        </>
      }
    >
      <div class="stack">
        <p class="callout callout--amber">
          <Icon name="alert" size={16} />
          <span>FiberSteel’s warranty is for the original purchaser, for as long as they own the lift. After the move, the new owner’s record shows the lift as not covered.</span>
        </p>
        <CustomerPicker value={to} onChange={setTo} kinds={['owner', 'marina']} label="New owner" autoFocus />
        {same && <span class="field__error-text">That’s the current owner — pick the new one.</span>}
      </div>
    </Dialog>
  );
}
