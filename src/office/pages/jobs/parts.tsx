/** Pieces the inbox, the job page and My day share: a lift at a dock, its warranty for a problem, a build's parts. */
import { remoteWarranty, serviceFee } from '../../../data/warranty';
import { useAssets } from '../../assets';
import { issues } from '../../data/catalog';
import type { Component, DB, Item, Job, Lead, Lift } from '../../data/types';
import { addDays, today } from '../../lib/dates';
import { money, shortDate } from '../../lib/format';
import { available, itemOf, itemPhotoKey, liftCoverage, serviceFeeApplies, warrantyState } from '../../selectors';
import { db } from '../../store';
import { Badge, cx } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { jobStatusOf, StatusBadge, warrantyMeta } from '../../ui/status';

/** A job's status, with "done" spelled out by how it's closed out (invoice, quote, or billed elsewhere) */
export const jobStatusFor = (job: Job) => jobStatusOf(job);

/** "Installed by FiberSteel · Jun 4, 2019" */
export const installedLine = (l: Lift) => `Installed ${l.installedBy === 'FiberSteel' ? 'by FiberSteel' : l.installedBy === 'Dealer' ? 'by a dealer' : 'by someone else'} · ${shortDate(l.installedOn, true)}`;

/** Which coverage row of FiberSteel's warranty a component falls under */
function coverageFor(l: Lift, component: Component) {
  const cov = liftCoverage(l);
  if (component === 'Poly tank' || component === 'Lift frame') return cov[0];
  if (component === 'Galvanized part') return cov[1];
  if (component === 'Blower controller' || component === 'Bushings' || component === 'Hose') return cov[2];
  return undefined;
}

/** Plain-words answer to "is this covered?", using only the published terms */
export function coverageAnswer(l: Lift, component: Component): { covered: boolean; text: string } {
  if (component === 'Remote system') {
    const maker = l.remote?.brand === 'FirstMate' ? remoteWarranty[0] : l.remote?.brand === 'Captain’s Choice' ? remoteWarranty[1] : undefined;
    return {
      covered: false,
      text: maker ? `Remote systems aren’t on the lift warranty. ${maker.who} handles ${l.remote?.brand} warranties: ${maker.phone}.` : 'Remote systems aren’t on the lift warranty — check the remote’s own warranty.',
    };
  }
  if (l.installedBy !== 'FiberSteel') return { covered: false, text: 'Not covered: the warranty is valid only if FiberSteel installed the lift.' };
  if (!l.originalOwner) return { covered: false, text: 'Not covered: the warranty is for the original purchaser, and this lift has changed hands.' };
  const row = coverageFor(l, component)!;
  if (row.covered) {
    return { covered: true, text: `${component} — covered (${row.term.toLowerCase()}${row.until ? `, until ${shortDate(row.until, true)}` : ''}). Parts only: the owner pays the service call and labor.` };
  }
  return { covered: false, text: `${component} — the ${row.term.replace(/(\d+) years/, '$1-year')} term ended ${shortDate(row.until!, true)}.` };
}

/** The $95 service fee: charged on service calls after one year from the installation date */
export function feeLine(l: Lift, day = today()) {
  if (serviceFeeApplies(l, day)) return `The $${serviceFee.amount} service fee applies — installed more than a year ago.`;
  return `No service fee yet — within a year of the install (it starts ${shortDate(addDays(l.installedOn, 365), true)}).`;
}

/** A lift at a customer's dock: what it is, who installed it, its warranty — and, for a problem, whether it's covered */
export function LiftBox({ lift, issueKey, issue, fee, class: className }: { lift: Lift; issueKey?: string; issue?: string; fee?: boolean; class?: string }) {
  const state = warrantyState(lift);
  const key = issueKey ?? (issue ? Object.entries(issues).find(([, def]) => def.label === issue)?.[0] : undefined);
  const component = key ? issues[key].component : undefined;
  const answer = component ? coverageAnswer(lift, component) : undefined;
  return (
    <div class={cx('lift-box', className)}>
      <span class="lift-box__icon" aria-hidden="true">
        <Icon name="lift" size={18} />
      </span>
      <div class="lift-box__text">
        <p class="lift-box__name">
          {lift.model} <span class="muted">· serial {lift.serial}</span>
        </p>
        <p class="muted small">
          {installedLine(lift)}
          {lift.boat ? ` · ${lift.boat.lengthFt} ft ${lift.boat.type.toLowerCase()}` : ''}
          {lift.remote ? ` · ${lift.remote.brand} remote` : ''}
          {lift.lastServiceOn ? ` · last service ${shortDate(lift.lastServiceOn, true)}` : ''}
        </p>
        <p class="lift-box__badges">
          <StatusBadge meta={warrantyMeta[state]} />
          {lift.registered ? (
            <Badge tone="neutral" icon="check">
              Registered
            </Badge>
          ) : (
            <Badge tone="amber" icon="clock">
              Not registered
            </Badge>
          )}
          {!lift.originalOwner && (
            <Badge tone="neutral" icon="users">
              Changed hands
            </Badge>
          )}
        </p>
        {answer && (
          <p class={cx('lift-box__cover', answer.covered ? 'is-covered' : 'is-not')}>
            <Icon name={answer.covered ? 'shield' : 'info'} size={14} />
            <span>{answer.text}</span>
          </p>
        )}
        {fee && <p class="lift-box__fee small">{feeLine(lift)}</p>}
      </div>
    </div>
  );
}

/** A catalog lift (being built, installed or delivered), with FiberSteel's own photo when there is one */
export function ItemBox({ item, note, class: className }: { item: Item; note?: string; class?: string }) {
  const { photos } = useAssets();
  const key = itemPhotoKey(item);
  const src = key ? photos[key] : undefined;
  return (
    <div class={cx('lift-box', className)}>
      {src ? (
        <img class="lift-box__thumb" src={src} alt="" width={48} height={48} loading="lazy" />
      ) : (
        <span class="lift-box__icon" aria-hidden="true">
          <Icon name={item.category === 'Remotes' ? 'remote' : 'lift'} size={18} />
        </span>
      )}
      <div class="lift-box__text">
        <p class="lift-box__name">{item.name}</p>
        <p class="muted small">
          {item.id}
          {item.capacity ? ` · rated ${item.capacity.toLocaleString('en-US')} lb` : ''}
          {note ? ` · ${note}` : ''}
        </p>
      </div>
    </div>
  );
}

/** What a request or job says about the boat and the slip */
export function boatLine(lead?: Pick<Lead, 'boat' | 'slip'>) {
  if (!lead?.boat) return undefined;
  const b = lead.boat;
  return `${b.lengthFt} ft ${b.type.toLowerCase()} · ${b.dryLb ? `${b.dryLb.toLocaleString('en-US')} lb dry` : 'dry weight not given'}${b.fuelGal ? ` · ${b.fuelGal} gal fuel` : ''}`;
}

export function slipLine(lead?: Pick<Lead, 'slip'>) {
  const s = lead?.slip;
  if (!s) return undefined;
  const size = s.widthFt && s.lengthFt ? `${s.widthFt} × ${s.lengthFt} ft slip` : s.widthFt ? `${s.widthFt} ft wide slip` : undefined;
  const dock = s.docking === 'back-in' ? 'backs in' : s.docking === 'straight' ? 'pulls straight in' : s.docking === 'not-sure' ? 'docking not decided' : undefined;
  return [size, dock].filter(Boolean).join(' · ') || undefined;
}

/**
 * A build's components: how many it needs, how many are reserved or used, and whether stock covers them. A reserved
 * part is short when every reservation together is more than what's on hand; one not reserved yet is short when the
 * free stock (on hand less reservations and displays) won't cover it.
 */
export function bomRows(d: DB, job: Job) {
  const item = itemOf(d, job.itemId);
  const qty = job.qty ?? 1;
  const finished = job.status === 'completed' || job.status === 'closed' || job.status === 'cancelled';
  return (item?.bom ?? []).map((b) => {
    const part = itemOf(d, b.itemId);
    const need = b.qty * qty;
    const onJob = job.parts.filter((p) => p.itemId === b.itemId);
    const used = onJob.filter((p) => p.status === 'used').reduce((s, p) => s + p.qty, 0);
    const reserved = onJob.filter((p) => p.status === 'reserved').reduce((s, p) => s + p.qty, 0);
    const s = part?.stock.camdenton;
    const outstanding = Math.max(0, need - used - reserved);
    const short = !finished && !!s && ((reserved > 0 && s.onHand < s.reserved) || (outstanding > 0 && outstanding > (part ? available(part, 'camdenton') : 0)));
    return { part, itemId: b.itemId, need, used, reserved, short, onHand: s?.onHand ?? 0, uom: part?.uom ?? 'ea' };
  });
}

/** Components a build is short of */
export const buildShortages = (d: DB, job: Job) => bomRows(d, job).filter((r) => r.short);

export function BomList({ job }: { job: Job }) {
  const d = db.value;
  const rows = bomRows(d, job);
  const short = new Set(rows.filter((r) => r.short).map((r) => r.itemId));
  if (!rows.length) return <p class="muted">No bill of materials for this lift in the demo catalog.</p>;
  return (
    <ul class="bom" role="list">
      {rows.map((r) => (
        <li key={r.itemId} class={cx('bom__row', short.has(r.itemId) && 'is-short')}>
          <span class="bom__name">
            {r.part?.name ?? r.itemId}
            <span class="muted small"> · {r.itemId}</span>
          </span>
          <span class="bom__qty tabular">
            {r.need}
            {r.uom !== 'ea' ? ` ${r.uom}` : ''}
          </span>
          {r.used >= r.need ? (
            <Badge tone="green" icon="check">
              Used
            </Badge>
          ) : short.has(r.itemId) ? (
            <Badge tone="red" icon="alert">
              Short · {r.onHand} on hand
            </Badge>
          ) : r.reserved > 0 ? (
            <Badge tone="blue" icon="lock">
              Reserved
            </Badge>
          ) : (
            <Badge tone="neutral" icon="box">
              {r.onHand} on hand
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A dealer order line's value */
export const lineValue = (qty: number, rate: number) => money(qty * rate, false);
