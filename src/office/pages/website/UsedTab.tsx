/**
 * Website → Used lifts: the listings on the public Used lifts page. The concept starts with sample listings (real
 * FiberSteel sizes, stand-in photos); staff change them into real ones, mark them sold, take them off, or add new ones.
 *   /office/website/?tab=used[&listing=new|<id>]
 */
import { useState } from 'preact/hooks';
import { useAssets } from '../../assets';
import { param, setParams } from '../../router';
import { toast } from '../../toast';
import { Badge, Button, Card, Menu, type MenuItem } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { removeUsed, restoreUsed, setUsedStatus, undoUsed } from './actions';
import { webUsed, type WebUsed } from './data';
import { PendingBadge, SampleBadge, SiteLink } from './helpers';
import { sizeName } from './installs';
import { PhotoImg, PhotosDialog } from './PhotosDialog';
import { statusLabel, usedRules } from './used';
import { UsedEditor } from './UsedEditor';

function UsedTile({ u, onPhotos }: { u: WebUsed; onPhotos: (u: WebUsed) => void }) {
  const { photos } = useAssets();
  const l = u.listing;
  const open = () => setParams({ listing: u.id });
  const items: (MenuItem | 'divider')[] = [{ label: 'Edit…', icon: 'edit', onSelect: open }];
  if (!u.removed) {
    // A sample nobody has changed yet gets its photos in the editor, so saving it keeps them
    items.push({ label: 'Photos…', icon: 'camera', onSelect: () => (u.changed ? onPhotos(u) : open()) });
    for (const s of ['available', 'pending', 'sold'] as const) {
      if (s !== l.status) items.push({ label: `Mark ${statusLabel[s].toLowerCase()}`, icon: s === 'sold' ? 'check-circle' : s === 'pending' ? 'clock' : 'tag', onSelect: () => (setUsedStatus(u.id, s), toast(`${l.title}: ${statusLabel[s].toLowerCase()} — on the page after the next publish`)) });
    }
  }
  if (u.removed && !u.live)
    items.push({ label: 'Put it back on the page', icon: 'undo', onSelect: () => (restoreUsed(u.id), toast(`${l.title} goes back on the page with the next publish (simulated)`)) });
  if (u.pending && (u.changed || u.sample))
    items.push({ label: 'Undo changes', icon: 'undo', onSelect: () => (undoUsed(u.id), toast(`${l.title}: back to how the page shows it`)) });
  if (!u.removed)
    items.push('divider', {
      label: u.sample || u.live ? 'Take it off the page' : 'Delete',
      icon: 'trash',
      danger: true,
      onSelect: () => (removeUsed(u.id), toast(u.sample || u.live ? `${l.title} comes off the page with the next publish (simulated)` : `${l.title} deleted`)),
    });
  const standIn = u.photoKey ? photos[u.photoKey] : undefined;
  return (
    <li class={u.removed ? 'install-tile used-tile is-removed' : 'install-tile used-tile'}>
      <div class="install-tile__media">
        {u.photoId ? <PhotoImg id={u.photoId} alt="" /> : standIn ? <img src={standIn} alt="" loading="lazy" /> : <Icon name="camera" size={22} />}
        <span class={`used-preview__status is-${l.status}`}>{statusLabel[l.status]}</span>
      </div>
      <div class="install-tile__body">
        <p class="install-tile__badges">
          {u.sample && <SampleBadge />}
          {u.removed ? (
            u.live ? <Badge tone="red">Coming off the page</Badge> : <Badge tone="neutral">Off the page</Badge>
          ) : !u.sample && !u.live ? (
            <Badge tone="amber">Goes up next publish</Badge>
          ) : u.live ? (
            <Badge tone="green" icon="globe">
              On the page
            </Badge>
          ) : null}
          {u.pending && !u.removed && (u.live || u.sample) && <PendingBadge>Changes waiting</PendingBadge>}
        </p>
        <button type="button" class="install-tile__title link-btn" onClick={open}>
          {l.title}
        </button>
        <p class="install-tile__meta">{sizeName(l.size)}</p>
        <p class="install-tile__meta muted">{l.condition}</p>
        <p class="install-tile__meta muted">{l.showPrice && l.price ? `Price shown: $${l.price.toLocaleString('en-US')}` : 'Call for price'}</p>
      </div>
      <div class="install-tile__menu">
        <Menu label={`Actions for ${l.title}`} items={items} size="sm" />
      </div>
    </li>
  );
}

export function UsedTab() {
  const listing = param('listing');
  const [photosFor, setPhotosFor] = useState<WebUsed | null>(null);
  if (listing) return <UsedEditor key={listing} id={listing} onClose={() => setParams({ listing: undefined })} />;

  const rows = webUsed.value;
  const mine = rows.filter((u) => !u.sample);
  const samples = rows.filter((u) => u.sample);
  return (
    <div class="installs-tab">
      <Card title="The Used lifts page" subtitle="Its rules stay as they are on the current page:">
        <ul class="used-rules" role="list">
          {usedRules.map((r) => (
            <li key={r}>
              <Icon name="info" size={16} /> {r}
            </li>
          ))}
        </ul>
        <p class="showcase-card__note">
          <Icon name="tag" size={14} /> No prices unless FiberSteel decides to show them — each listing has its own switch. <SiteLink path="/used-lifts/">Open the Used lifts page</SiteLink>
        </p>
      </Card>

      <div class="installs-head">
        <div>
          <h2 class="installs-head__title">Listed from FiberSteel mode</h2>
          <p class="muted small">Trade-ins and used lifts for sale. They go on the page with the next publish (simulated).</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setParams({ listing: 'new' })}>
          List a used lift
        </Button>
      </div>
      {mine.length ? (
        <ul class="install-tiles" role="list">
          {mine.map((u) => (
            <UsedTile key={u.id} u={u} onPhotos={setPhotosFor} />
          ))}
        </ul>
      ) : (
        <p class="muted small used-empty">Nothing listed here yet — add a trade-in, or turn one of the samples below into a real listing.</p>
      )}

      <div class="installs-head">
        <div>
          <h2 class="installs-head__title">Sample listings on the page now</h2>
          <p class="muted small">Real FiberSteel sizes with stand-in photos, made up to show the layout — the current page had no used lifts listed with details. Edit one to make it real, or take it off.</p>
        </div>
      </div>
      <ul class="install-tiles" role="list">
        {samples.map((u) => (
          <UsedTile key={u.id} u={u} onPhotos={setPhotosFor} />
        ))}
      </ul>

      {photosFor && <PhotosDialog id={photosFor.id} name={photosFor.listing.title} noun="listing" onClose={() => setPhotosFor(null)} />}
    </div>
  );
}
