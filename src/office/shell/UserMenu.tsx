import { useState } from 'preact/hooks';
import { profiles, roleLabels } from '../data/people';
import type { Staff } from '../data/types';
import { navigate, route, sectionPath } from '../router';
import { db, markTried, resetDemo, setUI } from '../store';
import { toast } from '../toast';
import { Avatar } from '../ui/core';
import { Confirm, Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';

/** Sign in as a profile. From the sign-in screen it stays on the page that was asked for, when the profile has it. */
export function switchProfile(id: string, opts: { keepPage?: boolean } = {}) {
  const person = db.value.staff.find((s) => s.id === id)!;
  setUI({ userId: id, signedIn: true, store: 'all' });
  if (person.role === 'crew' || person.role === 'shop') markTried('crew');
  const sections = db.value.settings.permissions[person.role];
  const home = sections.includes('dashboard') ? 'dashboard' : 'my-day';
  if (!opts.keepPage || !sections.includes(route.value.section)) navigate(sectionPath(home));
  toast(`Signed in as ${person.name} (${roleLabels[person.role]})`);
}

export function UserMenu({ user }: { user: Staff }) {
  const [open, setOpen] = useState<'menu' | 'switch' | 'reset' | null>(null);
  return (
    <div class="menu">
      <button type="button" class="user-btn" aria-haspopup="dialog" onClick={() => setOpen('switch')}>
        <Avatar person={user} size={32} />
        <span class="sr-only">Account: </span>
        <span class="user-btn__text">
          <span class="user-btn__name">{user.name.split(' ')[0]}</span>
          <span class="user-btn__role">{roleLabels[user.role]}</span>
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open === 'switch' && (
        <Dialog title="Your profile" description="This demo has a few sample profiles so you can see what each role works with." onClose={() => setOpen(null)} size="sm" drawer>
          <div class="profile-current">
            <Avatar person={user} size={48} />
            <div>
              <p class="profile-current__name">{user.name}</p>
              <p class="muted small">{user.title}</p>
            </div>
          </div>
          <h3 class="section-label">Switch profile</h3>
          <ul class="profile-list" role="list">
            {profiles.map((p) => {
              const person = db.value.staff.find((s) => s.id === p.id)!;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    class="profile-option"
                    aria-current={person.id === user.id ? 'true' : undefined}
                    onClick={() => {
                      setOpen(null);
                      if (person.id !== user.id) switchProfile(person.id);
                    }}
                  >
                    <Avatar person={person} size={36} />
                    <span>
                      <span class="profile-option__name">
                        {person.name} <span class="muted">· {roleLabels[person.role]}</span>
                      </span>
                      <span class="profile-option__blurb">{p.blurb}</span>
                    </span>
                    {person.id === user.id && <Icon name="check" size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div class="profile-actions">
            <button type="button" class="btn btn--secondary btn--md" onClick={() => setOpen('reset')}>
              <Icon name="refresh" size={16} />
              <span>Reset demo data</span>
            </button>
            <button
              type="button"
              class="btn btn--ghost btn--md"
              onClick={() => {
                setOpen(null);
                setUI({ signedIn: false, lastUserId: user.id });
              }}
            >
              <Icon name="logout" size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </Dialog>
      )}
      {open === 'reset' && (
        <Confirm
          title="Reset the demo?"
          confirmLabel="Reset demo data"
          danger
          onClose={() => setOpen(null)}
          onConfirm={async () => {
            await resetDemo();
            navigate('/office/');
            toast('Demo data reset — everything is back to the starting point.');
          }}
        >
          <p>This puts every request, job, lift, invoice and stock level back the way it started, in this browser only.</p>
        </Confirm>
      )}
    </div>
  );
}
