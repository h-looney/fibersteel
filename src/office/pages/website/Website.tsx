/**
 * Website — the parts of the public site FiberSteel's staff would keep up to date: "Lifts we've installed" (and its
 * on/off switch), the used lifts for sale and the dealer list. Changes go out with a publish (simulated); the public
 * pages in this browser then show them as previews.
 *   /office/website/?tab=installs|used|dealers|publish
 *   …?tab=installs&install=new|<id>[&job=<id>]  ·  …?tab=used&listing=new|<id>  ·  …?tab=dealers&dealer=new|<id>
 */
import { plural } from '../../lib/format';
import { param, setParams } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, PageHeader, Stat, TabPanel, Tabs } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { publishPending } from './actions';
import { installsToPost, pendingCount, siteHref, webDealers, webInstalls, webUsed } from './data';
import { DealersTab } from './DealersTab';
import { InstallsTab } from './InstallsTab';
import { PublishTab } from './PublishTab';
import { UsedTab } from './UsedTab';

type TabKey = 'installs' | 'used' | 'dealers' | 'publish';
const TAB_KEYS: TabKey[] = ['installs', 'used', 'dealers', 'publish'];

const flag = (n: number, what: string) =>
  n > 0 ? (
    <>
      <span class="tabs__count" aria-hidden="true">
        {n}
      </span>
      <span class="sr-only">
        , {n} {what}
      </span>
    </>
  ) : null;

const sitePath: Record<TabKey, string> = { installs: '/installs/', used: '/used-lifts/', dealers: '/dealers/', publish: '/' };

export default function Website() {
  const requested = param('tab') as TabKey | undefined;
  // An install being written (?install= or ?job=) belongs to Installs, a listing to Used lifts, a dealer to the list
  const tab: TabKey = requested && TAB_KEYS.includes(requested) ? requested : param('listing') ? 'used' : param('dealer') ? 'dealers' : 'installs';
  const go = (k: TabKey) => setParams({ tab: k === 'installs' ? undefined : k, install: undefined, job: undefined, listing: undefined, dealer: undefined });

  const pending = pendingCount.value;
  const toPost = installsToPost.value.length;
  const showcase = db.value?.website.showcase !== false;
  const installsOnSite = webInstalls.value.filter((i) => i.live && !i.removed).length;
  const posted = webInstalls.value.filter((i) => i.state !== 'sample' && i.live && !i.removed).length;
  const used = webUsed.value;
  const forSale = used.filter((u) => !u.removed && u.listing.status !== 'sold').length;
  const dealersShown = webDealers.value.filter((r) => !r.hidden).length;

  return (
    <div class="website">
      <PageHeader
        eyebrow="Business"
        title="Website"
        description="What the public site shows from FiberSteel mode: lifts you’ve installed, used lifts for sale and the dealer list. Changes go out with the next publish (simulated)."
        actions={
          <a class="btn btn--secondary btn--md" href={siteHref(sitePath[tab])} target="_blank" rel="noopener">
            <Icon name="globe" size={18} />
            <span>Open the public site</span>
            <span class="sr-only"> (opens in a new tab)</span>
          </a>
        }
      />

      {pending > 0 && (
        <div class="callout callout--amber web-pending" role="status">
          <Icon name="clock" size={18} />
          <div>
            <p class="callout__title">
              {plural(pending, 'change')} waiting — {pending === 1 ? 'it goes' : 'they go'} live on the next publish (simulated)
            </p>
            <p class="callout__text">Saved in this browser. In production a publish rebuilds the site; here the public pages in this browser show the changes as previews.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon="send"
            onClick={() => {
              const n = publishPending();
              toast(`Published ${plural(n, 'change')} (simulated)`, { tone: 'success' });
            }}
          >
            Publish now (simulated)
          </Button>
        </div>
      )}

      <div class="stats web-stats">
        <Stat
          label="Lifts we’ve installed"
          icon="camera"
          value={showcase ? installsOnSite : 'Off'}
          hint={showcase ? `${posted ? `${plural(posted, 'install')} posted here · ` : ''}${plural(installsOnSite - posted, 'sample')}` : 'Switched off on the public site'}
          to="/office/website/?tab=installs"
        />
        <Stat label="Installs to post" icon="lift" value={toPost} hint="Finished in the last two weeks, no post yet" to="/office/website/?tab=installs" />
        <Stat label="Used lifts for sale" icon="tag" value={forSale} hint={`${plural(used.filter((u) => u.sample && !u.removed && u.listing.status !== 'sold').length, 'sample')} among them`} to="/office/website/?tab=used" />
        <Stat label="Dealers on the page" icon="handshake" value={dealersShown} hint="Including FiberSteel’s own listing" to="/office/website/?tab=dealers" />
      </div>

      <Tabs<TabKey>
        label="Website sections"
        idBase="web"
        value={tab}
        onChange={go}
        items={[
          { key: 'installs', label: <>Lifts we’ve installed{flag(toPost, 'installs to post')}</> },
          { key: 'used', label: 'Used lifts' },
          { key: 'dealers', label: 'Dealer list' },
          { key: 'publish', label: <>Publishing{flag(pending, 'changes waiting')}</> },
        ]}
      />
      <TabPanel idBase="web" active={tab}>
        {tab === 'installs' && <InstallsTab />}
        {tab === 'used' && <UsedTab />}
        {tab === 'dealers' && <DealersTab />}
        {tab === 'publish' && <PublishTab />}
      </TabPanel>
    </div>
  );
}
