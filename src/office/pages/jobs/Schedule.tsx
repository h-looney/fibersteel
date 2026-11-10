/** Crew schedule: a week of jobs by person — install crews, service, the shop — with drag-to-schedule from the "Needs scheduling" list. */
import { useState } from 'preact/hooks';
import { scheduleJob } from '../../actions';
import { crews } from '../../data/people';
import type { Customer, Job, JobType, Staff } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addDays, startOfWeek, today } from '../../lib/dates';
import { dayLabel, dayTime, hours, plural, relative, shortDate, time, weekdayShort } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, staffOf } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Avatar, AvatarStack, Badge, Button, cx, EmptyState, Link } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { jobStatusOf, jobTypeMeta } from '../../ui/status';
import { fieldStaff, firstFreeStart, jobFilters, jobPath, jobWhere, personJobs, TEAMS, useMedia } from './helpers';

interface Drag {
  jobId: string;
  /** Row the chip was dragged from (absent for unscheduled jobs) */
  from?: string;
}

/** A short name for a schedule chip: an owner's last name, or the first words of a business name */
const shortName = (c?: Customer) => {
  if (!c) return '';
  const name = c.name.replace(/\s*\(sample\)$/, '');
  return c.kind === 'owner' ? name.split(' ').slice(-1)[0] : name.split(' ').slice(0, 2).join(' ');
};

/** Dropping an install or a delivery on one of an install crew's two people books the whole crew */
const crewFor = (personId: string, type: JobType) => {
  const pair = crews.install.find((p) => p.includes(personId));
  return pair && (type === 'install' || type === 'delivery') ? [...pair] : [personId];
};

function weekLabel(start: string) {
  const end = addDays(start, 5);
  const sameMonth = start.slice(5, 7) === end.slice(5, 7);
  return `${shortDate(start)} – ${sameMonth ? +end.slice(8, 10) : shortDate(end)}, ${end.slice(0, 4)}`;
}

function Chip({ job, person, onDragStart, onDragEnd }: { job: Job; person: string; onDragStart: (d: Drag) => void; onDragEnd: () => void }) {
  const c = customerOf(db.value, job.customerId);
  const type = jobTypeMeta[job.type];
  const movable = job.status === 'scheduled';
  const status = jobStatusOf(job);
  return (
    <Link
      to={jobPath(job.id)}
      class={cx('dchip', `jt--${type.tone}`, `is-${job.status}`, movable && 'is-movable')}
      draggable={movable}
      title={`${time(job.start!)} · ${job.title} — ${c?.name ?? ''} (${status.label})`}
      data-job={job.id}
      onDragStart={(e) => {
        if (!movable) return e.preventDefault();
        e.dataTransfer?.setData('text/plain', job.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        onDragStart({ jobId: job.id, from: person });
      }}
      onDragEnd={onDragEnd}
    >
      <span class="dchip__time">
        {time(job.start!)}
        {job.status !== 'scheduled' && <Icon name={status.icon} size={12} label={status.label} />}
      </span>
      <span class="dchip__who">{shortName(c)}</span>
      <span class="dchip__type">
        <Icon name={type.icon} size={12} /> {type.label}
      </span>
    </Link>
  );
}

function Unscheduled({ jobs, onDragStart, onDragEnd, touch }: { jobs: Job[]; onDragStart: (d: Drag) => void; onDragEnd: () => void; touch?: boolean }) {
  const d = db.value;
  return (
    <aside class="dispatch__side card" aria-labelledby="needs-scheduling">
      <header class="dispatch__side-head">
        <h2 id="needs-scheduling" class="card__title">
          Needs scheduling <span class="pill-count">{jobs.length}</span>
        </h2>
        <p class="card__sub">{touch ? 'Tap Schedule to pick a day, time and crew.' : 'Drag a job onto a person and day, or use Schedule.'}</p>
      </header>
      {jobs.length === 0 ? (
        <EmptyState icon="check-circle" title="All caught up">
          Every request has a time.
        </EmptyState>
      ) : (
        <ul class="dqueue" role="list">
          {jobs.map((j) => {
            const c = customerOf(d, j.customerId);
            const type = jobTypeMeta[j.type];
            return (
              <li key={j.id}>
                <div
                  class={cx('dqueue__item', `jt--${type.tone}`)}
                  draggable
                  data-job={j.id}
                  onDragStart={(e) => {
                    e.dataTransfer?.setData('text/plain', j.id);
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                    onDragStart({ jobId: j.id });
                  }}
                  onDragEnd={onDragEnd}
                >
                  <span class="dqueue__grip" aria-hidden="true">
                    <Icon name="grip" size={14} />
                  </span>
                  <span class="dqueue__main">
                    <Link to={jobPath(j.id)} class="dqueue__title">
                      {j.title}
                    </Link>
                    <span class="dqueue__meta">
                      {c?.name} · {jobWhere(d, j)}
                    </span>
                    <span class="dqueue__meta">
                      <Icon name={type.icon} size={12} /> {type.label} · {hours(j.hours)} · added {relative(j.createdAt)}
                    </span>
                    {j.priority === 'high' && (
                      <Badge tone="red" icon="alert">
                        High priority
                      </Badge>
                    )}
                  </span>
                  <Button size="sm" variant="secondary" icon="calendar" onClick={() => openDialog({ kind: 'job', jobId: j.id })} aria-label={`Schedule ${j.id}: ${j.title}`}>
                    Schedule
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export function Schedule({ jobs }: { jobs: Job[] }) {
  const d = db.value;
  const t = today();
  const rawWeek = param('week');
  const weekStart = startOfWeek(rawWeek && /^\d{4}-\d{2}-\d{2}$/.test(rawWeek) ? rawWeek : t);
  const days = [0, 1, 2, 3, 4, 5].map((i) => addDays(weekStart, i));
  const narrow = useMedia('(max-width: 900px)');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const inWeek = (j: Job) => !!j.start && j.start.slice(0, 10) >= days[0] && j.start.slice(0, 10) <= days[5] && j.status !== 'cancelled';
  const weekJobs = jobs.filter(inWeek);
  const unscheduled = jobs.filter((j) => j.status === 'requested').sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || (a.createdAt < b.createdAt ? -1 : 1));
  const techFilter = jobFilters.value.tech;

  const people = fieldStaff(d).filter((s) => techFilter === 'all' || s.id === techFilter);
  const groups = TEAMS.map((team) => ({ key: team.key, label: team.label, people: people.filter((p) => team.ids.includes(p.id)) })).filter((g) => g.people.length);

  const goWeek = (start: string | undefined) => setParams({ week: start }, { replace: true });

  const drop = (person: Staff, day: string) => {
    const current = drag;
    setDrag(null);
    setOver(null);
    if (!current) return;
    const job = db.value.jobs.find((j) => j.id === current.jobId);
    if (!job) return;
    if (day < t) {
      toast('Pick today or a later day.', { tone: 'warning' });
      return;
    }
    if (!job.start || job.status === 'requested') {
      const crew = crewFor(person.id, job.type);
      const start = firstFreeStart(db.value, person.id, day, job.hours, job.id);
      scheduleJob(job.id, start, crew);
      toast(`${job.id} scheduled for ${dayTime(start)} with ${crew.map((id) => staffOf(db.value, id)?.name.split(' ')[0]).join(' & ')}`, { tone: 'success' });
      return;
    }
    const start = `${day}T${job.start.slice(11, 16)}`;
    const crew = job.crew.includes(person.id) ? job.crew : [person.id, ...job.crew.filter((c) => c !== current.from)];
    if (start === job.start && crew.join() === job.crew.join()) return;
    scheduleJob(job.id, start, crew);
    toast(`${job.id} moved to ${dayTime(start)} with ${crew.map((id) => staffOf(db.value, id)?.name.split(' ')[0]).join(' & ')}`, { tone: 'success' });
  };

  const cellProps = (person: Staff, day: string) => {
    const key = `${person.id}|${day}`;
    return {
      'data-cell': key,
      onDragOver: (e: DragEvent) => {
        if (!drag || day < t) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (over !== key) setOver(key);
      },
      onDragLeave: (e: DragEvent) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver((o) => (o === key ? null : o));
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        drop(person, day);
      },
    };
  };

  const nav = (
    <div class="dispatch__nav">
      <div class="row">
        <Button size="sm" variant="secondary" icon="chevron-left" aria-label="Previous week" onClick={() => goWeek(addDays(weekStart, -7))} />
        <Button size="sm" variant="secondary" onClick={() => goWeek(undefined)} disabled={weekStart === startOfWeek(t)}>
          This week
        </Button>
        <Button size="sm" variant="secondary" icon="chevron-right" aria-label="Next week" onClick={() => goWeek(addDays(weekStart, 7))} />
      </div>
      <h2 class="dispatch__week" aria-live="polite">
        {weekLabel(weekStart)}
      </h2>
      <p class="muted small">
        {plural(weekJobs.length, 'job')} this week · {plural(unscheduled.length, 'request')} waiting
      </p>
    </div>
  );

  if (narrow) {
    const openDay = days.includes(t) ? t : days[0];
    return (
      <div class="dispatch dispatch--narrow">
        {nav}
        {unscheduled.length > 0 && <Unscheduled jobs={unscheduled} touch onDragStart={setDrag} onDragEnd={() => (setDrag(null), setOver(null))} />}
        {days.map((day) => {
          const list = weekJobs.filter((j) => j.start!.slice(0, 10) === day).sort((a, b) => (a.start! < b.start! ? -1 : 1));
          return (
            <details key={day} class={cx('dday card', day === t && 'is-today')} open={day === openDay}>
              <summary class="dday__summary">
                <span class="dday__label">{dayLabel(day)}</span>
                <span class="muted small">{list.length ? plural(list.length, 'job') : 'Nothing scheduled'}</span>
                <Icon name="chevron-down" size={16} class="dday__chev" />
              </summary>
              {list.length > 0 && (
                <ul class="dday__list" role="list">
                  {list.map((j) => {
                    const c = customerOf(d, j.customerId);
                    const type = jobTypeMeta[j.type];
                    return (
                      <li key={j.id}>
                        <Link to={jobPath(j.id)} class={cx('dday__row', `jt--${type.tone}`)}>
                          <span class="dday__time">{time(j.start!)}</span>
                          <span class="dday__main">
                            <span class="dday__title">{j.title}</span>
                            <span class="muted small">
                              {c?.name} · {jobWhere(d, j)}
                            </span>
                          </span>
                          <AvatarStack people={j.crew.map((id) => staffOf(d, id)!).filter(Boolean)} size={24} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    );
  }

  return (
    <div class="dispatch">
      <div class="dispatch__main card">
        {nav}
        {groups.length === 0 ? (
          <EmptyState icon="users" title="No one to show">
            Nobody matches the current filters.
          </EmptyState>
        ) : (
          <div class="dispatch__scroll">
            <table class={cx('dispatch__table', drag && 'is-dragging')}>
              <caption class="sr-only">Jobs by crew member for the week of {weekLabel(weekStart)}</caption>
              <thead>
                <tr>
                  <th scope="col" class="dispatch__corner">
                    Crew
                  </th>
                  {days.map((day) => (
                    <th key={day} scope="col" class={cx('dispatch__day', day === t && 'is-today')} aria-current={day === t ? 'date' : undefined}>
                      <span class="dispatch__dow">{weekdayShort(day)}</span>
                      <span class="dispatch__date">{+day.slice(8, 10)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => [
                  <tr key={`g-${g.key}`} class="dispatch__group">
                    <th scope="colgroup" colSpan={7}>
                      {g.label}
                    </th>
                  </tr>,
                  ...g.people.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" class="dispatch__person">
                        <Avatar person={p} size={30} />
                        <span>
                          <span class="dispatch__name">{p.name}</span>
                          <span class="dispatch__role">{p.title}</span>
                        </span>
                      </th>
                      {days.map((day) => {
                        const cellJobs = weekJobs.filter((j) => j.start!.slice(0, 10) === day && j.crew.includes(p.id)).sort((a, b) => (a.start! < b.start! ? -1 : 1));
                        const booked = personJobs(d, p.id, day).reduce((s, j) => s + j.hours, 0);
                        const key = `${p.id}|${day}`;
                        return (
                          <td key={day} class={cx('dcell', day === t && 'is-today', day < t && 'is-past', over === key && 'is-over')} {...cellProps(p, day)}>
                            {cellJobs.map((j) => (
                              <Chip key={j.id} job={j} person={p.id} onDragStart={setDrag} onDragEnd={() => (setDrag(null), setOver(null))} />
                            ))}
                            {booked > 0 && <span class={cx('dcell__load', booked > 8 && 'is-over')}>{hours(booked)} booked</span>}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        )}
        <p class="dispatch__legend muted small">
          {(['site-visit', 'build', 'install', 'service', 'warranty', 'delivery', 'remote'] as const).map((type) => (
            <span key={type} class={`dlegend jt--${jobTypeMeta[type].tone}`}>
              {jobTypeMeta[type].label}
            </span>
          ))}
          <span class="dispatch__hint">Drag a scheduled job to another day or person to reschedule it — times stay the same. Dropping an install on one of a crew’s two people books both.</span>
        </p>
      </div>
      <Unscheduled jobs={unscheduled} onDragStart={setDrag} onDragEnd={() => (setDrag(null), setOver(null))} />
    </div>
  );
}
