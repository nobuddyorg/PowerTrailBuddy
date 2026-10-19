import { parseDecimal } from '../../lib/format/parseDecimal';
import type { CacheType } from '../../lib/geocache/types';
import {
  DEFAULT_TRAIL_SETTINGS,
  type TrailSettings,
} from '../../lib/trails/types';
import { presetOf, type PresetName } from '../../lib/ui-logic/presets';

export type NumericField =
  | 'maxDifficulty'
  | 'maxTerrain'
  | 'maxGapMeters'
  | 'minCaches'
  | 'maxWalkKilometers'
  | 'maxReturnMeters'
  | 'walkingSpeedKmh'
  | 'minutesPerCache'
  | 'detourFactor';

export interface FieldSpec {
  name: NumericField;
  min: number;
  max: number;
  /** Values must be a multiple of this; 0 for a continuous setting. */
  step: number;
}

// The ranges data/sanitizeSettings.ts clamps stored values to; fields.test.ts fails if the two drift apart.
export const NUMERIC_FIELDS: readonly FieldSpec[] = [
  { name: 'maxDifficulty', min: 1, max: 5, step: 0.5 },
  { name: 'maxTerrain', min: 1, max: 5, step: 0.5 },
  { name: 'maxGapMeters', min: 10, max: 2000, step: 1 },
  { name: 'minCaches', min: 2, max: 1000, step: 1 },
  { name: 'maxWalkKilometers', min: 1, max: 100, step: 0 },
  { name: 'maxReturnMeters', min: 10, max: 10000, step: 1 },
  { name: 'walkingSpeedKmh', min: 1, max: 10, step: 0 },
  { name: 'minutesPerCache', min: 1, max: 60, step: 0 },
  { name: 'detourFactor', min: 1, max: 3, step: 0 },
];

export const CACHE_TYPES: readonly CacheType[] = [
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

/** The form's state: numbers as typed, so a half-typed "1," is kept rather than lost. */
export interface Draft {
  cacheTypes: CacheType[];
  loopsOnly: boolean;
  values: Record<NumericField, string>;
}

export type FieldError = 'number' | 'range' | 'step';

export type DraftErrors = Partial<
  Record<NumericField | 'cacheTypes', FieldError | 'required'>
>;

export function toDraft(settings: TrailSettings, locale: string): Draft {
  const format = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 2,
  });
  const values = Object.fromEntries(
    NUMERIC_FIELDS.map(({ name }) => [name, format.format(settings[name])]),
  ) as Record<NumericField, string>;
  return {
    cacheTypes: [...settings.cacheTypes],
    loopsOnly: settings.loopsOnly,
    values,
  };
}

// To a millionth of a step: 0.1 + 0.2 must still count as a multiple of 0.1.
const STEP_PRECISION = 1e6;

function isMultiple(value: number, step: number): boolean {
  return Math.round((value / step) * STEP_PRECISION) % STEP_PRECISION === 0;
}

/** What is wrong with a typed value, or undefined when it is a valid setting. */
export function fieldError(
  text: string,
  spec: FieldSpec,
): FieldError | undefined {
  const value = parseDecimal(text);
  if (Number.isNaN(value)) return 'number';
  if (value < spec.min || value > spec.max) return 'range';
  if (spec.step > 0 && !isMultiple(value, spec.step)) return 'step';
  return undefined;
}

export function draftErrors(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.cacheTypes.length === 0) errors.cacheTypes = 'required';
  for (const spec of NUMERIC_FIELDS) {
    const error = fieldError(draft.values[spec.name], spec);
    if (error) errors[spec.name] = error;
  }
  return errors;
}

/** The draft as settings; only for a draft without errors. */
export function draftSettings(draft: Draft): TrailSettings {
  const numbers = Object.fromEntries(
    NUMERIC_FIELDS.map(({ name }) => [name, parseDecimal(draft.values[name])]),
  ) as Record<NumericField, number>;
  // In the canonical order, so saving the same choice twice stores the same value.
  const cacheTypes = CACHE_TYPES.filter((type) =>
    draft.cacheTypes.includes(type),
  );
  return { ...numbers, cacheTypes, loopsOnly: draft.loopsOnly };
}

/** The preset the typed gap and trail size match; 'custom' while either matches none, unreadable text included. */
export function draftPreset(draft: Draft): PresetName | 'custom' {
  return presetOf({
    ...DEFAULT_TRAIL_SETTINGS,
    maxGapMeters: parseDecimal(draft.values.maxGapMeters),
    minCaches: parseDecimal(draft.values.minCaches),
  });
}
