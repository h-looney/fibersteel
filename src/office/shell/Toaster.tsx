import { dismissToast, toasts } from '../toast';
import { Icon } from '../ui/Icon';

export function Toaster() {
  return (
    <div class="toaster" role="status" aria-live="polite" aria-atomic="false">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast toast--${t.tone}`}>
          <Icon name={t.tone === 'warning' ? 'alert' : 'check-circle'} size={18} />
          <span class="toast__text">{t.text}</span>
          {t.action && (
            <button
              type="button"
              class="toast__action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" class="toast__close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
