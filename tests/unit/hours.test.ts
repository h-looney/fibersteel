/** The live open / closed / by-appointment status (Central time), from the Contact page's hours. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTime, getOpenStatus } from '../../src/scripts/hours.ts';
import type { WeeklyHours } from '../../src/data/site.ts';

const hours: WeeklyHours = [
  null,
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  'appointment',
];
// November 2026 is Central Standard Time (UTC−6): 10:00 CST = 16:00 UTC
const at = (iso: string) => getOpenStatus(hours, 'America/Chicago', new Date(iso));

describe('open status', () => {
  it('weekday during hours: open, until 4:30 PM', () => {
    assert.deepEqual(at('2026-11-10T16:00:00Z'), { state: 'open', label: 'Open now', detail: 'until 4:30 PM' });
  });

  it('closing soon in the last 45 minutes', () => {
    assert.equal(at('2026-11-10T22:00:00Z').label, 'Closing soon'); // 4:00 PM
  });

  it('weekday before opening: closed, opens 9 AM', () => {
    assert.deepEqual(at('2026-11-10T13:00:00Z'), { state: 'closed', label: 'Closed', detail: 'opens 9 AM' });
  });

  it('weekday after closing: opens tomorrow', () => {
    assert.equal(at('2026-11-10T23:00:00Z').detail, 'opens tomorrow 9 AM');
  });

  it('Friday evening skips the weekend to Monday', () => {
    assert.equal(at('2026-11-13T23:30:00Z').detail, 'opens Mon 9 AM');
  });

  it('Saturday is by appointment', () => {
    const s = at('2026-11-14T17:00:00Z');
    assert.equal(s.state, 'appointment');
    assert.equal(s.label, 'By appointment today');
  });

  it('Sunday is closed and opens Monday', () => {
    assert.deepEqual(at('2026-11-15T17:00:00Z'), { state: 'closed', label: 'Closed', detail: 'opens tomorrow 9 AM' });
  });

  it('formats times like the site', () => {
    assert.equal(formatTime('16:30'), '4:30 PM');
    assert.equal(formatTime('09:00'), '9 AM');
  });
});
