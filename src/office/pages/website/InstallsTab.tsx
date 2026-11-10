/**
 * Website → Installs: "Lifts we've installed", the public site's showcase of FiberSteel's own installs.
 *  - The switch that turns the whole showcase on or off on the public site.
 *  - Finished install jobs that haven't been posted yet, one click from a post (or marked "not for the website").
 *  - The installs posted here (on the site, waiting for the next publish, drafts) and the samples built into the concept.
 *   /office/website/?tab=installs[&install=new|<id>][&job=<id>]
 */
import { useState } from 'preact/hooks';
import { useAssets } from '../../assets';
import { plural } from '../../lib/format';
import { param, setParams } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, EmptyState, Menu, Switch, type MenuItem } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { removeInstall, setShowcase, skipInstallJob, undoInstall } from './actions';
import { installsToPost, siteHref, webInstalls, type WebInstall } from './data';
import { SampleBadge, SiteLink } from './helpers';
import { InstallEditor } from './InstallEditor';
import { monthLabel } from './installs';
import { PhotoImg, PhotosDialog } from './PhotosDialog';

function Tile({ i, onPhotos }: { i: WebInstall; onPhotos: (i: WebInstall) => void }) {
  const { photos } = useAssets();
  const open = () => setParams({ install: i.id, job: undefined });
  const items: (MenuItem | 'divider')[] = [];
  if (i.post) items.push({ label: 'Edit…', icon: 'edit', onSelect: open }, { label: 'Photos…', icon: 'camera', onSelect: () => onPhotos(i) });
  if (i.page) items.push({ label: 'Open on the site', icon: 'external', onSelect: () => window.open(siteHref(i.page!), '_blank', 'noopener') });
  if (i.post && i.pending && i.live)
    items.push({
      label: 'Undo changes',
      icon: 'undo',
      onSelect: () => {
        undoInstall(i.id);
        toast(`${i.title}: back to how it’s published`);
      },
    });
  if (i.post)
    items.push('divider', {
      label: i.live ? 'Take it down' : 'Delete',
      icon: 'trash',
      danger: true,
      onSelect: () => {
        removeInstall(i.id);
        toast(i.live ? `${i.title} comes off the site with the next publish (simulated)` : `${i.title} deleted`);
      },
    });
  if (i.removed && i.live)
    items.push({
      label: 'Keep it up',
      icon: 'undo',
      onSelect: () => {
        undoInstall(i.id);
        toast(`${i.title} stays on the site`);
      },
    });

  const meta = [i.town, monthLabel(i.completed)].filter(Boolean).join(' · ');
  const facts = [i.sizeName, i.boat].filter(Boolean).join(' · ');
  const sampleSrc = i.photoKey ? photos[i.photoKey] : undefined;
  return (
    <li class={i.removed ? 'install-tile is-removed' : 'install-tile'}>
      <div class="install-tile__media">
        {i.photoId ? <PhotoImg id={i.photoId} alt="" /> : sampleSrc ? <img src={sampleSrc} alt="" loading="lazy" /> : <Icon name="camera" size={22} />}
        {i.photoCount > 1 && (
          <span class="install-tile__count">
            <Icon name="camera" size={12} /> {i.photoCount}
            <span class="sr-only"> photos</span>
          </span>
        )}
      </div>
      <div class="install-tile__body">
        <p class="install-tile__badges">
          {i.state === 'sample' ? (
            <SampleBadge />
          ) : i.removed ? (
            <Badge tone="red">Coming down</Badge>
          ) : i.state === 'draft' ? (
            <Badge tone="neutral">{i.live ? 'Coming down (draft)' : 'Draft'}</Badge>
          ) : i.live ? (
            <Badge tone="green" icon="globe">
              On the site
            </Badge>
          ) : (
            <Badge tone="amber">Goes up next publish</Badge>
          )}
          {i.pending && i.live && !i.removed && i.state !== 'draft' && <Badge tone="amber">Changes waiting</Badge>}
          {i.featured && (
            <Badge tone="accent" icon="star">
              Home page
            </Badge>
          )}
        </p>
        {i.post && !i.removed ? (
          <button type="button" class="install-tile__title link-btn" onClick={open}>
            {i.title}
          </button>
        ) : (
          <p class="install-tile__title">{i.title}</p>
        )}
        <p class="install-tile__meta">{meta}</p>
        {facts && <p class="install-tile__meta muted">{facts}</p>}
        {i.kindLabel && <p class="install-tile__meta muted">{i.kindLabel}</p>}
      </div>
      {items.length > 0 && (
        <div class="install-tile__menu">
          <Menu label={`Actions for ${i.title}`} items={items} size="sm" />
        </div>
      )}
    </li>
  );
}

export function InstallsTab() {
  const install = param('install');
  const job = param('job');
  const [photosFor, setPhotosFor] = useState<WebInstall | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (install || job)
    return <InstallEditor key={`${install ?? 'new'}:${job ?? ''}`} id={install ?? 'new'} jobId={job} onClose={() => setParams({ install: undefined, job: undefined })} />;

  const d = db.value;
  const on = d.website.showcase !== false;
  const list = webInstalls.value;
  const posts = list.filter((i) => i.state !== 'sample');
  const samples = list.filter((i) => i.state === 'sample');
  const toPost = installsToPost.value;
  const shown = showAll ? toPost : toPost.slice(0, 4);
  const live = posts.filter((i) => i.live && !i.removed).length;

  return (
    <div class="installs-tab">
      <Card class={on ? 'showcase-card is-on' : 'showcase-card'}>
        <Switch
          checked={on}
          onChange={(v) => {
            setShowcase(v);
            toast(v ? '“Lifts we’ve installed” is on — the public site shows your installs' : '“Lifts we’ve installed” is off — the public site hides it', { tone: v ? 'success' : undefined });
          }}
          label="Show “Lifts we’ve installed” on the public site"
          description={
            on
              ? `On: the installs page, the newest featured installs on the home page and three on each lift page — ${samples.length} samples${live ? ` and ${plural(live, 'install')} posted here` : ''}.`
              : 'Off: the site has no installs page and shows no installs. Turn it on when there are photos to be proud of.'
          }
        />
        <p class="showcase-card__note">
          <Icon name="zap" size={14} /> Takes effect right away (in this demo: the public pages open in this browser). <SiteLink path="/installs/">Open “Lifts we’ve installed”</SiteLink>
        </p>
      </Card>

      {toPost.length > 0 && (
        <Card
          title={`Finished installs to post (${toPost.length})`}
          subtitle="Installs from the last two weeks with no post yet. A few photos at the walk-through and a couple of minutes here, and it’s on the site — or mark one “not for the website”."
        >
          <ul class="install-jobs" role="list">
            {shown.map((j) => {
              const c = d.customers.find((x) => x.id === j.customerId);
              const it = d.items.find((i) => i.id === j.itemId);
              return (
                <li key={j.id} class="install-jobs__row">
                  <span>
                    <strong>{it?.name ?? j.title}</strong>
                    <span class="muted small">
                      {' '}
                      · {c?.name ?? '—'}, {c?.address.city ?? '—'} · {j.id} · finished {monthLabel((j.completedAt ?? j.start ?? '').slice(0, 7))}
                    </span>
                  </span>
                  <span class="install-jobs__actions">
                    <Button size="sm" variant="ghost" onClick={() => (skipInstallJob(j.id), toast(`${j.id} won’t be suggested again`, { action: { label: 'Undo', run: () => skipInstallJob(j.id, false) } }))}>
                      Not for the website<span class="sr-only">: {j.id}</span>
                    </Button>
                    <Button size="sm" icon="camera" onClick={() => setParams({ install: 'new', job: j.id })}>
                      Post it<span class="sr-only">: {j.id}</span>
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
          {toPost.length > shown.length && (
            <button type="button" class="link-btn install-jobs__more" onClick={() => setShowAll(true)}>
              Show all {toPost.length}
            </button>
          )}
        </Card>
      )}

      <div class="installs-head">
        <div>
          <h2 class="installs-head__title">Posted from FiberSteel mode</h2>
          <p class="muted small">FiberSteel’s own photos of finished lifts. They go on the site with the next publish (simulated).</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setParams({ install: 'new', job: undefined })}>
          Post an install
        </Button>
      </div>
      {posts.length ? (
        <ul class="install-tiles" role="list">
          {posts.map((i) => (
            <Tile key={i.id} i={i} onPhotos={setPhotosFor} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="camera" title="No installs posted yet" action={<Button icon="plus" onClick={() => setParams({ install: 'new', job: undefined })}>Post your first install</Button>}>
          Pick a finished install, add a few photos and say what was built for the boat — it takes a couple of minutes.
        </EmptyState>
      )}

      <div class="installs-head">
        <div>
          <h2 class="installs-head__title">Samples built into this concept</h2>
          <p class="muted small">
            The photos and what each lift has come from FiberSteel’s current site; the towns, months and write-ups are made up to show the layout. FiberSteel’s real installs
            replace them.
          </p>
        </div>
      </div>
      <ul class="install-tiles" role="list">
        {samples.map((i) => (
          <Tile key={i.id} i={i} onPhotos={setPhotosFor} />
        ))}
      </ul>

      {photosFor && <PhotosDialog id={photosFor.id} name={photosFor.title} noun="install" allowBefore onClose={() => setPhotosFor(null)} />}
    </div>
  );
}
