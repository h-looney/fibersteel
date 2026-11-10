/**
 * Modal dialogs and side drawers on the native <dialog> element: focus is trapped, Escape
 * closes, and focus returns to whatever opened it. Mount it when it should be open.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { cx } from './core';
import { Icon } from './Icon';

interface Props {
  title: ComponentChildren;
  description?: ComponentChildren;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Slide in from the right instead of centering */
  drawer?: boolean;
  /** Extra header content (badges, actions) */
  headerExtra?: ComponentChildren;
  class?: string;
}

export function Dialog({ title, description, onClose, children, footer, size = 'md', drawer, headerExtra, class: className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    // Move focus to the first field if there is one, otherwise the dialog itself
    const target = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('.dialog__body input:not([type=hidden]), .dialog__body select, .dialog__body textarea');
    (target ?? dialog.querySelector<HTMLElement>('.dialog__close'))?.focus();
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      class={cx('dialog', `dialog--${size}`, drawer && 'dialog--drawer', className)}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      onMouseDown={(e) => {
        // Click on the backdrop closes
        if (e.target === ref.current) onClose();
      }}
    >
      <div class="dialog__inner">
        <div class="dialog__head">
          <div class="dialog__titles">
            <h2 id={`${id}-title`} class="dialog__title">
              {title}
            </h2>
            {description && (
              <p id={`${id}-desc`} class="dialog__desc">
                {description}
              </p>
            )}
          </div>
          {headerExtra}
          <button type="button" class="btn btn--ghost btn--md btn--icon dialog__close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div class="dialog__body">{children}</div>
        {footer && <div class="dialog__foot">{footer}</div>}
      </div>
    </dialog>
  );
}

/** A small yes/no dialog */
export function Confirm({ title, children, confirmLabel = 'Confirm', danger, onConfirm, onClose }: { title: string; children: ComponentChildren; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" class="btn btn--secondary btn--md" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            class={cx('btn btn--md', danger ? 'btn--danger' : 'btn--primary')}
            data-autofocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div class="prose-sm">{children}</div>
    </Dialog>
  );
}
