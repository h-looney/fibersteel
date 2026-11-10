import type { Notice } from '../data/types';
import { relative } from '../lib/format';
import { navigate } from '../router';
import { db, edit, mutate } from '../store';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/core';
import { Icon, type IconName } from '../ui/Icon';

const icons: Record<Notice['kind'], IconName> = {
  lead: 'inbox',
  job: 'clipboard',
  payment: 'dollar',
  stock: 'box',
  warranty: 'shield',
  dealer: 'handshake',
  build: 'hardhat',
  sync: 'refresh',
  system: 'info',
};

export function Notifications({ onClose }: { onClose: () => void }) {
  const notices = db.value.notices;
  const unread = notices.filter((n) => !n.read).length;
  const markAll = () =>
    mutate((d) => {
      d.notices = d.notices.map((n) => (n.read ? n : { ...n, read: true }));
    });
  return (
    <Dialog
      title="Notifications"
      description={unread ? `${unread} unread` : 'You’re all caught up'}
      onClose={onClose}
      drawer
      size="sm"
      headerExtra={
        unread > 0 ? (
          <button type="button" class="btn btn--ghost btn--sm" onClick={markAll}>
            Mark all read
          </button>
        ) : undefined
      }
    >
      {notices.length === 0 ? (
        <EmptyState icon="bell" title="No notifications" />
      ) : (
        <ul class="notices" role="list">
          {notices.slice(0, 40).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                class={`notice${n.read ? '' : ' is-unread'}`}
                onClick={() => {
                  mutate((d) => edit(d.notices, n.id, (x) => (x.read = true)));
                  onClose();
                  if (n.href) navigate(n.href);
                }}
              >
                <span class={`notice__icon notice__icon--${n.kind}`}>
                  <Icon name={icons[n.kind]} size={16} />
                </span>
                <span class="notice__text">
                  {n.text}
                  <span class="notice__time">{relative(n.at)}</span>
                </span>
                {!n.read && <span class="notice__dot" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
