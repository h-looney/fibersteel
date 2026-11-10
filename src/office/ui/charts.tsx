/**
 * Charts for FiberSteel mode, built to the data-viz method:
 *   – thin marks (bars ≤ 24px, 4px rounded data end, square at the baseline; 2px lines)
 *   – 2px surface gaps between touching marks, a 2px surface ring on dots
 *   – one y-axis, hairline solid gridlines, text in ink tokens (never the series color)
 *   – a legend for 2+ series, a hover/keyboard tooltip, and a table view for every chart
 * Series colors are validated tokens (--series-1…3, --series-muted) defined in office.css.
 */
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from './core';

/* ---------- Shared bits ---------- */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Bar path: rounded at the data end (top), square at the baseline */
function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export interface LegendItem {
  label: string;
  color: string;
  kind?: 'bar' | 'line';
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul class="legend" role="list">
      {items.map((it) => (
        <li key={it.label}>
          <span class={cx('legend__key', it.kind === 'line' && 'legend__key--line')} style={{ background: it.color }} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export interface ChartTableData {
  columns: string[];
  rows: (string | number)[][];
}

/** Card-like frame: title, legend, and a toggle to a plain table of the same numbers */
export function ChartFrame({ title, subtitle, legend, table, children, actions, level = 2 }: { title: string; subtitle?: ComponentChildren; legend?: LegendItem[]; table: ChartTableData; children: ComponentChildren; actions?: ComponentChildren; level?: 2 | 3 }) {
  const [asTable, setAsTable] = useState(false);
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <figure class="chart card">
      <figcaption class="chart__head">
        <div>
          <H class="chart__title">{title}</H>
          {subtitle && <p class="chart__sub">{subtitle}</p>}
        </div>
        <div class="chart__tools">
          {actions}
          <button type="button" class="btn btn--ghost btn--sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
            {asTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </figcaption>
      {legend && legend.length > 1 && !asTable && <Legend items={legend} />}
      {asTable ? (
        <div class="table-wrap chart__table">
          <table class="table table--dense">
            <caption class="sr-only">{title}</caption>
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" class={i ? 'is-right' : undefined}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j} class="is-right tabular">{v}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

interface TipRow {
  label: string;
  value: string;
  color?: string;
  kind?: 'bar' | 'line';
  strong?: boolean;
}

function Tooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: TipRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(160);
  useLayoutEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
  });
  const left = Math.max(4, Math.min(width - w - 4, x - w / 2));
  return (
    <div class="chart-tip" ref={ref} style={{ left: `${left}px`, top: `${Math.max(0, y)}px` }}>
      <p class="chart-tip__title">{title}</p>
      {rows.map((r) => (
        <p key={r.label} class={cx('chart-tip__row', r.strong && 'is-total')}>
          {r.color && <span class={cx('chart-tip__key', r.kind === 'bar' && 'chart-tip__key--bar')} style={{ background: r.color }} aria-hidden="true" />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </p>
      ))}
    </div>
  );
}

/* ---------- Column chart (stacked or grouped) ---------- */

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface BarProps {
  categories: string[];
  /** Longer labels for tooltips (defaults to categories) */
  titles?: string[];
  series: Series[];
  stacked?: boolean;
  height?: number;
  format: (n: number) => string;
  axisFormat?: (n: number) => string;
  /** Index to label on its cap (e.g. the current period) */
  labelIndex?: number;
  /** Optional comparison line drawn over the columns (e.g. last year) */
  overlay?: { label: string; color: string; values: (number | null)[] };
  ariaLabel: string;
}

export function BarChart({ categories, titles, series, stacked = true, height = 240, format, axisFormat = format, labelIndex, overlay, ariaLabel }: BarProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = categories.length;
  const m = { top: 22, right: 8, bottom: 28, left: 52 };
  const plotW = Math.max(10, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;

  const totals = categories.map((_, i) => (stacked ? series.reduce((s, se) => s + (se.values[i] ?? 0), 0) : Math.max(...series.map((se) => se.values[i] ?? 0))));
  const maxV = Math.max(...totals, ...(overlay?.values.filter((v): v is number => v !== null) ?? [0]), 0);
  const ticks = niceTicks(maxV);
  const top = ticks[ticks.length - 1] || 1;
  const yOf = (v: number) => m.top + plotH - (v / top) * plotH;
  const band = plotW / Math.max(1, n);
  const groupW = stacked ? Math.min(24, band * 0.62) : Math.min(band * 0.78, series.length * 24 + (series.length - 1) * 2);
  const barW = stacked ? groupW : (groupW - (series.length - 1) * 2) / series.length;
  const every = band < 34 ? Math.ceil(34 / band) : 1;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => (a === null ? (e.key === 'ArrowRight' ? 0 : n - 1) : Math.max(0, Math.min(n - 1, a + (e.key === 'ArrowRight' ? 1 : -1)))));
    } else if (e.key === 'Escape') setActive(null);
  };

  const tipRows = (i: number): TipRow[] => {
    const rows: TipRow[] = series.map((s) => ({ label: s.label, value: format(s.values[i] ?? 0), color: s.color, kind: 'bar' as const }));
    if (stacked && series.length > 1) rows.push({ label: 'Total', value: format(totals[i]), strong: true });
    if (overlay && overlay.values[i] !== null && overlay.values[i] !== undefined) rows.push({ label: overlay.label, value: format(overlay.values[i]!), color: overlay.color, kind: 'line' });
    return rows;
  };

  return (
    <div class="chart__plot" ref={ref} tabIndex={0} role="group" aria-label={`${ariaLabel}. Use the left and right arrow keys to read values.`} onKeyDown={onKey} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={yOf(t)} y2={yOf(t)} class={t === 0 ? 'chart-axis' : 'chart-grid'} />
              <text x={m.left - 8} y={yOf(t)} class="chart-tick" text-anchor="end" dominant-baseline="middle">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const cx0 = m.left + band * i + band / 2;
            let acc = 0;
            return (
              <g key={c + i} class={cx('chart-band', active === i && 'is-active')}>
                <rect x={m.left + band * i} y={m.top} width={band} height={plotH} class="chart-hit" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
                {stacked
                  ? series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      if (v <= 0) return null;
                      const y0 = yOf(acc);
                      acc += v;
                      const y1 = yOf(acc);
                      const gap = si > 0 && y0 < m.top + plotH ? 2 : 0;
                      const isTop = series.slice(si + 1).every((x) => (x.values[i] ?? 0) <= 0);
                      const h = Math.max(0, y0 - y1 - gap);
                      return isTop ? (
                        <path key={s.key} d={columnPath(cx0 - barW / 2, y1, barW, h)} fill={s.color} class="chart-mark" />
                      ) : (
                        <rect key={s.key} x={cx0 - barW / 2} y={y1} width={barW} height={h} fill={s.color} class="chart-mark" />
                      );
                    })
                  : series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      const x = cx0 - groupW / 2 + si * (barW + 2);
                      return <path key={s.key} d={columnPath(x, yOf(v), barW, yOf(0) - yOf(v))} fill={s.color} class="chart-mark" />;
                    })}
                {i % every === 0 && (
                  <text x={cx0} y={height - 8} class="chart-tick" text-anchor="middle">
                    {c}
                  </text>
                )}
                {labelIndex === i && totals[i] > 0 && (
                  <text x={cx0} y={yOf(totals[i]) - 6} class="chart-label" text-anchor="middle">
                    {axisFormat(totals[i])}
                  </text>
                )}
              </g>
            );
          })}
          {overlay && (
            <g class="chart-overlay" pointer-events="none">
              <polyline
                fill="none"
                stroke={overlay.color}
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
                points={overlay.values
                  .map((v, i) => (v === null ? null : `${m.left + band * i + band / 2},${yOf(v)}`))
                  .filter(Boolean)
                  .join(' ')}
              />
              {overlay.values.map((v, i) =>
                v === null || (i !== overlay.values.length - 1 && active !== i) ? null : <circle key={i} cx={m.left + band * i + band / 2} cy={yOf(v)} r={4} fill={overlay.color} class="chart-dot" />,
              )}
            </g>
          )}
        </svg>
      )}
      {active !== null && width > 0 && <Tooltip x={m.left + band * active + band / 2} y={Math.min(yOf(totals[active]) - 12, height - 120)} width={width} title={(titles ?? categories)[active]} rows={tipRows(active)} />}
    </div>
  );
}

/* ---------- Horizontal bars (ranked lists) ---------- */

export interface HBarRow {
  key: string;
  label: string;
  value: number;
  /** Shown after the value, e.g. "of 42" */
  note?: string;
  /** Secondary line under the label */
  sub?: string;
  /** Second series for a stacked bar */
  value2?: number;
  flag?: ComponentChildren;
}

export function HBarChart({ rows, format, color = 'var(--series-1)', color2 = 'var(--series-2)', reference, onSelect, ariaLabel, labels }: { rows: HBarRow[]; format: (n: number) => string; color?: string; color2?: string; reference?: { value: number; label: string }; onSelect?: (key: string) => void; ariaLabel: string; labels?: [string, string] }) {
  const max = Math.max(...rows.map((r) => r.value + (r.value2 ?? 0)), reference?.value ?? 0, 0) || 1;
  // Bars scale within the track minus room for the value label at their tip
  const pct = (v: number) => `calc((100% - var(--hb-room)) * ${(v / max).toFixed(4)})`;
  return (
    <div class={cx('hbars', reference && 'hbars--ref')} style={reference ? `--ref:${pct(reference.value)}` : undefined} role="list" aria-label={ariaLabel}>
      {reference && (
        <div class="hbars__refrow" aria-hidden="true">
          <span />
          <span class="hbars__reflabel">
            <span>{reference.label}</span>
          </span>
        </div>
      )}
      {rows.map((r) => {
        const total = r.value + (r.value2 ?? 0);
        const content = (
          <>
            <span class="hbars__label">
              <span class="hbars__name" title={r.label}>
                {r.label}
              </span>
              {r.sub && <span class="hbars__sub">{r.sub}</span>}
            </span>
            <span class="hbars__track">
              {r.value > 0 && <span class="hbars__bar" style={{ width: pct(r.value), background: color }} title={labels ? `${labels[0]}: ${format(r.value)}` : undefined} />}
              {r.value2 !== undefined && r.value2 > 0 && <span class="hbars__bar hbars__bar--2" style={{ width: pct(r.value2), background: color2 }} title={labels ? `${labels[1]}: ${format(r.value2)}` : undefined} />}
              <span class="hbars__value">
                {format(total)}
                {r.note && <span class="hbars__note"> {r.note}</span>}
              </span>
              {r.flag}
            </span>
          </>
        );
        return onSelect ? (
          <div key={r.key} role="listitem">
            <button type="button" class="hbars__row hbars__row--btn" onClick={() => onSelect(r.key)} aria-label={`${r.label}: ${format(total)}${r.note ? ` ${r.note}` : ''}`}>
              {content}
            </button>
          </div>
        ) : (
          <div key={r.key} role="listitem" class="hbars__row" aria-label={`${r.label}: ${format(total)}${r.note ? ` ${r.note}` : ''}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Line chart with crosshair ---------- */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  /** Light wash under a single series */
  area?: boolean;
}

export function LineChart({ categories, titles, series, height = 220, format, axisFormat = format, ariaLabel, minZero = true }: { categories: string[]; titles?: string[]; series: LineSeries[]; height?: number; format: (n: number) => string; axisFormat?: (n: number) => string; ariaLabel: string; minZero?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = categories.length;
  const m = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotW = Math.max(10, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const maxV = Math.max(...all, 0);
  const ticks = niceTicks(maxV);
  const top = ticks[ticks.length - 1] || 1;
  const bottom = minZero ? 0 : 0;
  const xOf = (i: number) => m.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yOf = (v: number) => m.top + plotH - ((v - bottom) / (top - bottom)) * plotH;
  const every = n > 1 && plotW / n < 38 ? Math.ceil(38 / (plotW / n)) : 1;

  const onMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - m.left) / plotW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => (a === null ? (e.key === 'ArrowRight' ? 0 : n - 1) : Math.max(0, Math.min(n - 1, a + (e.key === 'ArrowRight' ? 1 : -1)))));
    } else if (e.key === 'Escape') setActive(null);
  };

  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${xOf(i)},${yOf(v)}`;
      pen = true;
    });
    return d;
  };

  return (
    <div class="chart__plot" ref={ref} tabIndex={0} role="group" aria-label={`${ariaLabel}. Use the left and right arrow keys to read values.`} onKeyDown={onKey} onBlur={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={yOf(t)} y2={yOf(t)} class={t === 0 ? 'chart-axis' : 'chart-grid'} />
              <text x={m.left - 8} y={yOf(t)} class="chart-tick" text-anchor="end" dominant-baseline="middle">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={c + i} x={xOf(i)} y={height - 8} class="chart-tick" text-anchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>
                {c}
              </text>
            ) : null,
          )}
          {series.map((s) => {
            const lastIdx = s.values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
            return (
              <g key={s.key}>
                {s.area && lastIdx > 0 && <path d={`${path(s.values)}L${xOf(lastIdx)},${yOf(0)}L${xOf(s.values.findIndex((v) => v !== null))},${yOf(0)}Z`} fill={s.color} opacity="0.1" />}
                <path d={path(s.values)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                {lastIdx >= 0 && <circle cx={xOf(lastIdx)} cy={yOf(s.values[lastIdx]!)} r={4} fill={s.color} class="chart-dot" />}
              </g>
            );
          })}
          {active !== null && (
            <g pointer-events="none">
              <line x1={xOf(active)} x2={xOf(active)} y1={m.top} y2={m.top + plotH} class="chart-crosshair" />
              {series.map((s) => (s.values[active] === null ? null : <circle key={s.key} cx={xOf(active)} cy={yOf(s.values[active]!)} r={4} fill={s.color} class="chart-dot" />))}
            </g>
          )}
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tooltip
          x={xOf(active)}
          y={8}
          width={width}
          title={(titles ?? categories)[active]}
          rows={series.map((s) => ({ label: s.label, value: s.values[active] === null ? '—' : format(s.values[active]!), color: s.color, kind: 'line' as const }))}
        />
      )}
    </div>
  );
}

/* ---------- Sparkline ---------- */

/** 12-point trend in the de-emphasis color with the current point in the accent */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => (values.length <= 1 ? w / 2 : 3 + ((w - 6) * i) / (values.length - 1));
  const y = (v: number) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
  const last = values.length - 1;
  return (
    <svg width={w} height={h} class="sparkline" role="img" aria-label={label}>
      <polyline fill="none" stroke="var(--series-muted)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <circle cx={x(last)} cy={y(values[last] ?? 0)} r={3.5} fill="var(--series-1)" class="chart-dot" />
    </svg>
  );
}

