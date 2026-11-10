/** Kanban board: drag cards between workflow columns (or use each card's menu). */
import { useState } from 'preact/hooks';
import { completeJob, setJobStatus } from '../../actions';
import type { Job, JobStatus } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addDays, today } from '../../lib/dates';
import { dayTime, money, relative, shortDate } from '../../lib/format';
import { navigate } from '../../router';
import { customerOf, staffOf } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { AvatarStack, Badge, Button, cx, Link } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { jobTypeMeta } from '../../ui/status';
import { HoldDialog } from './dialogs';
import { BOARD_COLUMNS, closeOutAction, defaultTimes, doneLabel, jobPath, jobWhere, unschedule } from './helpers';
import { buildShortages } from './parts';

/** Finished work stays put; everything else can move to any other column */
const canMove = (job: Job, to: JobStatus) => job.status !== 'completed' && job.status !== to;

/** Apply a column move with the right side effects. Returns false if more input is needed. */
export function moveJob(job: Job, to: JobStatus, askHoldReason: (j: Job) => void) {
  if (!canMove(job, to)) return;
  switch (to) {
    case 'requested':
      unschedule(job);
      toast(`${job.id} moved back to Needs scheduling`);
      break;
    case 'scheduled':
      if (!job.start) {
        // Pick a day, time and crew first
        openDialog({ kind: 'job', jobId: job.id });
        return;
      }
      setJobStatus(job.id, 'scheduled');
      toast(`${job.id} moved to Scheduled`);
      break;
    case 'in-progress':
      setJobStatus(job.id, 'in-progress');
      toast(`${job.id} started`);
      break;
    case 'on-hold':
      askHoldReason(job);
      break;
    case 'completed': {
      completeJob(job.id, defaultTimes(job));
      const next = closeOutAction(job);
      toast(`${job.id} is done — ${doneLabel(job).toLowerCase()}`, { tone: 'success', action: { label: next.label, run: next.run } });
      break;
    }
  }
}

function JobCard({ job, dragging, onDragStart, onDragEnd, onMove }: { job: Job; dragging: boolean; onDragStart: (j: Job) => void; onDragEnd: () => void; onMove: (j: Job, to: JobStatus) => void }) {
  const d = db.value;
  const c = customerOf(d, job.customerId);
  const type = jobTypeMeta[job.type];
  const crew = job.crew.map((id) => staffOf(d, id)!).filter(Boolean);
  const movable = job.status !== 'completed';
  const overdue = job.status === 'scheduled' && job.start && job.start.slice(0, 10) < today();
  const close = closeOutAction(job);
  const short = job.type === 'build' ? buildShortages(d, job).length : 0;

  // Native select: works with keyboard and touch, and never gets clipped by the column's scroll area
  const onAction = (value: string) => {
    if (value.startsWith('move:')) onMove(job, value.slice(5) as JobStatus);
    else if (value === 'schedule') openDialog({ kind: 'job', jobId: job.id });
    else if (value === 'close') close.run();
    else if (value === 'open') navigate(jobPath(job.id));
  };
  const targets = BOARD_COLUMNS.filter((col) => canMove(job, col.status));

  return (
    <article
      class={cx('jcard', `jt--${type.tone}`, dragging && 'is-dragging', movable && 'is-movable')}
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer?.setData('text/plain', job.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        onDragStart(job);
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button, label, select')) return;
        navigate(jobPath(job.id));
      }}
      data-job={job.id}
    >
      <div class="jcard__top">
        <span class="jcard__id">{job.id}</span>
        {job.priority === 'high' && (
          <Badge tone="red" icon="alert" title="High priority">
            High<span class="sr-only"> priority</span>
          </Badge>
        )}
        <label class="jcard__actions" title="Move or update this job">
          <Icon name="more" size={18} />
          <select
            aria-label={`Move or update ${job.id}`}
            value=""
            onChange={(e) => {
              const el = e.currentTarget;
              const value = el.value;
              el.value = '';
              onAction(value);
            }}
          >
            <option value="" disabled>
              Choose an action…
            </option>
            {targets.length > 0 && (
              <optgroup label="Move to">
                {targets.map((col) => (
                  <option key={col.status} value={`move:${col.status}`}>
                    {col.label}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Job">
              {movable && <option value="schedule">{job.start ? 'Reschedule…' : 'Schedule…'}</option>}
              {job.status === 'completed' && <option value="close">{close.label}</option>}
              <option value="open">Open job</option>
            </optgroup>
          </select>
        </label>
      </div>
      <Link to={jobPath(job.id)} class="jcard__title">
        {job.title}
      </Link>
      {c && (
        <p class="jcard__cust">
          {c.name}
          <span class="muted"> · {jobWhere(d, job)}</span>
        </p>
      )}
      <div class="jcard__meta">
        <Badge tone={type.tone} icon={type.icon}>
          {type.label}
        </Badge>
        {short > 0 && (
          <Badge tone="red" icon="alert">
            Short on {short} part{short === 1 ? '' : 's'}
          </Badge>
        )}
        {job.value ? <span class="jcard__value">{money(job.value, false)}</span> : null}
      </div>
      {job.status === 'on-hold' && job.holdReason && (
        <p class="jcard__hold">
          <Icon name="alert" size={13} /> {job.holdReason}
        </p>
      )}
      <div class="jcard__foot">
        <span class={cx('jcard__when', overdue && 'is-bad')}>
          <Icon name={job.start ? 'clock' : 'inbox'} size={13} />
          {job.status === 'completed' && job.completedAt ? `Done ${relative(job.completedAt)}` : job.start ? dayTime(job.start) : `Added ${shortDate(job.createdAt)}`}
        </span>
        <AvatarStack people={crew} size={22} />
      </div>
      {job.status === 'completed' && (
        <Button size="sm" variant="secondary" icon={close.icon} class="jcard__action" onClick={close.run}>
          {close.label}
        </Button>
      )}
    </article>
  );
}

export function Board({ jobs }: { jobs: Job[] }) {
  const d = db.value;
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<JobStatus | null>(null);
  const [holdJob, setHoldJob] = useState<Job | null>(null);
  const horizon = addDays(today(), 14);
  const dragging = dragId ? d.jobs.find((j) => j.id === dragId) : undefined;

  const columns = BOARD_COLUMNS.map((col) => {
    let list = jobs.filter((j) => j.status === col.status);
    let more = 0;
    if (col.status === 'scheduled') {
      list.sort((a, b) => ((a.start ?? '') < (b.start ?? '') ? -1 : 1));
      const soon = list.filter((j) => (j.start ?? '') <= `${horizon}T23:59`);
      more = list.length - soon.length;
      list = soon;
    } else if (col.status === 'requested') {
      list.sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || (a.createdAt < b.createdAt ? -1 : 1));
    } else if (col.status === 'completed') {
      list.sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1));
    } else {
      list.sort((a, b) => ((a.start ?? a.createdAt) < (b.start ?? b.createdAt) ? -1 : 1));
    }
    return { ...col, list, more };
  });

  const move = (job: Job, to: JobStatus) => moveJob(job, to, setHoldJob);

  return (
    <>
      <div class="board">
        {columns.map((col) => {
          const droppable = !!dragging && canMove(dragging, col.status);
          return (
            <section
              key={col.status}
              class={cx('board__col', `board__col--${col.status}`, droppable && 'is-droppable', over === col.status && droppable && 'is-over')}
              aria-labelledby={`col-${col.status}`}
              data-column={col.status}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                if (over !== col.status) setOver(col.status);
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer?.getData('text/plain') || dragId;
                setOver(null);
                setDragId(null);
                const job = db.value.jobs.find((j) => j.id === id);
                if (job) move(job, col.status);
              }}
            >
              <header class="board__head">
                <h2 class="board__title" id={`col-${col.status}`}>
                  <Icon name={col.icon} size={16} />
                  {col.label}
                </h2>
                <span class="board__count" aria-label={`${col.list.length + col.more} jobs`}>
                  {col.list.length + col.more}
                </span>
              </header>
              <div class="board__list">
                {col.list.length === 0 && <p class="board__empty">{col.empty}</p>}
                {col.list.map((j) => (
                  <JobCard key={j.id} job={j} dragging={dragId === j.id} onDragStart={(job) => setDragId(job.id)} onDragEnd={() => (setDragId(null), setOver(null))} onMove={move} />
                ))}
                {col.more > 0 && (
                  <Link class="board__more" to="/office/jobs/?view=list&status=scheduled">
                    {col.more} more scheduled after {shortDate(horizon)} <Icon name="arrow-right" size={14} />
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p class="board__foot muted small">
        Drag a card to another column, or use its <Icon name="more" size={14} class="inline-icon" /> menu. Closed jobs move off the board — <Link to="/office/jobs/?view=list&status=closed">see closed jobs</Link>.
      </p>
      {holdJob && <HoldDialog job={holdJob} onClose={() => setHoldJob(null)} />}
    </>
  );
}

