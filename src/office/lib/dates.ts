/**
 * Date helpers for FiberSteel mode.
 *
 * Dates are stored as local, zone-less strings so they read the same everywhere:
 *   day       'YYYY-MM-DD'
 *   datetime  'YYYY-MM-DDTHH:mm'
 * Never pass a bare day string to `new Date()` — it parses as UTC. Use `parse()`.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDateTime = (d: Date) => `${toDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Parse a day or datetime string as local time. */
export function parse(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (s.length > 10) {
    const [hh, mm] = s.slice(11, 16).split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0);
  }
  return new Date(y, m - 1, d);
}

export const today = () => toDay(new Date());
export const now = () => toDateTime(new Date());

/** Add days to a day or datetime string, keeping its format (and time of day). */
export function addDays(s: string, n: number): string {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + n));
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return s.length > 10 ? day + s.slice(10) : day;
}

export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
}

export const addMinutes = (dt: string, n: number) => toDateTime(new Date(parse(dt).getTime() + n * 60_000));

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  const ua = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const ub = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((ua - ub) / 86_400_000);
}

export const diffMinutes = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 60_000);

/** 0 = Sunday … 6 = Saturday */
export const weekday = (day: string) => parse(day).getDay();

/** Monday of the week containing `day`. */
export function startOfWeek(day: string): string {
  const wd = weekday(day);
  return addDays(day.slice(0, 10), wd === 0 ? -6 : 1 - wd);
}

export const monthKey = (day: string) => day.slice(0, 7);
export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
export const startOfYear = (day: string) => `${day.slice(0, 4)}-01-01`;
export const endOfMonth = (day: string) => addDays(addMonths(startOfMonth(day), 1), -1);

/** Inclusive range check on day strings (datetimes compare by their day). */
export const inRange = (s: string, from: string, to: string) => {
  const d = s.slice(0, 10);
  return d >= from && d <= to;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

/**
 * Move every date in a value forward by `days`. Used to keep the demo current:
 * data saved on Monday still shows "today's" schedule when reopened on Thursday.
 */
export function shiftDates<T>(value: T, days: number): T {
  if (!days) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return DATE_RE.test(v) ? addDays(v, days) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
