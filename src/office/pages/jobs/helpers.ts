/** Shared helpers for the Jobs section, the inbox and My day. */
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { billedElsewhere, invoiceJob, scheduleJob, setJobStatus, updateJob } from '../../actions';
import { crews } from '../../data/people';
import type { Customer, DB, Job, JobStatus, JobType, Staff } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addMinutes, now } from '../../lib/dates';
import { navigate } from '../../router';
import { customerOf } from '../../selectors';
import { edit, me, mutate, uid } from '../../store';
import { toast } from '../../toast';
import type { IconName } from '../../ui/Icon';
import { whereLabel } from '../../ui/pickers';

export type JobsView = 'board' | 'list' | 'schedule';

export const jobPath = (id: string) => `/office/jobs/?id=${id}`;

/** Board columns, in workflow order */
export const BOARD_COLUMNS: { status: JobStatus; label: string; icon: IconName; empty: string }[] = [
  { status: 'requested', label: 'Needs scheduling', icon: 'clock', empty: 'Nothing waiting to be scheduled.' },
  { status: 'scheduled', label: 'Scheduled', icon: 'calendar', empty: 'No upcoming jobs.' },
  { status: 'in-progress', label: 'In progress', icon: 'wrench', empty: 'Nobody is on a job right now.' },
  { status: 'on-hold', label: 'On hold', icon: 'alert', empty: 'No jobs on hold.' },
  { status: 'completed', label: 'Done', icon: 'receipt', empty: 'Everything finished has been billed or closed.' },
];

/** Jobs out on the water (the rest happen in the shop, or are a hand-off to a dealer or a freight carrier) */
export const LAKE_TYPES: JobType[] = ['site-visit', 'install', 'service', 'warranty', 'remote'];

/** Where a job happens, the way the crew would say it: the dock's lake spot, or the town */
export function jobWhere(d: DB, j: Job): string {
  if (j.type === 'build') return 'FiberSteel shop, Camdenton';
  if (j.location) return j.location;
  const c = customerOf(d, j.customerId);
  return c ? whereLabel(c) : '';
}

/** A customer's place for a card: the lake spot for owners, the town for businesses */
export const customerWhere = (c?: Customer) => (!c ? '' : c.lake ? whereLabel(c) : [c.address.city, c.address.state].filter(Boolean).join(', '));

/* ---------- Filters (kept for the session) ---------- */

export interface JobFilters {
  q: string;
  type: JobType | 'all';
  tech: string;
}

export const jobFilters = signal<JobFilters>({ q: '', type: 'all', tech: 'all' });

export function filterJobs(d: DB, f: JobFilters): Job[] {
  const term = f.q.trim().toLowerCase();
  return d.jobs.filter((j) => {
    if (f.type !== 'all' && j.type !== f.type) return false;
    if (f.tech !== 'all' && !j.crew.includes(f.tech)) return false;
    if (!term) return true;
    const c = customerOf(d, j.customerId);
    return [j.id, j.title, j.location, c?.name, c?.address.city, c?.lake?.arm, c?.lake?.cove, j.dealerOrderId].some((s) => s?.toLowerCase().includes(term));
  });
}

/* ---------- Scheduling math ---------- */

const toMin = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const jobEnd = (j: Job) => addMinutes(j.start!, Math.round(j.hours * 60));

/** Jobs a person is booked on for a day */
export const personJobs = (d: DB, staffId: string, day: string, exceptJobId?: string) =>
  d.jobs.filter((j) => j.id !== exceptJobId && j.start && j.start.slice(0, 10) === day && j.crew.includes(staffId) && j.status !== 'cancelled');

export const bookedHours = (d: DB, staffId: string, day: string, exceptJobId?: string) =>
  personJobs(d, staffId, day, exceptJobId).reduce((sum, j) => sum + j.hours, 0);

/** First time from 8 AM when the person is free for `hours` plus 30 minutes of travel. */
export function firstFreeStart(d: DB, staffId: string, day: string, hours: number, exceptJobId?: string): string {
  const busy = personJobs(d, staffId, day, exceptJobId)
    .map((j) => {
      const s = toMin(j.start!.slice(11, 16));
      return [s, s + Math.round(j.hours * 60) + 30] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  const need = Math.round(hours * 60) + 30;
  let t = 8 * 60;
  for (const [s, e] of busy) {
    if (t + need <= s) break;
    t = Math.max(t, e);
  }
  t = Math.min(17 * 60, Math.ceil(t / 15) * 15);
  return `${day}T${fromMin(t)}`;
}

/** The teams, in schedule order: the two install crews, the service techs, the shop */
export const TEAMS: { key: 'install' | 'service' | 'shop'; label: string; ids: string[] }[] = [
  { key: 'install', label: 'Install crews', ids: crews.install.flat() },
  { key: 'service', label: 'Service', ids: crews.service },
  { key: 'shop', label: 'Shop', ids: crews.shop },
];

/** Who can be put on a job's crew (the crews and the shop — the office books the work, it isn't on it) */
export function fieldStaff(d: DB): Staff[] {
  const order = TEAMS.flatMap((t) => t.ids);
  return d.staff.filter((s) => s.active && order.includes(s.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/** The team a job type is usually done by */
export const teamFor = (type: JobType): 'install' | 'service' | 'shop' => (type === 'build' ? 'shop' : type === 'install' || type === 'delivery' || type === 'site-visit' ? 'install' : 'service');

/** Sensible arrival and finish times when marking a job complete */
export function defaultTimes(j: Job): { arrivedAt: string; finishedAt: string } {
  const n = now();
  const mins = Math.max(15, Math.round(j.hours * 60));
  const endFrom = (start: string) => {
    const planned = addMinutes(start, mins);
    if (planned <= n) return planned;
    const shortest = addMinutes(start, 15);
    return n > shortest ? n : shortest;
  };
  if (j.startedAt) return { arrivedAt: j.startedAt, finishedAt: endFrom(j.startedAt) };
  if (j.start && j.start <= n) return { arrivedAt: j.start, finishedAt: endFrom(j.start) };
  return { arrivedAt: addMinutes(n, -mins), finishedAt: n };
}

/** Send a job back to "Needs scheduling" */
export function unschedule(j: Job) {
  if (j.status === 'scheduled') return scheduleJob(j.id, undefined, j.crew);
  setJobStatus(j.id, 'requested');
  if (j.start) updateJob(j.id, { start: undefined });
}

/** Demo stand-in for taking a photo in the field */
export function addJobPhoto(jobId: string) {
  mutate((d) =>
    edit(d.jobs, jobId, (j) => {
      j.photos = (j.photos ?? 0) + 1;
      j.notes.push({ id: uid('a'), at: now(), by: me.value?.id ?? 'system', kind: 'note', text: `Photo ${j.photos} added from the field` });
    }),
  );
}

/**
 * The next step once the work is done: bill it, write the quote after a site visit, or close a build or a dealer
 * delivery (they're billed with the install or the dealer order).
 */
export function closeOutAction(job: Job): { label: string; icon: IconName; run: () => void } {
  if (job.type === 'site-visit') {
    return {
      label: 'Write the quote',
      icon: 'file',
      run: () => openDialog({ kind: 'invoice', preset: { kind: 'estimate', customerId: job.customerId, leadId: job.leadId, itemId: job.itemId } }),
    };
  }
  if (billedElsewhere(job)) {
    return {
      label: 'Close job',
      icon: 'check-circle',
      run: () => {
        invoiceJob(job.id);
        toast(job.dealerOrderId ? `${job.id} closed — billed with dealer order ${job.dealerOrderId}` : `${job.id} closed — billed with the install`);
      },
    };
  }
  return {
    label: 'Create invoice',
    icon: 'receipt',
    run: () => {
      const id = invoiceJob(job.id);
      if (id) toast(`Invoice ${id} created for ${job.id}`, { tone: 'success', action: { label: 'Open', run: () => navigate(`/office/accounting/?tab=invoices&id=${id}`) } });
    },
  };
}

/** What the "done" column calls a finished job, by how it's closed out */
export const doneLabel = (job: Job) => (job.type === 'site-visit' ? 'Quote to write' : billedElsewhere(job) ? 'To close' : 'To invoice');

/** Re-render when a media query starts or stops matching */
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}
