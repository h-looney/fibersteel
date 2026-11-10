/** One request: who it's from, what they asked for, what happens next, and the conversation so far. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { estimateLiftSize, formula, getSize, lb, quoteChecklist } from '../../../data/lifts';
import { keyPoints } from '../../../data/warranty';
import { assignLead, createCustomerFromLead, createDealerFromLead, linkLeadToCustomer, markLeadRead, orderFromEstimate, registerFromLead, setLeadStage, toggleLeadStar } from '../../actions';
import { issues, liftItemFor } from '../../data/catalog';
import type { Activity, Lead, LeadStage, Lift } from '../../data/types';
import { openDialog } from '../../dialogs';
import { dayTime, longDate, money, phone, plural, relative, shortDate, telHref, time } from '../../lib/format';
import { navigate, PUBLIC_HOME } from '../../router';
import { customerOf, dealerOf, firstName, invoiceOf, invoiceStatus, invoiceTotals, staffOf } from '../../selectors';
import { db, history } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, cx, Details, Field, Link, Menu } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon, type IconName } from '../../ui/Icon';
import { invoiceStatusMeta, jobTypeMeta, leadKindMeta, leadStageMeta, sourceLabels, StatusBadge } from '../../ui/status';
import { jobPath } from '../jobs/helpers';
import { boatLine, jobStatusFor, LiftBox, slipLine } from '../jobs/parts';
import { Composer } from './Composer';
import {
  CLOSED_STAGES,
  field,
  fillRegistrationData,
  firstNameOf,
  issueKeyOf,
  likelyLift,
  markLost,
  personName,
  possibleMatches,
  registrationMatches,
  sizeIdOf,
  suggestedJobType,
} from './helpers';

const stages = Object.keys(leadStageMeta) as LeadStage[];

const activityIcons: Record<Activity['kind'], IconName> = {
  received: 'inbox',
  note: 'note',
  email: 'mail',
  call: 'phone',
  text: 'message',
  status: 'refresh',
  assign: 'user',
  job: 'clipboard',
  estimate: 'file',
  system: 'info',
};

const activityLabels: Record<Activity['kind'], string> = {
  received: 'Request received',
  note: 'Note',
  email: 'Email',
  call: 'Call',
  text: 'Text message',
  status: 'Status update',
  assign: 'Assignment',
  job: 'Scheduling',
  estimate: 'Quote',
  system: 'Update',
};

/** The website form each kind of request comes from (for the demo note) */
const formNames: Record<Lead['kind'], string> = {
  quote: 'quote',
  service: 'service request',
  warranty: 'warranty registration',
  dealer: 'become-a-dealer',
  question: 'contact',
};

const lostReasons = ['Went with another lift company', 'Over budget', 'Postponed to next season', 'Bought a used lift', 'No response after follow-ups', 'Outside the area we serve', 'Other'];

/** Public site pages, opened from the demo in a new tab */
const siteHref = (path: string) => `${PUBLIC_HOME}${path.replace(/^\//, '')}`;

function LostDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [reason, setReason] = useState(lostReasons[0]);
  const [note, setNote] = useState('');
  return (
    <Dialog
      title="Mark as lost"
      description="Knowing why helps spot patterns in the lead reports."
      size="sm"
      class="inbox-dialog"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              markLost(lead.id, note.trim() ? `${reason} (${note.trim()})` : reason);
              toast(`${personName(lead)} marked lost — ${reason.toLowerCase()}`);
              onClose();
            }}
          >
            Mark lost
          </Button>
        </>
      }
    >
      <div class="stack">
        <Field label="Reason">
          <select class="select" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
            {lostReasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Note" optional>
          <textarea class="textarea" rows={3} value={note} placeholder="Anything worth remembering for next time" onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function Timeline({ lead }: { lead: Lead }) {
  const d = db.value;
  const items = [...lead.activity].sort((a, b) => (a.at < b.at ? 1 : -1));
  const who = (a: Activity) => (a.by === 'customer' ? personName(lead) : a.by === 'system' ? 'FiberSteel mode' : staffOf(d, a.by)?.name ?? firstName(d, a.by));
  return (
    <ol class="timeline lead-timeline">
      {items.map((a) => (
        <li key={a.id}>
          <span class={`timeline__icon lead-timeline__icon--${a.kind}`}>
            <Icon name={activityIcons[a.kind]} size={14} />
          </span>
          <div class="timeline__text">
            <p class="lead-timeline__head">
              <strong>{who(a)}</strong>
              <span class="muted"> · {activityLabels[a.kind]}</span>
            </p>
            <p class={cx('lead-timeline__body', (a.kind === 'email' || a.kind === 'text') && a.by !== 'system' && 'is-message')}>{a.text}</p>
            <p class="timeline__meta">
              <time dateTime={a.at}>
                {relative(a.at)} · {dayTime(a.at)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CustomerCard({ lead }: { lead: Lead }) {
  const d = db.value;
  // A dealer inquiry with an account is linked through the dealer's customer record
  const customer = customerOf(d, lead.customerId ?? dealerOf(d, lead.dealerId)?.customerId);

  if (!customer) {
    const matches = possibleMatches(d, lead);
    return (
      <Card title="Customer record" level={3} class="lead-card">
        <p class="muted">No customer record is linked to this request yet.</p>
        {matches.length > 0 && (
          <ul class="lead-matches" role="list">
            {matches.map((c) => (
              <li key={c.id} class="lead-match">
                <span class="lead-match__text">
                  <span class="lead-match__label">Possible match</span>
                  <strong>{c.name}</strong>
                  <span class="muted small">
                    {c.lake ? c.lake.arm : c.address.city} · {phone(c.phone)}
                  </span>
                </span>
                <Button
                  size="sm"
                  icon="link"
                  onClick={() => {
                    linkLeadToCustomer(lead.id, c.id);
                    toast(`Linked to ${c.name}`);
                  }}
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
        )}
        {lead.kind !== 'dealer' && (
          <Button
            icon="plus"
            onClick={() => {
              const id = createCustomerFromLead(lead.id);
              toast(`Customer record ${id} created`, { tone: 'success' });
            }}
          >
            Create customer record
          </Button>
        )}
      </Card>
    );
  }

  const lifts = d.lifts.filter((l) => l.customerId === customer.id);
  const liftIds = new Set(lifts.map((l) => l.id));
  const pastVisits =
    d.jobs.filter((j) => j.customerId === customer.id && (j.status === 'closed' || j.status === 'completed')).length +
    (history.value?.jobs.filter((f) => f.liftId && liftIds.has(f.liftId)).length ?? 0);

  return (
    <Card
      title="Existing customer"
      level={3}
      class="lead-card"
      actions={
        <Link class="card-link" to={`/office/customers/?id=${customer.id}`}>
          Open <Icon name="arrow-right" size={14} />
        </Link>
      }
    >
      <p class="lead-customer">
        <Link to={`/office/customers/?id=${customer.id}`} class="lead-customer__name">
          {customer.name}
        </Link>
        <span class="muted small">
          Customer since {customer.since.slice(0, 4)}
          {pastVisits > 0 ? ` · ${plural(pastVisits, 'past visit')}` : ''}
          {customer.kind !== 'owner' ? ` · ${customer.kind === 'dealer' ? 'Dealer' : 'Marina'}` : ''}
        </span>
      </p>
      {lifts.length === 0 ? (
        <p class="muted small">No lifts on file yet.</p>
      ) : (
        <ul class="lead-lifts" role="list">
          {lifts.slice(0, 3).map((l) => (
            <li key={l.id}>
              <LiftBox lift={l} />
            </li>
          ))}
        </ul>
      )}
      {lifts.length > 3 && <p class="muted small">+ {plural(lifts.length - 3, 'more lift')}</p>}
    </Card>
  );
}

/* ---------- What each kind of request is about ---------- */

/** FiberSteel's formula, worked through for this boat */
function FormulaBox({ lead }: { lead: Lead }) {
  const boat = lead.boat!;
  const est = estimateLiftSize(boat.dryLb, boat.fuelGal ?? 0, boat.lengthFt);
  const size = est.size;
  return (
    <div class="lead-formula" role="group" aria-label="FiberSteel’s lift-size formula">
      <p class="lead-formula__title">
        <Icon name="calculator" size={16} /> FiberSteel’s formula
      </p>
      <p class="lead-formula__math">
        {lb(est.dryWeight)} dry weight + {boat.fuelGal ?? 0} gal fuel × {formula.fuelLbPerGallon} lb ({lb(est.fuelWeight)}) + {lb(est.allowance)} for {boat.lengthFt > formula.lengthCutoffFt ? `boats over ${formula.lengthCutoffFt} ft` : `boats up to ${formula.lengthCutoffFt} ft`} ={' '}
        <strong>{lb(est.needed)}</strong>
      </p>
      <p class="lead-formula__result">
        {size ? (
          <>
            Smallest standard size that covers it: <strong>{size.name}</strong>
            {' · '}
            <a href={siteHref(`/lifts/sizes/#size-${size.id}`)} target="_blank" rel="noopener">
              On the size chart<span class="sr-only"> (opens the public site in a new tab)</span>
            </a>
          </>
        ) : (
          <>More than the largest standard size — talk it through as a custom build.</>
        )}
      </p>
      {lead.suggestedSize && size && lead.suggestedSize !== size.id && <p class="muted small">The request suggested {getSize(lead.suggestedSize)?.name ?? lead.suggestedSize}; the numbers above say {size.name}.</p>}
    </div>
  );
}

function QuotePanel({ lead }: { lead: Lead }) {
  const boat = boatLine(lead);
  const slip = slipLine(lead);
  return (
    <Card title="The boat & the slip" level={3} class="lead-card">
      {lead.boat ? (
        <>
          <Details
            columns={2}
            items={[
              ['Boat', lead.boat.type],
              ['Length', `${lead.boat.lengthFt} ft`],
              ['Dry weight', lead.boat.dryLb ? lb(lead.boat.dryLb) : 'Not given'],
              ['Fuel', lead.boat.fuelGal ? `${lead.boat.fuelGal} gal` : 'Not given'],
              ['Slip', slip ?? 'Not given'],
              ['Brand & model', [field(lead, 'Boat brand'), field(lead, 'Model')].filter((v) => v && v !== '(not given)').join(' ') || undefined],
            ]}
          />
          {lead.boat.dryLb > 0 ? <FormulaBox lead={lead} /> : <p class="muted small">Add the dry weight to work out the size.</p>}
        </>
      ) : (
        <div class="lead-ask">
          <p>{boat ?? 'No boat details yet.'} To size a lift, FiberSteel asks for:</p>
          <ul>
            {quoteChecklist.map((f) => (
              <li key={f.text}>{f.text}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ServicePanel({ lead }: { lead: Lead }) {
  const d = db.value;
  const customer = customerOf(d, lead.customerId);
  const key = issueKeyOf(lead);
  const lifts = customer ? d.lifts.filter((l) => l.customerId === customer.id) : [];
  const likely = likelyLift(d, lead, customer?.id);
  return (
    <Card title="The lift & the problem" level={3} class="lead-card">
      <Details
        columns={2}
        items={[
          ['Problem', field(lead, 'The problem') ?? lead.summary],
          ['Matches', key ? issues[key].label : 'Pick one when booking'],
          ['Lift size (they said)', field(lead, 'Lift size')],
          ['Installed by', field(lead, 'Installed by')],
          ['Installed', field(lead, 'Installed (year)')],
          ['Remote', field(lead, 'Remote system')],
        ]}
      />
      {customer ? (
        lifts.length ? (
          <ul class="lead-lifts" role="list">
            {[...lifts]
              .sort((a, b) => Number(b.id === likely?.id) - Number(a.id === likely?.id))
              .map((l) => (
                <li key={l.id}>
                  {l.id === likely?.id && lifts.length > 1 && <p class="lead-lifts__hint">Most likely this one</p>}
                  <LiftBox lift={l} issueKey={key} fee />
                </li>
              ))}
          </ul>
        ) : (
          <p class="muted small">No lifts on {customer.name}’s record yet — add it on the customer page to check the warranty.</p>
        )
      ) : (
        <p class="muted small">Link or create the customer record to see their lifts and whether the warranty covers this.</p>
      )}
    </Card>
  );
}

function WarrantyPanel({ lead }: { lead: Lead }) {
  const d = db.value;
  const customer = customerOf(d, lead.customerId);
  const matches = registrationMatches(d, lead, customer?.id);
  const byDealer = /dealer/i.test(field(lead, 'Installed by') ?? lead.data?.installedBy ?? '');
  const done = lead.stage === 'closed' || lead.stage === 'won';
  const registered = done ? d.lifts.find((l) => l.registered && lead.activity.some((a) => a.text.includes(l.serial))) : undefined;

  const register = (lift?: Lift) => {
    fillRegistrationData(lead.id);
    const id = registerFromLead(lead.id, lift?.id);
    const l = db.value.lifts.find((x) => x.id === id);
    toast(`${l?.model ?? 'Lift'} registered${l?.registrationNo ? ` — ${l.registrationNo}` : ''}`, { tone: 'success', action: l ? { label: 'Open', run: () => navigate(`/office/customers/?id=${l.customerId}&lift=${l.id}`) } : undefined });
  };

  return (
    <Card title="Warranty registration" level={3} class="lead-card">
      <Details
        columns={2}
        items={[
          ['Lift size', field(lead, 'Lift size')],
          ['Installed', field(lead, 'Installation date') ? shortDate(field(lead, 'Installation date')!, true) : undefined],
          ['Installed by', field(lead, 'Installed by')],
          ['Serial or order #', field(lead, 'Serial or order number')],
          ['Remote', field(lead, 'Remote system')],
          ['Where', field(lead, 'Where the lift is') ?? lead.location],
        ]}
      />
      {byDealer && (
        <p class="callout callout--blue lead-callout">
          <Icon name="info" size={16} />
          <span>{keyPoints[3]}</span>
        </p>
      )}
      {registered ? (
        <div class="lead-registered">
          <LiftBox lift={registered} />
        </div>
      ) : done ? (
        <p class="muted small">This registration is closed.</p>
      ) : (
        <>
          <h4 class="section-label">{matches.length ? 'Lifts it could be' : 'No matching lift on file'}</h4>
          {matches.length > 0 && (
            <ul class="lead-lifts" role="list">
              {matches.map((l) => (
                <li key={l.id} class="lead-lifts__pick">
                  <LiftBox lift={l} />
                  {l.registered ? (
                    <span class="muted small">Already registered ({l.registrationNo})</span>
                  ) : (
                    <Button size="sm" icon="shield" onClick={() => register(l)}>
                      Register this lift
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div class="lead-actions">
            <Button variant={matches.length ? 'secondary' : 'primary'} icon="plus" onClick={() => register()}>
              {customer ? 'Add it as a new lift and register it' : 'Create the customer, add the lift and register it'}
            </Button>
          </div>
          <p class="lead-actions__hint">Registering records the lift on the customer’s page with its warranty worked out from the install date.</p>
        </>
      )}
    </Card>
  );
}

function DealerPanel({ lead }: { lead: Lead }) {
  const d = db.value;
  const dealer = dealerOf(d, lead.dealerId);
  return (
    <Card
      title="The business"
      level={3}
      class="lead-card"
      actions={
        dealer ? (
          <Link class="card-link" to={`/office/dealers/?id=${dealer.id}`}>
            Dealer account <Icon name="arrow-right" size={14} />
          </Link>
        ) : undefined
      }
    >
      <Details
        columns={2}
        items={[
          ['Business', field(lead, 'Business')],
          ['Type', field(lead, 'Type of business')],
          ['Town', [field(lead, 'City'), field(lead, 'State')].filter(Boolean).join(', ') || lead.location],
          ['Lakes / areas', field(lead, 'Lakes / areas served')],
          ['Website', field(lead, 'Website')],
          ['In business', field(lead, 'Years in business') ? `${field(lead, 'Years in business')} years` : undefined],
        ]}
      />
      {dealer ? (
        <p class="muted small">
          Account {dealer.id} · {dealer.status === 'prospect' ? 'a prospect' : `${dealer.status} since ${shortDate(dealer.since, true)}`}
        </p>
      ) : (
        <p class="muted small">A dealer account keeps their orders, invoices and contact in one place. It starts as a prospect.</p>
      )}
    </Card>
  );
}

/* ---------- The request ---------- */

export function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const d = db.value;
  const [losing, setLosing] = useState(false);
  const kind = leadKindMeta[lead.kind];
  const jobs = d.jobs.filter((j) => j.leadId === lead.id || j.id === lead.jobId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const estimate = invoiceOf(d, lead.estimateId);
  const isClosed = CLOSED_STAGES.includes(lead.stage);
  const first = firstNameOf(lead);
  const lift = likelyLift(d, lead, lead.customerId);
  const sizeId = lead.suggestedSize ?? (lead.boat && lead.boat.dryLb ? estimateLiftSize(lead.boat.dryLb, lead.boat.fuelGal ?? 0, lead.boat.lengthFt).size?.id : undefined) ?? sizeIdOf(lead);
  const hasVisit = jobs.some((j) => j.type === 'site-visit' && j.status !== 'cancelled');
  const install = jobs.find((j) => j.type === 'install' && j.status !== 'cancelled');
  const quoteOpen = estimate && estimate.status !== 'accepted' && estimate.status !== 'declined' && estimate.status !== 'void';

  const ensureCustomer = () => lead.customerId ?? createCustomerFromLead(lead.id);

  const bookVisit = () => {
    const customerId = ensureCustomer();
    openDialog({
      kind: 'job',
      preset: {
        type: 'site-visit',
        customerId,
        leadId: lead.id,
        itemId: sizeId ? liftItemFor(sizeId) : undefined,
        location: lead.location,
        description: [boatLine(lead), slipLine(lead), lead.message].filter(Boolean).join('. '),
      },
    });
  };

  const bookService = () => {
    const customerId = ensureCustomer();
    const issueKey = issueKeyOf(lead);
    openDialog({
      kind: 'job',
      preset: {
        type: suggestedJobType(lead, lift),
        customerId,
        liftId: lift?.id,
        leadId: lead.id,
        issueKey,
        location: lead.location,
        description: lead.message ?? field(lead, 'The problem'),
      },
    });
  };

  const writeQuote = () => {
    const customerId = ensureCustomer();
    openDialog({ kind: 'invoice', preset: { kind: 'estimate', customerId, leadId: lead.id, itemId: sizeId ? liftItemFor(sizeId) : undefined } });
  };

  const orderLift = () => {
    if (!estimate) return;
    const { buildId, installId } = orderFromEstimate(estimate.id);
    if (!buildId) {
      toast(`Quote ${estimate.id} accepted — it has no lift on it, so no build was started`);
      return;
    }
    toast(`Quote accepted — shop build ${buildId} and install ${installId} are waiting to be scheduled`, { tone: 'success', action: { label: 'Open the install', run: () => navigate(jobPath(installId!)) } });
  };

  const changeStage = (stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === 'lost') return setLosing(true);
    setLeadStage(lead.id, stage);
    toast(`Moved to ${leadStageMeta[stage].label}`);
  };

  const preferred = field(lead, 'Best way to reach you') ?? customerOf(d, lead.customerId)?.contactPref.replace(/^./, (c) => c.toUpperCase());
  const staffGroups = [
    { label: 'Office', people: d.staff.filter((s) => !s.tech && !s.shop && (s.active || s.id === lead.assignee)) },
    { label: 'Crews & shop', people: d.staff.filter((s) => (s.tech || s.shop) && (s.active || s.id === lead.assignee)) },
  ];

  const contact: [string, ComponentChildren][] = [
    ['Email', lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : undefined],
    ['Phone', lead.phone ? <a href={telHref(lead.phone)}>{phone(lead.phone)}</a> : undefined],
    [lead.kind === 'dealer' ? 'Where' : 'Where the dock is', lead.location],
    ['Town', [lead.city, lead.zip].filter(Boolean).join(' ') || undefined],
    ['Prefers', preferred],
    ['Came in through', sourceLabels[lead.source]],
    ['Received', `${longDate(lead.receivedAt)} at ${time(lead.receivedAt)}`],
  ];

  // Fields the kind's own card already shows stay out of "What they sent"
  const shown: Record<Lead['kind'], string[]> = {
    quote: ['Boat type', 'Boat brand', 'Model', 'Length (ft)', 'Dry weight (lb)', 'Fuel capacity (gal)', 'Slip width (ft)', 'Slip length (ft)', 'Docking'],
    service: ['The problem', 'Lift size', 'Installed by', 'Installed (year)', 'Remote system'],
    warranty: ['Lift size', 'Installation date', 'Installed by', 'Serial or order number', 'Remote system', 'Where the lift is'],
    dealer: ['Business', 'Type of business', 'City', 'State', 'Lakes / areas served', 'Website', 'Years in business'],
    question: [],
  };
  const fields = lead.fields.filter(([k]) => ![...shown[lead.kind], 'Where the dock is', 'ZIP code', 'Best way to reach you'].includes(k));

  return (
    <article class="lead" aria-labelledby={`lead-${lead.id}-name`}>
      <header class="lead-head card">
        <button type="button" class="btn btn--ghost btn--sm lead-head__back" onClick={onBack}>
          <Icon name="arrow-left" size={16} />
          <span>All requests</span>
        </button>
        <div class="lead-head__top">
          <div class="lead-head__title">
            <div class="lead-head__badges">
              <Badge tone={kind.tone} icon={kind.icon}>
                {kind.label}
              </Badge>
              <StatusBadge meta={leadStageMeta[lead.stage]} />
              {lead.demo && (
                <Badge tone="green" icon="globe">
                  Sent in this demo
                </Badge>
              )}
            </div>
            <h2 id={`lead-${lead.id}-name`} class="lead-head__name">
              {lead.name}
            </h2>
            <p class="lead-head__meta">
              {lead.id} · {sourceLabels[lead.source]} · received {relative(lead.receivedAt)}
            </p>
          </div>
          <div class="lead-head__tools">
            <button
              type="button"
              class={cx('btn btn--ghost btn--md btn--icon', lead.starred && 'is-starred')}
              aria-pressed={!!lead.starred}
              aria-label={lead.starred ? 'Remove star' : 'Star this request'}
              onClick={() => toggleLeadStar(lead.id)}
            >
              <Icon name="star" size={18} />
            </button>
            <Menu
              label="More actions"
              items={[
                {
                  label: 'Mark as unread',
                  icon: 'eye',
                  onSelect: () => {
                    markLeadRead(lead.id, false);
                    onBack();
                  },
                },
                isClosed
                  ? { label: 'Reopen request', icon: 'undo', onSelect: () => (setLeadStage(lead.id, lead.estimateId ? 'quoted' : 'contacted', 'Reopened'), toast('Request reopened')) }
                  : { label: 'Close request', icon: 'archive', onSelect: () => (setLeadStage(lead.id, 'closed', 'Closed'), toast('Request closed')) },
              ]}
            />
          </div>
        </div>
        <div class="lead-head__controls">
          <label class="lead-head__control">
            <span>Stage</span>
            <select class="select select--sm" value={lead.stage} onChange={(e) => changeStage((e.target as HTMLSelectElement).value as LeadStage)}>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {leadStageMeta[s].label}
                </option>
              ))}
            </select>
          </label>
          <label class="lead-head__control">
            <span>Assigned to</span>
            <select
              class="select select--sm"
              value={lead.assignee ?? ''}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value || undefined;
                assignLead(lead.id, v);
                toast(v ? `Assigned to ${staffOf(d, v)?.name}` : 'Unassigned');
              }}
            >
              <option value="">Unassigned</option>
              {staffGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.people.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      </header>

      {lead.demo && (
        <div class="callout callout--green lead-demo" role="note">
          <Icon name="sparkle" size={18} />
          <div>
            <p class="callout__title">Submitted on the website (this demo)</p>
            <p class="callout__text">
              You sent this from the concept site’s {formNames[lead.kind]} form in this browser, and the demo passed it here so you can follow it through
              {lead.customerId ? ' — it even matched an existing customer' : ''}. On the real website, requests are emailed to the address FiberSteel chooses, for the team to review. FiberSteel mode is optional.
            </p>
          </div>
        </div>
      )}

      <Card title="Next steps" level={3} class="lead-card">
        {(jobs.length > 0 || estimate) && (
          <ul class="lead-links" role="list">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link to={jobPath(job.id)} class="lead-link">
                  <span class="lead-link__icon">
                    <Icon name={jobTypeMeta[job.type].icon} size={16} />
                  </span>
                  <span class="lead-link__text">
                    <strong>
                      {job.id} · {job.title}
                    </strong>
                    <span class="muted small">
                      {jobTypeMeta[job.type].label} · {job.start ? dayTime(job.start) : 'not on the schedule yet'}
                      {job.crew.length ? ` · ${job.crew.map((c) => staffOf(d, c)?.name.split(' ')[0]).join(' & ')}` : ''}
                    </span>
                  </span>
                  <StatusBadge meta={jobStatusFor(job)} />
                </Link>
              </li>
            ))}
            {estimate && (
              <li>
                <Link to={`/office/accounting/?tab=estimates&id=${estimate.id}`} class="lead-link">
                  <span class="lead-link__icon">
                    <Icon name="file" size={16} />
                  </span>
                  <span class="lead-link__text">
                    <strong>Quote {estimate.id}</strong>
                    <span class="muted small">
                      {money(invoiceTotals(estimate).total)} · {estimate.status === 'draft' ? 'drafted' : 'sent'} {shortDate(estimate.issuedOn)}
                    </span>
                  </span>
                  <StatusBadge meta={invoiceStatusMeta[invoiceStatus(estimate)]} />
                </Link>
              </li>
            )}
          </ul>
        )}
        <div class="lead-actions">
          {isClosed ? (
            <>
              <p class="muted lead-actions__note">
                {lead.stage === 'won' ? 'Won' : lead.stage === 'lost' ? `Lost${lead.lostReason ? ` — ${lead.lostReason.toLowerCase()}` : ''}` : 'Closed'}
                {lead.closedAt ? ` on ${shortDate(lead.closedAt)}` : ''}.
              </p>
              {install && (
                <Button icon="lift" onClick={() => navigate(jobPath(install.id))}>
                  Open the install
                </Button>
              )}
              <Button icon="undo" onClick={() => (setLeadStage(lead.id, lead.estimateId ? 'quoted' : 'contacted', 'Reopened'), toast('Request reopened'))}>
                Reopen
              </Button>
            </>
          ) : (
            <>
              {lead.kind === 'quote' && (
                <>
                  {!hasVisit && !install && (
                    <Button variant="primary" icon="ruler" onClick={bookVisit}>
                      Book a site visit
                    </Button>
                  )}
                  {!estimate && (
                    <Button variant={hasVisit ? 'primary' : 'secondary'} icon="file" onClick={writeQuote}>
                      Write a quote
                    </Button>
                  )}
                  {quoteOpen && (
                    <Button variant="primary" icon="check-circle" onClick={orderLift}>
                      Quote accepted — order the lift
                    </Button>
                  )}
                  <Button variant="ghost" icon="x-circle" onClick={() => setLosing(true)}>
                    Mark lost
                  </Button>
                </>
              )}
              {lead.kind === 'service' && !jobs.some((j) => j.status !== 'cancelled') && (
                <Button variant="primary" icon="calendar-plus" onClick={bookService}>
                  {suggestedJobType(lead, lift) === 'warranty' ? 'Book a warranty visit' : 'Book a service call'}
                </Button>
              )}
              {lead.kind === 'dealer' && !lead.dealerId && (
                <Button
                  variant="primary"
                  icon="handshake"
                  onClick={() => {
                    const id = createDealerFromLead(lead.id);
                    toast(`Dealer account ${id} created as a prospect`, { tone: 'success', action: { label: 'Open', run: () => navigate(`/office/dealers/?id=${id}`) } });
                  }}
                >
                  Create a dealer account
                </Button>
              )}
              {lead.kind === 'dealer' && lead.dealerId && (
                <Button variant="primary" icon="handshake" onClick={() => navigate(`/office/dealers/?id=${lead.dealerId}`)}>
                  Open the dealer account
                </Button>
              )}
              <Button variant="ghost" icon="archive" onClick={() => (setLeadStage(lead.id, 'closed', lead.kind === 'question' ? 'Answered and closed' : 'Closed'), toast('Request closed'))}>
                {lead.kind === 'question' ? 'Mark answered' : 'Close'}
              </Button>
            </>
          )}
        </div>
        {!isClosed && (lead.kind === 'quote' || lead.kind === 'service') && !jobs.length && (
          <p class="lead-actions__hint">
            {lead.customerId ? '' : 'Booking or quoting creates a customer record from this request. '}
            {lead.kind === 'quote' ? 'A site visit goes on the schedule and moves this request to Scheduled; an accepted quote starts the shop build and the install.' : 'A booked call goes on the schedule and moves this request to Scheduled.'}
          </p>
        )}
        {lead.kind === 'warranty' && !isClosed && <p class="lead-actions__hint">Register the lift in the card below — it closes this request.</p>}
      </Card>

      {lead.kind === 'quote' && <QuotePanel lead={lead} />}
      {lead.kind === 'service' && <ServicePanel lead={lead} />}
      {lead.kind === 'warranty' && <WarrantyPanel lead={lead} />}
      {lead.kind === 'dealer' && <DealerPanel lead={lead} />}

      <div class="lead-grid">
        <Card title="Contact" level={3} class="lead-card">
          <Details items={contact} />
        </Card>
        <CustomerCard lead={lead} />
      </div>

      {(lead.message || fields.length > 0 || !!lead.photos) && (
        <Card title="What they sent" level={3} class="lead-card">
          {lead.message && (
            <blockquote class="lead-message">
              <p>{lead.message}</p>
              <footer>— {personName(lead)}</footer>
            </blockquote>
          )}
          {fields.length > 0 && <Details items={fields.map(([k, v]) => [k, v] as [string, string])} columns={2} />}
          {!!lead.photos && (
            <div class="lead-photos">
              <p class="lead-photos__label">
                {plural(lead.photos, 'photo')} attached <span class="muted">(placeholders in this demo)</span>
              </p>
              <ul class="lead-photos__grid" role="list">
                {Array.from({ length: lead.photos }, (_, i) => (
                  <li key={i} class="lead-photo">
                    <Icon name="camera" size={22} />
                    <span>Photo {i + 1}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card title="Conversation" subtitle={`Follow up with ${first} and keep the whole team in the loop`} level={3} class="lead-card">
        <Composer key={lead.id} lead={lead} />
        <h4 class="section-label">Activity</h4>
        <Timeline lead={lead} />
      </Card>

      {losing && <LostDialog lead={lead} onClose={() => setLosing(false)} />}
    </article>
  );
}
