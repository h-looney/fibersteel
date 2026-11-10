/** Labels, colors and icons for every status in FiberSteel mode — color never carries meaning alone. */
import type { ClaimStatus, Dealer, DealerOrderStatus, Job, JobStatus, JobType, LeadKind, LeadSource, LeadStage } from '../data/types';
import type { InvoiceStatus, StockStatus, WarrantyState } from '../selectors';
import { Badge, type Tone } from './core';
import type { IconName } from './Icon';

type Meta = { label: string; tone: Tone; icon: IconName };

export const jobStatusMeta: Record<JobStatus, Meta> = {
  requested: { label: 'Needs scheduling', tone: 'amber', icon: 'clock' },
  scheduled: { label: 'Scheduled', tone: 'blue', icon: 'calendar' },
  'in-progress': { label: 'In progress', tone: 'accent', icon: 'wrench' },
  'on-hold': { label: 'On hold', tone: 'red', icon: 'alert' },
  completed: { label: 'Ready to invoice', tone: 'teal', icon: 'check' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'x-circle' },
};

/**
 * A job's status for display. A finished job says what's next: invoice it, write the quote (site visits), or just close
 * it (shop builds and dealer deliveries are billed with the install or the dealer order).
 */
export function jobStatusOf(job: Pick<Job, 'status' | 'type'> & { dealerOrderId?: string }): Meta {
  if (job.status !== 'completed') return jobStatusMeta[job.status];
  const next = job.type === 'site-visit' ? 'quote to write' : job.type === 'build' || (job.type === 'delivery' && job.dealerOrderId) ? 'to close' : 'to invoice';
  return { ...jobStatusMeta.completed, label: `Done · ${next}` };
}

export const jobTypeMeta: Record<JobType, Meta> = {
  'site-visit': { label: 'Site visit', tone: 'blue', icon: 'ruler' },
  build: { label: 'Shop build', tone: 'violet', icon: 'hardhat' },
  install: { label: 'Install', tone: 'accent', icon: 'lift' },
  service: { label: 'Service call', tone: 'amber', icon: 'wrench' },
  warranty: { label: 'Warranty', tone: 'green', icon: 'shield' },
  delivery: { label: 'Delivery', tone: 'neutral', icon: 'truck' },
  remote: { label: 'Remote install', tone: 'teal', icon: 'remote' },
};

export const leadStageMeta: Record<LeadStage, Meta> = {
  new: { label: 'New', tone: 'accent', icon: 'sparkle' },
  contacted: { label: 'Contacted', tone: 'blue', icon: 'phone' },
  scheduled: { label: 'Scheduled', tone: 'teal', icon: 'calendar' },
  quoted: { label: 'Quote sent', tone: 'violet', icon: 'file' },
  won: { label: 'Won', tone: 'green', icon: 'check-circle' },
  lost: { label: 'Lost', tone: 'neutral', icon: 'x-circle' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'archive' },
};

export const leadKindMeta: Record<LeadKind, Meta> = {
  quote: { label: 'Quote request', tone: 'accent', icon: 'lift' },
  service: { label: 'Service request', tone: 'blue', icon: 'wrench' },
  warranty: { label: 'Warranty registration', tone: 'green', icon: 'shield' },
  dealer: { label: 'Dealer inquiry', tone: 'violet', icon: 'handshake' },
  question: { label: 'Message', tone: 'neutral', icon: 'message' },
};

export const sourceLabels: Record<LeadSource, string> = {
  'web-quote': 'Website quote form',
  'web-service': 'Website service form',
  'web-warranty': 'Website warranty registration',
  'web-dealer': 'Website dealer form',
  'web-contact': 'Website contact form',
  phone: 'Phone call',
  'walk-in': 'Walk-in',
  facebook: 'Facebook',
  referral: 'Referral',
  'boat-show': 'Boat show',
};

export const invoiceStatusMeta: Record<InvoiceStatus, Meta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'edit' },
  open: { label: 'Open', tone: 'blue', icon: 'clock' },
  partial: { label: 'Partially paid', tone: 'teal', icon: 'dollar' },
  overdue: { label: 'Overdue', tone: 'red', icon: 'alert' },
  paid: { label: 'Paid', tone: 'green', icon: 'check-circle' },
  void: { label: 'Void', tone: 'neutral', icon: 'x-circle' },
  sent: { label: 'Sent', tone: 'blue', icon: 'send' },
  accepted: { label: 'Accepted', tone: 'green', icon: 'check-circle' },
  declined: { label: 'Declined', tone: 'neutral', icon: 'x-circle' },
  expired: { label: 'Expired', tone: 'amber', icon: 'clock' },
};

export const claimStatusMeta: Record<ClaimStatus, Meta> = {
  open: { label: 'Open', tone: 'amber', icon: 'clock' },
  approved: { label: 'Approved', tone: 'teal', icon: 'check' },
  'part-sent': { label: 'Part sent', tone: 'violet', icon: 'truck' },
  replaced: { label: 'Replaced', tone: 'green', icon: 'check-circle' },
  referred: { label: 'Referred to the maker', tone: 'blue', icon: 'external' },
  denied: { label: 'Not covered', tone: 'red', icon: 'x-circle' },
};

export const orderStatusMeta: Record<DealerOrderStatus, Meta> = {
  quote: { label: 'Quote', tone: 'neutral', icon: 'file' },
  confirmed: { label: 'Confirmed', tone: 'blue', icon: 'check' },
  building: { label: 'Building', tone: 'violet', icon: 'hardhat' },
  ready: { label: 'Ready to ship', tone: 'amber', icon: 'box' },
  shipped: { label: 'Shipped', tone: 'teal', icon: 'truck' },
  delivered: { label: 'Delivered', tone: 'green', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'x-circle' },
};

export const dealerStatusMeta: Record<Dealer['status'], Meta> = {
  active: { label: 'Active', tone: 'green', icon: 'check-circle' },
  prospect: { label: 'Prospect', tone: 'violet', icon: 'sparkle' },
  paused: { label: 'Paused', tone: 'neutral', icon: 'clock' },
};

export const stockMeta: Record<StockStatus, Meta> = {
  ok: { label: 'In stock', tone: 'green', icon: 'check' },
  low: { label: 'Low', tone: 'amber', icon: 'alert' },
  out: { label: 'Out of stock', tone: 'red', icon: 'x-circle' },
  special: { label: 'Built to order', tone: 'neutral', icon: 'hardhat' },
};

export const warrantyMeta: Record<WarrantyState, Meta> = {
  active: { label: 'Covered', tone: 'green', icon: 'shield' },
  expiring: { label: 'A term ends soon', tone: 'amber', icon: 'clock' },
  'lifetime-only': { label: 'Tanks & frame (lifetime)', tone: 'blue', icon: 'shield' },
  'not-eligible': { label: 'Not covered', tone: 'neutral', icon: 'minus' },
};

export function StatusBadge({ meta }: { meta: Meta }) {
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
