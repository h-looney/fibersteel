/**
 * Write a used-lift listing, or change one of the sample listings the public page shows: the size, its condition, what
 * comes with it, the status and (only if FiberSteel chooses) a price. Saved in this browser; it goes on the Used lifts
 * page with the next publish (simulated).
 *   /office/website/?tab=used&listing=new|<id>
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useAssets } from '../../assets';
import { liftSizes } from '../../../data/lifts';
import { money } from '../../lib/format';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Card, Field, Link, Segmented, Switch } from '../../ui/core';
import { Confirm } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { newUsedId, saveUsed, undoPhotos } from './actions';
import { RowsEditor, SampleBadge } from './helpers';
import { sizeName } from './installs';
import { PhotoImg, PhotoManager } from './PhotosDialog';
import { COMMON_INCLUDES, MAX_INCLUDES, sameUsed, sampleUsed, statusLabel, tidyUsed, usedFromSample, usedProblems, type UsedDraft } from './used';

function startingForm(id: string): UsedDraft {
  const w = db.value.website;
  const saved = w.used[id] ?? w.usedLive[id];
  if (saved) {
    const { by: _by, at: _at, ...rest } = saved;
    return structuredClone(rest);
  }
  const s = sampleUsed(id);
  if (s) return usedFromSample(s);
  return { id, title: '', size: '', condition: '', includes: [], status: 'available', showPrice: false };
}

function Preview({ form }: { form: UsedDraft }) {
  const { photos: thumbs } = useAssets();
  const photos = db.value.website.photos[form.id] ?? [];
  const standIn = !photos.length && sampleUsed(form.id) ? thumbs[`used:${form.id}`] : undefined;
  return (
    <div class="listing-preview">
      <p class="listing-preview__label">
        <Icon name="eye" size={15} /> How it looks on the Used lifts page
      </p>
      <div class={form.status === 'sold' ? 'listing-card used-preview is-sold' : 'listing-card used-preview'}>
        <div class="listing-card__media used-preview__media">
          {photos.length ? (
            <PhotoImg id={photos[0].id} alt="" />
          ) : standIn ? (
            <img src={standIn} alt="" />
          ) : (
            <span class="install-preview-card__empty">
              <Icon name="camera" size={22} />
              Add a photo
            </span>
          )}
          <span class={`used-preview__status is-${form.status}`}>{statusLabel[form.status]}</span>
        </div>
        <div class="listing-card__body">
          <p class="listing-card__brand">{sizeName(form.size) || 'Lift size'}</p>
          <p class="listing-card__model">{form.title.trim() || 'Title of the listing'}</p>
          <p class="listing-card__type">{form.condition.trim() || 'A line about its condition'}</p>
          {form.includes.filter((x) => x.trim()).length > 0 && <p class="listing-card__note">{form.includes.filter((x) => x.trim()).join(' · ')}</p>}
          <p class="used-preview__price">{form.showPrice && Number(form.price) > 0 ? money(Number(form.price), false) : 'Call for price'}</p>
        </div>
      </div>
      <p class="muted small">{form.removed ? 'Coming off the page with the next publish.' : 'Marked as a preview in this browser after the next publish (simulated).'}</p>
    </div>
  );
}

export function UsedEditor({ id: requested, onClose }: { id: string; onClose: () => void }) {
  const [newId] = useState(newUsedId);
  const id = requested === 'new' ? newId : requested;
  const [form, setForm] = useState<UsedDraft>(() => startingForm(id));
  const [start] = useState(() => tidyUsed(form));
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);
  const errorsRef = useRef<HTMLDivElement>(null);
  const w = db.value.website;
  const sample = sampleUsed(id);
  const hadCopy = !!w.used[id] || !!w.usedLive[id];
  const isNew = !sample && !hadCopy;
  const photos = w.photos[id] ?? [];
  const inStock = db.value.items.find((i) => i.id === id && i.kind === 'used');

  // Leaving a listing that was never saved leaves no photos behind
  useEffect(
    () => () => {
      if (!hadCopy && !saved.current && !db.value.website.used[id]) undoPhotos(id);
    },
    [],
  );

  const set = (patch: Partial<UsedDraft>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = !sameUsed(tidyUsed(form), start);
  const name = form.title.trim() || 'this listing';

  const save = () => {
    const found = usedProblems(form, photos, !!sample);
    setProblems(found);
    if (found.length) {
      requestAnimationFrame(() => errorsRef.current?.focus());
      return;
    }
    saveUsed({ ...form, price: form.showPrice ? Number(form.price) : undefined });
    saved.current = true;
    toast(`${name} saved — it goes on the Used lifts page with the next publish (simulated)`, { tone: 'success' });
    onClose();
  };
  const leave = () => (dirty || (!hadCopy && photos.length > 0) ? setConfirmLeave(true) : onClose());

  return (
    <div class="listing-editor used-editor">
      <button type="button" class="link-btn listing-editor__back" onClick={leave}>
        <Icon name="arrow-left" size={16} /> All used lifts
      </button>
      <header class="listing-editor__head">
        <div>
          <h2 class="listing-editor__title">
            {isNew ? 'New used-lift listing' : `Used lift: ${name}`} {sample && <SampleBadge />}
          </h2>
          <p class="muted small">
            {sample
              ? 'A sample listing from this concept. Change it to a real one, mark it sold or take it off the page — it goes out with the next publish (simulated).'
              : 'A trade-in or used lift for sale. Saved in this browser; it goes on the Used lifts page with the next publish (simulated).'}
          </p>
        </div>
        <div class="listing-editor__actions">
          <Button onClick={leave}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save}>
            Save listing
          </Button>
        </div>
      </header>

      {problems.length > 0 && (
        <div class="callout callout--red listing-problems" role="alert" tabIndex={-1} ref={errorsRef}>
          <Icon name="alert" size={18} />
          <div>
            <p class="callout__title">Before saving:</p>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div class="listing-editor__grid">
        <div class="listing-editor__main">
          <Card title="The lift" level={3}>
            <div class="form-grid">
              <Field label="Title" class="span-2" hint="e.g. “Used 10,000 lb lift with V-bunks”">
                <input class="input" value={form.title} maxLength={80} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Lift size">
                <select class="select" value={form.size} onChange={(e) => set({ size: (e.target as HTMLSelectElement).value })}>
                  <option value="">Choose…</option>
                  {liftSizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div class="field">
                <span class="field__label" id="used-status-label">
                  Status
                </span>
                <Segmented<UsedDraft['status']>
                  label="Status"
                  size="sm"
                  value={form.status}
                  onChange={(status) => set({ status })}
                  items={(Object.keys(statusLabel) as UsedDraft['status'][]).map((k) => ({ key: k, label: statusLabel[k] }))}
                />
              </div>
              <Field label="Condition" class="span-2" hint="One or two plain lines: why it was traded in, its age, anything a buyer should know.">
                <textarea class="textarea" rows={2} maxLength={240} value={form.condition} onInput={(e) => set({ condition: (e.target as HTMLTextAreaElement).value })} />
              </Field>
            </div>
            {inStock && (
              <p class="muted small used-editor__stock">
                <Icon name="box" size={14} /> In inventory as <Link to={`/office/inventory/?id=${inStock.id}`}>{inStock.id}</Link>.
              </p>
            )}
          </Card>

          <Card title="What comes with it" subtitle="Shown as tags on the card." level={3}>
            <RowsEditor rows={form.includes} onChange={(includes) => set({ includes })} common={COMMON_INCLUDES} max={MAX_INCLUDES} noun="includes" label="What comes with it" placeholder="One thing per row, e.g. “Walk boards”." />
          </Card>

          <Card title="Price" level={3}>
            <Switch
              checked={form.showPrice}
              onChange={(on) => set({ showPrice: on })}
              label="Show the price on the page"
              description="The current Used Lifts page shows no prices, so this is off — the card says “Call for price”. FiberSteel decides."
            />
            {form.showPrice && (
              <Field label="Price" class="used-editor__price">
                <span class="affix affix--prefix">
                  <span class="affix__text" aria-hidden="true">
                    $
                  </span>
                  <input class="input" type="number" inputMode="numeric" min="0" step="1" value={form.price ?? ''} onInput={(e) => set({ price: Number((e.target as HTMLInputElement).value) || undefined })} />
                </span>
              </Field>
            )}
          </Card>

          <Card title="Photos" subtitle={sample ? 'The sample’s stand-in photo shows until you add one of the real lift.' : 'Photos of the lift itself. They’re saved as you add them; the first one leads.'} level={3}>
            <PhotoManager id={id} name={form.title.trim() || 'A used FiberSteel lift'} noun="listing" hint="The whole lift, out of the water if you can, and close-ups of the tanks and bunks." />
          </Card>

          <div class="listing-editor__foot">
            <Button onClick={leave}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>
              Save listing
            </Button>
          </div>
        </div>

        <aside class="listing-editor__side" aria-label="Preview">
          <Preview form={form} />
        </aside>
      </div>

      {confirmLeave && (
        <Confirm
          title="Leave without saving?"
          confirmLabel="Leave without saving"
          danger
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            onClose();
          }}
        >
          <p>{!hadCopy ? 'This listing and any photos you added to it will be discarded.' : 'Your changes will be lost. Photos you added stay — they save as you go.'}</p>
        </Confirm>
      )}
    </div>
  );
}
