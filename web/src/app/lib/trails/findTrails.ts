import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import { filterCandidates } from './filterCaches';
import { linkComponentsWhere } from './linkComponents';
import { orderPath } from './orderPath';
import { roundTrips } from './roundTrips';
import { scoreTrail } from './scoreTrail';
import { splitWalks } from './splitWalks';
import type { Trail, TrailSettings } from './types';
import {
  isWalkableGap,
  legMetersFor,
  NO_WALKING_DISTANCES,
  type LegMeters,
  type WalkingDistances,
} from './walkingDistances';

export interface TrailInput {
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
  /** Routed walking distances; any pair without one counts as straight line times the detour factor. */
  walkingDistances?: WalkingDistances;
}

function compareTrails(a: Trail, b: Trail): number {
  if (a.cachesPerHour > b.cachesPerHour) return -1;
  if (a.cachesPerHour < b.cachesPerHour) return 1;
  return b.caches.length - a.caches.length || compareCodes(a.id, b.id);
}

/** The linked groups, each in walking order, with how far each leg is. */
export function orderedGroups(
  caches: readonly Geocache[],
  {
    settings,
    locallyFound,
    walkingDistances = NO_WALKING_DISTANCES,
  }: TrailInput,
): { groups: Geocache[][]; legMeters: LegMeters } {
  const legMeters = legMetersFor(walkingDistances, settings.detourFactor);
  const groups = linkComponentsWhere(
    filterCandidates(caches, { settings, locallyFound }),
    {
      maxGapMeters: settings.maxGapMeters,
      isLinked: isWalkableGap(legMeters, settings),
    },
  ).map((group) => orderPath(group));
  return { groups, legMeters };
}

function walksOf(
  groups: readonly Geocache[][],
  { settings, legMeters }: { settings: TrailSettings; legMeters: LegMeters },
): Geocache[][] {
  const limits = {
    maxWalkMeters: settings.maxWalkKilometers * 1000,
    legMeters,
  };
  const walks = groups.flatMap((group) => splitWalks(group, limits));
  if (!settings.loopsOnly) return walks;
  return roundTrips(walks, {
    maxReturnMeters: settings.maxReturnMeters,
    legMeters,
  });
}

/** Filter, link, order, split, close into round trips if asked, and score: deterministic for the same input. */
export function findTrails(
  caches: readonly Geocache[],
  input: TrailInput,
): Trail[] {
  const { settings } = input;
  const { groups, legMeters } = orderedGroups(caches, input);
  return (
    walksOf(groups, { settings, legMeters })
      // A group below minCaches only splits into walks below it, so this one check drops both.
      .filter((walk) => walk.length >= settings.minCaches)
      .map((walk) => scoreTrail(walk, { settings, legMeters }))
      .sort(compareTrails)
  );
}
