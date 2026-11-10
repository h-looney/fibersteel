/**
 * Photos for an install post or a used-lift listing: staff add FiberSteel's own photos and describe each one. They go
 * on the public pages with the next publish (simulated). The images stay in this browser (IndexedDB `photo:<id>`).
 * PhotoManager is the part the editors use; PhotosDialog wraps it for a quick change from a list.
 */
import { useEffect, useState } from 'preact/hooks';
import { plural } from '../../lib/format';
import { db, getPhoto } from '../../store';
import { toast } from '../../toast';
import { Button, Checkbox, cx, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { addPhoto, movePhoto, removePhoto, updatePhoto } from './actions';
import { MAX_PHOTOS, PHOTO_TYPES } from './photos';

/** A photo kept in this browser, shown from IndexedDB */
export function PhotoImg({ id, alt, class: className }: { id: string; alt: string; class?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void getPhoto(id).then((blob) => {
      if (!live || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url ? <img src={url} alt={alt} class={className} /> : <span class={cx(className, 'photo-img--loading')} aria-hidden="true" />;
}

/** Put focus back on a control after its row moves (moving a row's DOM node drops focus) */
export const refocus = (...ids: string[]) =>
  requestAnimationFrame(() => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el.focus();
    }
  });

/**
 * Add, describe, order and remove photos. `name` starts each new photo's description; installs offer a "before" tick.
 */
export function PhotoManager({ id, name, allowBefore = false, noun = 'install', hint }: { id: string; name: string; allowBefore?: boolean; noun?: string; hint?: string }) {
  const [busy, setBusy] = useState(0);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const photos = db.value?.website.photos[id] ?? [];
  const room = MAX_PHOTOS - photos.length;

  async function add(files: File[]) {
    if (!files.length) return;
    const take = files.slice(0, Math.max(0, room));
    const problems = files.length > take.length ? [`Up to ${MAX_PHOTOS} photos per ${noun}: ${plural(files.length - take.length, 'photo')} weren’t added`] : [];
    setErrors([]);
    setBusy(take.length);
    setStatus(`Adding ${plural(take.length, 'photo')}…`);
    let added = 0;
    for (const file of take) {
      try {
        await addPhoto(id, file, { alt: name });
        added++;
      } catch (e) {
        problems.push((e as Error).message);
      }
    }
    setBusy(0);
    setErrors(problems);
    setStatus(added ? `Added ${plural(added, 'photo')}. Check each description below.` : '');
  }

  const onPick = (e: Event) => {
    const input = e.target as HTMLInputElement;
    void add([...(input.files ?? [])]);
    input.value = '';
  };

  return (
    <div class="photo-dialog">
      {hint && (
        <p class="photo-hint">
          <Icon name="camera" size={16} /> {hint}
        </p>
      )}

      <label
        class={cx('photo-drop', dragging && 'is-dragging', (room <= 0 || busy > 0) && 'is-disabled')}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (room > 0 && !busy) void add([...(e.dataTransfer?.files ?? [])]);
        }}
      >
        <Icon name="upload" size={22} />
        <span class="photo-drop__title">{room > 0 ? 'Add photos' : `${MAX_PHOTOS} photos — the most a ${noun} can have`}</span>
        <span class="photo-drop__hint">
          JPEG, PNG or WebP · up to {MAX_PHOTOS} per {noun} · location data is removed
        </span>
        <input type="file" class="sr-only" accept={PHOTO_TYPES.join(',')} multiple disabled={room <= 0 || busy > 0} onChange={onPick} />
      </label>

      <div role="status" class="photo-status">
        {status && <p>{status}</p>}
        {errors.length > 0 && (
          <ul class="photo-errors">
            {errors.map((m) => (
              <li key={m}>
                <Icon name="alert" size={14} /> {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      {photos.length > 0 && (
        <ol class="photo-list" aria-label="Photos, in the order they show">
          {photos.map((ph, i) => {
            const n = i + 1;
            const last = i === photos.length - 1;
            return (
              <li key={ph.id} class="photo-row">
                <div class="photo-row__img">
                  <PhotoImg id={ph.id} alt="" />
                  {i === 0 && <span class="photo-row__main">Main photo</span>}
                </div>
                <div class="photo-row__fields">
                  <Field label={`Description of photo ${n}`} hint="What it shows. Screen readers read it aloud.">
                    <input id={`photo-${ph.id}-alt`} class="input" value={ph.alt} maxLength={160} onInput={(e) => updatePhoto(id, ph.id, { alt: (e.target as HTMLInputElement).value })} />
                  </Field>
                  {!ph.alt.trim() && <p class="photo-warn">Add a description — without one the photo is described as “{name}”.</p>}
                  {allowBefore && (
                    <Checkbox checked={!!ph.before} onChange={(v) => updatePhoto(id, ph.id, { before: v || undefined })}>
                      A “before” photo (the empty slip or the old lift)<span class="sr-only">: photo {n}</span>
                    </Checkbox>
                  )}
                </div>
                <div class="photo-row__actions">
                  {i > 0 && (
                    <Button id={`photo-${ph.id}-main`} size="sm" icon="star" onClick={() => (movePhoto(id, ph.id, 0), refocus(`photo-${ph.id}-down`, `photo-${ph.id}-alt`))}>
                      Make main<span class="sr-only"> photo: photo {n}</span>
                    </Button>
                  )}
                  {i > 0 && (
                    <Button id={`photo-${ph.id}-up`} size="sm" variant="ghost" icon="sort-up" onClick={() => (movePhoto(id, ph.id, i - 1), refocus(`photo-${ph.id}-up`, `photo-${ph.id}-down`))}>
                      Earlier<span class="sr-only">: move photo {n} up</span>
                    </Button>
                  )}
                  {!last && (
                    <Button id={`photo-${ph.id}-down`} size="sm" variant="ghost" icon="sort-down" onClick={() => (movePhoto(id, ph.id, i + 1), refocus(`photo-${ph.id}-down`, `photo-${ph.id}-up`))}>
                      Later<span class="sr-only">: move photo {n} down</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    onClick={() => {
                      const next = photos[i + 1] ?? photos[i - 1];
                      removePhoto(id, ph.id);
                      toast(`Photo ${n} removed`);
                      if (next) refocus(`photo-${next.id}-alt`);
                    }}
                  >
                    Remove<span class="sr-only"> photo {n}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Photos for one post or listing, from a list */
export function PhotosDialog({ id, name, noun, allowBefore, onClose }: { id: string; name: string; noun: string; allowBefore?: boolean; onClose: () => void }) {
  return (
    <Dialog
      title={`Photos: ${name}`}
      description="FiberSteel’s own photos. They go on the public page with the next publish (simulated)."
      size="lg"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <PhotoManager id={id} name={name} noun={noun} allowBefore={allowBefore} />
    </Dialog>
  );
}
