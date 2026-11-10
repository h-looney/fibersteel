/** The FiberSteel mode frame: sidebar, top bar, the demo note, page area, toasts and app-wide dialogs. */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useAssets } from '../assets';
import type { Section } from '../data/types';
import { activeDialog, openDialog } from '../dialogs';
import { PUBLIC_HOME, route, sectionPath } from '../router';
import { lowStock } from '../selectors';
import { loadWebsiteData, websiteAttention } from '../pages/website/data';
import { can, db, me } from '../store';
import { cx, Link, Menu } from '../ui/core';
import { Icon, type IconName } from '../ui/Icon';
import { CommandPalette, paletteOpen } from './CommandPalette';
import { DialogHost } from './DialogHost';
import { Notifications } from './Notifications';
import { Toaster } from './Toaster';
import { UserMenu } from './UserMenu';

interface NavItem {
  section: Section;
  label: string;
  icon: IconName;
  badge?: () => { count: number; label: string } | null;
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Today',
    items: [
      { section: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { section: 'my-day', label: 'My day', icon: 'sun' },
      {
        section: 'inbox',
        label: 'Inbox',
        icon: 'inbox',
        badge: () => {
          const n = db.value.leads.filter((l) => l.stage === 'new').length;
          return n ? { count: n, label: `${n} new` } : null;
        },
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        section: 'jobs',
        label: 'Jobs & schedule',
        icon: 'clipboard',
        badge: () => {
          const n = db.value.jobs.filter((j) => j.status === 'requested').length;
          return n ? { count: n, label: `${n} need scheduling` } : null;
        },
      },
      { section: 'customers', label: 'Customers & lifts', icon: 'users' },
      {
        section: 'warranty',
        label: 'Warranty',
        icon: 'shield',
        badge: () => {
          const n = db.value.claims.filter((c) => c.status === 'open').length;
          return n ? { count: n, label: `${n} open claim${n === 1 ? '' : 's'}` } : null;
        },
      },
      {
        section: 'inventory',
        label: 'Inventory',
        icon: 'box',
        badge: () => {
          const n = lowStock(db.value, 'all').length;
          return n ? { count: n, label: `${n} low on stock` } : null;
        },
      },
      {
        section: 'dealers',
        label: 'Dealers',
        icon: 'handshake',
        badge: () => {
          const n = db.value.dealerOrders.filter((o) => o.status === 'ready').length;
          return n ? { count: n, label: `${n} order${n === 1 ? '' : 's'} ready to ship` } : null;
        },
      },
    ],
  },
  {
    label: 'Business',
    items: [
      { section: 'accounting', label: 'Accounting', icon: 'bank' },
      { section: 'analytics', label: 'Analytics', icon: 'chart' },
      {
        section: 'website',
        label: 'Website',
        icon: 'globe',
        badge: () => {
          const n = websiteAttention.value;
          return n ? { count: n, label: `${n} to review` } : null;
        },
      },
      { section: 'settings', label: 'Settings', icon: 'sliders' },
    ],
  },
];

export const sectionTitles: Record<Section, string> = {
  dashboard: 'Dashboard',
  'my-day': 'My day',
  inbox: 'Inbox',
  jobs: 'Jobs & schedule',
  customers: 'Customers & lifts',
  warranty: 'Warranty',
  inventory: 'Inventory',
  dealers: 'Dealers',
  accounting: 'Accounting',
  analytics: 'Analytics',
  website: 'Website',
  settings: 'Settings',
};

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logo } = useAssets();
  const current = route.value.section;
  return (
    <aside class={cx('sidebar', open && 'is-open')} aria-label="FiberSteel mode">
      <div class="sidebar__brand">
        <Link to="/office/" class="sidebar__logo" aria-label="FiberSteel mode — dashboard">
          <img src={logo} alt="" width={88} height={40} />
        </Link>
        <span class="sidebar__app">FiberSteel mode</span>
        <button type="button" class="btn btn--ghost btn--md btn--icon sidebar__close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <nav class="sidebar__nav" aria-label="Sections">
        {groups.map((g) => {
          const items = g.items.filter((it) => can(it.section));
          if (!items.length) return null;
          return (
            <div class="sidebar__group" key={g.label}>
              <p class="sidebar__group-label">{g.label}</p>
              <ul role="list">
                {items.map((it) => {
                  const badge = it.badge?.();
                  return (
                    <li key={it.section}>
                      <Link to={sectionPath(it.section)} class={cx('sidebar__link', current === it.section && 'is-active')} aria-current={current === it.section ? 'page' : undefined} onClick={onClose}>
                        <Icon name={it.icon} size={18} />
                        <span class="sidebar__label">{it.label}</span>
                        {badge && (
                          <span class="sidebar__badge" aria-label={badge.label}>
                            {badge.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div class="sidebar__foot">
        <a class="sidebar__public" href={lastPublic()}>
          <Icon name="globe" size={16} />
          View the public website
        </a>
        <p class="sidebar__demo">Demo · sample data</p>
      </div>
    </aside>
  );
}

const lastPublic = () => {
  try {
    return localStorage.getItem('fs-last-public') || PUBLIC_HOME;
  } catch {
    return PUBLIC_HOME;
  }
};

/** Public ↔ FiberSteel mode switch, mirrored on the public site */
export function ModeToggle() {
  return (
    <nav class="mode-toggle" aria-label="Demo: switch between the public site and FiberSteel mode">
      <a href={lastPublic()} class="mode-toggle__opt">
        <Icon name="globe" size={15} />
        <span>Public</span>
      </a>
      <span class="mode-toggle__opt is-active" aria-current="page">
        <Icon name="briefcase" size={15} />
        <span>FiberSteel mode</span>
      </span>
    </nav>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const user = me.value!;
  const unread = db.value.notices.filter((n) => !n.read).length;
  const [notifOpen, setNotifOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const newItems = [
    can('jobs') && { label: 'Job', icon: 'clipboard' as const, onSelect: () => openDialog({ kind: 'job' }) },
    can('customers') && { label: 'Customer', icon: 'user' as const, onSelect: () => openDialog({ kind: 'customer' }) },
    can('inbox') && { label: 'Phone, walk-in or boat-show request', icon: 'phone' as const, onSelect: () => openDialog({ kind: 'request' }) },
    can('accounting') && { label: 'Quote', icon: 'file' as const, onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'estimate' } }) },
    can('accounting') && { label: 'Invoice', icon: 'receipt' as const, onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'invoice' } }) },
    can('dealers') && { label: 'Dealer order', icon: 'handshake' as const, onSelect: () => openDialog({ kind: 'dealer-order' }) },
  ].filter(Boolean) as { label: string; icon: IconName; onSelect: () => void }[];

  return (
    <header class="topbar">
      <button type="button" class="btn btn--ghost btn--md btn--icon topbar__menu" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <button type="button" class="topbar__search" aria-label={`Search customers, lifts, jobs… ${isMac ? '⌘K' : 'Ctrl K'}`} onClick={() => (paletteOpen.value = true)} aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}>
        <Icon name="search" size={16} />
        <span class="topbar__search-text">Search customers, lifts, jobs…</span>
        <kbd class="kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <div class="topbar__end">
        {newItems.length > 0 && <Menu label="Create new" icon="plus" buttonLabel={<span class="hide-sm">New</span>} variant="primary" items={newItems} />}
        <button type="button" class="btn btn--ghost btn--md btn--icon topbar__bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setNotifOpen(true)}>
          <Icon name="bell" />
          {unread > 0 && <span class="topbar__dot" aria-hidden="true">{unread}</span>}
        </button>
        <ModeToggle />
        <UserMenu user={user} />
      </div>
      {notifOpen && <Notifications onClose={() => setNotifOpen(false)} />}
    </header>
  );
}

/** Said on every screen, before anything else: this is a demo, and a real one would be built around FiberSteel */
export function DemoNote() {
  return (
    <aside class="demo-note" aria-label="About this demo">
      <Icon name="info" size={16} />
      <p>
        <strong>Purely a demo, with sample data.</strong> FiberSteel mode is an optional idea — a real one would be customized to how FiberSteel works.
      </p>
    </aside>
  );
}

export function Shell({ children }: { children: ComponentChildren }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const section = route.value.section;

  useEffect(() => {
    document.title = `${sectionTitles[section]} · FiberSteel mode`;
    setMenuOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true }));
  }, [section]);

  // Remember the last screen, so the public site's "FiberSteel mode" switch returns here
  useEffect(() => {
    try {
      localStorage.setItem('fs-last-office', location.pathname + location.search);
    } catch {
      /* storage unavailable */
    }
  }, [route.value]);

  // The Website badge and the dashboard read what's been published to the concept site
  useEffect(() => {
    if (can('website') || can('dashboard')) loadWebsiteData();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen.value = !paletteOpen.value;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class={cx('app', menuOpen && 'menu-open')}>
      <a class="skip-link" href="#office-main">
        Skip to content
      </a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div class="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div class="main">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <DemoNote />
        <main id="office-main" class="page" tabIndex={-1}>
          {children}
        </main>
      </div>
      {paletteOpen.value && <CommandPalette />}
      {activeDialog.value && <DialogHost request={activeDialog.value} />}
      <Toaster />
    </div>
  );
}
