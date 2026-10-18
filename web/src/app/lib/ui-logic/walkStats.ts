import type { Coordinates } from '../geocache/types';
import { pathMeters } from '../trails/geo';
import type { TrailSettings } from '../trails/types';
import type { WalkState } from '../walk/walk';

/** Closer than this, the cache is in reach: time to look rather than to walk. */
export const CLOSE_METERS = 30;

const MINUTES_PER_HOUR = 60;
const METERS_PER_KILOMETER = 1000;

/** Minutes still to go: from the walker through every remaining cache and back to the start, plus searching. */
export function remainingWalkMinutes({
  position,
  remaining,
  returnTo,
  settings,
}: {
  position?: Coordinates;
  remaining: readonly Coordinates[];
  returnTo: Coordinates;
  settings: Pick<
    TrailSettings,
    'detourFactor' | 'walkingSpeedKmh' | 'minutesPerCache'
  >;
}): number {
  if (remaining.length === 0) return 0;
  const route = [...(position ? [position] : []), ...remaining, returnTo];
  const walkMeters = pathMeters(route) * settings.detourFactor;
  const walkMinutes =
    (walkMeters / METERS_PER_KILOMETER / settings.walkingSpeedKmh) *
    MINUTES_PER_HOUR;
  return walkMinutes + remaining.length * settings.minutesPerCache;
}

export interface VisitEntry {
  code: string;
  outcome: 'found' | 'dnf';
  at: string;
}

/** The finds and DNFs of a walk in walking order, as the field-notes file wants them; skips are left out. */
export function visitEntries(walk: WalkState): VisitEntry[] {
  const entries: VisitEntry[] = [];
  for (const code of walk.codes) {
    const record = walk.outcomes[code];
    if (record && record.outcome !== 'skipped') {
      entries.push({ code, outcome: record.outcome, at: record.at });
    }
  }
  return entries;
}

/** Under this, finds per hour swing wildly: one quick find reads as hundreds an hour. */
const MIN_PACE_MINUTES = 10;

/** True once enough time has passed for finds per hour to mean something. */
export function paceKnown({
  elapsedMinutes,
}: {
  elapsedMinutes: number;
}): boolean {
  return elapsedMinutes >= MIN_PACE_MINUTES;
}
