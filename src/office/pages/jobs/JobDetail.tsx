/** A single job: status actions, what it's about (by type), checklist, parts, notes and sign-off. */
import { useState } from 'preact/hooks';
import { addJobNote, addJobPart, removeJobPart, setJobStatus, toggleChecklistItem } from '../../actions';
import type { Activity, Item, Job } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addMinutes, diffMinutes } from '../../lib/dates';
import { address, dayTime, duration, hours, mapsUrl, money, phone, relative, shortDate, telHref, time } from '../../lib/format';
import { navigate } from '../../router';
import { available, customerOf, dealerOf, firstName, itemLabel, itemOf, liftOf, staffOf } from '../../selectors';
import { can, db, ui } from '../../store';
import { toast } from '../../toast';
import { Avatar, Badge, Button, Card, Checkbox, Details, EmptyState, Field, Link, Menu, Meter, PageHeader, type MenuItem } from '../../ui/core';
import { Confirm } from '../../ui/Dialog';
import { Icon, type IconName } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { claimStatusMeta, jobTypeMeta, orderStatusMeta, StatusBadge } from '../../ui/status';
import { CompleteDialog, finishNotes, HoldDialog, needsSignature } from './dialogs';
import { closeOutAction, jobPath, jobWhere } from './helpers';
import { BomList, boatLine, buildShortages, ItemBox, jobStatusFor, lineValue, LiftBox, slipLine } from './parts';

const activityIcon: Record<Activity['kind'], IconName> = {
  received: 'inbox',
  note: 'note',
  email: 'mail',
  call: 'phone',
  text: 'message',
  status: 'refresh',
  assign: 'user',
  job: 'clipboard',
  estimate: 'file',
  system: 'info',
};

function Notes({ job }: { job: Job }) {
  const d = db.value;
  const [text, setText] = useState('');
  const notes = [...job.notes].sort((a, b) => (a.at < b.at ? -1 : 1));
  const canNote = job.status !== 'cancelled';
  return (
    <Card title="Notes & activity" subtitle={notes.length === 1 ? '1 entry' : `${notes.length} entries`}>
      <ol class="timeline">
        {notes.map((n) => (
          <li key={n.id}>
            <span class="timeline__icon">
              <Icon name={activityIcon[n.kind] ?? 'note'} size={14} />
            </span>
            <div class="timeline__text">
              <p>{n.text}</p>
              <p class="timeline__meta">
                {firstName(d, n.by)} · {dayTime(n.at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {canNote && (
        <form
          class="note-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addJobNote(job.id, text.trim());
            setText('');
            toast('Note added');
          }}
        >
          <label class="sr-only" for="job-note">
            Add a note
          </label>
          <textarea id="job-note" class="textarea" rows={2} value={text} placeholder={job.type === 'build' ? 'Add a note for the shop or the office…' : 'Add a note for the crew or the office…'} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
          <Button type="submit" variant="secondary" icon="send" disabled={!text.trim()}>
            Add note
          </Button>
        </form>
      )}
    </Card>
  );
}

function Parts({ job }: { job: Job }) {
  const d = db.value;
  const [picked, setPicked] = useState<Item | null>(null);
  const [qty, setQty] = useState(1);
  const editable = job.status !== 'closed' && job.status !== 'cancelled';
  const avail = picked ? available(picked, 'camdenton') : 0;
  const isBuild = job.type === 'build';
  // A build's bill of materials has its own list above; this one is for anything extra
  const bomIds = new Set(isBuild ? (itemOf(d, job.itemId)?.bom ?? []).map((b) => b.itemId) : []);
  const rows = job.parts.map((p, i) => ({ p, i })).filter(({ p }) => !bomIds.has(p.itemId));

  return (
    <Card title={isBuild ? 'Extra components' : 'Parts & stock'} subtitle={rows.length ? `${rows.length} line${rows.length === 1 ? '' : 's'}` : isBuild ? 'Anything beyond the bill of materials' : 'Nothing reserved yet'}>
      {rows.length > 0 && (
        <ul class="parts" role="list">
          {rows.map(({ p, i }) => {
            const it = itemOf(d, p.itemId);
            return (
              <li key={`${p.itemId}-${i}`} class="parts__row">
                <span class="parts__main">
                  <span class="parts__name">{it ? itemLabel(it) : p.itemId}</span>
                  <span class="muted small">{p.itemId}</span>
                </span>
                <span class="parts__qty tabular">
                  {p.qty}
                  {it && it.uom !== 'ea' ? ` ${it.uom}` : ''}
                </span>
                <Badge tone={p.status === 'used' ? 'green' : 'blue'} icon={p.status === 'used' ? 'check' : 'lock'}>
                  {p.status === 'used' ? 'Used' : 'Reserved'}
                </Badge>
                {editable && p.status === 'reserved' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    aria-label={`Release ${it?.name ?? p.itemId}`}
                    onClick={() => {
                      removeJobPart(job.id, i);
                      toast('Reservation released');
                    }}
                  />
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <div class="parts-add">
          {picked ? (
            <div class="parts-add__form">
              <p class="parts-add__item">
                <strong>{itemLabel(picked)}</strong>
                <span class="muted small"> · {picked.id}</span>
                <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </p>
              <div class="parts-add__row">
                <Field label={`Quantity${picked.uom !== 'ea' ? ` (${picked.uom})` : ''}`}>
                  <input class="input" type="number" min={1} step={1} value={qty} onInput={(e) => setQty(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} />
                </Field>
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() => {
                    addJobPart(job.id, picked.id, qty);
                    toast(`Reserved ${qty} × ${picked.name}`);
                    setPicked(null);
                    setQty(1);
                  }}
                >
                  Reserve
                </Button>
              </div>
              <p class={avail >= qty ? 'muted small' : 'is-bad small'}>{avail >= qty ? `${avail} available in Camdenton.` : avail > 0 ? `Only ${avail} available — the rest will need to be ordered.` : 'None available — this will need to be ordered.'}</p>
            </div>
          ) : (
            <ItemPicker label={isBuild ? 'Reserve another component' : 'Reserve a part from stock'} onSelect={(it) => setPicked(it)} />
          )}
        </div>
      )}
    </Card>
  );
}

/** What the job is about — a different card for each kind of job */
function TypePanel({ job }: { job: Job }) {
  const d = db.value;
  const item = itemOf(d, job.itemId);
  const lift = liftOf(d, job.liftId);
  const lead = job.leadId ? d.leads.find((l) => l.id === job.leadId) : undefined;
  const sibling = (type: Job['type']) => (job.leadId ? d.jobs.find((j) => j.id !== job.id && j.leadId === job.leadId && j.type === type && j.status !== 'cancelled') : undefined);
  const order = job.dealerOrderId ? d.dealerOrders.find((o) => o.id === job.dealerOrderId) : undefined;
  const dealer = order ? dealerOf(d, order.dealerId) : undefined;

  switch (job.type) {
    case 'build': {
      const install = sibling('install');
      const short = buildShortages(d, job).length;
      return (
        <Card title="What it takes to build" subtitle={item ? `${job.qty && job.qty > 1 ? `${job.qty} × ` : ''}${item.name}` : undefined}>
          {item && <ItemBox item={item} note={job.qty && job.qty > 1 ? `${job.qty} to build` : 'one to build'} />}
          {short > 0 && (
            <p class="callout callout--red job-callout">
              <Icon name="alert" size={16} />
              <span>
                Short on {short} component{short === 1 ? '' : 's'} — order them from Inventory before the build date.
              </span>
            </p>
          )}
          <h3 class="section-label">Bill of materials {job.qty && job.qty > 1 ? `(× ${job.qty})` : ''}</h3>
          <BomList job={job} />
          <ul class="job-links" role="list">
            {install && (
              <li>
                <Link to={jobPath(install.id)}>
                  <Icon name="lift" size={14} /> For install {install.id} · {install.start ? dayTime(install.start) : 'not scheduled yet'}
                </Link>
              </li>
            )}
            {order && (
              <li>
                <Link to={`/office/dealers/?tab=orders&id=${order.id}`}>
                  <Icon name="handshake" size={14} /> For dealer order {order.id}
                  {dealer ? ` · ${dealer.name}` : ''}
                </Link>
              </li>
            )}
          </ul>
        </Card>
      );
    }
    case 'install': {
      const build = sibling('build');
      const boat = boatLine(lead);
      const slip = slipLine(lead);
      return (
        <Card title={lift ? 'The lift that went in' : 'The lift going in'}>
          {lift ? <LiftBox lift={lift} /> : item && <ItemBox item={item} note={item.stock.camdenton.onHand > 0 ? `${item.stock.camdenton.onHand} finished in the yard` : 'built to order'} />}
          <Details
            items={[
              ['Boat', boat],
              ['Slip', slip],
              ['Shop build', build ? <Link to={jobPath(build.id)}>{`${build.id} · ${jobStatusFor(build).label}`}</Link> : undefined],
            ]}
          />
          {!boat && !slip && <p class="muted small">No boat or slip details on this job — check the request or the site visit.</p>}
        </Card>
      );
    }
    case 'service':
    case 'warranty': {
      const claim = job.claimId ? d.claims.find((c) => c.id === job.claimId) : undefined;
      return (
        <Card title="The lift">
          {lift ? <LiftBox lift={lift} issue={job.issue} fee /> : <p class="muted">No lift is linked to this job. Edit the job to pick one of the customer’s lifts.</p>}
          {claim && (
            <p class="job-claim">
              <Link to={`/office/warranty/?tab=claims&id=${claim.id}`}>
                <Icon name="shield" size={14} /> Warranty claim {claim.id}
              </Link>{' '}
              <StatusBadge meta={claimStatusMeta[claim.status]} /> <span class="muted small">· {claim.part}</span>
            </p>
          )}
        </Card>
      );
    }
    case 'remote':
      return (
        <Card title="The remote and the lift">
          {item && <ItemBox item={item} note={item.publicPrice ? `${money(item.price, false)} (the price on FiberSteel’s site)` : undefined} />}
          {lift ? <LiftBox lift={lift} /> : <p class="muted small">No lift is linked to this job.</p>}
        </Card>
      );
    case 'delivery':
      return (
        <Card
          title={order ? `Dealer order ${order.id}` : 'Delivery'}
          actions={
            order ? (
              <Link class="card-link" to={`/office/dealers/?tab=orders&id=${order.id}`}>
                Open the order <Icon name="arrow-right" size={14} />
              </Link>
            ) : undefined
          }
        >
          {order ? (
            <>
              <p class="job-order__head">
                {dealer?.name} <StatusBadge meta={orderStatusMeta[order.status]} />
              </p>
              <ul class="job-order" role="list">
                {order.lines.map((l, i) => (
                  <li key={i}>
                    <span>
                      {l.qty} × {itemOf(d, l.itemId)?.name ?? l.itemId}
                    </span>
                    <span class="tabular">{lineValue(l.qty, l.rate)}</span>
                  </li>
                ))}
              </ul>
              <Details
                items={[
                  ['How it goes', order.ship === 'freight' ? 'Freight carrier picks it up' : order.ship === 'pickup' ? 'The dealer picks it up' : 'FiberSteel delivers it'],
                  ['Promised to ship', order.shipOn ? shortDate(order.shipOn, true) : undefined],
                  ['Shipped', order.shippedOn ? shortDate(order.shippedOn, true) : undefined],
                ]}
              />
            </>
          ) : (
            <p class="muted">{item ? `Delivering ${item.name}.` : 'No dealer order linked.'}</p>
          )}
        </Card>
      );
    case 'site-visit':
    default: {
      const boat = boatLine(lead);
      const slip = slipLine(lead);
      return (
        <Card title="What to look at">
          <Details
            items={[
              ['Boat', boat],
              ['Slip (as they described it)', slip],
              ['Lift they’re considering', item?.name],
            ]}
          />
          {!boat && !slip && !item && <p class="muted small">Measure the slip and confirm the boat — the checklist below has the steps.</p>}
          {lead && (
            <p class="job-claim">
              <Link to={`/office/inbox/?id=${lead.id}`}>
                <Icon name="inbox" size={14} /> Request {lead.id}
              </Link>
            </p>
          )}
        </Card>
      );
    }
  }
}

export function JobDetail({ id }: { id: string }) {
  const d = db.value;
  const job = d.jobs.find((j) => j.id === id);
  const [dialog, setDialog] = useState<'hold' | 'complete' | 'cancel' | null>(null);
  const backTo = `/office/jobs/?view=${ui.value.jobsView}`;

  if (!job) {
    return (
      <>
        <Link to={backTo} class="back-link">
          <Icon name="arrow-left" size={16} /> Jobs
        </Link>
        <EmptyState icon="clipboard" title="Job not found">
          {id} isn’t in this demo’s data — it may have been reset.
        </EmptyState>
      </>
    );
  }

  const c = customerOf(d, job.customerId);
  const type = jobTypeMeta[job.type];
  const crew = job.crew.map((sid) => staffOf(d, sid)!).filter(Boolean);
  const done = job.checklist.filter((x) => x.done).length;
  const actualMins = job.startedAt && job.completedAt ? diffMinutes(job.completedAt, job.startedAt) : undefined;
  const lead = job.leadId ? d.leads.find((l) => l.id === job.leadId) : undefined;
  const invoice = job.invoiceId ? d.invoices.find((i) => i.id === job.invoiceId) : undefined;
  const estimate = d.invoices.find((i) => i.kind === 'estimate' && (i.id === job.estimateId || (lead && i.id === lead.estimateId)));
  const claim = job.claimId ? d.claims.find((cl) => cl.id === job.claimId) : undefined;
  const callbackOf = job.callbackOf ? d.jobs.find((j) => j.id === job.callbackOf) : undefined;
  const close = closeOutAction(job);
  const schedule = () => openDialog({ kind: 'job', jobId: job.id });
  const where = jobWhere(d, job);
  const finished = job.status === 'completed' || job.status === 'closed';

  // Status-aware actions: [primary, ...secondary], plus a menu for the rest
  const actions: { label: string; icon: IconName; run: () => void; primary?: boolean }[] = [];
  const more: (MenuItem | 'divider')[] = [];
  switch (job.status) {
    case 'requested':
      actions.push({ label: 'Schedule', icon: 'calendar', run: schedule, primary: true }, { label: 'Put on hold', icon: 'clock', run: () => setDialog('hold') });
      break;
    case 'scheduled':
      actions.push(
        {
          label: job.type === 'build' ? 'Start the build' : 'Start job',
          icon: 'play',
          primary: true,
          run: () => {
            setJobStatus(job.id, 'in-progress');
            toast(`${job.id} started`);
          },
        },
        { label: 'Reschedule', icon: 'calendar', run: schedule },
      );
      more.push({ label: 'Put on hold', icon: 'clock', onSelect: () => setDialog('hold') }, { label: 'Mark complete…', icon: 'check', onSelect: () => setDialog('complete') });
      break;
    case 'in-progress':
      actions.push({ label: job.type === 'build' ? 'Mark built' : 'Mark complete', icon: 'check', primary: true, run: () => setDialog('complete') }, { label: 'Put on hold', icon: 'clock', run: () => setDialog('hold') });
      more.push({ label: 'Reschedule', icon: 'calendar', onSelect: schedule });
      break;
    case 'on-hold':
      actions.push(
        {
          label: 'Resume',
          icon: 'play',
          primary: true,
          run: () => {
            setJobStatus(job.id, job.start ? 'scheduled' : 'requested');
            toast(`${job.id} is back on ${job.start ? 'the schedule' : 'the scheduling list'}`);
          },
        },
        { label: job.start ? 'Reschedule' : 'Schedule', icon: 'calendar', run: schedule },
      );
      break;
    case 'completed':
      actions.push({ label: close.label, icon: close.icon, primary: true, run: close.run });
      if (job.type === 'site-visit')
        more.push({
          label: 'Close job',
          icon: 'check-circle',
          onSelect: () => {
            setJobStatus(job.id, 'closed');
            toast(`${job.id} closed`);
          },
        });
      break;
    case 'closed':
      if (invoice) actions.push({ label: `View ${invoice.id}`, icon: 'receipt', primary: true, run: () => navigate(`/office/accounting/?tab=invoices&id=${invoice.id}`) });
      break;
    case 'cancelled':
      actions.push({
        label: 'Reopen',
        icon: 'undo',
        primary: true,
        run: () => {
          setJobStatus(job.id, 'requested');
          toast(`${job.id} reopened`);
        },
      });
      break;
  }
  // A finished install: show it in "Lifts we've installed" (Website → Installs), when the showcase is on and this profile can post
  const showcase = db.value.website.showcase !== false;
  const post = Object.values(db.value.website.installs).find((p) => p.jobId === job.id);
  if (job.type === 'install' && finished && can('website') && showcase) {
    more.push({
      label: post ? 'Open its install post' : 'Post it on the website',
      icon: 'camera',
      onSelect: () => navigate(post ? `/office/website/?tab=installs&install=${post.id}` : `/office/website/?tab=installs&job=${job.id}`),
    });
  }
  if (job.status !== 'closed' && job.status !== 'cancelled') {
    more.push({ label: 'Edit job details', icon: 'edit', onSelect: schedule });
    more.push('divider', { label: 'Cancel job', icon: 'x-circle', danger: true, onSelect: () => setDialog('cancel') });
  }

  return (
    <div class="job-detail">
      <Link to={backTo} class="back-link">
        <Icon name="arrow-left" size={16} /> Jobs & schedule
      </Link>
      <PageHeader
        eyebrow={
          <span class="row job-detail__badges">
            <span>{job.id}</span>
            <StatusBadge meta={type} />
            <StatusBadge meta={jobStatusFor(job)} />
            {job.priority === 'high' && (
              <Badge tone="red" icon="alert">
                High priority
              </Badge>
            )}
          </span>
        }
        title={job.title}
        description={
          <>
            {c ? (
              <Link to={`/office/customers/?id=${c.id}`} class="job-detail__cust">
                {c.name}
              </Link>
            ) : (
              'Unknown customer'
            )}
            {where ? ` · ${where}` : ''}
            {job.start ? ` · ${dayTime(job.start)}` : ' · Not scheduled yet'}
          </>
        }
        actions={
          <>
            {actions.map((a) => (
              <Button key={a.label} variant={a.primary ? 'primary' : 'secondary'} icon={a.icon} onClick={a.run}>
                {a.label}
              </Button>
            ))}
            {more.length > 0 && <Menu label="More actions" items={more} variant="secondary" />}
          </>
        }
      />

      {job.status === 'on-hold' && job.holdReason && (
        <div class="callout callout--amber job-detail__callout">
          <Icon name="alert" size={18} />
          <div>
            <p class="callout__title">On hold</p>
            <p class="callout__text">{job.holdReason}</p>
          </div>
        </div>
      )}
      {job.status === 'completed' && (
        <div class="callout callout--green job-detail__callout">
          <Icon name="check-circle" size={18} />
          <div>
            <p class="callout__title">
              {job.type === 'build' ? 'Built' : 'Work complete'}
              {job.completedAt ? ` — ${dayTime(job.completedAt)}` : ''}
            </p>
            <p class="callout__text">
              {job.type === 'site-visit'
                ? 'Next step: write the quote from what was measured.'
                : job.type === 'build'
                  ? job.dealerOrderId
                    ? 'The lift is in stock for the dealer order, which is billed when it ships. Close the job when you’re done with it.'
                    : 'The lift is in stock for its install, which is where it’s billed. Close the job when you’re done with it.'
                  : job.type === 'delivery' && job.dealerOrderId
                    ? 'The order has gone out and the dealer has been invoiced on the order. Close the job.'
                    : job.type === 'warranty'
                      ? 'The part is covered. Bill the owner the service call and labor — creating the invoice closes the job.'
                      : 'Ready to bill. Creating the invoice closes the job.'}
            </p>
          </div>
        </div>
      )}
      {job.type === 'install' && finished && showcase && !post && can('website') && (
        <div class="callout callout--blue job-detail__callout">
          <Icon name="camera" size={18} />
          <div>
            <p class="callout__title">Show it off on the website?</p>
            <p class="callout__text">
              With the owner’s OK, add this install to “Lifts we’ve installed” — the town only, never the street.{' '}
              <Link to={`/office/website/?tab=installs&job=${job.id}`}>Post it on the website</Link>
            </p>
          </div>
        </div>
      )}

      <div class="job-grid">
        <div class="job-main">
          <Card title={job.type === 'build' ? 'Build notes' : 'Scope of work'}>
            {job.description ? <p class="job-desc">{job.description}</p> : <p class="muted">No description yet.</p>}
            {job.issue && (
              <p class="job-issue">
                <Icon name="wrench" size={14} /> Reported problem: <strong>{job.issue}</strong>
              </p>
            )}
            {callbackOf && (
              <p class="job-issue">
                <Icon name="undo" size={14} /> Return visit for <Link to={jobPath(callbackOf.id)}>{callbackOf.id}</Link> ({callbackOf.completedAt ? shortDate(callbackOf.completedAt) : 'earlier visit'})
              </p>
            )}
          </Card>

          <TypePanel job={job} />

          <Card title="Checklist" subtitle={`${done} of ${job.checklist.length} done`}>
            <Meter value={done} max={job.checklist.length || 1} tone={done === job.checklist.length ? 'green' : 'accent'} label="Checklist progress" />
            <ul class="checklist-items" role="list">
              {job.checklist.map((item) =>
                job.status === 'closed' || job.status === 'cancelled' ? (
                  <li key={item.id} class={`checklist-ro${item.done ? ' is-done' : ''}`}>
                    <Icon name={item.done ? 'check-circle' : 'minus'} size={16} />
                    <span>{item.label}</span>
                    <span class="sr-only">{item.done ? '(done)' : '(not done)'}</span>
                  </li>
                ) : (
                  <li key={item.id}>
                    <Checkbox checked={item.done} onChange={() => toggleChecklistItem(job.id, item.id)} class={item.done ? 'is-done' : undefined}>
                      {item.label}
                    </Checkbox>
                  </li>
                ),
              )}
            </ul>
            {!finished && job.status !== 'cancelled' && <p class="muted small job-finish-note">When it’s done: {finishNotes[job.type].charAt(0).toLowerCase() + finishNotes[job.type].slice(1)}</p>}
          </Card>

          {(job.parts.length > 0 || (job.type !== 'site-visit' && !(job.type === 'delivery' && job.dealerOrderId))) && <Parts job={job} />}
          <Notes job={job} />
        </div>

        <div class="job-side">
          <Card title="Details">
            <Details
              items={[
                ['When', job.start ? `${dayTime(job.start)} – ${time(addMinutes(job.start, Math.round(job.hours * 60)))}` : 'Not scheduled'],
                [
                  'Crew',
                  crew.length ? (
                    <span class="crew-list">
                      {crew.map((p) => (
                        <span key={p.id} class="crew-list__item">
                          <Avatar person={p} size={22} /> {p.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span class="muted">Not assigned</span>
                  ),
                ],
                [job.type === 'build' ? 'Estimated shop time' : 'Estimated time', hours(job.hours)],
                [job.type === 'build' ? 'Time in the shop' : 'Time on site', actualMins !== undefined ? `${duration(actualMins)}${job.startedAt ? ` (started ${time(job.startedAt)})` : ''}` : job.startedAt ? `Started ${time(job.startedAt)}` : undefined],
                ['Expected value', job.value ? money(job.value, false) : undefined],
                ['Created', relative(job.createdAt)],
              ]}
            />
            {(lead || estimate || invoice || claim) && (
              <ul class="job-links" role="list">
                {lead && (
                  <li>
                    <Link to={`/office/inbox/?id=${lead.id}`}>
                      <Icon name="inbox" size={14} /> Request {lead.id}
                    </Link>
                  </li>
                )}
                {estimate && (
                  <li>
                    <Link to={`/office/accounting/?tab=estimates&id=${estimate.id}`}>
                      <Icon name="file" size={14} /> Quote {estimate.id}
                    </Link>
                  </li>
                )}
                {invoice && (
                  <li>
                    <Link to={`/office/accounting/?tab=invoices&id=${invoice.id}`}>
                      <Icon name="receipt" size={14} /> Invoice {invoice.id}
                    </Link>
                  </li>
                )}
                {claim && (
                  <li>
                    <Link to={`/office/warranty/?tab=claims&id=${claim.id}`}>
                      <Icon name="shield" size={14} /> Warranty claim {claim.id}
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Card>

          {c && (
            <Card
              title={job.type === 'build' ? 'Built for' : c.lake ? 'Customer & dock' : 'Customer'}
              actions={
                <Link class="card-link" to={`/office/customers/?id=${c.id}`}>
                  Profile <Icon name="arrow-right" size={14} />
                </Link>
              }
            >
              <p class="site__name">{c.name}</p>
              {c.contact && <p class="muted small">Contact: {c.contact}</p>}
              {job.type !== 'build' && (c.lake || job.location) && where && <p class="site__where">{where}</p>}
              {c.address.street && <p class="muted">{address(c.address)}</p>}
              <div class="site__actions">
                {job.type !== 'build' && c.address.street && (
                  <a class="btn btn--secondary btn--sm" href={mapsUrl(c.address)} target="_blank" rel="noopener">
                    <Icon name="map" size={16} /> Directions
                  </a>
                )}
                {c.phone && (
                  <a class="btn btn--secondary btn--sm" href={telHref(c.phone)}>
                    <Icon name="phone" size={16} /> {phone(c.phone)}
                  </a>
                )}
                {c.email && (
                  <a class="btn btn--ghost btn--sm" href={`mailto:${c.email}`}>
                    <Icon name="mail" size={16} /> Email
                  </a>
                )}
              </div>
            </Card>
          )}

          {needsSignature(job) && (
            <Card title={c?.kind === 'owner' ? 'Owner sign-off' : 'Sign-off'}>
              {job.signature ? (
                <div class="signoff">
                  {job.signature.image && <img class="signoff__img" src={job.signature.image} alt={`Signature of ${job.signature.name}`} />}
                  <p>
                    Signed by <strong>{job.signature.name}</strong>
                  </p>
                  <p class="muted small">{dayTime(job.signature.at)}</p>
                </div>
              ) : (
                <p class="muted">{finished ? 'No signature recorded.' : job.type === 'delivery' ? 'Whoever takes the lift signs on the crew’s phone at the hand-off.' : 'The owner signs on the crew’s phone when the work is done.'}</p>
              )}
              {(job.photos ?? 0) > 0 && (
                <p class="muted small signoff__photos">
                  <Icon name="camera" size={14} /> {job.photos} photo{job.photos === 1 ? '' : 's'} from the field
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {dialog === 'hold' && <HoldDialog job={job} onClose={() => setDialog(null)} />}
      {dialog === 'complete' && <CompleteDialog job={job} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && (
        <Confirm
          title={`Cancel ${job.id}?`}
          confirmLabel="Cancel job"
          danger
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setJobStatus(job.id, 'cancelled');
            toast(`${job.id} cancelled — reserved stock was released`);
          }}
        >
          <p>The job comes off the schedule and anything reserved for it goes back into stock. You can reopen it later.</p>
        </Confirm>
      )}
    </div>
  );
}
