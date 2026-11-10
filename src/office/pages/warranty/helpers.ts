/**
 * Warranty helpers: claim groups, and what FiberSteel's published warranty says about one part of one lift.
 * The terms come from src/data/warranty.ts (FiberSteel's Warranty page) — nothing here adds to them.
 */
import { remoteWarranty } from '../../../data/warranty';
import type { ClaimStatus, Component, Lift, RemoteBrand } from '../../data/types';
import { addDays, today } from '../../lib/dates';
import { shortDate } from '../../lib/format';
import { covers, liftCoverage, serviceFeeApplies } from '../../selectors';
import { notCoveredReason, warrantyEligible } from '../customers/helpers';

export const OPEN_CLAIMS: ClaimStatus[] = ['open', 'approved', 'part-sent'];
export const claimOrder: ClaimStatus[] = ['open', 'approved', 'part-sent', 'replaced', 'referred', 'denied'];

export const components: Component[] = ['Poly tank', 'Lift frame', 'Galvanized part', 'Blower controller', 'Bushings', 'Hose', 'Remote system'];

/** The published term for each part the warranty names */
export const componentTerm: Record<Component, string> = {
  'Poly tank': 'Lifetime',
  'Lift frame': 'Lifetime',
  'Galvanized part': '5 years',
  'Blower controller': '3 years',
  Bushings: '3 years',
  Hose: '3 years',
  'Remote system': 'The remote maker’s warranty',
};

export const componentLabel: Record<Component, string> = {
  'Poly tank': 'Polyethylene tanks',
  'Lift frame': 'Lift frame',
  'Galvanized part': 'Hot-dipped galvanized parts',
  'Blower controller': 'Blower controller',
  Bushings: 'Bushings',
  Hose: 'Hose',
  'Remote system': 'Remote system',
};

/** Who to call about a remote, from FiberSteel's Warranty page (FirstMate, Captain's Choice) */
export function remoteContact(brand?: RemoteBrand) {
  if (brand === 'FirstMate') return remoteWarranty[0];
  if (brand === 'Captain’s Choice') return remoteWarranty[1];
  return undefined;
}

export interface PartCoverage {
  component: Component;
  term: string;
  /** End of the term (undefined: lifetime, or not FiberSteel's to cover) */
  until?: string;
  covered: boolean;
  /** Plain-words explanation for the office */
  note: string;
}

/** What FiberSteel's warranty says about one part of this lift today */
export function partCoverage(l: Lift, component: Component, day = today()): PartCoverage {
  const term = componentTerm[component];
  if (component === 'Remote system') {
    const contact = remoteContact(l.remote?.brand);
    const note = !l.remote
      ? 'No remote on file for this lift.'
      : contact
        ? `${l.remote.brand} remotes: ${contact.note} ${contact.who}, ${contact.phone}.`
        : `FiberSteel’s site doesn’t state the warranty on ${l.remote.brand} remotes — confirm with FiberSteel.`;
    return { component, term, covered: false, note };
  }
  if (!warrantyEligible(l)) return { component, term, covered: false, note: notCoveredReason(l) };
  const cov = liftCoverage(l, day);
  const until = component === 'Galvanized part' ? cov[1].until : component === 'Poly tank' || component === 'Lift frame' ? undefined : cov[2].until;
  const covered = covers(l, component, day);
  const fee = serviceFeeApplies(l, day) ? ' The $95 service-call fee applies (it’s been more than a year since the install).' : ` The $95 service-call fee applies from ${shortDate(addDays(l.installedOn, 365), true)}, a year after the install.`;
  const note = covered
    ? `Covered: FiberSteel provides the part. The owner pays the service call and any labor.${fee}`
    : `The ${term === '5 years' ? '5-year' : '3-year'} term ended ${until ? shortDate(until, true) : ''} — the part, the service call and the labor are billable.`;
  return { component, term, until, covered, note };
}
