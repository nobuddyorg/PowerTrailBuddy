import { describe, expect, it } from 'vitest';

import { DEFAULT_TRAIL_SETTINGS } from '../trails/types';
import { presetOf, withPreset } from './presets';

describe('presets', () => {
  it('names the defaults "standard"', () => {
    expect(presetOf(DEFAULT_TRAIL_SETTINGS)).toBe('standard');
  });

  it('sets a classic power trail: 200 m gaps, at least 20 caches', () => {
    const classic = withPreset(DEFAULT_TRAIL_SETTINGS, 'classic');
    expect(classic).toEqual({
      ...DEFAULT_TRAIL_SETTINGS,
      maxGapMeters: 200,
      minCaches: 20,
    });
    expect(presetOf(classic)).toBe('classic');
  });

  it('sets a relaxed search: 500 m gaps, at least 6 caches, other settings kept', () => {
    const base = { ...DEFAULT_TRAIL_SETTINGS, walkingSpeedKmh: 5 };
    const relaxed = withPreset(base, 'relaxed');
    expect(relaxed).toEqual({ ...base, maxGapMeters: 500, minCaches: 6 });
    expect(presetOf(relaxed)).toBe('relaxed');
  });

  it('is custom when only one of gap and size matches a preset', () => {
    expect(presetOf({ ...DEFAULT_TRAIL_SETTINGS, maxGapMeters: 200 })).toBe(
      'custom',
    );
    expect(presetOf({ ...DEFAULT_TRAIL_SETTINGS, minCaches: 20 })).toBe(
      'custom',
    );
  });

  it('goes back to the defaults from another preset', () => {
    expect(
      withPreset(withPreset(DEFAULT_TRAIL_SETTINGS, 'classic'), 'standard'),
    ).toEqual(DEFAULT_TRAIL_SETTINGS);
  });
});
