/**
 * Post an install for "Lifts we've installed": FiberSteel's photos of a finished lift, the boat, the slip, the town and
 * what was built for it. Start from scratch or from a finished install job (?job=<id> fills in the size, boat, slip,
 * docking, town and month). Saving keeps it in this browser; it goes on the site with the next publish (simulated),
 * or waits as a draft.
 *   /office/website/?tab=installs&install=new[&job=<id>]  ·  /office/website/?tab=installs&job=<id>  ·  …&install=<id>
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { liftSizes } from '../../../data/lifts';
import { towns } from '../../data/people';
import type { BoatInfo, InstallPost, Item } from '../../data/types';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Card, Checkbox, cx, Field, Switch } from '../../ui/core';
import { Confirm } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { newInstallId, saveInstall, undoPhotos } from './actions';
import { RowsEditor } from './helpers';
import { COMMON_BUILT, INSTALL_KINDS, installProblems, kindName, MAX_BUILT, monthLabel, sameInstall, sizeName, thisMonth, tidyInstall, whereWhen } from './installs';
import { PhotoImg, PhotoManager } from './PhotosDialog';

type Form = Omit<InstallPost, 'by' | 'at'>;

const TOWNS = towns.map((t) => t.city).sort();
const CUSTOM = '';

/** The kind of install a lift and boat usually mean (the public grid's filter) */
function kindFor(item?: Item, boat?: BoatInfo): string {
  if (!item) return '';
  if (item.id === 'L-SHAL8') return 'shallow';
  if (item.id === 'L-FRONT') return 'front';
  if (item.category === 'PWC lifts') return 'pwc';
  if (item.category === 'Dock steps') return 'dock-steps';
  const t = boat?.type ?? '';
  const cap = item.capacity ?? 0;
  if (/pontoon|tri-toon/i.test(t)) return 'pontoon';
  if (/cruiser/i.test(t)) return cap >= 16000 ? 'large' : 'performance';
  if (/performance|cuddy/i.test(t)) return 'performance';
  return cap >= 16000 ? 'large' : 'v-bottom';
}

/** Finished install jobs, newest first */
export function finishedInstallJobs() {
  return db.value.jobs
    .filter((j) => j.type === 'install' && (j.status === 'completed' || j.status === 'closed'))
    .sort((a, b) => (b.completedAt ?? b.start ?? '').localeCompare(a.completedAt ?? a.start ?? ''));
}

/** What a finished install job says about the install — the boat and the slip, never the owner or the address */
export function fromJob(jobId: string): Partial<Form> | undefined {
  const d = db.value;
  const job = d.jobs.find((j) => j.id === jobId);
  if (!job) return undefined;
  const customer = d.customers.find((c) => c.id === job.customerId);
  const item = d.items.find((i) => i.id === job.itemId);
  const lift = d.lifts.find((l) => l.id === job.liftId);
  const boat = lift?.boat;
  const pwc = !boat || boat.type === 'Personal watercraft';
  const boatText = boat ? (pwc ? 'Personal watercraft' : `${boat.lengthFt} ft ${boat.type.toLowerCase()}`) : '';
  const docking: Form['docking'] = lift?.slip ? (lift.slip.docking === 'back-in' ? 'Back-in' : 'Straight pull-in') : undefined;
  const slip = lift?.slip ? `${lift.slip.widthFt} ft wide slip` : undefined;
  const town = customer?.address.city ?? '';
  const bunks = lift?.bunks && lift.bunks !== 'PWC bunks' ? lift.bunks : undefined;
  const built = [
    item?.name,
    bunks,
    ...(lift?.extras ?? []),
    lift?.remote ? `${lift.remote.brand} remote` : undefined,
    docking === 'Back-in' ? 'Set up for back-in docking' : docking ? 'Installed as a straight pull-in' : undefined,
    slip ? `In a ${slip}` : undefined,
  ].filter((x): x is string => !!x);
  return {
    jobId: job.id,
    kind: kindFor(item, boat),
    size: item?.sizeId,
    boat: boatText,
    slip,
    docking,
    town,
    completed: (job.completedAt ?? job.start ?? '').slice(0, 7),
    title: item ? (pwc ? `${item.name} in ${town || 'a lake cove'}` : `${item.name} for a ${boatText}`) : '',
    built,
  };
}

function blank(id: string): Form {
  return { id, title: '', summary: '', story: '', kind: '', boat: '', town: '', completed: thisMonth(), built: [], featured: false, status: 'published', consent: false };
}

function startingForm(id: string, jobId?: string): Form {
  const w = db.value.website;
  const saved = w.installs[id] ?? w.installsLive[id];
  if (saved) {
    const { by: _by, at: _at, ...rest } = saved;
    return structuredClone(rest);
  }
  const base = blank(id);
  const job = jobId ? fromJob(jobId) : undefined;
  return job ? { ...base, ...job } : base;
}

/* ---------- Preview ---------- */

function CardPreview({ form }: { form: Form }) {
  const photos = db.value.website.photos[form.id] ?? [];
  const facts = [sizeName(form.size), form.boat.trim()].filter(Boolean).join(' · ');
  return (
    <div class="listing-preview">
      <p class="listing-preview__label">
        <Icon name="eye" size={15} /> How the card looks on the site
      </p>
      <div class="listing-card install-preview-card">
        <div class="listing-card__media">
          {photos.length ? (
            <PhotoImg id={photos[0].id} alt="" />
          ) : (
            <span class="install-preview-card__empty">
              <Icon name="camera" size={22} />
              Add a photo
            </span>
          )}
        </div>
        <div class="listing-card__body">
          <p class="listing-card__brand">{whereWhen({ town: form.town.trim() || 'Town', completed: form.completed }) || 'Town · Month'}</p>
          <p class="listing-card__model">{form.title.trim() || 'Title of the install'}</p>
          {facts && <p class="listing-card__type">{facts}</p>}
          <p class="listing-card__note">{[form.kind ? kindName(form.kind) : 'Kind of install', form.docking, form.slip].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {form.summary.trim() && <p class="install-preview-card__summary">{form.summary.trim()}</p>}
      <p class="muted small install-preview-card__where">
        {form.status === 'published'
          ? `After the next publish: on “Lifts we’ve installed”${form.kind && form.kind !== 'dock-steps' ? `, the ${kindName(form.kind).toLowerCase()} lifts page` : ''}${form.featured ? ', and the home page' : ''}. Marked as a preview in this browser.`
          : 'A draft: it stays here until you switch it on.'}
      </p>
    </div>
  );
}

/* ---------- The editor ---------- */

export function InstallEditor({ id: requested, jobId, onClose }: { id: string; jobId?: string; onClose: () => void }) {
  const [newId] = useState(newInstallId);
  const id = requested === 'new' ? newId : requested;
  const [form, setForm] = useState<Form>(() => startingForm(id, jobId));
  const [start] = useState(() => tidyInstall(form));
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);
  const errorsRef = useRef<HTMLDivElement>(null);
  const isNew = !db.value.website.installs[id] && !db.value.website.installsLive[id];
  const photos = db.value.website.photos[id] ?? [];
  const jobs = useMemo(() => finishedInstallJobs().slice(0, 30), []);
  const posted = new Set(Object.values(db.value.website.installs).map((p) => p.jobId).filter(Boolean));

  // A new install that's never saved leaves no photos behind
  useEffect(
    () => () => {
      if (isNew && !saved.current && !db.value.website.installs[id]) undoPhotos(id);
    },
    [],
  );

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = !sameInstall(tidyInstall(form), start);
  const name = form.title.trim() || 'this install';

  const pickJob = (value: string) => {
    const filled = value ? fromJob(value) : undefined;
    if (!filled) return set({ jobId: undefined });
    // Keep anything already typed; fill in the rest from the job
    setForm((f) => {
      const next: Form = { ...f, jobId: filled.jobId };
      for (const [k, v] of Object.entries(filled) as [keyof Form, unknown][]) {
        const cur = f[k];
        const empty = cur === undefined || cur === '' || (Array.isArray(cur) && !cur.length);
        if (v !== undefined && v !== '' && (empty || k === 'completed')) (next as Record<string, unknown>)[k] = v;
      }
      return next;
    });
  };

  const save = () => {
    const found = installProblems(form, photos);
    setProblems(found);
    if (found.length) {
      requestAnimationFrame(() => errorsRef.current?.focus());
      return;
    }
    saveInstall(form);
    saved.current = true;
    toast(`${name} saved — ${form.status === 'draft' ? 'kept as a draft' : 'it goes on the site with the next publish (simulated)'}`, { tone: 'success' });
    onClose();
  };
  const leave = () => (dirty || (isNew && photos.length > 0) ? setConfirmLeave(true) : onClose());

  return (
    <div class="listing-editor install-editor">
      <button type="button" class="link-btn listing-editor__back" onClick={leave}>
        <Icon name="arrow-left" size={16} /> All installs
      </button>
      <header class="listing-editor__head">
        <div>
          <h2 class="listing-editor__title">{isNew ? 'Post an install' : `Install: ${name}`}</h2>
          <p class="muted small">Show a lift your crew put on the water: the boat, the slip and what was built for it. Saved in this browser; it goes on the site with the next publish (simulated).</p>
        </div>
        <div class="listing-editor__actions">
          <Button onClick={leave}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save}>
            Save install
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
          {jobs.length > 0 && (
            <Card title="Start from a finished install" subtitle="Fills in the size, boat, slip, docking, town and month from the job — never the owner’s name or address." level={3}>
              <Field label="Finished install job" optional>
                <select class="select" value={form.jobId ?? ''} onChange={(e) => pickJob((e.target as HTMLSelectElement).value)}>
                  <option value="">None — I’ll fill it in</option>
                  {jobs.map((j) => {
                    const c = db.value.customers.find((x) => x.id === j.customerId);
                    const it = db.value.items.find((i) => i.id === j.itemId);
                    return (
                      <option key={j.id} value={j.id}>
                        {[j.id, it?.name, c?.address.city, monthLabel((j.completedAt ?? j.start ?? '').slice(0, 7))].filter(Boolean).join(' · ')}
                        {posted.has(j.id) && j.id !== form.jobId ? ' (already posted)' : ''}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </Card>
          )}

          <Card title="The lift and the boat" level={3}>
            <div class="form-grid">
              <Field label="Kind of install" hint="How visitors filter the grid, and which lift page it shows on">
                <select class="select" value={form.kind} onChange={(e) => set({ kind: (e.target as HTMLSelectElement).value })}>
                  <option value="">Choose…</option>
                  {INSTALL_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lift size" optional hint="A standard FiberSteel size — leave it for a custom build">
                <select class="select" value={form.size ?? CUSTOM} onChange={(e) => set({ size: (e.target as HTMLSelectElement).value || undefined })}>
                  <option value={CUSTOM}>Custom / not a standard size</option>
                  {liftSizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="The boat" class="span-2" hint="Type and length, e.g. “24 ft bowrider” — the boat, never the owner.">
                <input class="input" value={form.boat} maxLength={60} onInput={(e) => set({ boat: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="The slip" optional hint="e.g. “14 ft wide slip”">
                <input class="input" value={form.slip ?? ''} maxLength={60} onInput={(e) => set({ slip: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Docking" optional>
                <select class="select" value={form.docking ?? ''} onChange={(e) => set({ docking: ((e.target as HTMLSelectElement).value || undefined) as Form['docking'] })}>
                  <option value="">Don’t say</option>
                  <option value="Straight pull-in">Straight pull-in</option>
                  <option value="Back-in">Back-in</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card title="The job" level={3}>
            <div class="form-grid">
              <Field label="Title" class="span-2" hint="What a boater would call it, e.g. “Extra-tall bunks for an inboard ski boat”.">
                <input class="input" value={form.title} maxLength={80} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Town" hint="Only the town — never the street, cove or mile marker.">
                <input class="input" value={form.town} maxLength={40} list="install-towns" onInput={(e) => set({ town: (e.target as HTMLInputElement).value })} />
              </Field>
              <datalist id="install-towns">
                {TOWNS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Field label="Finished" hint="Month and year">
                <input class="input" type="month" max={thisMonth()} value={form.completed} onInput={(e) => set({ completed: (e.target as HTMLInputElement).value })} />
              </Field>
            </div>
          </Card>

          <Card title="The story" subtitle="Plain and specific: what the boat and the slip needed, and what was built." level={3}>
            <div class="form-grid">
              <Field label="One-line summary" class="span-2" hint={`What search results and the page’s intro show. ${160 - form.summary.length} characters left.`}>
                <input class="input" value={form.summary} maxLength={160} onInput={(e) => set({ summary: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="The job, in a few lines" class="span-2" hint="A blank line starts a new paragraph. No prices, ratings or claims you can’t back up — and no quotes unless the owners said them and said yes.">
                <textarea class="textarea" rows={5} maxLength={1200} value={form.story} onInput={(e) => set({ story: (e.target as HTMLTextAreaElement).value })} />
              </Field>
            </div>
          </Card>

          <Card title="What was built for it" subtitle="Shown as a checklist on its page: the size, the bunks and anything else worth pointing out." level={3}>
            <RowsEditor rows={form.built} onChange={(built) => set({ built })} common={COMMON_BUILT} max={MAX_BUILT} noun="built" label="What was built for it" placeholder="One thing per row, e.g. “Walk boards on both sides”." />
          </Card>

          <Card title="Photos" subtitle="FiberSteel’s own photos of the finished lift. They’re saved as you add them; the first one leads." level={3}>
            <PhotoManager
              id={id}
              name={form.title.trim() || [sizeName(form.size), form.boat.trim()].filter(Boolean).join(', ') || 'A FiberSteel lift'}
              allowBefore
              noun="install"
              hint="Photos of the lift on the water — and a “before” if you have one. Leave out faces, house numbers, boat registration numbers and anything else that gives the address away."
            />
          </Card>

          <Card title="On the website" level={3}>
            <div class="install-publish">
              <Switch
                checked={form.status === 'published'}
                onChange={(on) => set({ status: on ? 'published' : 'draft' })}
                label="Show this install on the site"
                description={form.status === 'published' ? 'After the next publish it’s on “Lifts we’ve installed” and its lift page.' : 'Kept as a draft: it stays here until you switch it on.'}
              />
              <Switch checked={form.featured} onChange={(on) => set({ featured: on })} label="Feature it on the home page" description="The home page shows the three newest featured installs." />
              <div class={cx('install-consent', !form.consent && form.status === 'published' && 'is-missing')}>
                <Checkbox checked={form.consent} onChange={(v) => set({ consent: v })}>
                  The owners said yes to sharing these photos. The site shows the town only — no name, street, cove, house numbers or faces.
                </Checkbox>
              </div>
            </div>
          </Card>

          <div class="listing-editor__foot">
            <Button onClick={leave}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>
              Save install
            </Button>
          </div>
        </div>

        <aside class="listing-editor__side" aria-label="Preview">
          <CardPreview form={form} />
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
          <p>{isNew ? 'This install and any photos you added to it will be discarded.' : 'Your changes will be lost. Photos you added stay — they save as you go.'}</p>
        </Confirm>
      )}
    </div>
  );
}
