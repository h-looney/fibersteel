import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'warning';
  action?: { label: string; run: () => void };
}

export const toasts = signal<Toast[]>([]);
let next = 1;

/** Show a short confirmation. Disappears on its own after a few seconds. */
export function toast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action']; duration?: number } = {}) {
  const id = next++;
  toasts.value = [...toasts.value.slice(-3), { id, text, tone: opts.tone ?? 'default', action: opts.action }];
  setTimeout(() => dismissToast(id), opts.duration ?? (opts.action ? 7000 : 4200));
  return id;
}

export const dismissToast = (id: number) => {
  toasts.value = toasts.value.filter((t) => t.id !== id);
};
