/** The shop's week, for shop profiles on My day: builds by day, what's waiting, what's short, and what's in the yard. */
import type { Job } from '../../data/types';
import { addDays, startOfWeek, today } from '../../lib/dates';
import { dayLabel, plural, time } from '../../lib/format';
import { available, customerOf, isOpenJob, itemOf, staffOf } from '../../selectors';
import { db } from '../../store';
import { AvatarStack, Badge, Card, cx, EmptyState, Link } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { StatusBadge } from '../../ui/status';
import { jobPath } from '../jobs/helpers';
import { buildShortages, jobStatusFor } from '../jobs/parts';

/** Every component the open builds still need, against what's on hand */
function shortages(builds: Job[]) {
  const d = db.value;
  const need = new Map<string, number>();
  for (const job of builds) {
    const item = itemOf(d, job.itemId);
    for (const b of item?.bom ?? []) {
      const used = job.parts.filter((p) => p.itemId === b.itemId && p.status === 'used').reduce((s, p) => s + p.qty, 0);
      need.set(b.itemId, (need.get(b.itemId) ?? 0) + Math.max(0, b.qty * (job.qty ?? 1) - used));
    }
  }
  return [...need.entries()]
    .map(([itemId, qty]) => {
      const part = itemOf(d, itemId);
      const s = part?.stock.camdenton;
      // What the builds need, plus everything else reserved (service calls), against what's on hand
      const reservedElsewhere = Math.max(0, (s?.reserved ?? 0) - builds.reduce((sum, j) => sum + j.parts.filter((p) => p.itemId === itemId && p.status === 'reserved').reduce((n, p) => n + p.qty, 0), 0));
      const onHand = s?.onHand ?? 0;
      return { itemId, part, qty, onHand, gap: qty + reservedElsewhere - onHand };
    })
    .filter((r) => r.part && r.gap > 0)
    .sort((a, b) => b.gap - a.gap);
}

function BuildRow({ job }: { job: Job }) {
  const d = db.value;
  const item = itemOf(d, job.itemId);
  const c = customerOf(d, job.customerId);
  const short = buildShortages(d, job).length;
  return (
    <li>
      <Link to={jobPath(job.id)} class="shop-row jt--violet">
        <span class="shop-row__time">{job.start ? time(job.start) : '—'}</span>
        <span class="shop-row__main">
          <span class="shop-row__title">
            {job.qty && job.qty > 1 ? `${job.qty} × ` : ''}
            {item?.name ?? job.title}
          </span>
          <span class="muted small">
            {job.id} · for {c?.name ?? 'stock'}
            {job.dealerOrderId ? ` · order ${job.dealerOrderId}` : ''}
          </span>
        </span>
        {short > 0 && (
          <Badge tone="red" icon="alert">
            Short {short}
          </Badge>
        )}
        <AvatarStack people={job.crew.map((id) => staffOf(d, id)!).filter(Boolean)} size={22} />
        <StatusBadge meta={jobStatusFor(job)} />
      </Link>
    </li>
  );
}

export function ShopWeek({ day }: { day: string }) {
  const d = db.value;
  const t = today();
  const weekStart = startOfWeek(day);
  const days = [0, 1, 2, 3, 4, 5].map((i) => addDays(weekStart, i));
  const builds = d.jobs.filter((j) => j.type === 'build' && j.status !== 'cancelled');
  const thisWeek = builds.filter((j) => j.start && j.start.slice(0, 10) >= days[0] && j.start.slice(0, 10) <= days[5]);
  const waiting = builds.filter((j) => j.status === 'requested' || j.status === 'on-hold');
  const open = builds.filter(isOpenJob);
  const short = shortages(open);
  const yard = d.items.filter((it) => it.kind === 'lift' && it.stock.camdenton.onHand > 0);

  return (
    <div class="shop-week">
      <Card title="The shop this week" subtitle={`${plural(thisWeek.length, 'build')} on the schedule · ${plural(waiting.length, 'build')} waiting`} level={2} flush>
        {thisWeek.length === 0 ? (
          <EmptyState icon="hardhat" title="No builds scheduled this week">
            Builds for installs and dealer orders show up here once they’re scheduled.
          </EmptyState>
        ) : (
          days.map((dd) => {
            const list = thisWeek.filter((j) => j.start!.slice(0, 10) === dd).sort((a, b) => (a.start! < b.start! ? -1 : 1));
            if (!list.length) return null;
            return (
              <section key={dd} class={cx('shop-day', dd === t && 'is-today')} aria-labelledby={`shop-${dd}`}>
                <h3 id={`shop-${dd}`} class="shop-day__label">
                  {dayLabel(dd)}
                </h3>
                <ul role="list" class="shop-list">
                  {list.map((j) => (
                    <BuildRow key={j.id} job={j} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </Card>

      {waiting.length > 0 && (
        <Card title="Waiting to be scheduled" subtitle="The office books these on the crew schedule" level={2} flush>
          <ul role="list" class="shop-list">
            {waiting.slice(0, 8).map((j) => (
              <BuildRow key={j.id} job={j} />
            ))}
          </ul>
        </Card>
      )}

      <div class="shop-grid">
        <Card title="Short on components" subtitle={short.length ? 'For every open build, after other reservations' : undefined} level={2}>
          {short.length === 0 ? (
            <p class="muted">Stock covers every open build.</p>
          ) : (
            <ul role="list" class="shop-short">
              {short.slice(0, 8).map((r) => (
                <li key={r.itemId}>
                  <Link to={`/office/inventory/?id=${r.itemId}`} class="shop-short__row">
                    <span>
                      <span class="shop-short__name">{r.part!.name}</span>
                      <span class="muted small">
                        {' '}
                        · builds need {r.qty}
                        {r.part!.uom !== 'ea' ? ` ${r.part!.uom}` : ''}, {r.onHand} on hand
                      </span>
                    </span>
                    <Badge tone="red" icon="alert">
                      {r.gap} short
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Finished lifts in the yard" level={2}>
          {yard.length === 0 ? (
            <p class="muted">No finished lifts in stock.</p>
          ) : (
            <ul role="list" class="shop-yard">
              {yard.map((it) => (
                <li key={it.id}>
                  <span>{it.name}</span>
                  <span class="muted small">
                    {it.stock.camdenton.onHand} on hand · {Math.max(0, available(it, 'camdenton'))} free
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p class="muted small shop-yard__note">
            <Icon name="info" size={14} /> Stock counts are sample data.
          </p>
        </Card>
      </div>
    </div>
  );
}
