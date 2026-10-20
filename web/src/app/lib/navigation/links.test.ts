import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  appleMapsUrl,
  cachePageUrl,
  geoUri,
  walkingDirectionsUrl,
} from './links';

const SPOT = { latitude: 48.1234567, longitude: -11.5 };

describe('geoUri', () => {
  it('points at the coordinates and labels them for the navigation app', () => {
    expect(geoUri(SPOT, 'GCTEST1 Bench')).toBe(
      'geo:48.123457,-11.500000?q=48.123457,-11.500000(GCTEST1%20Bench)',
    );
  });

  it('encodes parentheses, which would otherwise end the label early', () => {
    expect(geoUri(SPOT, 'Tree (old) #1&2')).toBe(
      'geo:48.123457,-11.500000?q=48.123457,-11.500000(Tree%20%28old%29%20%231%262)',
    );
  });

  it('carries any label through intact, and nothing after it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.string(),
        (latitude, longitude, label) => {
          const uri = geoUri({ latitude, longitude }, label);
          const match = /^geo:([^?]+)\?q=([^(]+)\((.*)\)$/.exec(uri);
          expect(match).not.toBeNull();
          const [, position, query, encoded] = match!;
          expect(query).toBe(position);
          expect(encoded).not.toMatch(/[()]/);
          expect(decodeURIComponent(encoded)).toBe(label);
          const [lat, lon] = position.split(',').map(Number);
          expect(Math.abs(lat - latitude)).toBeLessThanOrEqual(5e-7);
          expect(Math.abs(lon - longitude)).toBeLessThanOrEqual(5e-7);
        },
      ),
    );
  });
});

describe('appleMapsUrl', () => {
  it('drops a labelled pin on the coordinates in Apple Maps', () => {
    expect(appleMapsUrl(SPOT, 'GCTEST1 Bench')).toBe(
      'https://maps.apple.com/?ll=48.123457,-11.500000&q=GCTEST1%20Bench',
    );
  });

  it('keeps any label inside its own parameter', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.string(),
        (latitude, longitude, label) => {
          const url = new URL(appleMapsUrl({ latitude, longitude }, label));
          expect(url.origin).toBe('https://maps.apple.com');
          expect([...url.searchParams.keys()]).toEqual(['ll', 'q']);
          expect(url.searchParams.get('q')).toBe(label);
          const [lat, lon] = url.searchParams.get('ll')!.split(',').map(Number);
          expect(Math.abs(lat - latitude)).toBeLessThanOrEqual(5e-7);
          expect(Math.abs(lon - longitude)).toBeLessThanOrEqual(5e-7);
        },
      ),
    );
  });
});

describe('cachePageUrl', () => {
  it('links to the listing through coord.info', () => {
    expect(cachePageUrl('GCTEST1')).toBe('https://coord.info/GCTEST1');
  });

  it('keeps a hostile code inside the path', () => {
    expect(cachePageUrl('../x?y#z')).toBe('https://coord.info/..%2Fx%3Fy%23z');
  });
});

describe('walkingDirectionsUrl', () => {
  it('asks Google Maps for walking directions to the spot', () => {
    expect(walkingDirectionsUrl(SPOT)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=48.123457,-11.500000&travelmode=walking',
    );
  });
});
