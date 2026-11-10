import { diffDays, diffMinutes, now, parse, today } from './dates';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-US');
const num1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** $1,234.50 — or $1,235 with `cents = false` */
export const money = (n: number, cents = true) => (cents ? usd : usd0).format(Math.abs(n) < 0.005 ? 0 : n);

/** $950 · $12.9K · $1.2M */
export function compactMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(a >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${sign}$${Math.round(a)}`;
}

/** 1,284 · 12.9K */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 10_000) return `${(n / 1_000).toFixed(a >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return num.format(Math.round(n));
}

export const number = (n: number) => num.format(n);
export const decimal = (n: number) => num1.format(n);
export const percent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
export const hours = (h: number) => `${num1.format(h)} h`;

/** Signed change, e.g. "+12%" / "−4%" */
export const delta = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n * 100).toFixed(digits)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Oct 20" (adds the year when it isn't this year) */
export function shortDate(s: string, withYear?: boolean): string {
  const d = parse(s);
  const y = d.getFullYear() !== new Date().getFullYear() || withYear ? `, ${d.getFullYear()}` : '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${y}`;
}

/** "Tuesday, October 20" */
export function longDate(s: string): string {
  const d = parse(s);
  return `${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** "Oct 2026" */
export const monthLabel = (key: string) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
/** "Oct" */
export const monthShort = (key: string) => MONTHS[+key.slice(5, 7) - 1];
export const monthLong = (key: string) => `${MONTHS_LONG[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
export const weekdayShort = (s: string) => DAYS[parse(s).getDay()];

/** "9 AM" / "1:30 PM" */
export function time(dt: string): string {
  const d = parse(dt);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${suffix}`;
}

/** "Today" · "Tomorrow" · "Yesterday" · "Wed, Oct 21" */
export function dayLabel(s: string): string {
  const diff = diffDays(s, today());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${DAYS[parse(s).getDay()]}, ${shortDate(s)}`;
}

/** "Today, 9 AM" · "Wed, Oct 21, 1:30 PM" */
export const dayTime = (dt: string) => `${dayLabel(dt)}, ${time(dt)}`;

/** "just now" · "25 min ago" · "3 h ago" · "Yesterday" · "Oct 12" */
export function relative(dt: string): string {
  const mins = diffMinutes(now(), dt.length > 10 ? dt : `${dt}T12:00`);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const days = diffDays(today(), dt);
  if (days === 0) return `${Math.floor(mins / 60)} h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return shortDate(dt);
}

/** "in 12 days" · "3 days ago" · "today" */
export function fromToday(day: string): string {
  const d = diffDays(day, today());
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

/** "(573) 555-0142" */
export function phone(p: string): string {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

export const telHref = (p: string) => `tel:+1${p.replace(/\D/g, '').slice(-10)}`;

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${number(n)} ${n === 1 ? word : pluralWord}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Minutes → "45 min" / "2 h 10 min" / "3 days" */
export function duration(mins: number): string {
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
  if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.round(mins / 60 / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** "418 Hickory Ridge Dr, Camdenton, MO 65020" */
export const address = (a: { street: string; city: string; state: string; zip: string }) => `${a.street}, ${a.city}, ${a.state} ${a.zip}`;

/** Google Maps directions link for an address */
export const mapsUrl = (a: { street: string; city: string; state: string; zip: string } | string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(typeof a === 'string' ? a : address(a))}`;
