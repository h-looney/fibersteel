/** Sortable, paginated data table with optional row selection. */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { cx } from './core';
import { Icon } from './Icon';

export interface Column<T> {
  key: string;
  label: ComponentChildren;
  render: (row: T) => ComponentChildren;
  sortValue?: (row: T) => string | number | undefined;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Hide on narrow screens */
  hide?: 'sm' | 'md';
  class?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  empty?: ComponentChildren;
  footer?: ComponentChildren;
  selected?: Set<string>;
  onSelect?: (keys: Set<string>) => void;
  rowClass?: (row: T) => string | undefined;
  dense?: boolean;
}

const interactive = 'a, button, input, select, textarea, label, [role="button"]';

export function DataTable<T>({ rows, columns, rowKey, caption, onRowClick, initialSort, pageSize = 25, empty, footer, selected, onSelect, rowClass, dense }: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const get = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === undefined || va === '') return 1;
      if (vb === undefined || vb === '') return -1;
      return (va < vb ? -1 : 1) * dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [pages]);
  const shown = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(0);
  };

  const allOnPage = shown.length > 0 && shown.every((r) => selected?.has(rowKey(r)));
  const togglePage = () => {
    if (!selected || !onSelect) return;
    const next = new Set(selected);
    shown.forEach((r) => (allOnPage ? next.delete(rowKey(r)) : next.add(rowKey(r))));
    onSelect(next);
  };

  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div class="table-block">
      <div class="table-wrap">
        <table class={cx('table', dense && 'table--dense', onRowClick && 'table--clickable')}>
          <caption class="sr-only">{caption}</caption>
          <thead>
            <tr>
              {onSelect && (
                <th class="table__check" scope="col">
                  <input type="checkbox" checked={allOnPage} aria-label="Select all on this page" onChange={togglePage} />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  class={cx(c.align && `is-${c.align}`, c.hide && `hide-${c.hide}`, c.class)}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" class="table__sort" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <Icon name={sort?.key === c.key ? (sort.dir === 'asc' ? 'sort-up' : 'sort-down') : 'sort'} size={14} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const key = rowKey(row);
              const isSel = selected?.has(key);
              return (
                <tr
                  key={key}
                  class={cx(isSel && 'is-selected', rowClass?.(row))}
                  onClick={
                    onRowClick
                      ? (e) => {
                          if ((e.target as HTMLElement).closest(interactive)) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                >
                  {onSelect && (
                    <td class="table__check">
                      <input
                        type="checkbox"
                        checked={!!isSel}
                        aria-label="Select row"
                        onChange={() => {
                          const next = new Set(selected);
                          if (isSel) next.delete(key);
                          else next.add(key);
                          onSelect(next);
                        }}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} class={cx(c.align && `is-${c.align}`, c.hide && `hide-${c.hide}`, c.class)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {sorted.length > pageSize && (
        <nav class="pager" aria-label={`${caption} pages`}>
          <span class="pager__info">
            {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length.toLocaleString()}
          </span>
          <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <Icon name="chevron-left" size={16} />
          </button>
          <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            <Icon name="chevron-right" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
