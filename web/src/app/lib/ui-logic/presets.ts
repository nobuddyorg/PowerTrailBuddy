import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from '../trails/types';

export type PresetName = 'standard' | 'classic' | 'relaxed';
type PresetValues = Pick<TrailSettings, 'maxGapMeters' | 'minCaches'>;

export const PRESET_NAMES: readonly PresetName[] = [
  'standard',
  'classic',
  'relaxed',
];

// Classic: a dense series of 20 or more; relaxed: a loose cluster worth an afternoon.
const PRESETS: Record<PresetName, PresetValues> = {
  standard: {
    maxGapMeters: DEFAULT_TRAIL_SETTINGS.maxGapMeters,
    minCaches: DEFAULT_TRAIL_SETTINGS.minCaches,
  },
  classic: { maxGapMeters: 200, minCaches: 20 },
  relaxed: { maxGapMeters: 500, minCaches: 6 },
};

/** The preset whose gap and trail size the settings use, or 'custom'. */
export function presetOf(settings: TrailSettings): PresetName | 'custom' {
  return (
    PRESET_NAMES.find(
      (name) =>
        PRESETS[name].maxGapMeters === settings.maxGapMeters &&
        PRESETS[name].minCaches === settings.minCaches,
    ) ?? 'custom'
  );
}

/** The settings with a preset's gap and trail size; everything else as it was. */
export function withPreset(
  settings: TrailSettings,
  name: PresetName,
): TrailSettings {
  return { ...settings, ...PRESETS[name] };
}
