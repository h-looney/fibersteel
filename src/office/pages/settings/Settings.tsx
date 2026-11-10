/** Settings: business details, team & permissions, website forms, prices & fees, books & invoices, notifications, demo data. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { setPermission, updateSettings } from '../../actions';
import { allSections, roleLabels } from '../../data/people';
import type { LeadKind, Role, Section, Settings as SettingsData, Staff } from '../../data/types';
import { openDialog } from '../../dialogs';
import { today } from '../../lib/dates';
import { money, number, phone, plural, relative, telHref } from '../../lib/format';
import { param, setParams } from '../../router';
import { db, me, resetDemo } from '../../store';
import { toast } from '../../toast';
import { Avatar, Badge, Button, Card, cx, Field, Link, Menu, PageHeader, Switch, TabPanel, Tabs, type TabItem } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { site } from '../../../data/site';
import { admiral, dockSteps } from '../../../data/products';
import { cancelInvite, defaultTitles, downloadJson, inviteStaff, isInvited, updateStaff } from './helpers';
import { setShowcase } from '../website/actions';

type Tab = 'profile' | 'team' | 'forms' | 'fees' | 'books' | 'notifications' | 'demo';

const tabs: TabItem<Tab>[] = [
  { key: 'profile', label: 'Business', icon: 'store' },
  { key: 'team', label: 'Team', icon: 'users' },
  { key: 'forms', label: 'Website forms', icon: 'globe' },
  { key: 'fees', label: 'Prices & fees', icon: 'dollar' },
  { key: 'books', label: 'Books & invoices', icon: 'receipt' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'demo', label: 'Demo data', icon: 'refresh' },
];

const sectionLabels: Record<Section, string> = {
  dashboard: 'Dashboard',
  'my-day': 'My day',
  inbox: 'Inbox',
  jobs: 'Jobs',
  customers: 'Customers',
  warranty: 'Warranty',
  inventory: 'Inventory',
  dealers: 'Dealers',
  accounting: 'Accounting',
  analytics: 'Analytics',
  website: 'Website',
  settings: 'Settings',
};

const roles: Role[] = ['owner', 'sales', 'service', 'office', 'shop', 'crew'];
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/* ---------- Business profile ---------- */

type Business = NonNullable<SettingsData['business']>;

const defaultBusiness = (): Business => ({
  displayName: site.name,
  email: site.sales.email,
  phone: site.sales.phone,
  servicePhone: site.service.phone,
  website: site.url,
});

function ProfileTab() {
  const saved = db.value.settings.business ?? defaultBusiness();
  const [form, setForm] = useState<Business>(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof Business) => (e: Event) => setForm({ ...form, [k]: (e.target as HTMLInputElement).value });

  return (
    <div class="settings-grid">
      <Card title="Business profile" subtitle="Shown on invoices, quotes and customer emails">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateSettings((s) => (s.business = { ...form, displayName: form.displayName.trim() || site.name }));
            toast('Business profile saved', { tone: 'success' });
          }}
        >
          <div class="form-grid">
            <Field label="Business name" class="span-2">
              <input class="input" value={form.displayName} onInput={set('displayName')} required />
            </Field>
            <Field label="Sales & information phone">
              <input class="input" type="tel" value={form.phone} onInput={set('phone')} />
            </Field>
            <Field label="Service, parts & repairs phone">
              <input class="input" type="tel" value={form.servicePhone} onInput={set('servicePhone')} />
            </Field>
            <Field label="Reply-to email" hint="Customers see this on emails and invoices">
              <input class="input" type="email" value={form.email} onInput={set('email')} />
            </Field>
            <Field label="Website">
              <input class="input" type="url" value={form.website} onInput={set('website')} />
            </Field>
          </div>
          <div class="settings-actions">
            <Button type="submit" variant="primary" disabled={!dirty}>
              Save changes
            </Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => setForm(saved)}>
              Discard
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Factory, office & showroom" subtitle="From the website’s shared business details — in a real version, edit them once and the site, invoices and FiberSteel mode all update">
        <ul class="showrooms" role="list">
          <li class="showroom">
            <p class="showroom__name">
              <Icon name="store" size={16} /> {site.name}
              <span class="muted small"> · {site.region}</span>
            </p>
            <p>
              {site.address.street}, {site.address.city}, {site.address.state} {site.address.zip}
            </p>
            <p class="muted small">{site.address.note}</p>
            <p>
              {site.sales.label}: <a href={telHref(site.sales.phone)}>{phone(site.sales.phone)}</a>
              <span class="muted"> · {site.sales.email}</span>
            </p>
            <p>
              {site.service.label}: <a href={telHref(site.service.phone)}>{phone(site.service.phone)}</a>
              <span class="muted"> · {site.service.email}</span>
            </p>
            <ul class="showroom__hours" role="list">
              {site.hoursSummary.map((h) => (
                <li key={h.days}>
                  {h.days}: {h.time}
                </li>
              ))}
            </ul>
          </li>
        </ul>
        <p class="muted small">Editing these is turned off in this demo.</p>
      </Card>
    </div>
  );
}

/* ---------- Team & permissions ---------- */

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('crew');
  const [title, setTitle] = useState(defaultTitles.crew);
  const [titleTouched, setTitleTouched] = useState(false);
  const valid = name.trim().length > 1 && /.+@.+\..+/.test(email.trim());

  const send = () => {
    if (!valid) return;
    inviteStaff({ name: name.trim(), role, title: title.trim() || defaultTitles[role] });
    toast(`Invitation sent to ${email.trim()} — sending is simulated in this demo`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Invite a teammate"
      description="They’d get an email to set up their own sign-in. Until then they show as invited."
      size="sm"
      class="settings-dialog"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="send" disabled={!valid} onClick={send}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Field label="Full name">
          <input class="input" value={name} autocomplete="off" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Work email">
          <input class="input" type="email" value={email} placeholder="name@lakeboatlifts.com" onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        </Field>
        <div class="form-grid">
          <Field label="Role" hint="Decides which sections they can use">
            <select
              class="select"
              value={role}
              onChange={(e) => {
                const r = (e.target as HTMLSelectElement).value as Role;
                setRole(r);
                if (!titleTouched) setTitle(defaultTitles[r]);
              }}
            >
              {roles
                .filter((r) => r !== 'owner')
                .map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Job title">
            <input
              class="input"
              value={title}
              onInput={(e) => {
                setTitle((e.target as HTMLInputElement).value);
                setTitleTouched(true);
              }}
            />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function TeamTab() {
  const d = db.value;
  const user = me.value!;
  const [inviting, setInviting] = useState(false);
  const perms = d.settings.permissions;

  const status = (s: Staff) =>
    s.active ? (
      <Badge tone="green" icon="check">
        Active
      </Badge>
    ) : isInvited(s) ? (
      <Badge tone="amber" icon="mail">
        Invitation sent
      </Badge>
    ) : (
      <Badge tone="neutral" icon="minus">
        Inactive
      </Badge>
    );

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      label: 'Name',
      sortValue: (s) => s.name,
      render: (s) => (
        <span class="team-person">
          <Avatar person={s} size={32} />
          <span>
            <span class="cell-main">
              {s.name}
              {s.id === user.id && (
                <Badge tone="accent" class="team-you">
                  You
                </Badge>
              )}
            </span>
            <span class="cell-sub">{s.title}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortValue: (s) => roles.indexOf(s.role),
      render: (s) =>
        s.role === 'owner' ? (
          <span>{roleLabels.owner}</span>
        ) : (
          <select
            class="select select--sm team-role"
            aria-label={`Role for ${s.name}`}
            value={s.role}
            onChange={(e) => {
              const r = (e.target as HTMLSelectElement).value as Role;
              updateStaff(s.id, { role: r });
              toast(`${s.name.split(' ')[0]}’s role is now ${roleLabels[r].toLowerCase()}`);
            }}
          >
            {roles
              .filter((r) => r !== 'owner')
              .map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
          </select>
        ),
    },
    { key: 'status', label: 'Status', sortValue: (s) => (s.active ? 0 : isInvited(s) ? 1 : 2), render: status },
    {
      key: 'actions',
      label: <span class="sr-only">Actions</span>,
      align: 'right',
      class: 'team-actions',
      render: (s) => {
        if (s.role === 'owner' || s.id === user.id) return null;
        const items = isInvited(s)
          ? [
              { label: 'Resend invitation', icon: 'send' as const, onSelect: () => toast(`Invitation resent to ${s.name} — simulated`) },
              { label: 'Cancel invitation', icon: 'x-circle' as const, danger: true, onSelect: () => (cancelInvite(s.id), toast('Invitation cancelled')) },
            ]
          : s.active
            ? [{ label: 'Deactivate', icon: 'lock' as const, danger: true, onSelect: () => (updateStaff(s.id, { active: false }), toast(`${s.name} can no longer sign in`)) }]
            : [{ label: 'Reactivate', icon: 'check-circle' as const, onSelect: () => (updateStaff(s.id, { active: true }), toast(`${s.name} can sign in again`)) }];
        return <Menu label={`Actions for ${s.name}`} items={items} size="sm" />;
      },
    },
  ];

  return (
    <div class="stack">
      <Card
        title="Team"
        subtitle={`${plural(d.staff.filter((s) => s.active).length, 'person', 'people')} can sign in. Dean is the only real name; everyone else is a placeholder for this demo.`}
        actions={
          <Button icon="plus" onClick={() => setInviting(true)}>
            Invite teammate
          </Button>
        }
        flush
      >
        <DataTable rows={d.staff} columns={columns} rowKey={(s) => s.id} caption="Team members" pageSize={40} />
      </Card>

      <Card title="What each role can use" subtitle="Changes apply right away — switch profiles from the account menu (top right) to see each role’s view." flush>
        <div class="table-wrap">
          <table class="table perm-table">
            <caption class="sr-only">Sections each role can use</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                {allSections.map((s) => (
                  <th key={s} scope="col" class="is-center">
                    {sectionLabels[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const people = d.staff.filter((s) => s.role === r && s.active).length;
                const locked = r === 'owner';
                return (
                  <tr key={r}>
                    <th scope="row">
                      <span class="perm-role">{roleLabels[r]}</span>
                      <span class="cell-sub">
                        {plural(people, 'person', 'people')}
                        {locked ? ' · always everything' : ''}
                      </span>
                    </th>
                    {allSections.map((s) => {
                      const on = locked || perms[r].includes(s);
                      return (
                        <td key={s} class="is-center">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={locked}
                            aria-label={`${roleLabels[r]} can use ${sectionLabels[s]}`}
                            onChange={(e) => {
                              const allowed = (e.target as HTMLInputElement).checked;
                              setPermission(r, s, allowed);
                              toast(`${roleLabels[r]} ${allowed ? 'can now use' : 'can no longer use'} ${sectionLabels[s]}`);
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </div>
  );
}

/* ---------- Website forms ---------- */

/** Each kind of request: which form it comes from, and which of FiberSteel's two inboxes it goes to */
const requestKinds: { kind: LeadKind; label: string; from: string; path: string; inbox: 'sales' | 'service' }[] = [
  { kind: 'quote', label: 'Quote requests', from: 'The quote form and the lift-size calculator', path: '/quote/', inbox: 'sales' },
  { kind: 'service', label: 'Service requests', from: 'The service & parts form', path: '/service/', inbox: 'service' },
  { kind: 'warranty', label: 'Warranty registrations', from: 'The warranty registration form', path: '/warranty/register/', inbox: 'service' },
  { kind: 'dealer', label: 'Dealer inquiries', from: 'The “Become a dealer” form', path: '/dealers/become-a-dealer/', inbox: 'sales' },
  { kind: 'question', label: 'Messages', from: 'The contact form', path: '/contact/', inbox: 'sales' },
];

const inboxLabel = { sales: site.sales.label, service: site.service.label };

function FormsTab() {
  const d = db.value;
  const forms = d.settings.forms;
  const [reply, setReply] = useState(forms.autoReplyText);
  const [emails, setEmails] = useState(forms.emailTo);
  const people = d.staff.filter((s) => s.active);
  const business = d.settings.business?.displayName || site.name;
  const showcase = d.website.showcase !== false;
  const emailsValid = (['sales', 'service'] as const).every((k) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[k].trim()));
  const emailsDirty = emails.sales !== forms.emailTo.sales || emails.service !== forms.emailTo.service;

  const route = (kind: LeadKind, staffId: string) => {
    updateSettings((s) => (s.forms.routing[kind] = staffId));
    toast(`New ${requestKinds.find((r) => r.kind === kind)?.label.toLowerCase()} now go to ${d.staff.find((x) => x.id === staffId)?.name}`);
  };

  return (
    <div class="stack">
      <div class="callout callout--blue settings-callout">
        <Icon name="mail" size={18} />
        <div>
          <p class="callout__title">Every website request is emailed to the address FiberSteel chooses, for the team to review.</p>
          <p class="callout__text">
            In this demo, requests sent from the public pages in this browser are also copied into the Inbox here, so you can try the whole path. Nothing leaves the browser.
          </p>
        </div>
      </div>

      <Card title="Where website requests go" subtitle="Each request is emailed to one of FiberSteel’s two inboxes and assigned to a person. Requests logged from a call or a boat show follow the same rules." flush>
        <div class="table-wrap">
          <table class="table routing-table">
            <caption class="sr-only">Where each kind of website request goes</caption>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Emailed to</th>
                <th scope="col">Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {requestKinds.map((r) => (
                <tr key={r.kind}>
                  <th scope="row">
                    <span class="perm-role">{r.label}</span>
                    <span class="cell-sub">
                      {r.from} ·{' '}
                      <a href={`${BASE}${r.path}`} target="_blank" rel="noopener">
                        open it<span class="sr-only"> (opens in a new tab)</span>
                      </a>
                    </span>
                  </th>
                  <td>
                    <span class="cell-main">{forms.emailTo[r.inbox]}</span>
                    <span class="cell-sub">{inboxLabel[r.inbox]}</span>
                  </td>
                  <td>
                    <select class="select select--sm" aria-label={`${r.label} are assigned to`} value={forms.routing[r.kind]} onChange={(e) => route(r.kind, (e.target as HTMLSelectElement).value)}>
                      {people.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div class="settings-grid">
        <Card title="The two inboxes" subtitle="These are the addresses on FiberSteel’s current site. FiberSteel chooses where requests really go.">
          <form
            class="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!emailsValid || !emailsDirty) return;
              updateSettings((s) => (s.forms.emailTo = { sales: emails.sales.trim(), service: emails.service.trim() }));
              toast('Request emails saved', { tone: 'success' });
            }}
          >
            <Field label={`${inboxLabel.sales}: quotes, dealer inquiries and messages`}>
              <input class="input" type="email" value={emails.sales} onInput={(e) => setEmails({ ...emails, sales: (e.target as HTMLInputElement).value })} />
            </Field>
            <Field label={`${inboxLabel.service}: service requests and warranty registrations`}>
              <input class="input" type="email" value={emails.service} onInput={(e) => setEmails({ ...emails, service: (e.target as HTMLInputElement).value })} />
            </Field>
            {!emailsValid && <p class="is-bad small">Both need to be email addresses.</p>}
            <div class="settings-actions">
              <Button type="submit" variant="primary" disabled={!emailsDirty || !emailsValid}>
                Save addresses
              </Button>
              <Button variant="ghost" disabled={!emailsDirty} onClick={() => setEmails(forms.emailTo)}>
                Discard
              </Button>
            </div>
          </form>
        </Card>

        <Card title="On the public site" subtitle="Parts of the website FiberSteel can switch on and off. They take effect right away (in this demo, on the public pages in this browser).">
          <Switch
            checked={showcase}
            onChange={(v) => {
              setShowcase(v);
              toast(v ? '“Lifts we’ve installed” is on — the public site shows the installs' : '“Lifts we’ve installed” is off — the public site hides it', { tone: v ? 'success' : undefined });
            }}
            label="Lifts we’ve installed"
            description={
              <>
                The installs page, plus installs on the home page and the lift pages. Post and manage installs under{' '}
                <a class="link-btn" href={`${BASE}/office/website/?tab=installs`}>
                  Website → Lifts we’ve installed
                </a>
                .
              </>
            }
          />
        </Card>
      </div>

      <div class="settings-grid">
        <Card title="Automatic reply" subtitle="Sent the moment someone submits a website form">
          <Switch
            checked={forms.autoReply}
            onChange={(v) => {
              updateSettings((s) => (s.forms.autoReply = v));
              toast(v ? 'Automatic replies turned on' : 'Automatic replies turned off');
            }}
            label="Send an automatic reply"
            description="Lets people know their request arrived and when to expect an answer."
          />
          <Field label="Message" class="settings-reply">
            <textarea class="textarea" rows={5} value={reply} disabled={!forms.autoReply} onInput={(e) => setReply((e.target as HTMLTextAreaElement).value)} />
          </Field>
          <div class="settings-actions">
            <Button
              variant="primary"
              disabled={reply === forms.autoReplyText || !reply.trim()}
              onClick={() => {
                updateSettings((s) => (s.forms.autoReplyText = reply.trim()));
                toast('Automatic reply saved', { tone: 'success' });
              }}
            >
              Save message
            </Button>
          </div>
        </Card>

        <Card title="Preview" subtitle="What a customer sees in their inbox">
          <div class={cx('email-preview', !forms.autoReply && 'is-off')}>
            <p class="email-preview__row">
              <span>From</span> {business}
            </p>
            <p class="email-preview__row">
              <span>Subject</span> We got your request
            </p>
            <p class="email-preview__body">{reply || ' '}</p>
          </div>
          {!forms.autoReply && <p class="muted small">Automatic replies are off — nothing is sent.</p>}
        </Card>
      </div>

      <Card title="Where else requests come from">
        <ul class="sources" role="list">
          <li>
            <Icon name="phone" size={18} />
            <span>
              <strong>Phone calls, walk-ins and boat shows</strong> — logged by the team in a few seconds.{' '}
              <button type="button" class="link-btn" onClick={() => openDialog({ kind: 'request' })}>
                Log a request
              </button>
            </span>
          </li>
          <li>
            <Icon name="facebook" size={18} />
            <span>
              <strong>Facebook messages</strong> — logged by staff in this demo; a real version could connect FiberSteel’s Facebook page.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Prices & fees ---------- */

interface FeeForm {
  serviceFee: string;
  remoteInstall: string;
  labor: string;
  tax: string;
}

const pct = (n: number) => String(Math.round(n * 100000) / 1000);
const remotePrices = admiral.prices.map((p) => p.price);
const feesFrom = (s: SettingsData): FeeForm => ({ serviceFee: String(s.serviceFee), remoteInstall: String(s.remoteInstall), labor: String(s.laborRate), tax: pct(s.taxRates.camdenton) });

function Affix({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: ComponentChildren }) {
  return (
    <span class={cx('affix', prefix && 'affix--prefix', suffix && 'affix--suffix')}>
      {prefix && (
        <span class="affix__text" aria-hidden="true">
          {prefix}
        </span>
      )}
      {children}
      {suffix && (
        <span class="affix__text" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  );
}

function SaveBar({ dirty, valid, invalidText, onDiscard }: { dirty: boolean; valid: boolean; invalidText: string; onDiscard: () => void }) {
  return (
    <div class={cx('settings-actions settings-actions--bar', dirty && 'is-dirty')}>
      {!valid ? (
        <span class="is-bad small">{invalidText}</span>
      ) : (
        <span class="settings-actions__status" aria-live="polite">
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </span>
      )}
      <Button variant="ghost" disabled={!dirty} onClick={onDiscard}>
        Discard
      </Button>
      <Button type="submit" variant="primary" disabled={!dirty || !valid}>
        Save changes
      </Button>
    </div>
  );
}

function FeesTab() {
  const s = db.value.settings;
  const saved = feesFrom(s);
  const [form, setForm] = useState<FeeForm>(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof FeeForm) => (e: Event) => setForm({ ...form, [k]: (e.target as HTMLInputElement).value });
  const ok = (v: string, max = Infinity) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max;
  const valid = ok(form.serviceFee) && ok(form.remoteInstall) && ok(form.labor) && ok(form.tax, 20);

  const save = (e: Event) => {
    e.preventDefault();
    if (!valid) return;
    updateSettings((x) => {
      x.serviceFee = Number(form.serviceFee);
      x.remoteInstall = Number(form.remoteInstall);
      x.laborRate = Number(form.labor);
      x.taxRates = { camdenton: Number(form.tax) / 100 };
    });
    toast('Prices & fees saved — new invoices use them', { tone: 'success' });
  };

  return (
    <form class="stack" onSubmit={save}>
      <div class="settings-grid">
        <Card title="From FiberSteel’s site" subtitle="These two are the prices the current site states. Change them here if they change.">
          <div class="stack">
            <Field label="Service call fee" hint="Warranty page: “All service calls will be charged a $95 service fee after one year from the installation date.” Calls in a lift’s first year have no fee.">
              <Affix prefix="$">
                <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.serviceFee} onInput={set('serviceFee')} />
              </Affix>
            </Field>
            <Field label="Remote system installation" hint="Remotes page: installations on the Lake of the Ozarks, $200 (on top of the remote itself).">
              <Affix prefix="$">
                <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.remoteInstall} onInput={set('remoteInstall')} />
              </Affix>
            </Field>
          </div>
        </Card>

        <Card title="Samples for this demo" subtitle="Made-up figures so invoices add up — FiberSteel sets the real ones">
          <div class="stack">
            <Field label="Labor, per hour" hint="Billed on service calls. Warranty covers the part only — the owner pays the service call and labor.">
              <Affix prefix="$">
                <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.labor} onInput={set('labor')} />
              </Affix>
            </Field>
            <Field label="Sales tax" hint="A sample rate — confirm the current Camdenton rate with your accountant. It applies to lifts, parts and remotes; labor and installation aren’t taxed.">
              <Affix suffix="%">
                <input class="input" type="number" inputMode="decimal" step="0.001" min="0" max="20" value={form.tax} onInput={set('tax')} />
              </Affix>
            </Field>
          </div>
        </Card>
      </div>

      <Card title="Product prices">
        <p class="settings-prose">
          Lift, remote and dock-step prices are kept with each item in <Link to="/office/inventory/">Inventory</Link>. The Admiral remotes ({money(Math.min(...remotePrices), false)}–
          {money(Math.max(...remotePrices), false)}) and the dock steps ({money(dockSteps.prices[0].price, false)}) use the prices on FiberSteel’s current site; every lift price and every cost is a
          sample.
        </p>
      </Card>

      <SaveBar dirty={dirty} valid={valid} invalidText="Amounts need to be numbers, and the tax rate between 0 and 20%." onDiscard={() => setForm(saved)} />
    </form>
  );
}

/* ---------- Books & invoices ---------- */

function BooksTab() {
  const d = db.value;
  const s = d.settings;
  const saved = { terms: s.terms, footer: s.invoiceFooter };
  const [form, setForm] = useState(saved);
  const dirty = form.terms !== saved.terms || form.footer !== saved.footer;
  const books = d.books;

  const save = (e: Event) => {
    e.preventDefault();
    updateSettings((x) => {
      x.terms = form.terms;
      x.invoiceFooter = form.footer.trim();
    });
    toast('Invoice settings saved — new invoices and quotes use them', { tone: 'success' });
  };

  return (
    <form class="stack" onSubmit={save}>
      <div class="settings-grid">
        <Card title="Where the books are kept">
          <div class="books-mode">
            <span class="books-mode__icon">
              <Icon name={books.connected ? 'refresh' : 'bank'} size={20} />
            </span>
            <div>
              <p class="books-mode__title">{books.connected ? `Synced with QuickBooks Online${books.company ? ` — “${books.company}”` : ''}` : 'Kept here, in FiberSteel mode'}</p>
              <p class="muted small">
                {books.connected
                  ? `Invoices, payments and bills go to QuickBooks as they happen${books.lastSyncAt ? ` · last sync ${relative(books.lastSyncAt)}` : ''} (simulated).`
                  : 'Invoices, payments, bills and reports live here. Or connect QuickBooks Online and keep using it for the books (simulated).'}
              </p>
            </div>
          </div>
          <div class="settings-actions">
            <Link to="/office/accounting/?tab=integrations" class="btn btn--secondary btn--md">
              <Icon name="sliders" size={16} />
              <span>{books.connected ? 'Manage the connection' : 'Connect QuickBooks'}</span>
            </Link>
          </div>
        </Card>

        <Card title="Invoices & quotes" subtitle="Defaults for new invoices and quotes">
          <div class="stack">
            <Field label="Payment terms" hint="Dealers and marinas are always billed Net 30">
              <select class="select" value={form.terms} onChange={(e) => setForm({ ...form, terms: (e.target as HTMLSelectElement).value as SettingsData['terms'] })}>
                <option>Due on receipt</option>
                <option>Net 15</option>
                <option>Net 30</option>
              </select>
            </Field>
            <Field label="Invoice footer">
              <textarea class="textarea" rows={3} value={form.footer} onInput={(e) => setForm({ ...form, footer: (e.target as HTMLTextAreaElement).value })} />
            </Field>
          </div>
        </Card>
      </div>
      <SaveBar dirty={dirty} valid invalidText="" onDiscard={() => setForm(saved)} />
    </form>
  );
}

/* ---------- Notifications ---------- */

const notificationRows: { key: keyof SettingsData['notifications']; label: string; description: string }[] = [
  { key: 'newLead', label: 'New website requests', description: 'When a quote, service, warranty or dealer request comes in from the website.' },
  { key: 'jobCompleted', label: 'Jobs finished', description: 'When a crew finishes an install, a service call or a shop build.' },
  { key: 'paymentReceived', label: 'Payments received', description: 'Card, check, cash, ACH and Venmo payments recorded against invoices.' },
  { key: 'lowStock', label: 'Low stock', description: 'When a component or a stocked lift drops below its reorder point.' },
  { key: 'dailyDigest', label: 'Morning summary email', description: 'A 7 AM recap of today’s installs and service calls, new requests and overdue invoices.' },
];

function NotificationsTab() {
  const n = db.value.settings.notifications;
  return (
    <Card title="Notifications" subtitle="These show up under the bell in the top bar. A real version could also send them by email or text.">
      {notificationRows.map((row) => (
        <Switch
          key={row.key}
          checked={n[row.key]}
          label={row.label}
          description={row.description}
          onChange={(v) => {
            updateSettings((s) => (s.notifications[row.key] = v));
            toast(`${row.label}: ${v ? 'on' : 'off'}`);
          }}
        />
      ))}
    </Card>
  );
}

/* ---------- Demo data ---------- */

function DemoTab() {
  const d = db.value;
  const [confirming, setConfirming] = useState(false);
  const stats: [string, number][] = [
    ['Customers', d.customers.length],
    ['Lifts at docks', d.lifts.length],
    ['Requests', d.leads.length],
    ['Jobs', d.jobs.length],
    ['Invoices & quotes', d.invoices.length],
    ['Dealer orders', d.dealerOrders.length],
    ['Catalog items', d.items.length],
  ];
  return (
    <div class="settings-grid">
      <Card title="About the demo data">
        <div class="prose-sm settings-prose">
          <p>
            <strong>FiberSteel mode is purely a demo.</strong> A real one would be customized to how FiberSteel works.
          </p>
          <p>
            Everything in it is sample data made for this concept. The customers, lifts, jobs, invoices, dealer accounts and figures are invented. Dean is the only real name, used for a sign-in profile and never rated; the crew, shop and office people are placeholders.
          </p>
          <p>
            Prices: the Admiral remotes, the dock steps, the $95 service fee and the $200 remote installation are the ones on FiberSteel’s current site. Every other price, cost and stock count is a sample.
          </p>
          <p>
            What you change is saved <strong>only in this browser</strong>. Nothing is sent anywhere, and other people viewing the demo see their own copy. Dates move forward on their own, so the schedule always looks current.
          </p>
        </div>
        <ul class="demo-stats" role="list">
          {stats.map(([label, value]) => (
            <li key={label}>
              <span class="demo-stats__value">{number(value)}</span>
              <span class="demo-stats__label">{label}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Start over or take a copy">
        <div class="stack">
          <div class="demo-action">
            <div>
              <p class="demo-action__title">Reset demo data</p>
              <p class="muted small">Puts every request, job, lift, invoice, stock level and website change back the way it started. Your profile stays signed in.</p>
            </div>
            <Button variant="danger" icon="refresh" onClick={() => setConfirming(true)}>
              Reset
            </Button>
          </div>
          <div class="demo-action">
            <div>
              <p class="demo-action__title">Download my demo data</p>
              <p class="muted small">A JSON file of everything in this browser — handy for showing developers what a real backend would store.</p>
            </div>
            <Button
              icon="download"
              onClick={() => {
                downloadJson(`fibersteel-mode-demo-${today()}.json`, db.value);
                toast('Download started');
              }}
            >
              Download
            </Button>
          </div>
        </div>
      </Card>
      {confirming && (
        <Dialog
          title="Reset the demo?"
          size="sm"
          class="settings-dialog"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button
                variant="danger"
                data-autofocus
                onClick={async () => {
                  setConfirming(false);
                  await resetDemo();
                  toast('Demo data reset — everything is back to the starting point.', { tone: 'success' });
                }}
              >
                Reset demo data
              </Button>
            </>
          }
        >
          <p>This puts every request, job, lift, invoice, stock level and website change back the way it started, in this browser only.</p>
        </Dialog>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

export default function Settings() {
  const raw = param('tab');
  // Older links used ?tab=invoicing
  const tab: Tab = raw === 'invoicing' ? 'books' : tabs.some((t) => t.key === raw) ? (raw as Tab) : 'profile';
  return (
    <div class="settings">
      <PageHeader title="Settings" description="How FiberSteel mode works for the team — business details, who can see what, website forms, prices and fees, invoices and notifications." />
      <Tabs idBase="settings" label="Settings sections" items={tabs} value={tab} onChange={(k) => setParams({ tab: k === 'profile' ? undefined : k }, { replace: true })} />
      <TabPanel idBase="settings" active={tab}>
        {tab === 'profile' && <ProfileTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'forms' && <FormsTab />}
        {tab === 'fees' && <FeesTab />}
        {tab === 'books' && <BooksTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'demo' && <DemoTab />}
      </TabPanel>
    </div>
  );
}
