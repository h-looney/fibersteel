import type { WeeklyHours } from '../data/site';

export type OpenState = 'open' | 'closed' | 'appointment';

export interface OpenStatus {
  state: OpenState;
  label: string;
  detail: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** "17:00" → "5 PM", "16:30" → "4:30 PM" */
export const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
};

/** Current weekday + minutes-since-midnight in the business's time zone. */
const zonedNow = (timeZone: string, now: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAY_INDEX[get('weekday')] ?? now.getDay(),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
};

/**
 * Open now / closed / by appointment, from a week of hours (Central time by default). A day is open hours, the
 * string 'appointment' (by appointment only) or null (closed).
 */
export function getOpenStatus(hours: WeeklyHours, timeZone = 'America/Chicago', now = new Date()): OpenStatus {
  const { day, minutes } = zonedNow(timeZone, now);
  const today = hours[day];

  if (today && today !== 'appointment') {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (minutes >= open && minutes < close) {
      const closingSoon = close - minutes <= 45;
      return { state: 'open', label: closingSoon ? 'Closing soon' : 'Open now', detail: `until ${formatTime(today.close)}` };
    }
    if (minutes < open) return { state: 'closed', label: 'Closed', detail: `opens ${formatTime(today.open)}` };
  }

  // The next day with regular hours
  let next = '';
  for (let i = 1; i <= 7; i++) {
    const idx = (day + i) % 7;
    const h = hours[idx];
    if (h && h !== 'appointment') {
      next = `opens ${i === 1 ? 'tomorrow' : DAY_NAMES[idx]} ${formatTime(h.open)}`;
      break;
    }
  }
  if (today === 'appointment') return { state: 'appointment', label: 'By appointment today', detail: next };
  return { state: 'closed', label: 'Closed', detail: next };
}
