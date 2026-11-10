/** Photos added in FiberSteel mode (installs and used-lift listings): reading and shrinking the files, and what counts as a change. */
import type { PhotoMeta } from '../../data/types';

export const MAX_PHOTOS = 12;
const MAX_EDGE = 1600;
const MAX_MB = 25;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Read a photo, scale it to at most 1600 px on its long side and re-encode it as a JPEG. Re-encoding also drops the
 * file's metadata, including the GPS location phones add. Throws a message fit to show when the file won't do.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.type && !PHOTO_TYPES.includes(file.type)) throw new Error(`${file.name} isn’t a JPEG, PNG or WebP photo`);
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_MB} MB`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name} couldn’t be read — try saving it as a JPEG`);
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`${file.name} couldn’t be processed`);
    // JPEG has no transparency: put see-through PNGs on white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error(`${file.name} couldn’t be processed`);
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

/** Same photos, in the same order, with the same descriptions? */
export const samePhotos = (a: PhotoMeta[] = [], b: PhotoMeta[] = []) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && p.alt === b[i].alt && !!p.before === !!b[i].before);
