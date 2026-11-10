/** Create or edit a job: what kind, for whom, which lift, where, when and which crew. */
import { useMemo, useState } from 'preact/hooks';
import { addJobPart, createJob, defaultHours, remoteValves, removeJobPart, scheduleJob, updateJob } from '../../actions';
import { crews } from '../../data/people';
import { issues, jobTypeLabels } from '../../data/catalog';
import type { DialogRequest } from '../../dialogs';
import type { Item, JobType } from '../../data/types';
import { addDays, now, today, weekday } from '../../lib/dates';
import { navigate } from '../../router';
import { available, covers, customerOf, itemLabel, itemOf, liftOf } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Avatar, Button, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker, ItemPicker, whereLabel } from '../../ui/pickers';
import { bookedHours, fieldStaff, firstFreeStart, jobPath, TEAMS, teamFor } from './helpers';
import { LiftBox } from './parts';

type Preset = Extract<DialogRequest, { kind: 'job' }>['preset'];

const TYPES: JobType[] = ['site-visit', 'build', 'install', 'service', 'warranty', 'delivery', 'remote'];
/** Jobs on a lift that's already at the dock */
const LIFT_TYPES: JobType[] = ['service', 'warranty', 'remote'];
/** Jobs about a lift from the catalog */
const CATALOG_TYPES: JobType[] = ['site-visit', 'build', 'install'];

const issueKeyFor = (label?: string) => (label ? Object.entries(issues).find(([, def]) => def.label === label)?.[0] : undefined);

function nextBusinessDay(day: string) {
  let d = addDays(day, 1);
  while (weekday(d) === 0) d = addDays(d, 1);
  return d;
}

export function JobDialog({ jobId, preset, onClose }: { jobId?: string; preset?: Preset; onClose: () => void }) {
  const d = db.value;
  const job = jobId ? d.jobs.find((j) => j.id === jobId) : undefined;
  const startType: JobType = job?.type ?? preset?.type ?? 'service';

  const [type, setType] = useState<JobType>(startType);
  const [customerId, setCustomerId] = useState<string | undefined>(job?.customerId ?? preset?.customerId);
  const [liftId, setLiftId] = useState<string | undefined>(job?.liftId ?? preset?.liftId);
  const [itemId, setItemId] = useState<string | undefined>(job?.itemId ?? preset?.itemId);
  const [qty, setQty] = useState<number>(job?.qty ?? 1);
  const [issueKey, setIssueKey] = useState<string | undefined>(issueKeyFor(job?.issue) ?? preset?.issueKey);
  const presetCustomer = customerOf(d, job?.customerId ?? preset?.customerId);
  const [location, setLocation] = useState(job?.location ?? preset?.location ?? (presetCustomer?.lake ? whereLabel(presetCustomer) : ''));
  const [title, setTitle] = useState(job?.title ?? preset?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? preset?.description ?? '');
  const [date, setDate] = useState(job?.start?.slice(0, 10) ?? '');
  const [timeOfDay, setTimeOfDay] = useState(job?.start?.slice(11, 16) ?? '');
  const [hrs, setHrs] = useState<number>(job?.hours ?? defaultHours(d, startType, job?.itemId ?? preset?.itemId, job?.liftId ?? preset?.liftId));
  const [hoursTouched, setHoursTouched] = useState(!!job);
  const [crew, setCrew] = useState<string[]>(job?.crew ?? []);
  const [priority, setPriority] = useState<'normal' | 'high'>(job?.priority ?? 'normal');
  const [error, setError] = useState('');

  const customer = customerOf(d, customerId);
  const lifts = customer ? d.lifts.filter((l) => l.customerId === customer.id) : [];
  const lift = liftOf(d, liftId);
  const item = itemOf(d, itemId);
  const people = useMemo(() => fieldStaff(d), [d]);
  const team = teamFor(type);
  const teams = [...TEAMS].sort((a, b) => Number(b.key === team) - Number(a.key === team));
  const needsLift = LIFT_TYPES.includes(type);
  const usesCatalog = CATALOG_TYPES.includes(type) || type === 'remote';
  const onLake = type !== 'build';
  const covered = lift && issueKey ? covers(lift, issues[issueKey].component) : undefined;

  // Keep the estimated duration in step with the job unless someone typed one
  const refreshHours = (t: JobType, item?: string, lift?: string, n = qty) => {
    if (!hoursTouched) setHrs(defaultHours(d, t, item, lift, n));
  };

  const pickCustomer = (id: string | undefined) => {
    setCustomerId(id);
    setLiftId(undefined);
    const c = customerOf(db.value, id);
    if (c?.lake) setLocation(whereLabel(c));
    else if (!c) setLocation('');
  };

  /** A remote: the Admiral system with the valves the lift's size calls for */
  const suggestRemote = (forLift = lift) => {
    if (!forLift) return;
    const valves = remoteValves(forLift.capacity);
    const id = `R-ADM${valves}`;
    if (db.value.items.some((i) => i.id === id)) setItemId(id);
  };

  const changeType = (t: JobType) => {
    setType(t);
    // Keep only what still fits the new kind of job
    if (!LIFT_TYPES.includes(t)) setLiftId(undefined);
    if (t === 'remote') {
      setItemId(undefined);
      suggestRemote();
    } else if (item?.category === 'Remotes' || !(CATALOG_TYPES.includes(t))) setItemId(t === 'delivery' ? itemId : undefined);
    refreshHours(t, t === 'remote' ? undefined : itemId, liftId);
    setError('');
  };

  const toggleCrew = (id: string) => setCrew((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  /** First day (from the chosen date, or today) when the lead person has room for the job */
  const suggestTime = () => {
    const lead = crew[0] ?? teams[0]?.ids[0];
    if (!lead) return;
    const t = today();
    let day = date && date >= t ? date : weekday(t) !== 0 && now() < `${t}T15:00` ? t : nextBusinessDay(t);
    let start = firstFreeStart(db.value, lead, day, hrs, job?.id);
    for (let i = 0; i < 12 && (start.slice(11, 16) > '16:30' || (day === t && start < now())); i++) {
      day = nextBusinessDay(day);
      start = firstFreeStart(db.value, lead, day, hrs, job?.id);
    }
    setDate(day);
    setTimeOfDay(start.slice(11, 16));
    if (!crew.length) setCrew(team === 'install' ? [...(crews.install.find((p) => p.includes(lead)) ?? [lead])] : [lead]);
    setError('');
  };

  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!customerId) return setError('Choose a customer for this job.');
    if (needsLift && type !== 'remote' && lifts.length > 0 && !liftId) return setError('Choose which of their lifts this is for.');
    if (type === 'remote' && !liftId) return setError('Choose the lift the remote goes on.');
    if ((type === 'build' || type === 'install') && !itemId) return setError(`Choose the lift to ${type === 'build' ? 'build' : 'install'}.`);
    if (type === 'remote' && !itemId) return setError('Choose the remote to fit.');
    if ((date && !timeOfDay) || (!date && timeOfDay)) return setError('Set both a date and a start time — or leave both empty to schedule later.');
    if (!(hrs > 0)) return setError('Enter how long the job should take.');
    const start = date && timeOfDay ? `${date}T${timeOfDay}` : undefined;
    const keepItem = usesCatalog || type === 'delivery' ? itemId : undefined;

    if (job) {
      const prevItem = job.itemId;
      updateJob(job.id, {
        type,
        customerId,
        liftId: needsLift ? liftId : undefined,
        itemId: keepItem,
        qty: type === 'build' ? qty : undefined,
        title: title.trim() || job.title,
        description,
        location: onLake ? location.trim() || undefined : undefined,
        issue: issueKey && (type === 'service' || type === 'warranty') ? issues[issueKey].label : job.issue,
        hours: hrs,
        priority,
      });
      // Swap the reserved lift or remote when it changes
      if ((type === 'install' || type === 'remote') && itemId && itemId !== prevItem) {
        const i = job.parts.findIndex((p) => p.itemId === prevItem && p.status === 'reserved');
        if (i >= 0) removeJobPart(job.id, i);
        addJobPart(job.id, itemId, 1);
      }
      if (start !== job.start || crew.join() !== job.crew.join()) scheduleJob(job.id, start, crew);
      toast(`${job.id} updated`);
      onClose();
      return;
    }

    const id = createJob({
      type,
      customerId,
      title: title.trim() || undefined,
      description: description.trim(),
      liftId: needsLift ? liftId : undefined,
      itemId: keepItem,
      qty: type === 'build' ? qty : undefined,
      leadId: preset?.leadId,
      dealerOrderId: preset?.dealerOrderId,
      issueKey: type === 'service' || type === 'warranty' ? issueKey : undefined,
      location: onLake ? location.trim() || undefined : undefined,
      start,
      hours: hrs,
      crew,
      priority,
      value: type === 'install' ? item?.price : undefined,
    });
    toast(`${id} created${start ? ' and scheduled' : ' — it’s in Needs scheduling'}`, { tone: 'success' });
    onClose();
    navigate(jobPath(id));
  };

  const itemLabelText = type === 'build' ? 'Lift to build' : type === 'install' ? 'Lift to install' : type === 'remote' ? 'Remote to fit' : 'Lift they’re considering';

  return (
    <Dialog
      title={job ? `Edit ${job.id}` : 'New job'}
      description={job ? job.title : preset?.leadId ? `From request ${preset.leadId}` : 'Book a site visit, a shop build, an install, a service or warranty call, a delivery or a remote install.'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {error && (
            <p class="job-form__error" role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={job ? 'check' : 'plus'} onClick={() => submit()}>
            {job ? 'Save changes' : date && timeOfDay ? 'Create & schedule' : 'Create job'}
          </Button>
        </>
      }
    >
      <form class="job-form" onSubmit={submit}>
        <div class="form-grid">
          <Field label="Type of job">
            <select class="select" value={type} onChange={(e) => changeType((e.target as HTMLSelectElement).value as JobType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {jobTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          {type === 'build' ? (
            <Field label="How many">
              <input
                class="input"
                type="number"
                min={1}
                max={20}
                step={1}
                value={qty}
                onInput={(e) => {
                  const n = Math.max(1, Math.min(20, Math.round(Number((e.target as HTMLInputElement).value)) || 1));
                  setQty(n);
                  refreshHours(type, itemId, liftId, n);
                }}
              />
            </Field>
          ) : (
            <Field label="Priority">
              <select class="select" value={priority} onChange={(e) => setPriority((e.target as HTMLSelectElement).value as 'normal' | 'high')}>
                <option value="normal">Normal</option>
                <option value="high">High — a boat that can’t come out, storm damage, a promised date</option>
              </select>
            </Field>
          )}

          <div class="span-2">
            <CustomerPicker value={customerId} onChange={(id) => (pickCustomer(id), setError(''))} autoFocus={!customerId} label={type === 'build' ? 'Built for' : 'Customer'} />
          </div>

          {needsLift && customer && (
            <Field label={type === 'remote' ? 'Lift the remote goes on' : 'Which lift'} class="span-2" hint={lifts.length ? undefined : 'No lifts on this customer’s record yet — add it on the customer page.'}>
              <select
                class="select"
                value={liftId ?? ''}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value || undefined;
                  setLiftId(v);
                  refreshHours(type, itemId, v);
                  if (type === 'remote' && !itemId) suggestRemote(liftOf(db.value, v));
                }}
              >
                <option value="">{lifts.length ? 'Choose a lift…' : 'No lift on file'}</option>
                {lifts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.model} · serial {l.serial} · installed {l.installedOn.slice(0, 4)}
                    {l.remote ? ` · ${l.remote.brand} remote` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {(type === 'service' || type === 'warranty') && (
            <Field label="The problem" class="span-2" hint={job ? undefined : 'The parts it usually takes are reserved from stock when the job is created.'}>
              <select class="select" value={issueKey ?? ''} onChange={(e) => setIssueKey((e.target as HTMLSelectElement).value || undefined)}>
                <option value="">Not sure yet</option>
                {Object.entries(issues).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label} ({def.component.toLowerCase()})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {lift && (type === 'service' || type === 'warranty' || type === 'remote') && (
            <div class="span-2">
              <LiftBox lift={lift} issueKey={type === 'remote' ? undefined : issueKey} fee={type !== 'remote'} />
              {type === 'service' && covered && (
                <p class="job-form__tip">
                  <Icon name="shield" size={14} /> The warranty covers this part.{' '}
                  <button type="button" class="link-btn" onClick={() => changeType('warranty')}>
                    Book it as a warranty visit
                  </button>
                </p>
              )}
              {type === 'warranty' && covered === false && (
                <p class="job-form__tip is-warn">
                  <Icon name="alert" size={14} /> The warranty doesn’t cover this part on this lift — it may be a regular service call.{' '}
                  <button type="button" class="link-btn" onClick={() => changeType('service')}>
                    Make it a service call
                  </button>
                </p>
              )}
            </div>
          )}

          {usesCatalog && (
            <div class="span-2">
              {item ? (
                <div class="field">
                  <span class="field__label">{itemLabelText}</span>
                  <div class="picked">
                    <span class="picked__icon">
                      <Icon name={item.category === 'Remotes' ? 'remote' : 'lift'} size={16} />
                    </span>
                    <span class="picked__text">
                      <strong>{itemLabel(item)}</strong>
                      <span class="muted small">
                        {item.id} · {item.buildToOrder ? 'built to order' : `${available(item, 'camdenton')} finished and available`}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setItemId(undefined)}>
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <ItemPicker
                  label={itemLabelText}
                  placeholder={type === 'remote' ? 'Search remote systems' : 'Search lift sizes'}
                  filter={(it: Item) => (type === 'remote' ? it.category === 'Remotes' : it.kind === 'lift')}
                  onSelect={(it) => {
                    setItemId(it.id);
                    refreshHours(type, it.id, liftId);
                  }}
                />
              )}
              {type === 'build' && item?.bom && <p class="muted small">Reserves the components for {qty === 1 ? 'one lift' : `${qty} lifts`} from stock (the lift’s bill of materials).</p>}
            </div>
          )}

          {onLake && (
            <Field label="Where" optional class="span-2" hint="The dock’s arm or channel, mile marker and cove — or an address">
              <input class="input" value={location} placeholder="e.g. Gravois arm, MM 9 · Sunset Cove" onInput={(e) => setLocation((e.target as HTMLInputElement).value)} />
            </Field>
          )}

          <Field label="Title" optional class="span-2" hint="Leave blank to name it from the job type, the lift and the customer.">
            <input class="input" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label={type === 'build' ? 'Notes for the shop' : 'Notes for the crew'} optional class="span-2">
            <textarea
              class="textarea"
              rows={3}
              value={description}
              placeholder={type === 'build' ? 'Bunks, brackets, walk boards, anything special about the boat…' : 'What the owner reported, the slip, gate codes, what to bring…'}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            />
          </Field>
        </div>

        <fieldset class="job-form__when">
          <legend class="field__label">When</legend>
          <div class="job-form__when-row">
            <Field label="Date">
              <input class="input" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Start time">
              <input class="input" type="time" step={900} value={timeOfDay} onInput={(e) => setTimeOfDay((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label={type === 'build' ? 'Shop hours' : 'Hours on site'}>
              <input
                class="input"
                type="number"
                min={0.25}
                step={0.25}
                value={hrs}
                onInput={(e) => {
                  setHrs(Number((e.target as HTMLInputElement).value));
                  setHoursTouched(true);
                }}
              />
            </Field>
            <Button size="sm" variant="ghost" icon="sparkle" onClick={suggestTime} class="job-form__suggest">
              Find the next opening
            </Button>
          </div>
          {!date && <p class="muted small">No date yet? Leave it blank — the job goes to Needs scheduling.</p>}
        </fieldset>

        <fieldset class="job-form__crew">
          <legend class="field__label">Crew</legend>
          {team === 'install' && (
            <div class="crew-pairs" role="group" aria-label="Install crews">
              {crews.install.map((pair) => {
                const names = pair.map((id) => db.value.staff.find((s) => s.id === id)?.name.split(' ')[0]).join(' & ');
                const on = pair.every((id) => crew.includes(id)) && crew.length === pair.length;
                return (
                  <button key={pair.join()} type="button" class="chip" aria-pressed={on} onClick={() => setCrew(on ? [] : [...pair])}>
                    <Icon name="users" size={14} /> {names}
                  </button>
                );
              })}
            </div>
          )}
          {teams.map((t) => (
            <div key={t.key} class="crew-team">
              <p class="crew-team__label">{t.label}</p>
              <ul class="crew-pick" role="list">
                {people
                  .filter((p) => t.ids.includes(p.id))
                  .map((p) => {
                    const booked = date ? bookedHours(d, p.id, date, job?.id) : 0;
                    const checked = crew.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label class={`crew-pick__item${checked ? ' is-checked' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCrew(p.id)} />
                          <Avatar person={p} size={28} />
                          <span class="crew-pick__text">
                            <span class="crew-pick__name">{p.name}</span>
                            <span class="crew-pick__meta">
                              {p.title}
                              {date ? ` · ${booked ? `${booked} h booked` : 'open'}` : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </fieldset>

        {type === 'build' && (
          <label class="check job-form__priority">
            <input type="checkbox" checked={priority === 'high'} onChange={(e) => setPriority((e.target as HTMLInputElement).checked ? 'high' : 'normal')} />
            <span class="check__box" aria-hidden="true">
              <Icon name="check" size={13} stroke={3} />
            </span>
            <span class="check__label">High priority — a promised install date depends on it</span>
          </label>
        )}
      </form>
    </Dialog>
  );
}
