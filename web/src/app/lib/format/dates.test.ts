import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { daysSince, formatDay, formatMoment } from './dates';

describe('formatDay', () => {
  it.each([
    ['2026-03-12', 'de', '12.03.2026'],
    ['2026-03-12', 'en-GB', '12 Mar 2026'],
    ['2026-01-01', 'en-US', 'Jan 1, 2026'],
  ])('writes %s in %s as "%s"', (date, locale, expected) => {
    expect(formatDay(date, locale)).toBe(expected);
  });

  it('keeps the calendar day whatever zone the day would fall in', () => {
    expect(formatDay('2026-12-31', 'de')).toBe('31.12.2026');
  });
});

describe('formatMoment', () => {
  it('writes date and time in the given zone', () => {
    expect(
      formatMoment('2026-03-12T13:05:00Z', {
        locale: 'de',
        timeZone: 'Europe/Berlin',
      }),
    ).toBe('12.03.2026, 14:05');
    expect(
      formatMoment('2026-03-12T13:05:00Z', {
        locale: 'en-GB',
        timeZone: 'UTC',
      }),
    ).toBe('12 Mar 2026, 13:05');
  });
});

describe('daysSince', () => {
  it.each([
    ['2026-03-12', '2026-03-12T23:59:00Z', 0],
    ['2026-03-11', '2026-03-12T00:00:00Z', 1],
    ['2025-03-12', '2026-03-12T10:00:00Z', 365],
    ['2026-03-20', '2026-03-12T10:00:00Z', 0],
  ])('from %s to %s is %s days', (date, now, expected) => {
    expect(daysSince(date, now)).toBe(expected);
  });

  it('counts each day added once', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (days) => {
        const now = new Date(
          Date.UTC(2026, 0, 1) + days * 86_400_000,
        ).toISOString();
        expect(daysSince('2026-01-01', now)).toBe(days);
      }),
    );
  });
});
