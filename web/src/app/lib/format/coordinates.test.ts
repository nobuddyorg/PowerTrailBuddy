import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatCoordinates } from './coordinates';

const DECIMAL_MINUTES =
  /^([NS]) (\d{2})° (\d{2}\.\d{3})′ ([EW]) (\d{3})° (\d{2}\.\d{3})′$/;

function readBack(text: string) {
  const [, ns, latDegrees, latMinutes, ew, lonDegrees, lonMinutes] =
    DECIMAL_MINUTES.exec(text)!;
  const latitude =
    (Number(latDegrees) + Number(latMinutes) / 60) * (ns === 'S' ? -1 : 1);
  const longitude =
    (Number(lonDegrees) + Number(lonMinutes) / 60) * (ew === 'W' ? -1 : 1);
  return { latitude, longitude };
}

describe('formatCoordinates', () => {
  it.each([
    [
      { latitude: 48.13538, longitude: 11.57612 },
      'N 48° 08.123′ E 011° 34.567′',
    ],
    [{ latitude: -33.5, longitude: -70.25 }, 'S 33° 30.000′ W 070° 15.000′'],
    [{ latitude: 0, longitude: 0 }, 'N 00° 00.000′ E 000° 00.000′'],
    [{ latitude: 5.0001, longitude: 179.99 }, 'N 05° 00.006′ E 179° 59.400′'],
  ])('writes %o as "%s"', (coordinates, expected) => {
    expect(formatCoordinates(coordinates)).toBe(expected);
  });

  it('carries a minute that rounds up to 60 into the next degree', () => {
    expect(
      formatCoordinates({ latitude: 47.9999999, longitude: -8.9999999 }),
    ).toBe('N 48° 00.000′ W 009° 00.000′');
  });

  it('writes a value that rounds to zero as north and east, never "S 00° 00.000′"', () => {
    expect(
      formatCoordinates({ latitude: -0.0000001, longitude: -0.0000001 }),
    ).toBe('N 00° 00.000′ E 000° 00.000′');
  });

  it('reads back to within half a thousandth of a minute', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        (latitude, longitude) => {
          const text = formatCoordinates({ latitude, longitude });
          expect(text).toMatch(DECIMAL_MINUTES);
          const back = readBack(text);
          const tolerance = 0.0005 / 60 + 1e-12;
          expect(Math.abs(back.latitude - latitude)).toBeLessThanOrEqual(
            tolerance,
          );
          expect(Math.abs(back.longitude - longitude)).toBeLessThanOrEqual(
            tolerance,
          );
        },
      ),
    );
  });
});
