import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parseDecimal } from './parseDecimal';

describe('parseDecimal', () => {
  it.each([
    ['3', 3],
    ['1.5', 1.5],
    ['1,5', 1.5],
    [' 12 ', 12],
    ['0', 0],
    ['007', 7],
    ['2000', 2000],
  ])('reads "%s" as %s', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['1.5.2'],
    ['1,5,2'],
    ['1.'],
    ['.5'],
    ['-1'],
    ['+1'],
    ['1e3'],
    ['1 000'],
    ['Infinity'],
    ['0x10'],
  ])('refuses "%s"', (text) => {
    expect(parseDecimal(text)).toBeNaN();
  });

  it('reads back what a German or English number format writes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999 }),
        fc.constantFrom('de', 'en'),
        (tenths, locale) => {
          const value = tenths / 10;
          const written = new Intl.NumberFormat(locale, {
            useGrouping: false,
            maximumFractionDigits: 1,
          }).format(value);
          expect(parseDecimal(written)).toBe(value);
        },
      ),
    );
  });
});
