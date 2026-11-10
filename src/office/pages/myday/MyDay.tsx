/**
 * My day — the crew's phone view: today's stops on the water in order, then one stop at a time with the checklist,
 * parts, photos, notes and the owner's signature. Shop profiles get the week's builds and what they're short of.
 */
import { useState } from 'preact/hooks';
import { addJobNote, addJobPart, completeJob, setJobStatus, toggleChecklistItem } from '../../actions';
import type { Job, Staff } from '../../data/types';
import { addDays, addMinutes, diffMinutes, today } from '../../lib/dates';
import { dayLabel, duration, longDate, mapsUrl, phone, plural, shortDate, telHref, time } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, itemLabel, itemOf, jobsOn, liftOf, staffOf, warrantyState } from '../../selectors';
import { db, me } from '../../store';
import { toast } from '../../toast';
import { Avatar, Badge, Button, Card, Checkbox, cx, EmptyState, Field, Link, LinkButton, Meter, PageHeader, Segmented } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { jobTypeMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { finishNotes, needsSignature } from '../jobs/dialogs';
import { addJobPhoto, defaultTimes, jobPath, jobWhere } from '../jobs/helpers';
import { boatLine, ItemBox, jobStatusFor, LiftBox, slipLine } from '../jobs/parts';
import { ShopWeek } from './ShopWeek';
import { SignaturePad } from './SignaturePad';

const stopPath = (id: string) => `/office/my-day/?id=${id}`;
const endOf = (j: Job) => addMinutes(j.start!, Math.round(j.hours * 60));
const isDone = (j: Job) => j.status === 'completed' || j.status === 'closed';
const smsHref = (p: string) => `sms:+1${p.replace(/\D/g, '').slice(-10)}`;
const doneMeta = { label: 'Done', tone: 'green' as const, icon: 'check-circle' as const };
const stopStatus = (j: Job) => (isDone(j) ? doneMeta : jobStatusFor(j));

function myStops(day: string, user: Staff) {
  return db.value.jobs
    .filter((j) => j.start && j.start.slice(0, 10) === day && j.crew.includes(user.id) && j.status !== 'cancelled')
    .sort((a, b) => (a.start! < b.start! ? -1 : 1));
}

export default function MyDay() {
  const id = param('id');
  return id ? <Stop key={id} id={id} /> : <DayList />;
}

/* ---------- The day ---------- */

/** One line about what's at the stop: the lift that's there, or the one going in */
function StopWhat({ job }: { job: Job }) {
  const d = db.value;
  const lift = liftOf(d, job.liftId);
  const item = itemOf(d, job.itemId);
  if (lift) {
    return (
      <p class="stop__unit">
        {lift.model} <span class="muted">· serial {lift.serial}</span> <StatusBadge meta={warrantyMeta[warrantyState(lift)]} />
      </p>
    );
  }
  if (item && job.type !== 'site-visit') {
    return (
      <p class="stop__unit">
        {job.qty && job.qty > 1 ? `${job.qty} × ` : ''}
        {item.name}
      </p>
    );
  }
  return null;
}

function StopCard({ job, index }: { job: Job; index: number }) {
  const d = db.value;
  const c = customerOf(d, job.customerId);
  const type = jobTypeMeta[job.type];
  const bring = job.parts.filter((p) => p.status === 'reserved');
  const done = job.checklist.filter((x) => x.done).length;
  const cta = job.status === 'scheduled' ? 'Start' : job.status === 'in-progress' ? 'Continue' : 'View';
  const where = jobWhere(d, job);
  const inShop = job.type === 'build';
  return (
    <li class={cx('stop', `jt--${type.tone}`, isDone(job) && 'is-done', job.status === 'in-progress' && 'is-active')}>
      <div class="stop__rail" aria-hidden="true">
        <span class="stop__num">{isDone(job) ? <Icon name="check" size={14} stroke={2.6} /> : index + 1}</span>
      </div>
      <article class="stop__card" aria-labelledby={`stop-${job.id}`}>
        <div class="stop__head">
          <p class="stop__time">
            {time(job.start!)} – {time(endOf(job))}
          </p>
          <StatusBadge meta={stopStatus(job)} />
        </div>
        <h2 class="stop__title" id={`stop-${job.id}`}>
          <Link to={stopPath(job.id)}>{inShop ? job.title : (c?.name ?? 'Customer')}</Link>
        </h2>
        {!inShop && (
          <p class="stop__what">
            <Icon name={type.icon} size={14} /> {job.title}
          </p>
        )}
        {where && (
          <p class="stop__addr">
            <Icon name={inShop ? 'hardhat' : 'pin'} size={14} /> {where}
          </p>
        )}
        <StopWhat job={job} />
        {job.description && <p class="stop__notes">{job.description}</p>}
        {bring.length > 0 && !isDone(job) && (
          <p class="stop__bring">
            <Icon name="box" size={14} /> {inShop ? 'Pull from stock' : 'On the truck'}: {bring.slice(0, 6).map((p) => `${p.qty} × ${itemOf(d, p.itemId)?.name ?? p.itemId}`).join(', ')}
            {bring.length > 6 ? `, and ${plural(bring.length - 6, 'more part')}` : ''}
          </p>
        )}
        {job.status === 'in-progress' && (
          <div class="stop__progress">
            <Meter value={done} max={job.checklist.length || 1} tone="accent" label="Checklist progress" />
            <span class="muted small">
              {done} of {job.checklist.length} checklist items
            </span>
          </div>
        )}
        <div class="stop__actions">
          {!inShop && c?.phone && (
            <a class="btn btn--secondary" href={telHref(c.phone)} aria-label={`Call ${c.name}`}>
              <Icon name="phone" size={18} /> <span>Call</span>
            </a>
          )}
          {!inShop && c?.address.street && (
            <a class="btn btn--secondary" href={mapsUrl(c.address)} target="_blank" rel="noopener" aria-label={`Directions to ${c.address.street}`}>
              <Icon name="map" size={18} /> <span>Directions</span>
            </a>
          )}
          <LinkButton to={stopPath(job.id)} variant={isDone(job) ? 'secondary' : 'primary'} iconRight="arrow-right" aria-label={`${cta}: ${inShop ? job.title : (c?.name ?? job.title)}`}>
            {cta}
          </LinkButton>
        </div>
      </article>
    </li>
  );
}

function TeamDay({ day }: { day: string }) {
  const d = db.value;
  const jobs = jobsOn(d, day, 'all').filter((j) => j.crew.length);
  const byPerson = new Map<string, Job[]>();
  for (const j of jobs) for (const id of j.crew) byPerson.set(id, [...(byPerson.get(id) ?? []), j]);
  const people = [...byPerson.keys()].map((id) => staffOf(d, id)!).filter(Boolean).sort((a, b) => Number(!!b.tech) - Number(!!a.tech) || a.name.localeCompare(b.name));
  const when = dayLabel(day).toLowerCase() === 'today' ? 'today' : `on ${dayLabel(day)}`;
  if (!jobs.length) {
    return (
      <EmptyState icon="calendar" title={`No one is scheduled ${when}`}>
        Jobs show up here once they’re on the schedule.
      </EmptyState>
    );
  }
  return (
    <>
      <div class="callout callout--blue myday__team-note">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">You don’t have any stops {when}</p>
          <p class="callout__text">Here’s the whole team’s day instead. Crew members see only their own stops on this page — sign in as Jesse (install crew) to try it, or Travis for the shop.</p>
        </div>
      </div>
      <div class="team-day">
        {people.map((p) => (
          <Card
            key={p.id}
            level={2}
            title={
              <span class="team-day__who">
                <Avatar person={p} size={28} /> {p.name}
              </span>
            }
            subtitle={`${p.title} · ${plural(byPerson.get(p.id)!.length, 'stop')}`}
            flush
          >
            <ul class="team-day__list" role="list">
              {byPerson.get(p.id)!.map((j) => {
                const c = customerOf(d, j.customerId);
                return (
                  <li key={j.id}>
                    <Link to={jobPath(j.id)} class={cx('team-day__row', `jt--${jobTypeMeta[j.type].tone}`)}>
                      <span class="team-day__time">{time(j.start!)}</span>
                      <span class="team-day__main">
                        <span class="team-day__title">{j.type === 'build' ? j.title : c?.name}</span>
                        <span class="muted small">
                          {jobTypeMeta[j.type].label} · {jobWhere(d, j)}
                        </span>
                      </span>
                      <StatusBadge meta={jobStatusFor(j)} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

function DayList() {
  const user = me.value!;
  const t = today();
  const raw = param('day');
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : t;
  const stops = myStops(day, user);
  const doneCount = stops.filter(isDone).length;
  const next = stops.find((j) => !isDone(j));
  const tomorrow = day === t ? myStops(addDays(t, 1), user) : [];
  const days = [addDays(t, -1), t, addDays(t, 1)];
  const dayOptions = days.map((k, i) => ({ key: k, label: ['Yesterday', 'Today', 'Tomorrow'][i] }));
  const totalHours = stops.reduce((s, j) => s + j.hours, 0);
  const shop = user.role === 'shop';
  const crewMember = user.role === 'crew' || shop;
  const label = (j: Job) => (j.type === 'build' ? j.title : (customerOf(db.value, j.customerId)?.name ?? j.title));

  return (
    <div class="myday">
      <PageHeader
        eyebrow={longDate(day)}
        title="My day"
        description={
          stops.length
            ? `${plural(stops.length, shop ? 'build' : 'stop')} · first at ${time(stops[0].start!)} · about ${Math.round(totalHours * 10) / 10} h of work`
            : `${user.name.split(' ')[0]}, you have no ${shop ? 'builds' : 'stops'} ${day === t ? 'today' : `on ${dayLabel(day)}`}.`
        }
        actions={
          days.includes(day) ? (
            <Segmented label="Day" size="sm" items={dayOptions} value={day} onChange={(k) => setParams({ day: k === t ? undefined : k }, { replace: true })} />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setParams({ day: undefined }, { replace: true })}>
              Back to today
            </Button>
          )
        }
      />

      {stops.length > 0 && (
        <div class="myday__summary card">
          <div class="myday__summary-text">
            <p class="myday__summary-title">{doneCount === stops.length ? 'All done — nice work.' : next ? `Next: ${time(next.start!)} · ${label(next)}` : ''}</p>
            <p class="muted small">
              {doneCount} of {plural(stops.length, shop ? 'build' : 'stop')} finished
            </p>
          </div>
          <Meter value={doneCount} max={stops.length} tone="green" label={shop ? 'Builds finished' : 'Stops finished'} />
        </div>
      )}

      {stops.length > 0 ? (
        <ol class="stops" role="list">
          {stops.map((j, i) => (
            <StopCard key={j.id} job={j} index={i} />
          ))}
        </ol>
      ) : shop ? (
        <p class="callout callout--blue myday__team-note">
          <Icon name="info" size={18} />
          <span>No builds on your schedule {day === t ? 'today' : `on ${dayLabel(day)}`} — the whole shop’s week is below.</span>
        </p>
      ) : crewMember ? (
        <EmptyState icon="sun" title={`No stops ${day === t ? 'today' : `on ${dayLabel(day)}`}`}>
          When the office schedules you, your stops show up here in order.
        </EmptyState>
      ) : (
        <TeamDay day={day} />
      )}

      {shop && <ShopWeek day={day} />}

      {!shop && day === t && stops.length > 0 && (
        <section class="myday__tomorrow" aria-labelledby="tomorrow-title">
          <h2 id="tomorrow-title" class="section-label">
            Tomorrow · {shortDate(addDays(t, 1))}
          </h2>
          {tomorrow.length ? (
            <ul class="tomorrow" role="list">
              {tomorrow.map((j) => (
                <li key={j.id}>
                  <Link to={stopPath(j.id)} class="tomorrow__row">
                    <span class="tomorrow__time">{time(j.start!)}</span>
                    <span class="tomorrow__main">
                      <span class="tomorrow__title">{label(j)}</span>
                      <span class="muted small">
                        {jobTypeMeta[j.type].label} · {jobWhere(db.value, j)}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Nothing on the schedule yet.</p>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- One stop ---------- */

function Stop({ id }: { id: string }) {
  const d = db.value;
  const user = me.value!;
  const job = d.jobs.find((j) => j.id === id);
  const c = customerOf(d, job?.customerId);
  const [arriveEdit, setArrive] = useState<string | null>(null);
  const [finishEdit, setFinishT] = useState<string | null>(null);
  const [signer, setSigner] = useState(c?.contact ?? c?.name.split(' & ')[0] ?? '');
  const [signature, setSignature] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  const [note, setNote] = useState('');
  const [justDone, setJustDone] = useState(false);

  if (!job) {
    return (
      <div class="myday">
        <Link to="/office/my-day/" class="back-link">
          <Icon name="arrow-left" size={16} /> My day
        </Link>
        <EmptyState icon="clipboard" title="Stop not found">
          {id} isn’t in this demo’s data.
        </EmptyState>
      </div>
    );
  }

  const lift = liftOf(d, job.liftId);
  const item = itemOf(d, job.itemId);
  const lead = job.leadId ? d.leads.find((l) => l.id === job.leadId) : undefined;
  const type = jobTypeMeta[job.type];
  const inShop = job.type === 'build';
  const signs = needsSignature(job);
  const checked = job.checklist.filter((x) => x.done).length;
  // Defaults follow the job (arrival = when it was started) until someone edits the times
  const times = defaultTimes(job);
  const arrive = arriveEdit ?? times.arrivedAt.slice(11, 16);
  const finishT = finishEdit ?? times.finishedAt.slice(11, 16);
  const baseDay = times.arrivedAt.slice(0, 10);
  const arrivedAt = `${baseDay}T${arrive}`;
  // Time-only inputs: a finish earlier than the arrival means the work ran past midnight
  const finishedAt = finishT < arrive ? addDays(`${baseDay}T${finishT}`, 1) : `${baseDay}T${finishT}`;
  const mins = arrive && finishT ? diffMinutes(finishedAt, arrivedAt) : 0;
  const signed = !signs || (typed ? signer.trim().length > 1 : !!signature);
  const canFinish = mins > 0 && (!signs || signer.trim().length > 1) && signed;
  const nextStop = myStops(job.start?.slice(0, 10) ?? today(), user).find((j) => j.id !== job.id && !isDone(j) && (j.start ?? '') > (job.start ?? ''));
  const onMyCrew = job.crew.includes(user.id);
  const where = jobWhere(d, job);
  const name = inShop ? job.title : (c?.name ?? 'Customer');
  const boat = boatLine(lead);
  const slip = slipLine(lead);

  const complete = () => {
    if (!canFinish) return;
    completeJob(job.id, { arrivedAt, finishedAt, note: note.trim() || undefined, signature: signs ? { name: signer.trim(), image: typed ? undefined : (signature ?? undefined) } : undefined });
    setJustDone(true);
    window.scrollTo({ top: 0 });
  };

  if (justDone) {
    return (
      <div class="myday">
        <div class="done-panel card" role="status">
          <span class="done-panel__icon">
            <Icon name="check" size={30} stroke={2.6} />
          </span>
          <h1 class="done-panel__title" data-page-title tabIndex={-1}>
            {inShop ? 'Built' : 'Job complete'}
          </h1>
          <p class="muted">
            {inShop ? `${name} is marked built at ${time(finishedAt)} and is in stock.` : signs ? `${c?.name} signed off at ${time(finishedAt)}.` : `Finished at ${time(finishedAt)}.`} {finishNotes[job.type]}
          </p>
          <div class="done-panel__actions">
            {nextStop ? (
              <LinkButton to={stopPath(nextStop.id)} variant="primary" iconRight="arrow-right">
                Next: {time(nextStop.start!)} · {nextStop.type === 'build' ? nextStop.title : customerOf(d, nextStop.customerId)?.name}
              </LinkButton>
            ) : null}
            <LinkButton to="/office/my-day/" variant={nextStop ? 'secondary' : 'primary'}>
              Back to my day
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  const status = job.status;

  return (
    <div class="myday myday--stop">
      <Link to="/office/my-day/" class="back-link">
        <Icon name="arrow-left" size={16} /> My day
      </Link>

      <header class={cx('stop-hero card', `jt--${type.tone}`)}>
        <div class="stop-hero__top">
          <span class="stop-hero__time">{job.start ? `${dayLabel(job.start)} · ${time(job.start)} – ${time(endOf(job))}` : 'Not scheduled'}</span>
          <StatusBadge meta={stopStatus(job)} />
        </div>
        <h1 class="stop-hero__name" data-page-title tabIndex={-1}>
          {name}
        </h1>
        <p class="stop-hero__what">
          <Icon name={type.icon} size={15} /> {inShop ? `${type.label}${c ? ` for ${c.name}` : ''}` : job.title} <span class="muted">· {job.id}</span>
        </p>
        {where && (
          <p class="stop-hero__addr">
            <Icon name={inShop ? 'hardhat' : 'pin'} size={15} /> {where}
            {!inShop && c?.address.street ? ` · ${c.address.street}, ${c.address.city}` : ''}
          </p>
        )}
        {!inShop && c && (
          <div class="stop-hero__actions">
            {c.phone && (
              <a class="btn btn--secondary" href={telHref(c.phone)}>
                <Icon name="phone" size={18} /> <span>Call</span>
              </a>
            )}
            {c.phone && (
              <a class="btn btn--secondary" href={smsHref(c.phone)}>
                <Icon name="message" size={18} /> <span>Text</span>
              </a>
            )}
            {c.address.street && (
              <a class="btn btn--secondary" href={mapsUrl(c.address)} target="_blank" rel="noopener">
                <Icon name="map" size={18} /> <span>Directions</span>
              </a>
            )}
          </div>
        )}
        {!inShop && c?.phone && <p class="muted small stop-hero__phone">{phone(c.phone)}</p>}
      </header>

      {!onMyCrew && (
        <p class="callout callout--blue">
          <Icon name="info" size={18} />
          <span>You’re not on this job’s crew — you can still follow along.</span>
        </p>
      )}

      {status === 'scheduled' && (
        <div class="start-panel">
          <Button
            variant="primary"
            icon="play"
            class="btn--xl"
            onClick={() => {
              setJobStatus(job.id, 'in-progress');
              toast(inShop ? 'Build started — the office can see it’s underway' : 'Job started — the office can see you’re on site');
            }}
          >
            {inShop ? 'Start the build' : 'I’m here — start job'}
          </Button>
          <p class="muted small">{inShop ? 'Starting records the time, so the shop report shows real build hours.' : `Starting the job records your arrival time. You can adjust it when ${signs ? 'the owner signs' : 'you finish'}.`}</p>
        </div>
      )}

      <Card title={inShop ? 'What you’re building' : 'What you’re working on'} level={2}>
        {lift ? <LiftBox lift={lift} issue={job.issue} /> : item && <ItemBox item={item} note={inShop ? (job.qty && job.qty > 1 ? `${job.qty} to build` : 'one to build') : job.type === 'site-visit' ? 'what they’re considering' : undefined} />}
        {(boat || slip) && (
          <p class="stop-issue">
            <Icon name="boat" size={15} /> {[boat, slip].filter(Boolean).join(' · ')}
          </p>
        )}
        {job.issue && !lift && (
          <p class="stop-issue">
            <Icon name="wrench" size={15} /> Reported: <strong>{job.issue}</strong>
          </p>
        )}
        {job.description && <p class="stop-office-notes">{job.description}</p>}
        {!lift && !item && !job.description && !boat && <p class="muted">{job.title}</p>}
      </Card>

      <Card title="Checklist" subtitle={`${checked} of ${job.checklist.length} done`} level={2}>
        <Meter value={checked} max={job.checklist.length || 1} tone={checked === job.checklist.length ? 'green' : 'accent'} label="Checklist progress" />
        <ul class="big-checks" role="list">
          {job.checklist.map((x) => (
            <li key={x.id}>
              <Checkbox checked={x.done} onChange={() => toggleChecklistItem(job.id, x.id)} class={cx('big-check', x.done && 'is-done')}>
                {x.label}
              </Checkbox>
            </li>
          ))}
        </ul>
      </Card>

      {(job.parts.length > 0 || job.type !== 'site-visit') && (
        <Card title={inShop ? 'Components' : 'Parts'} subtitle={job.parts.length ? (inShop ? 'Reserved components are used up when it’s marked built' : 'Reserved parts are marked used when you finish') : 'Nothing reserved for this job'} level={2}>
          {job.parts.length > 0 && (
            <ul class="stop-parts" role="list">
              {job.parts.map((p, i) => {
                const it = itemOf(d, p.itemId);
                return (
                  <li key={`${p.itemId}-${i}`}>
                    <span>
                      <strong>
                        {p.qty}
                        {it && it.uom !== 'ea' ? ` ${it.uom}` : ''} ×
                      </strong>{' '}
                      {it ? itemLabel(it) : p.itemId}
                    </span>
                    <Badge tone={p.status === 'used' ? 'green' : 'blue'} icon={p.status === 'used' ? 'check' : 'box'}>
                      {p.status === 'used' ? 'Used' : inShop ? 'Reserved' : 'On the truck'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {!isDone(job) && <ItemPicker label={inShop ? 'Used another component? Add it' : 'Used something else? Add a part'} placeholder="Search parts by name or SKU" onSelect={(it) => addJobPart(job.id, it.id, 1)} />}
        </Card>
      )}

      <Card title="Photos & notes" level={2}>
        <div class="photo-row">
          {Array.from({ length: job.photos ?? 0 }, (_, i) => (
            <span key={i} class="photo-tile" role="img" aria-label={`Photo ${i + 1}`}>
              <Icon name="camera" size={18} />
              <span>Photo {i + 1}</span>
            </span>
          ))}
          {!isDone(job) && (
            <button type="button" class="photo-tile photo-tile--add" onClick={() => addJobPhoto(job.id)} aria-label="Add photo (demo — adds a placeholder)">
              <Icon name="plus" size={18} />
              <span>Add photo</span>
            </button>
          )}
        </div>
        {!isDone(job) && (
          <form
            class="note-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              addJobNote(job.id, note.trim());
              setNote('');
              toast('Note saved to the job');
            }}
          >
            <label class="field__label" for="stop-note">
              Note for the office
            </label>
            <textarea id="stop-note" class="textarea" rows={3} value={note} placeholder={job.type === 'site-visit' ? 'Slip width × length, water depth, docking, roof clearance…' : 'What you found, what you did, anything to follow up'} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
            <Button type="submit" variant="secondary" icon="send" disabled={!note.trim()}>
              Save note
            </Button>
          </form>
        )}
      </Card>

      {status === 'in-progress' && (
        <Card title={signs ? 'Finish & get a signature' : inShop ? 'Mark it built' : 'Finish the visit'} subtitle={signs ? 'The owner signs on your screen' : finishNotes[job.type]} level={2} class="finish-card">
          <div class="finish-times">
            <Field label={inShop ? 'Started' : 'Arrived'}>
              <input class="input" type="time" value={arrive} onInput={(e) => setArrive((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Finished">
              <input class="input" type="time" value={finishT} aria-invalid={mins <= 0} onInput={(e) => setFinishT((e.target as HTMLInputElement).value)} />
            </Field>
          </div>
          <p class={mins > 0 ? 'muted small' : 'is-bad small'}>{mins > 0 ? `${inShop ? 'Time in the shop' : 'Time on site'}: ${duration(mins)}` : 'Finish time must be after the start.'}</p>
          {signs && (
            <>
              <Field label="Owner’s name">
                <input class="input" value={signer} autocomplete="off" onInput={(e) => setSigner((e.target as HTMLInputElement).value)} />
              </Field>
              {typed ? (
                <div class="typed-sig" aria-live="polite">
                  <span class="typed-sig__name">{signer || 'Owner’s name'}</span>
                  <span class="muted small">Signed by typing their name</span>
                </div>
              ) : (
                <SignaturePad label="Owner’s signature" onChange={setSignature} />
              )}
              <button type="button" class="link-btn finish-card__alt" onClick={() => setTyped(!typed)}>
                {typed ? 'Draw a signature instead' : 'Can’t draw? Sign by typing the name instead'}
              </button>
            </>
          )}
          <Button variant="primary" icon="check" class="btn--xl finish-card__submit" disabled={!canFinish} onClick={complete}>
            {inShop ? 'Mark built' : 'Mark job complete'}
          </Button>
          {!canFinish && <p class="muted small">{!signed ? 'Waiting for the owner’s signature.' : signs && signer.trim().length < 2 ? 'Add the owner’s name.' : 'Check the start and finish times.'}</p>}
        </Card>
      )}

      {isDone(job) && (
        <Card title={signs ? 'Signed off' : 'Finished'} level={2}>
          {job.signature ? (
            <div class="signoff">
              {job.signature.image && <img class="signoff__img" src={job.signature.image} alt={`Signature of ${job.signature.name}`} />}
              <p>
                {job.signature.name} · {time(job.signature.at)}
              </p>
            </div>
          ) : (
            <p class="muted">
              Completed {job.completedAt ? `at ${time(job.completedAt)}` : ''}
              {signs ? ' without a signature.' : '.'}
            </p>
          )}
          {job.startedAt && job.completedAt && (
            <p class="muted small">
              {inShop ? 'Time in the shop' : 'Time on site'}: {duration(diffMinutes(job.completedAt, job.startedAt))}
            </p>
          )}
        </Card>
      )}

      {(status === 'on-hold' || status === 'requested') && (
        <p class="callout callout--amber">
          <Icon name="alert" size={18} />
          <span>{status === 'on-hold' ? `On hold — ${job.holdReason ?? 'check with the office'}` : 'This job isn’t scheduled yet.'}</span>
        </p>
      )}
    </div>
  );
}
