/** Jobs & schedule: board, list and crew-schedule views, plus the single-job page (?id=). */
import { useEffect } from 'preact/hooks';
import { jobTypeLabels } from '../../data/catalog';
import type { JobType } from '../../data/types';
import { openDialog } from '../../dialogs';
import { plural } from '../../lib/format';
import { param, setParams } from '../../router';
import { isOpenJob } from '../../selectors';
import { db, setUI, ui } from '../../store';
import { Button, PageHeader, SearchInput, Segmented } from '../../ui/core';
import { Board } from './Board';
import { fieldStaff, filterJobs, jobFilters, TEAMS, type JobsView } from './helpers';
import { JobDetail } from './JobDetail';
import { JobList } from './JobList';
import { Schedule } from './Schedule';

const VIEWS: { key: JobsView; label: string; icon: 'columns' | 'list' | 'calendar' }[] = [
  { key: 'board', label: 'Board', icon: 'columns' },
  { key: 'list', label: 'List', icon: 'list' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar' },
];

export default function Jobs() {
  const id = param('id');
  return id ? <JobDetail key={id} id={id} /> : <JobsIndex />;
}

function JobsIndex() {
  const d = db.value;
  const raw = param('view') as JobsView | undefined;
  const view: JobsView = raw && VIEWS.some((v) => v.key === raw) ? raw : ui.value.jobsView;

  // A link straight to a view (e.g. from the dashboard) becomes the remembered view
  useEffect(() => {
    if (view !== ui.value.jobsView) setUI({ jobsView: view });
  }, [view]);
  const f = jobFilters.value;
  const setF = (patch: Partial<typeof f>) => (jobFilters.value = { ...f, ...patch });
  const jobs = filterJobs(d, f);

  const open = d.jobs.filter(isOpenJob).length;
  const waiting = d.jobs.filter((j) => j.status === 'requested').length;
  const held = d.jobs.filter((j) => j.status === 'on-hold').length;
  const building = d.jobs.filter((j) => j.type === 'build' && isOpenJob(j)).length;
  const people = fieldStaff(d);
  const filtered = f.q || f.type !== 'all' || f.tech !== 'all';

  const switchView = (v: JobsView) => {
    setUI({ jobsView: v });
    setParams({ view: v, status: undefined, week: undefined }, { replace: true });
  };

  return (
    <div class="jobs">
      <PageHeader
        eyebrow="Operations"
        title="Jobs & schedule"
        description={`${plural(open, 'open job')} · ${plural(waiting, 'job')} to schedule · ${plural(building, 'lift')} in the shop queue · ${held} on hold`}
        actions={
          <>
            <Segmented label="View" items={VIEWS.map((v) => ({ key: v.key, label: v.label, icon: v.icon }))} value={view} onChange={switchView} />
            <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'job' })}>
              New job
            </Button>
          </>
        }
      />

      <div class="toolbar jobs__filters">
        <SearchInput value={f.q} onInput={(q) => setF({ q })} placeholder="Search job #, customer, cove, order" label="Search jobs" />
        <label class="sr-only" for="jobs-type">
          Job type
        </label>
        <select id="jobs-type" class="select select--sm jobs__select" value={f.type} onChange={(e) => setF({ type: (e.target as HTMLSelectElement).value as JobType | 'all' })}>
          <option value="all">All job types</option>
          {(Object.keys(jobTypeLabels) as JobType[]).map((t) => (
            <option key={t} value={t}>
              {jobTypeLabels[t]}
            </option>
          ))}
        </select>
        <label class="sr-only" for="jobs-tech">
          Crew member
        </label>
        <select id="jobs-tech" class="select select--sm jobs__select" value={f.tech} onChange={(e) => setF({ tech: (e.target as HTMLSelectElement).value })}>
          <option value="all">Everyone</option>
          {TEAMS.map((t) => (
            <optgroup key={t.key} label={t.label}>
              {people
                .filter((p) => t.ids.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {filtered && (
          <Button size="sm" variant="ghost" icon="close" onClick={() => (jobFilters.value = { q: '', type: 'all', tech: 'all' })}>
            Clear filters
          </Button>
        )}
        <span class="toolbar__spacer" />
        {filtered && <span class="muted small">{plural(jobs.length, 'job')} match</span>}
      </div>

      {view === 'board' && <Board jobs={jobs} />}
      {view === 'list' && <JobList jobs={jobs} />}
      {view === 'schedule' && <Schedule jobs={jobs} />}
    </div>
  );
}
