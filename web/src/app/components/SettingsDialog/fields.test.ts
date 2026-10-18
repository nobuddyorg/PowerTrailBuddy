import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { sanitizeSettings } from '../../data/sanitizeSettings';
import { DEFAULT_TRAIL_SETTINGS } from '../../lib/trails/types';
import {
  CACHE_TYPES,
  draftErrors,
  draftPreset,
  draftSettings,
  fieldError,
  NUMERIC_FIELDS,
  toDraft,
  type FieldSpec,
} from './fields';

const spec = (name: FieldSpec['name']) =>
  NUMERIC_FIELDS.find((field) => field.name === name)!;

describe('NUMERIC_FIELDS', () => {
  // The form must accept exactly what the store keeps, or a saved value comes back changed.
  it.each(NUMERIC_FIELDS.map((field) => [field.name, field] as const))(
    'offers %s in the range the store keeps',
    (name, field) => {
      const stored = (value: number) =>
        sanitizeSettings({ ...DEFAULT_TRAIL_SETTINGS, [name]: value })[name];
      expect(stored(field.min)).toBe(field.min);
      expect(stored(field.max)).toBe(field.max);
      expect(stored(field.min - 1)).toBe(field.min);
      expect(stored(field.max + 1)).toBe(field.max);
    },
  );

  it('accepts only values the store keeps unchanged', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NUMERIC_FIELDS),
        fc.integer({ min: 0, max: 40_000 }),
        (field, twentieths) => {
          const value = twentieths / 20;
          const valid = fieldError(String(value), field) === undefined;
          const stored = sanitizeSettings({
            ...DEFAULT_TRAIL_SETTINGS,
            [field.name]: value,
          })[field.name];
          if (valid) expect(stored).toBe(value);
          else expect(stored).not.toBe(value);
        },
      ),
    );
  });

  it('lists every setting but the cache types', () => {
    expect(NUMERIC_FIELDS.map((field) => field.name).sort()).toEqual(
      Object.keys(DEFAULT_TRAIL_SETTINGS)
        .filter((key) => key !== 'cacheTypes')
        .sort(),
    );
  });
});

describe('CACHE_TYPES', () => {
  it('offers every cache type once, traditional first', () => {
    expect(CACHE_TYPES).toEqual([
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
    ]);
  });
});

describe('fieldError', () => {
  it.each([
    ['maxDifficulty', '1', undefined],
    ['maxDifficulty', '5', undefined],
    ['maxDifficulty', '2,5', undefined],
    ['maxDifficulty', '0.5', 'range'],
    ['maxDifficulty', '5.5', 'range'],
    ['maxDifficulty', '2.2', 'step'],
    ['maxGapMeters', '300', undefined],
    ['maxGapMeters', '300.5', 'step'],
    ['maxGapMeters', '9', 'range'],
    ['maxGapMeters', '2001', 'range'],
    ['minCaches', '2', undefined],
    ['minCaches', '1', 'range'],
    ['maxWalkKilometers', '7.3', undefined],
    ['maxWalkKilometers', '0.9', 'range'],
    ['walkingSpeedKmh', '3,7', undefined],
    ['minutesPerCache', '0', undefined],
    ['minutesPerCache', '60', undefined],
    ['minutesPerCache', '61', 'range'],
    ['minutesPerCache', '', 'number'],
    ['minutesPerCache', 'abc', 'number'],
    ['minutesPerCache', '-1', 'number'],
  ] as const)('judges %s = "%s" as %s', (name, text, expected) => {
    expect(fieldError(text, spec(name))).toBe(expected);
  });

  it('counts a sum that floating point makes inexact as a multiple', () => {
    expect(
      fieldError(String(0.1 + 0.2), {
        name: 'maxDifficulty',
        min: 0,
        max: 1,
        step: 0.1,
      }),
    ).toBeUndefined();
  });
});

describe('toDraft', () => {
  it('writes the numbers as a German or English speaker types them', () => {
    const settings = {
      ...DEFAULT_TRAIL_SETTINGS,
      maxDifficulty: 2.5,
      maxGapMeters: 1500,
    };
    expect(toDraft(settings, 'de').values).toMatchObject({
      maxDifficulty: '2,5',
      maxGapMeters: '1500',
      walkingSpeedKmh: '4',
    });
    expect(toDraft(settings, 'en').values.maxDifficulty).toBe('2.5');
  });

  it('copies the cache types, so editing the draft leaves the settings alone', () => {
    const settings = {
      ...DEFAULT_TRAIL_SETTINGS,
      cacheTypes: ['traditional' as const],
    };
    const draft = toDraft(settings, 'en');
    draft.cacheTypes.push('multi');
    expect(settings.cacheTypes).toEqual(['traditional']);
  });
});

describe('draftErrors', () => {
  it('finds nothing wrong with the defaults', () => {
    expect(draftErrors(toDraft(DEFAULT_TRAIL_SETTINGS, 'de'))).toEqual({});
  });

  it('names each bad field and an empty type choice', () => {
    const draft = toDraft(DEFAULT_TRAIL_SETTINGS, 'en');
    draft.cacheTypes = [];
    draft.values.maxTerrain = '7';
    draft.values.minCaches = '';
    expect(draftErrors(draft)).toEqual({
      cacheTypes: 'required',
      maxTerrain: 'range',
      minCaches: 'number',
    });
  });
});

describe('draftSettings', () => {
  it('reads the typed numbers, a German decimal comma included', () => {
    const draft = toDraft(DEFAULT_TRAIL_SETTINGS, 'de');
    draft.values.maxWalkKilometers = '7,5';
    draft.values.minCaches = '20';
    draft.values.detourFactor = '1,6';
    expect(draftSettings(draft)).toEqual({
      ...DEFAULT_TRAIL_SETTINGS,
      maxWalkKilometers: 7.5,
      minCaches: 20,
      detourFactor: 1.6,
    });
  });

  it('stores the chosen types in one canonical order, whatever order they were ticked in', () => {
    const draft = toDraft(DEFAULT_TRAIL_SETTINGS, 'en');
    draft.cacheTypes = ['event', 'traditional', 'multi'];
    expect(draftSettings(draft).cacheTypes).toEqual([
      'traditional',
      'multi',
      'event',
    ]);
  });

  it('round-trips any valid settings through the form unchanged', () => {
    fc.assert(
      fc.property(
        fc.subarray([...CACHE_TYPES], { minLength: 1 }),
        fc.constantFrom('de', 'en'),
        (cacheTypes, locale) => {
          const settings = { ...DEFAULT_TRAIL_SETTINGS, cacheTypes };
          expect(draftSettings(toDraft(settings, locale))).toEqual(settings);
        },
      ),
    );
  });
});

describe('draftPreset', () => {
  it('names the preset whose gap and trail size are typed', () => {
    const draft = toDraft(DEFAULT_TRAIL_SETTINGS, 'de');
    expect(draftPreset(draft)).toBe('standard');
    draft.values.maxGapMeters = '200';
    draft.values.minCaches = '20';
    expect(draftPreset(draft)).toBe('classic');
    draft.values.minCaches = '21';
    expect(draftPreset(draft)).toBe('custom');
  });

  it('is custom while the gap or the trail size is not a valid value', () => {
    const draft = toDraft(DEFAULT_TRAIL_SETTINGS, 'en');
    draft.values.maxGapMeters = '';
    expect(draftPreset(draft)).toBe('custom');
    const other = toDraft(DEFAULT_TRAIL_SETTINGS, 'en');
    other.values.minCaches = '1';
    expect(draftPreset(other)).toBe('custom');
  });
});
