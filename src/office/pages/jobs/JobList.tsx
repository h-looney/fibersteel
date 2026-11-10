/** Table of jobs with status filters. */
import type { Job, JobStatus } from '../../data/types';
import { dayTime, money, shortDate } from '../../lib/format';
import { navigate, param, setParams } from '../../router';
import { customerOf, isOpenJob, staffOf } from '../../selectors';
import { db } from '../../store';
import { AvatarStack, Card, Chips, EmptyState, Link } from '../../ui/core';
import { StatusBadge, jobTypeMeta } from '../../ui/status';
import { DataTable, type Column } from '../../ui/Table';
import { jobPath, jobWhere } from './helpers';
import { jobStatusFor } from './parts';

type StatusFilter = 'open' | JobStatus | 'all';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'requested', label: 'Needs scheduling' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'on-hold', label: 'On hold' },
  { key: 'completed', label: 'Done — to close out' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const statusOrder: Record<JobStatus, number> = { 'in-progress': 0, 'on-hold': 1, requested: 2, scheduled: 3, completed: 4, closed: 5, cancelled: 6 };

const matches = (j: Job, f: StatusFilter) => (f === 'all' ? true : f === 'open' ? isOpenJob(j) : j.status === f);

export function JobList({ jobs }: { jobs: Job[] }) {
  const d = db.value;
  const raw = param('status') as StatusFilter | undefined;
  const status: StatusFilter = raw && FILTERS.some((f) => f.key === raw) ? raw : 'open';
  const rows = jobs.filter((j) => matches(j, status));
  const finished = status === 'closed' || status === 'completed' || status === 'cancelled';

  const columns: Column<Job>[] = [
    {
      key: 'job',
      label: 'Job',
      render: (j) => (
        <>
          <Link class="cell-main" to={jobPath(j.id)}>
            {j.title}
          </Link>
          <span class="cell-sub">{j.id}</span>
        </>
      ),
      sortValue: (j) => j.title,
    },
    { key: 'type', label: 'Type', render: (j) => <StatusBadge meta={jobTypeMeta[j.type]} />, sortValue: (j) => j.type, hide: 'sm' },
    {
      key: 'customer',
      label: 'Customer',
      render: (j) => {
        const c = customerOf(d, j.customerId);
        return (
          <>
            <span>{c?.name ?? '—'}</span>
            <span class="cell-sub">{jobWhere(d, j)}</span>
          </>
        );
      },
      sortValue: (j) => customerOf(d, j.customerId)?.name ?? '',
    },
    {
      key: 'when',
      label: finished ? 'Completed' : 'Scheduled',
      render: (j) =>
        finished && j.completedAt ? (
          <span class="nowrap">{shortDate(j.completedAt)}</span>
        ) : j.start ? (
          <span class="nowrap">{dayTime(j.start)}</span>
        ) : (
          <span class="muted">Not scheduled</span>
        ),
      sortValue: (j) => (finished ? j.completedAt : j.start) ?? '',
    },
    { key: 'crew', label: 'Crew', render: (j) => <AvatarStack people={j.crew.map((id) => staffOf(d, id)!).filter(Boolean)} size={24} />, hide: 'sm' },
    { key: 'status', label: 'Status', render: (j) => <StatusBadge meta={jobStatusFor(j)} />, sortValue: (j) => statusOrder[j.status] },
    { key: 'value', label: 'Value', align: 'right', render: (j) => (j.value ? money(j.value, false) : <span class="muted">—</span>), sortValue: (j) => j.value ?? 0, hide: 'sm' },
  ];

  return (
    <div class="stack">
      <Chips
        label="Filter by status"
        value={status}
        onChange={(k) => setParams({ status: k === 'open' ? undefined : k }, { replace: true })}
        items={FILTERS.map((f) => ({ key: f.key, label: f.label, count: jobs.filter((j) => matches(j, f.key)).length }))}
      />
      <Card flush>
        <DataTable
          key={status}
          rows={rows}
          columns={columns}
          rowKey={(j) => j.id}
          caption="Jobs"
          onRowClick={(j) => navigate(jobPath(j.id))}
          initialSort={{ key: finished || status === 'all' ? 'when' : 'when', dir: finished || status === 'all' ? 'desc' : 'asc' }}
          empty={<EmptyState icon="clipboard" title="No jobs match">Try a different status, or clear the search and filters above.</EmptyState>}
        />
      </Card>
    </div>
  );
}
