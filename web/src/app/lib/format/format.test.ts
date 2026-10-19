import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatDuration,
  formatRate,
  formatRating,
} from './format';

const NBSP = ' ';

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [7.4, '7 m'],
    [99.4, '99 m'],
    [99.6, '100 m'],
    [104, '100 m'],
    [105, '110 m'],
    [850, '850 m'],
    [994, '990 m'],
  ])('writes %s m in metres as "%s"', (meters, expected) => {
    expect(formatDistance(meters, 'en')).toBe(expected.replace(' ', NBSP));
  });

  it.each([
    [995, 'en', '1.0 km'],
    [1000, 'en', '1.0 km'],
    [1234, 'en', '1.2 km'],
    [1250, 'de', '1,3 km'],
    [12_345, 'de', '12,3 km'],
    [1_234_567, 'en', '1,234.6 km'],
    [1_234_567, 'de', '1.234,6 km'],
  ])('writes %s m in %s as "%s"', (meters, locale, expected) => {
    expect(formatDistance(meters, locale)).toBe(expected.replace(' ', NBSP));
  });

  it('keeps the unit on the same line as its number', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e7, noNaN: true }), (meters) => {
        expect(formatDistance(meters, 'de')).toMatch(/^[\d.,]+ (m|km)$/);
      }),
    );
  });

  it('never shows 1000 m: from there on it is kilometres', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), (meters) => {
        const text = formatDistance(meters, 'en');
        expect(text.endsWith(`${NBSP}m`)).toBe(meters < 995);
      }),
    );
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 min'],
    [0.4, '0 min'],
    [44.6, '45 min'],
    [59.4, '59 min'],
    [59.5, '1 h'],
    [60, '1 h'],
    [61, '1 h 1 min'],
    [135, '2 h 15 min'],
    [180, '3 h'],
  ])('writes %s minutes as "%s"', (minutes, expected) => {
    expect(formatDuration(minutes, 'en')).toBe(
      expected.replaceAll(/ (h|min)/g, `${NBSP}$1`),
    );
  });

  it('groups thousands of hours in the locale', () => {
    expect(formatDuration(60_000, 'de')).toBe(`1.000${NBSP}h`);
  });

  it('adds up to the rounded minutes it was given', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59_999 }), (minutes) => {
        const text = formatDuration(minutes, 'en');
        const hours = /(\d+) h/.exec(text)?.[1] ?? '0';
        const rest = /(\d+) min/.exec(text)?.[1] ?? '0';
        expect(Number(hours) * 60 + Number(rest)).toBe(minutes);
        expect(Number(rest)).toBeLessThan(60);
      }),
    );
  });
});

describe('formatRating', () => {
  it.each([
    [1.5, 'de', '1,5'],
    [1.5, 'en', '1.5'],
    [2, 'de', '2'],
    [4.5, 'en', '4.5'],
  ])('writes %s in %s as "%s"', (rating, locale, expected) => {
    expect(formatRating(rating, locale)).toBe(expected);
  });
});

describe('formatRate', () => {
  it.each([
    [12, 'de', '12,0'],
    [9.46, 'en', '9.5'],
    [1234.5, 'de', '1.234,5'],
  ])('writes %s in %s as "%s"', (rate, locale, expected) => {
    expect(formatRate(rate, locale)).toBe(expected);
  });
});
