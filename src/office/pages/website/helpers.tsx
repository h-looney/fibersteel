/** Badges and small pieces shared by the Website tabs. Color never carries meaning alone — every badge has a label. */
import type { ComponentChildren } from 'preact';
import { Badge } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { siteHref } from './data';

export function PendingBadge({ children = 'Waiting for the next publish' }: { children?: ComponentChildren }) {
  return (
    <Badge tone="amber" icon="clock" title="Saved in this browser. In production it would go out when the site is next published.">
      {children}
    </Badge>
  );
}

export function SampleBadge() {
  return (
    <Badge tone="neutral" icon="info" title="Made up for this concept, to show the layout">
      Sample
    </Badge>
  );
}

/** A link to a page on the concept's public site, in a new tab */
export function SiteLink({ path, children }: { path: string; children: ComponentChildren }) {
  return (
    <a class="link-btn site-link" href={siteHref(path)} target="_blank" rel="noopener">
      {children} <Icon name="external" size={13} />
      <span class="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** One editable list of short rows (what was built, what a used lift includes), with common ones a click away */
export function RowsEditor({
  rows,
  onChange,
  common,
  max,
  noun,
  label,
  placeholder,
}: {
  rows: string[];
  onChange: (rows: string[]) => void;
  common: string[];
  max: number;
  noun: string;
  label: string;
  placeholder: string;
}) {
  const set = (i: number, v: string) => onChange(rows.map((r, n) => (n === i ? v : r)));
  const remove = (i: number) => onChange(rows.filter((_, n) => n !== i));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r);
    onChange(next);
  };
  const has = (c: string) => rows.some((r) => r.trim().toLowerCase() === c.toLowerCase());
  const full = rows.length >= max;
  return (
    <div class="rows-editor">
      {common.length > 0 && (
        <div class="spec-common">
          <p class="spec-common__label" id={`${noun}-common`}>
            Common — add with a click
          </p>
          <ul class="spec-common__list" role="list" aria-labelledby={`${noun}-common`}>
            {common.map((c) => (
              <li key={c}>
                <button type="button" class={has(c) ? 'spec-chip is-on' : 'spec-chip'} aria-pressed={has(c)} disabled={!has(c) && full} onClick={() => (has(c) ? onChange(rows.filter((r) => r.trim().toLowerCase() !== c.toLowerCase())) : onChange([...rows, c]))}>
                  <Icon name={has(c) ? 'check' : 'plus'} size={14} />
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length > 0 ? (
        <ol class="rows-editor__list" aria-label={label}>
          {rows.map((r, i) => (
            <li key={i} class="rows-editor__row">
              <span class="rows-editor__n" aria-hidden="true">
                {i + 1}
              </span>
              <input class="input" value={r} maxLength={90} aria-label={`${label}, row ${i + 1}`} onInput={(e) => set(i, (e.target as HTMLInputElement).value)} />
              <span class="rows-editor__actions">
                <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Move row ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="sort-up" size={16} />
                </button>
                <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Move row ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <Icon name="sort-down" size={16} />
                </button>
                <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Remove row ${i + 1}`} onClick={() => remove(i)}>
                  <Icon name="trash" size={16} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p class="spec-empty muted small">Nothing listed yet.</p>
      )}
      <div class="spec-add">
        <button type="button" class="btn btn--secondary btn--sm" disabled={full} onClick={() => onChange([...rows, ''])}>
          <Icon name="plus" size={16} />
          <span>Add a row</span>
        </button>
        <span class="muted small">
          {full ? `${max} rows — the most it can have.` : placeholder}
        </span>
      </div>
    </div>
  );
}
