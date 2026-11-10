/** Small building blocks shared by the Customers and Warranty sections. */
import { useId, useState } from 'preact/hooks';
import { addCustomerNote } from '../../actions';
import { diffDays, today } from '../../lib/dates';
import { decimal, money, relative, shortDate } from '../../lib/format';
import { firstName } from '../../selectors';
import { can, db } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Link, Segmented } from '../../ui/core';
import { Icon, type IconName } from '../../ui/Icon';
import { DataTable } from '../../ui/Table';
import { jobStatusOf, jobTypeMeta, StatusBadge } from '../../ui/status';
import { timeLeft, type HistoryRow, type TimelineEntry } from './helpers';

/* ---------- Tags ---------- */

export function TagList({ tags, max }: { tags: string[]; max?: number }) {
  const shown = max ? tags.slice(0, max) : tags;
  if (!tags.length) return <span class="muted">—</span>;
  return (
    <span class="tag-list">
      {shown.map((t) => (
        <Badge key={t} tone={t === 'Commercial' ? 'blue' : t === 'Dealer' ? 'violet' : 'neutral'}>
          {t}
        </Badge>
      ))}
      {max && tags.length > max && <span class="muted small">+{tags.length - max}</span>}
    </span>
  );
}

/* ---------- Warranty coverage bar ---------- */

/**
 * Shows how much of a coverage period is left: the bar is the whole period, the shaded
 * part is time already used, and the marker is today. Dates are always spelled out too.
 */
export function CoverageBar({ label, from, until }: { label: string; from: string; until: string }) {
  const t = today();
  const total = Math.max(1, diffDays(until, from));
  const used = Math.min(total, Math.max(0, diffDays(t, from)));
  const pct = (used / total) * 100;
  const left = diffDays(until, t);
  const tone = left < 0 ? 'ended' : left <= 90 ? 'expiring' : 'active';
  return (
    <div class={`coverage__row coverage__row--${tone}`}>
      <span class="coverage__label">{label}</span>
      <span class="coverage__track" aria-hidden="true">
        <span class="coverage__used" style={{ width: `${pct}%` }} />
        {tone !== 'ended' && <span class="coverage__today" style={{ left: `${pct}%` }} />}
      </span>
      <span class="coverage__text">{tone === 'ended' ? `Ended ${shortDate(until, true)}` : `Until ${shortDate(until, true)} · ${timeLeft(left)} left`}</span>
    </div>
  );
}

/* ---------- Activity timeline ---------- */

const timelineIcons: Record<TimelineEntry['kind'], IconName> = {
  received: 'inbox',
  note: 'note',
  email: 'mail',
  call: 'phone',
  text: 'message',
  status: 'check-circle',
  assign: 'user',
  job: 'clipboard',
  estimate: 'file',
  system: 'info',
  payment: 'dollar',
  invoice: 'receipt',
  lift: 'lift',
};

export function Timeline({ entries, limit }: { entries: TimelineEntry[]; limit?: number }) {
  const d = db.value;
  const [showAll, setShowAll] = useState(false);
  const shown = limit && !showAll ? entries.slice(0, limit) : entries;
  if (!entries.length) return <p class="muted">No activity yet.</p>;
  return (
    <>
      <ol class="timeline" role="list">
        {shown.map((e) => (
          <li key={e.id}>
            <span class={`timeline__icon timeline__icon--${e.kind}`}>
              <Icon name={timelineIcons[e.kind]} size={14} />
            </span>
            <div class="timeline__text">
              <p>{e.text}</p>
              <p class="timeline__meta">
                {e.by === 'customer' ? 'Customer' : firstName(d, e.by)} · <time dateTime={e.at}>{relative(e.at)}</time>
                {e.source && (
                  <>
                    {' · '}
                    {can(e.source.section) ? <Link to={e.source.to}>{e.source.label}</Link> : e.source.label}
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {limit && entries.length > limit && (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show all ${entries.length}`}
        </Button>
      )}
    </>
  );
}

/* ---------- Log a call / note ---------- */

type EntryKind = 'call' | 'email' | 'text' | 'note';

const placeholders: Record<EntryKind, string> = {
  call: 'What did you talk about? e.g. Confirmed Thursday morning; the boat will be off the lift.',
  email: 'Summary of the email you sent or received',
  text: 'What did the text say?',
  note: 'Anything the crew should know — gate codes, dock access, the best time to come by',
};

export function Composer({ customerId, onSaved, autoFocus }: { customerId: string; onSaved?: () => void; autoFocus?: boolean }) {
  const id = useId();
  const [kind, setKind] = useState<EntryKind>('call');
  const [text, setText] = useState('');
  const save = (e: Event) => {
    e.preventDefault();
    if (!text.trim()) return;
    addCustomerNote(customerId, kind, text.trim());
    setText('');
    toast(kind === 'note' ? 'Note saved' : kind === 'call' ? 'Call logged' : `${kind === 'email' ? 'Email' : 'Text'} logged`);
    onSaved?.();
  };
  return (
    <form class="composer" onSubmit={save}>
      <Segmented<EntryKind>
        label="Type of entry"
        size="sm"
        value={kind}
        onChange={setKind}
        items={[
          { key: 'call', label: 'Call', icon: 'phone' },
          { key: 'email', label: 'Email', icon: 'mail' },
          { key: 'text', label: 'Text', icon: 'message' },
          { key: 'note', label: 'Note', icon: 'note' },
        ]}
      />
      <label class="sr-only" for={`${id}-text`}>
        Details
      </label>
      <textarea id={`${id}-text`} class="textarea" rows={3} placeholder={placeholders[kind]} value={text} data-autofocus={autoFocus ? '' : undefined} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      <div class="composer__foot">
        <span class="muted small">{kind === 'email' || kind === 'text' ? 'Logged to the customer’s history — a real version could also send it.' : 'Visible to everyone using FiberSteel mode.'}</span>
        <Button type="submit" variant="primary" size="sm" disabled={!text.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

/* ---------- Service history table ---------- */

export function HistoryTable({ rows, caption, pageSize = 15 }: { rows: HistoryRow[]; caption: string; pageSize?: number }) {
  const d = db.value;
  return (
    <DataTable<HistoryRow>
      rows={rows}
      caption={caption}
      rowKey={(r) => r.id}
      pageSize={pageSize}
      initialSort={{ key: 'day', dir: 'desc' }}
      columns={[
        { key: 'day', label: 'Date', sortValue: (r) => r.day, render: (r) => <span class="nowrap">{shortDate(r.day, true)}</span> },
        {
          key: 'type',
          label: 'Type',
          sortValue: (r) => r.type,
          render: (r) => (
            <Badge tone={jobTypeMeta[r.type].tone} icon={jobTypeMeta[r.type].icon}>
              {jobTypeMeta[r.type].label}
            </Badge>
          ),
          hide: 'sm',
        },
        {
          key: 'work',
          label: 'Work',
          width: '40%',
          render: (r) => (
            <>
              {r.jobId && can('jobs') ? (
                <Link to={`/office/jobs/?id=${r.jobId}`} class="cell-main">
                  {r.title}
                </Link>
              ) : (
                <span class="cell-main">{r.title}</span>
              )}
              {r.detail && <span class="cell-sub">{r.detail}</span>}
            </>
          ),
        },
        { key: 'tech', label: 'Crew', render: (r) => (r.techs.length ? r.techs.map((t) => firstName(d, t)).join(', ') : <span class="muted">—</span>), hide: 'md' },
        { key: 'hours', label: 'Hours', align: 'right', sortValue: (r) => r.hours ?? -1, render: (r) => (r.hours !== undefined ? decimal(r.hours) : <span class="muted">—</span>), hide: 'md' },
        {
          key: 'revenue',
          label: 'Billed',
          align: 'right',
          sortValue: (r) => r.revenue ?? -1,
          render: (r) => {
            const open = r.status && r.status !== 'closed' && r.status !== 'completed';
            if (r.type === 'warranty' && !r.revenue) return <span class="muted">Part covered</span>;
            if (!r.revenue) return <span class="muted">—</span>;
            return open ? <span class="muted nowrap">est. {money(r.revenue, false)}</span> : money(r.revenue, false);
          },
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (r.status ? <StatusBadge meta={jobStatusOf({ status: r.status, type: r.type })} /> : <span class="muted small">{r.id.startsWith('inst-') ? 'On record' : 'Completed'}</span>),
          hide: 'sm',
        },
      ]}
    />
  );
}
