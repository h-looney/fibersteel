/**
 * FiberSteel mode — an optional demo of a staff side for FiberSteel Boat Lifts, shown alongside the website concept.
 * Purely a demo with sample data: a real one would be customized to how FiberSteel works.
 * Mounted by src/pages/office/[...section].astro as a client-only Preact island.
 */
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { AssetsContext, type Assets } from './assets';
import type { Section } from './data/types';
import { navigate, route, sectionPath } from './router';
import { can, initStore, me, ready, setOpenRecord, ui } from './store';
import { Shell, sectionTitles } from './shell/Shell';
import { SignIn } from './shell/SignIn';
import { EmptyState, LinkButton, PageHeader } from './ui/core';
import Accounting from './pages/accounting/Accounting';
import Analytics from './pages/analytics/Analytics';
import Customers from './pages/customers/Customers';
import Dashboard from './pages/dashboard/Dashboard';
import Dealers from './pages/dealers/Dealers';
import Inbox from './pages/inbox/Inbox';
import Inventory from './pages/inventory/Inventory';
import Jobs from './pages/jobs/Jobs';
import MyDay from './pages/myday/MyDay';
import Settings from './pages/settings/Settings';
import Warranty from './pages/warranty/Warranty';
import Website from './pages/website/Website';

const pages: Record<Section, FunctionComponent> = {
  dashboard: Dashboard,
  'my-day': MyDay,
  inbox: Inbox,
  jobs: Jobs,
  customers: Customers,
  warranty: Warranty,
  inventory: Inventory,
  dealers: Dealers,
  accounting: Accounting,
  analytics: Analytics,
  website: Website,
  settings: Settings,
};

function NoAccess({ section }: { section: Section }) {
  const home = can('dashboard') ? 'dashboard' : 'my-day';
  return (
    <>
      <PageHeader title={sectionTitles[section]} />
      <EmptyState icon="lock" title="Not part of this role" action={<LinkButton to={sectionPath(home)}>Go to {sectionTitles[home]}</LinkButton>}>
        {me.value?.name.split(' ')[0]}’s profile doesn’t include {sectionTitles[section]}. Owners decide who sees what under Settings → Team &amp; permissions.
      </EmptyState>
    </>
  );
}

export default function OfficeApp({ assets }: { assets: Assets }) {
  useEffect(() => {
    void initStore();
    setOpenRecord((h) => navigate(h));
  }, []);

  if (!ready.value) {
    return (
      <div class="boot" role="status">
        <span class="spinner" aria-hidden="true" /> Loading FiberSteel mode…
      </div>
    );
  }

  const section = route.value.section;
  const Page = pages[section];
  return (
    <AssetsContext.Provider value={assets}>
      {ui.value.signedIn ? <Shell>{can(section) ? <Page key={section} /> : <NoAccess section={section} />}</Shell> : <SignIn />}
    </AssetsContext.Provider>
  );
}
