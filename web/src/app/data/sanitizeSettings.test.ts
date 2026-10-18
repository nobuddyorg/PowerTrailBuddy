import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TRAIL_SETTINGS,
  type TrailSettings,
} from '../lib/trails/types';
import { sanitizeSettings } from './sanitizeSettings';

const NUMERIC_SETTINGS = [
  'maxDifficulty',
  'maxTerrain',
  'maxGapMeters',
  'minCaches',
  'maxWalkKilometers',
  'walkingSpeedKmh',
  'minutesPerCache',
  'detourFactor',
] as const;

const VALID: TrailSettings = {
  cacheTypes: ['traditional', 'multi', 'earthcache'],
  maxDifficulty: 3.5,
  maxTerrain: 1.5,
  maxGapMeters: 450,
  minCaches: 25,
  maxWalkKilometers: 7.5,
  walkingSpeedKmh: 4.6,
  minutesPerCache: 2.5,
  detourFactor: 1.15,
};

describe('sanitizeSettings', () => {
  it('keeps valid settings exactly as they are', () => {
    expect(sanitizeSettings(VALID)).toEqual(VALID);
  });

  it('keeps the defaults as they are', () => {
    expect(sanitizeSettings(DEFAULT_TRAIL_SETTINGS)).toEqual(
      DEFAULT_TRAIL_SETTINGS,
    );
  });

  it.each([undefined, null, 'settings', 42, true, [], [VALID]])(
    'gives the defaults for a stored %j that is no settings object',
    (stored) => {
      expect(sanitizeSettings(stored)).toEqual(DEFAULT_TRAIL_SETTINGS);
    },
  );

  // A setting added in a later version reaches users whose stored settings predate it.
  it('fills in a setting missing from an older stored shape', () => {
    const older: Partial<TrailSettings> = { ...VALID };
    delete older.detourFactor;

    expect(sanitizeSettings(older)).toEqual({
      ...VALID,
      detourFactor: DEFAULT_TRAIL_SETTINGS.detourFactor,
    });
  });

  it('drops keys it does not know', () => {
    expect(sanitizeSettings({ ...VALID, cyclingSpeed: 20 })).toEqual(VALID);
  });

  it('never hands out the defaults themselves, so changing the result cannot change them', () => {
    const settings = sanitizeSettings(undefined);
    settings.cacheTypes.push('mystery');

    expect(DEFAULT_TRAIL_SETTINGS.cacheTypes).toEqual(['traditional']);
  });

  describe('numbers', () => {
    it.each(['4', Number.NaN, Infinity, -Infinity, null, {}])(
      'falls back to the default for %s',
      (value) => {
        const settings = sanitizeSettings({ ...VALID, maxGapMeters: value });
        expect(settings.maxGapMeters).toBe(DEFAULT_TRAIL_SETTINGS.maxGapMeters);
      },
    );

    it.each([
      ['maxDifficulty', 0, 1],
      ['maxDifficulty', 9, 5],
      ['maxTerrain', -1, 1],
      ['maxTerrain', 5.5, 5],
      ['maxGapMeters', 0, 10],
      ['maxGapMeters', 50_000, 2000],
      ['minCaches', 1, 2],
      ['minCaches', 1001, 1000],
      ['maxWalkKilometers', 0, 1],
      ['maxWalkKilometers', 500, 100],
      ['walkingSpeedKmh', 0, 1],
      ['walkingSpeedKmh', 30, 10],
      ['minutesPerCache', -5, 0],
      ['minutesPerCache', 120, 60],
      ['detourFactor', 0.5, 1],
      ['detourFactor', 4, 3],
    ] as const)('clamps %s %s to %s', (setting, stored, expected) => {
      expect(sanitizeSettings({ ...VALID, [setting]: stored })[setting]).toBe(
        expected,
      );
    });

    it.each([
      ['maxDifficulty', 1, 1],
      ['maxDifficulty', 5, 5],
      ['maxGapMeters', 10, 10],
      ['maxGapMeters', 2000, 2000],
      ['minCaches', 2, 2],
      ['minCaches', 1000, 1000],
      ['maxWalkKilometers', 1, 1],
      ['maxWalkKilometers', 100, 100],
      ['walkingSpeedKmh', 1, 1],
      ['walkingSpeedKmh', 10, 10],
      ['minutesPerCache', 0, 0],
      ['minutesPerCache', 60, 60],
      ['detourFactor', 1, 1],
      ['detourFactor', 3, 3],
    ] as const)('keeps %s at its bound %s', (setting, stored, expected) => {
      expect(sanitizeSettings({ ...VALID, [setting]: stored })[setting]).toBe(
        expected,
      );
    });

    it('rounds difficulty and terrain to the half steps ratings come in', () => {
      const settings = sanitizeSettings({
        ...VALID,
        maxDifficulty: 2.2,
        maxTerrain: 2.3,
      });

      expect(settings.maxDifficulty).toBe(2);
      expect(settings.maxTerrain).toBe(2.5);
    });

    it('rounds the gap and the minimum group size to whole numbers', () => {
      const settings = sanitizeSettings({
        ...VALID,
        maxGapMeters: 299.6,
        minCaches: 10.4,
      });

      expect(settings.maxGapMeters).toBe(300);
      expect(settings.minCaches).toBe(10);
    });

    it('keeps fractions in the continuous settings', () => {
      const settings = sanitizeSettings({
        ...VALID,
        maxWalkKilometers: 12.34,
        walkingSpeedKmh: 4.25,
        minutesPerCache: 1.75,
        detourFactor: 1.27,
      });

      expect(settings).toMatchObject({
        maxWalkKilometers: 12.34,
        walkingSpeedKmh: 4.25,
        minutesPerCache: 1.75,
        detourFactor: 1.27,
      });
    });
  });

  describe('cache types', () => {
    it('drops types it does not know, and duplicates', () => {
      const settings = sanitizeSettings({
        ...VALID,
        cacheTypes: ['multi', 'lab', 'multi', 7, 'traditional', 'toString'],
      });

      expect(settings.cacheTypes).toEqual(['multi', 'traditional']);
    });

    it('knows every cache type', () => {
      const all = [
        'traditional',
        'multi',
        'mystery',
        'letterbox',
        'wherigo',
        'earthcache',
        'virtual',
        'webcam',
        'event',
        'other',
      ];

      expect(sanitizeSettings({ cacheTypes: all }).cacheTypes).toEqual(all);
    });

    it.each([[[]], [['lab', 'adventure']], ['traditional'], [undefined]])(
      'falls back to the default types for %j',
      (cacheTypes) => {
        expect(sanitizeSettings({ ...VALID, cacheTypes }).cacheTypes).toEqual(
          DEFAULT_TRAIL_SETTINGS.cacheTypes,
        );
      },
    );
  });

  // Whatever storage holds, trail finding gets settings it can compute with.
  it('always gives settings within range, whatever was stored', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.dictionary(fc.string(), fc.anything()),
        (raw, partial) => {
          for (const stored of [raw, partial, { ...VALID, ...partial }]) {
            const settings = sanitizeSettings(stored);
            expect(Object.keys(settings).sort()).toEqual(
              Object.keys(DEFAULT_TRAIL_SETTINGS).sort(),
            );
            expect(settings.cacheTypes.length).toBeGreaterThan(0);
            for (const setting of NUMERIC_SETTINGS) {
              expect(Number.isFinite(settings[setting])).toBe(true);
            }
            expect(settings.walkingSpeedKmh).toBeGreaterThan(0);
            expect(settings.minCaches).toBeGreaterThanOrEqual(2);
            expect(sanitizeSettings(settings)).toEqual(settings);
          }
        },
      ),
    );
  });

  it('clamps any finite number into its range', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NUMERIC_SETTINGS),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (setting, value) => {
          const result = sanitizeSettings({ [setting]: value })[setting];
          const low = sanitizeSettings({ [setting]: -Number.MAX_VALUE })[
            setting
          ];
          const high = sanitizeSettings({ [setting]: Number.MAX_VALUE })[
            setting
          ];
          expect(result).toBeGreaterThanOrEqual(low);
          expect(result).toBeLessThanOrEqual(high);
        },
      ),
    );
  });
});
