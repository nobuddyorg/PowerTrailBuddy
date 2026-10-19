import { describe, expect, it } from 'vitest';

import { formatDay, formatMoment } from './dates';

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
