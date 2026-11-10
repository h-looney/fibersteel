/**
 * FiberSteel mode UI kit — small, accessible building blocks styled by office.css.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useAssets } from '../assets';
import type { Staff } from '../data/types';
import { initials } from '../lib/format';
import { href, navigate } from '../router';
import { Icon, type IconName } from './Icon';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
export { cx };

/* ---------- Links & buttons ---------- */

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'class'>;

/** In-app link: real href (open in new tab works), client-side navigation on plain clicks. */
export function Link({ to, class: className, children, onClick, ...rest }: AnchorProps & { to: string; class?: string; children: ComponentChildren }) {
  return (
    <a
      href={href(to)}
      class={className}
      onClick={(e) => {
        (onClick as ((e: MouseEvent) => void) | undefined)?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: IconName;
  iconRight?: IconName;
  class?: string;
  children?: ComponentChildren;
}

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, class: className, children, type = 'button', ...rest }: ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'icon'>) {
  return (
    <button type={type} class={cx('btn', `btn--${variant}`, `btn--${size}`, !children && 'btn--icon', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children !== undefined && children !== null && children !== false && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={16} />}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', size = 'md', icon, iconRight, class: className, children, ...rest }: ButtonOwnProps & AnchorProps & { to: string }) {
  return (
    <Link to={to} class={cx('btn', `btn--${variant}`, `btn--${size}`, !children && 'btn--icon', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={16} />}
    </Link>
  );
}

/* ---------- Badges & avatars ---------- */

export type Tone = 'neutral' | 'accent' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal';

export function Badge({ tone = 'neutral', icon, children, title, class: className }: { tone?: Tone; icon?: IconName; children: ComponentChildren; title?: string; class?: string }) {
  return (
    <span class={cx('badge', `badge--${tone}`, className)} title={title}>
      {icon && <Icon name={icon} size={13} stroke={2.1} />}
      {children}
    </span>
  );
}

export function Avatar({ person, size = 28, class: className }: { person?: Pick<Staff, 'name' | 'photo' | 'color'>; size?: number; class?: string }) {
  const { avatars } = useAssets();
  const style = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` };
  if (!person) return <span class={cx('avatar avatar--empty', className)} style={style} aria-hidden="true" />;
  const src = person.photo ? avatars[person.photo] : undefined;
  if (src) return <img class={cx('avatar', className)} src={src} alt="" width={size} height={size} style={style} title={person.name} loading="lazy" />;
  return (
    <span class={cx('avatar', className)} style={{ ...style, background: person.color }} title={person.name} aria-hidden="true">
      {initials(person.name)}
    </span>
  );
}

export function AvatarStack({ people, size = 26, max = 3 }: { people: Staff[]; size?: number; max?: number }) {
  if (!people.length) return <span class="muted small">Unassigned</span>;
  return (
    <span class="avatar-stack" aria-label={people.map((p) => p.name).join(', ')} role="img">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.name} person={p} size={size} />
      ))}
      {people.length > max && <span class="avatar avatar--more" style={{ width: `${size}px`, height: `${size}px` }}>+{people.length - max}</span>}
    </span>
  );
}

/* ---------- Layout pieces ---------- */

export function PageHeader({ eyebrow, title, description, actions, children }: { eyebrow?: ComponentChildren; title: ComponentChildren; description?: ComponentChildren; actions?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div class="page-head__text">
        {eyebrow && <p class="page-head__eyebrow">{eyebrow}</p>}
        <h1 class="page-head__title" tabIndex={-1} data-page-title>
          {title}
        </h1>
        {description && <p class="page-head__desc">{description}</p>}
      </div>
      {actions && <div class="page-head__actions">{actions}</div>}
      {children}
    </header>
  );
}

export function Card({ title, subtitle, actions, children, class: className, flush, level = 2, id }: { title?: ComponentChildren; subtitle?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren; class?: string; flush?: boolean; level?: 2 | 3; id?: string }) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <section class={cx('card', flush && 'card--flush', className)} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <header class="card__head">
          <div>
            {title && <H class="card__title">{title}</H>}
            {subtitle && <p class="card__sub">{subtitle}</p>}
          </div>
          {actions && <div class="card__actions">{actions}</div>}
        </header>
      )}
      <div class="card__body">{children}</div>
    </section>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action }: { icon?: IconName; title: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <span class="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <p class="empty__title">{title}</p>
      {children && <p class="empty__text">{children}</p>}
      {action && <div class="empty__action">{action}</div>}
    </div>
  );
}

/** Label/value pairs */
export function Details({ items, columns = 1 }: { items: [ComponentChildren, ComponentChildren][]; columns?: 1 | 2 }) {
  return (
    <dl class={cx('details', columns === 2 && 'details--2')}>
      {items
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v], i) => (
          <div key={i}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/* ---------- KPI tiles ---------- */

export function Stat({
  label,
  value,
  delta,
  deltaGood = 'up',
  deltaLabel,
  hint,
  icon,
  to,
  spark,
}: {
  label: string;
  value: ComponentChildren;
  /** Fractional change, e.g. 0.12 for +12% */
  delta?: number;
  deltaGood?: 'up' | 'down';
  deltaLabel?: string;
  hint?: ComponentChildren;
  icon?: IconName;
  to?: string;
  spark?: ComponentChildren;
}) {
  const good = delta === undefined ? undefined : delta === 0 ? undefined : (delta > 0) === (deltaGood === 'up');
  const body = (
    <>
      <span class="stat__label">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </span>
      <span class="stat__value">{value}</span>
      {(delta !== undefined || hint) && (
        <span class="stat__meta">
          {delta !== undefined && (
            <span class={cx('stat__delta', good === true && 'is-good', good === false && 'is-bad')}>
              <Icon name={delta >= 0 ? 'arrow-up-right' : 'trend'} size={14} class={delta < 0 ? 'icon-flip' : undefined} />
              {`${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta * 100).toFixed(Math.abs(delta) < 0.1 ? 1 : 0)}%`}
              {deltaLabel && <span class="stat__delta-label"> {deltaLabel}</span>}
            </span>
          )}
          {hint && <span class="stat__hint">{hint}</span>}
        </span>
      )}
      {spark && <span class="stat__spark">{spark}</span>}
    </>
  );
  return to ? (
    <Link to={to} class="stat stat--link">
      {body}
    </Link>
  ) : (
    <div class="stat">{body}</div>
  );
}

/** Same-ramp meter: the track is a lighter step of the fill's hue */
export function Meter({ value, max = 1, tone = 'accent', label }: { value: number; max?: number; tone?: 'accent' | 'green' | 'amber' | 'red' | 'blue'; label: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <span class={`meter meter--${tone}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span class="meter__fill" style={{ width: `${pct * 100}%` }} />
    </span>
  );
}

/* ---------- Tabs & segmented controls ---------- */

export interface TabItem<K extends string> {
  key: K;
  label: ComponentChildren;
  count?: number;
  icon?: IconName;
}

/** Accessible tabs (arrow keys move between them). Render the active panel yourself inside <TabPanel>. */
export function Tabs<K extends string>({ items, value, onChange, label, idBase }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string; idBase: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (e.key === 'Home' || e.key === 'End' || dir) {
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + dir + items.length) % items.length;
      refs.current[next]?.focus();
      onChange(items[next].key);
    }
  };
  return (
    <div class="tabs" role="tablist" aria-label={label}>
      {items.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.key}`}
          aria-controls={`${idBase}-panel`}
          aria-selected={t.key === value}
          tabIndex={t.key === value ? 0 : -1}
          class="tabs__tab"
          onClick={() => onChange(t.key)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.count !== undefined && <span class="tabs__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idBase, active, children }: { idBase: string; active: string; children: ComponentChildren }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${active}`} class="tabpanel">
      {children}
    </div>
  );
}

export function Segmented<K extends string>({ items, value, onChange, label, size = 'md' }: { items: { key: K; label: ComponentChildren; icon?: IconName }[]; value: K; onChange: (k: K) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div class={cx('segmented', size === 'sm' && 'segmented--sm')} role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" aria-pressed={it.key === value} onClick={() => onChange(it.key)}>
          {it.icon && <Icon name={it.icon} size={16} />}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Pill filters that toggle */
export function Chips<K extends string>({ items, value, onChange, label }: { items: { key: K; label: ComponentChildren; count?: number }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div class="chips" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" class="chip" aria-pressed={it.key === value} onClick={() => onChange(it.key)}>
          {it.label}
          {it.count !== undefined && <span class="chip__count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Form controls ---------- */

export function Field({ label, hint, children, class: className, optional }: { label: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren; class?: string; optional?: boolean }) {
  return (
    <label class={cx('field', className)}>
      <span class="field__label">
        {label}
        {optional && <span class="field__optional"> (optional)</span>}
      </span>
      {children}
      {hint && <span class="field__hint">{hint}</span>}
    </label>
  );
}

export function SearchInput({ value, onInput, placeholder = 'Search', label, class: className }: { value: string; onInput: (v: string) => void; placeholder?: string; label: string; class?: string }) {
  return (
    <span class={cx('search', className)}>
      <Icon name="search" size={16} />
      <input type="search" class="input" value={value} placeholder={placeholder} aria-label={label} onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
    </span>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ComponentChildren; description?: ComponentChildren }) {
  const id = useId();
  return (
    <div class="switch-row">
      <span class="switch-row__text">
        <span id={`${id}-l`} class="switch-row__label">
          {label}
        </span>
        {description && (
          <span id={`${id}-d`} class="switch-row__desc">
            {description}
          </span>
        )}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={description ? `${id}-d` : undefined} class="switch" onClick={() => onChange(!checked)}>
        <span class="switch__thumb" />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, children, class: className }: { checked: boolean; onChange: (v: boolean) => void; children: ComponentChildren; class?: string }) {
  return (
    <label class={cx('check', className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="check__box" aria-hidden="true">
        <Icon name="check" size={13} stroke={3} />
      </span>
      <span class="check__label">{children}</span>
    </label>
  );
}

/* ---------- Menus ---------- */

export interface MenuItem {
  label: ComponentChildren;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Button that opens a small list of actions. Arrow keys move, Escape closes. */
export function Menu({ label, items, icon = 'more', buttonLabel, variant = 'ghost', size = 'md', align = 'end' }: { label: string; items: (MenuItem | 'divider')[]; icon?: IconName; buttonLabel?: ComponentChildren; variant?: ButtonVariant; size?: 'sm' | 'md'; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    const list = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div class="menu" ref={wrap} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        class={cx('btn', `btn--${variant}`, `btn--${size}`, !buttonLabel && 'btn--icon')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        <Icon name={icon} size={size === 'sm' ? 16 : 18} />
        {buttonLabel && <span>{buttonLabel}</span>}
        {buttonLabel && <Icon name="chevron-down" size={14} />}
      </button>
      {open && (
        <div class={cx('menu__list', align === 'start' && 'menu__list--start')} role="menu" id={id} aria-label={label}>
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={i} class="menu__divider" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                class={cx('menu__item', it.danger && 'is-danger')}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  button.current?.focus();
                  it.onSelect();
                }}
              >
                {it.icon && <Icon name={it.icon} size={16} />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Misc ---------- */

export const Kbd = ({ children }: { children: ComponentChildren }) => <kbd class="kbd">{children}</kbd>;

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span class="spinner" role="status" aria-label={label} />;
}

/** Visually hidden text for screen readers */
export const Sr = ({ children }: { children: ComponentChildren }) => <span class="sr-only">{children}</span>;
