/** Inbox helpers: filters, customer and lift matching, suggestions and quick-reply templates. */
import { getSize, liftSizes } from '../../../data/lifts';
import { site } from '../../../data/site';
import { issues } from '../../data/catalog';
import type { Customer, DB, JobType, Lead, LeadKind, LeadStage, Lift } from '../../data/types';
import { now } from '../../lib/dates';
import { covers } from '../../selectors';
import { edit, me, mutate, uid } from '../../store';

export type InboxFilter = 'all' | 'new' | 'open' | 'closed';

export const OPEN_STAGES: LeadStage[] = ['contacted', 'scheduled', 'quoted'];
export const CLOSED_STAGES: LeadStage[] = ['won', 'lost', 'closed'];

export const inFilter = (l: Lead, f: InboxFilter) =>
  f === 'all' || (f === 'new' ? l.stage === 'new' : f === 'open' ? OPEN_STAGES.includes(l.stage) : CLOSED_STAGES.includes(l.stage));

/** "Jordan & Sam Ellison" stays as is; a business inquiry keeps the contact person's name */
export const personName = (l: Lead) => l.name.replace(/ — .*/, '');

/** "Jordan & Sam Ellison" → "Jordan" */
export const firstNameOf = (l: Lead) => personName(l).split(/\s+|&/)[0] || 'there';

export const field = (l: Lead, label: string) => l.fields.find(([k]) => k === label)?.[1];

/** Mark a request lost with a reason — one change, so the activity log reads cleanly. */
export function markLost(id: string, reason: string) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      const at = now();
      l.stage = 'lost';
      l.lostReason = reason;
      l.closedAt = at;
      l.unread = false;
      if (!l.firstResponseAt) l.firstResponseAt = at;
      l.activity.push({ id: uid('a'), at, by: me.value?.id ?? 'system', kind: 'status', text: `Marked lost — ${reason}` });
    }),
  );
}

/** Customers who might be the same person: same email, same name, or same phone and last name. */
export function possibleMatches(d: DB, l: Lead): Customer[] {
  const digits = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-10);
  const name = personName(l).toLowerCase();
  const last = name.split(/\s+/).pop() ?? '';
  const email = l.email?.toLowerCase();
  const tel = digits(l.phone);
  return d.customers
    .filter((c) => !c.tags.includes('Counter sales'))
    .filter((c) => {
      const cname = c.name.toLowerCase();
      if (email && c.email.toLowerCase() === email) return true;
      if (cname === name) return true;
      // A shared phone number only counts when the last name matches too
      return tel.length === 10 && digits(c.phone) === tel && !!last && cname.split(/\s+/).pop() === last;
    })
    .slice(0, 3);
}

/* ---------- Lifts and problems ---------- */

/** A lift size id from what the visitor saw ("10,000 lb lift") or sent (the raw value) */
export function sizeIdOf(l: Lead): string | undefined {
  const raw = l.data?.liftSize;
  if (raw && getSize(raw)) return raw;
  const shown = field(l, 'Lift size');
  return shown ? liftSizes.find((s) => s.name === shown)?.id : undefined;
}

/** The service problem as one of the catalog's issue keys (data/catalog.ts), from the words the visitor picked */
export function issueKeyOf(l: Lead): string | undefined {
  const text = `${field(l, 'The problem') ?? ''} ${l.summary} ${l.message ?? ''}`.toLowerCase();
  const exact = Object.entries(issues).find(([, def]) => text.includes(def.label.toLowerCase()));
  if (exact) return exact[0];
  const rules: [RegExp, string][] = [
    [/won.t raise|raises slow|slow/, 'slow-raise'],
    [/uneven|lean/, 'uneven'],
    [/blower|controller/, 'blower'],
    [/remote/, 'remote'],
    [/bunk|bracket|guide/, 'bunks'],
    [/hose|valve|leak/, 'hose'],
    [/bushing|squeak/, 'bushings'],
    [/storm|impact|hit/, 'impact'],
    [/tank/, 'tank'],
  ];
  return rules.find(([re]) => re.test(text))?.[1];
}

/** The customer's lift this request is most likely about: a serial match, a size match, or their only one */
export function likelyLift(d: DB, l: Lead, customerId: string | undefined): Lift | undefined {
  const serial = (l.data?.serial ?? field(l, 'Serial or order number'))?.trim().toUpperCase();
  if (serial) {
    const bySerial = d.lifts.find((x) => x.serial.toUpperCase() === serial);
    if (bySerial) return bySerial;
  }
  if (!customerId) return undefined;
  const lifts = d.lifts.filter((x) => x.customerId === customerId);
  const sizeId = sizeIdOf(l);
  const bySize = sizeId ? lifts.filter((x) => d.items.find((i) => i.id === x.itemId)?.sizeId === sizeId) : [];
  if (bySize.length === 1) return bySize[0];
  return lifts.length === 1 ? lifts[0] : undefined;
}

/** Registrations: lifts the request could be about (a serial match first, then the customer's own) */
export function registrationMatches(d: DB, l: Lead, customerId: string | undefined): Lift[] {
  const serial = (l.data?.serial ?? field(l, 'Serial or order number'))?.trim().toUpperCase();
  const out: Lift[] = [];
  if (serial) out.push(...d.lifts.filter((x) => x.serial.toUpperCase() === serial));
  if (customerId) out.push(...d.lifts.filter((x) => x.customerId === customerId && !out.includes(x)));
  return out.slice(0, 4);
}

/** The kind of job to suggest when scheduling from a request: a warranty visit when the problem's part is covered */
export function suggestedJobType(l: Lead, lift?: Lift): JobType {
  if (l.kind === 'quote') return 'site-visit';
  const key = issueKeyOf(l);
  if (lift && key && covers(lift, issues[key].component)) return 'warranty';
  return 'service';
}

/**
 * Website requests without the raw form values (older demo data) get them back from the labelled fields, so the
 * registration action has a size, a date and who installed it.
 */
export function fillRegistrationData(leadId: string) {
  mutate((d) =>
    edit(d.leads, leadId, (l) => {
      const data = { ...(l.data ?? {}) };
      if (!data.liftSize) {
        const id = sizeIdOf(l);
        if (id) data.liftSize = id;
      }
      if (!data.installedBy) {
        const by = field(l, 'Installed by') ?? '';
        data.installedBy = /dealer/i.test(by) ? 'dealer' : 'fibersteel';
      }
      if (!data.installDate) {
        const date = field(l, 'Installation date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) data.installDate = date;
      }
      if (!data.serial) {
        const serial = field(l, 'Serial or order number');
        if (serial) data.serial = serial;
      }
      if (!data.remote) {
        const remote = (field(l, 'Remote system') ?? '').toLowerCase();
        data.remote = remote.includes('admiral') ? 'admiral' : remote.includes('firstmate') ? 'firstmate' : remote.includes('captain') ? 'captains-choice' : '';
      }
      l.data = data;
    }),
  );
}

/* ---------- Quick replies ---------- */

export type ComposerMode = 'email' | 'call' | 'text' | 'note';

interface TemplateContext {
  first: string;
  me: string;
  /** The line to call back on: sales, or service and parts */
  phone: string;
}

interface Template {
  label: string;
  /** Request kinds it fits (all when absent) */
  kinds?: LeadKind[];
  text: (c: TemplateContext) => string;
}

const sign = (c: TemplateContext) => `${c.me}\nFiberSteel Boat Lifts · ${c.phone}`;

export const templates: Record<ComposerMode, Template[]> = {
  email: [
    {
      label: 'Set up a site visit',
      kinds: ['quote'],
      text: (c) =>
        `Hi ${c.first},\n\nThanks for the details on your boat. The best next step is a quick look at your slip: we’ll measure it, see how you like to dock, and recommend the size and bunk setup. Would a morning or an afternoon later this week work for you?\n\n${sign(c)}`,
    },
    {
      label: 'Ask for the boat details',
      kinds: ['quote'],
      text: (c) =>
        `Hi ${c.first},\n\nTo size a lift for you we need a few details: your boat’s brand, its model, its length and its weight, and your dock slip’s size (width × length). Reply with whatever you have and we’ll take it from there.\n\n${sign(c)}`,
    },
    {
      label: 'Ask for photos',
      kinds: ['service', 'question'],
      text: (c) =>
        `Hi ${c.first},\n\nThanks for letting us know. Could you reply with a couple of photos of the lift and the blower box on your dock? That helps us bring the right parts the first time.\n\n${sign(c)}`,
    },
    {
      label: 'Registration received',
      kinds: ['warranty'],
      text: (c) =>
        `Hi ${c.first},\n\nThanks for registering your lift — it’s on file. Please keep your proof of purchase somewhere safe: the warranty is for the original purchaser. If anything comes up, call the service and parts department at ${site.service.phone}.\n\n${sign(c)}`,
    },
    {
      label: 'Set up a dealer call',
      kinds: ['dealer'],
      text: (c) =>
        `Hi ${c.first},\n\nThanks for your interest in carrying FiberSteel lifts. I’d like to set up a call to hear about your business and the lakes you serve, and to walk you through the lifts and how ordering works. What times work for you this week?\n\n${sign(c)}`,
    },
    {
      label: 'You’re on the schedule',
      kinds: ['quote', 'service', 'warranty'],
      text: (c) => `Hi ${c.first},\n\nYou’re all set — we’ll confirm the day before, and the crew will call when they’re on the way. Reply here if anything changes.\n\n${sign(c)}`,
    },
  ],
  text: [
    { label: 'Quick intro', text: (c) => `Hi ${c.first}, this is ${c.me} with FiberSteel Boat Lifts. We got your request — is now a good time for a quick call?` },
    { label: 'Ask for a photo', kinds: ['service'], text: (c) => `Hi ${c.first}, could you text us a photo of the lift and the blower box? It helps us bring the right parts. Thanks! — ${c.me}, FiberSteel` },
    { label: 'On the way', kinds: ['quote', 'service', 'warranty'], text: (c) => `Hi ${c.first}, you’re on the schedule. The crew will call when they’re on the way. — FiberSteel Boat Lifts` },
  ],
  call: [
    { label: 'Talked — booking a site visit', kinds: ['quote'], text: (c) => `Talked with ${c.first}. Booking a site visit to measure the slip.` },
    { label: 'Talked — booking service', kinds: ['service', 'warranty'], text: (c) => `Talked with ${c.first}. Booking a service call.` },
    { label: 'Talked — sending details', kinds: ['dealer', 'question'], text: (c) => `Talked with ${c.first}. Sending the details by email.` },
    { label: 'Left a voicemail', text: (c) => `Left a voicemail for ${c.first} and sent a follow-up email.` },
    { label: 'No answer', text: (c) => `No answer. Will try ${c.first} again tomorrow morning.` },
  ],
  note: [
    { label: 'Waiting on boat details', kinds: ['quote'], text: () => 'Waiting on the boat’s weight and the slip size before quoting.' },
    { label: 'Check stock first', kinds: ['quote', 'service'], text: () => 'Check finished lifts and parts in stock before promising a date.' },
    { label: 'Proof of purchase', kinds: ['warranty'], text: () => 'Asked for proof of purchase — the warranty is for the original purchaser.' },
    { label: 'Dealer follow-up', kinds: ['dealer'], text: () => 'Follow up after the call about the lakes they serve and their first order.' },
  ],
};

export const templatesFor = (mode: ComposerMode, kind: LeadKind) => templates[mode].filter((t) => !t.kinds || t.kinds.includes(kind));

export const templateContext = (l: Lead): TemplateContext => ({
  first: firstNameOf(l),
  me: me.value?.name.split(' ')[0] ?? 'The FiberSteel team',
  phone: l.kind === 'service' || l.kind === 'warranty' ? site.service.phone : site.sales.phone,
});
