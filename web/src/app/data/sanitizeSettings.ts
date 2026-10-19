import type { CacheType } from '../lib/geocache/types';
import {
  DEFAULT_TRAIL_SETTINGS,
  type TrailSettings,
} from '../lib/trails/types';

type NumericSetting = Exclude<keyof TrailSettings, 'cacheTypes' | 'loopsOnly'>;

interface Range {
  min: number;
  max: number;
  /** Values are rounded to a multiple of this; absent for a continuous setting. */
  step?: number;
}

// Every value here keeps findTrails finite: a positive speed, gap, walk length and time per cache, and at least two caches.
const RANGES: Record<NumericSetting, Range> = {
  maxDifficulty: { min: 1, max: 5, step: 0.5 },
  maxTerrain: { min: 1, max: 5, step: 0.5 },
  maxGapMeters: { min: 10, max: 2000, step: 1 },
  minCaches: { min: 2, max: 1000, step: 1 },
  maxWalkKilometers: { min: 1, max: 100 },
  maxReturnMeters: { min: 10, max: 10000, step: 1 },
  walkingSpeedKmh: { min: 1, max: 10 },
  minutesPerCache: { min: 1, max: 60 },
  detourFactor: { min: 1, max: 3 },
};

const CACHE_TYPES = [
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
] as const;

// Resolves to never, failing to compile, while a CacheType is missing from the list it checks.
type EveryCacheType<List extends readonly CacheType[]> =
  Exclude<CacheType, List[number]> extends never ? List : never;
const KNOWN_CACHE_TYPES: EveryCacheType<typeof CACHE_TYPES> = CACHE_TYPES;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCacheType = (value: unknown): value is CacheType =>
  (KNOWN_CACHE_TYPES as readonly unknown[]).includes(value);

// Number.isFinite, unlike the global isFinite, is false for anything that is not already a number.
const isFiniteNumber = (value: unknown): value is number =>
  Number.isFinite(value);

function sanitizeNumber(value: unknown, setting: NumericSetting): number {
  if (!isFiniteNumber(value)) return DEFAULT_TRAIL_SETTINGS[setting];
  const { min, max, step } = RANGES[setting];
  const stepped = step === undefined ? value : Math.round(value / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

// Types a later version added, or nothing usable at all, fall back rather than leave a filter that matches nothing.
function sanitizeCacheTypes(value: unknown): CacheType[] {
  const known = Array.isArray(value) ? value.filter(isCacheType) : [];
  const unique = [...new Set(known)];
  return unique.length > 0 ? unique : [...DEFAULT_TRAIL_SETTINGS.cacheTypes];
}

/** Settings as stored by any version, or anything else, made into valid TrailSettings: unknown keys dropped, missing or mistyped ones defaulted, numbers clamped. */
export function sanitizeSettings(value: unknown): TrailSettings {
  const stored = isRecord(value) ? value : {};
  const numbers = Object.fromEntries(
    (Object.keys(RANGES) as NumericSetting[]).map((setting) => [
      setting,
      sanitizeNumber(stored[setting], setting),
    ]),
  ) as Record<NumericSetting, number>;
  return {
    cacheTypes: sanitizeCacheTypes(stored.cacheTypes),
    loopsOnly:
      typeof stored.loopsOnly === 'boolean'
        ? stored.loopsOnly
        : DEFAULT_TRAIL_SETTINGS.loopsOnly,
    ...numbers,
  };
}
