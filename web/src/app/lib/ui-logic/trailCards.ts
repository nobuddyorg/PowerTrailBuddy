import type { Coordinates } from '../geocache/types';
import { cacheHealth } from '../geocache/health';
import { distanceToTrail } from '../trails/nearby';
import type { Trail } from '../trails/types';
import type { TrailFilter, TrailSort } from './trailSort';

export const SHORT_WALK_METERS = 5000;
export const QUICK_WALK_MINUTES = 120;
export const NEAR_METERS = 10_000;

export interface TrailCard {
  trail: Trail;
  /** 1-based position in findTrails' order, the best rate first; stays with the trail whatever the sort. */
  rank: number;
  /** Straight line from the user to the trail's nearest cache, when the position is known. */
  distanceMeters?: number;
}

interface Arrangement {
  sort: TrailSort;
  filters: readonly TrailFilter[];
  position?: Coordinates;
}

function keeps(card: TrailCard, filter: TrailFilter): boolean {
  switch (filter) {
    case 'short':
      return card.trail.walkMeters <= SHORT_WALK_METERS;
    case 'quick':
      return card.trail.durationMinutes <= QUICK_WALK_MINUTES;
    case 'near':
      // Without a position there is nothing to be near to, so the filter stands aside.
      return (
        card.distanceMeters === undefined || card.distanceMeters <= NEAR_METERS
      );
  }
}

function sortKey(card: TrailCard, sort: TrailSort): number {
  switch (sort) {
    case 'rate':
      return card.rank;
    case 'caches':
      return -card.trail.caches.length;
    case 'nearest':
      return card.distanceMeters ?? card.rank;
    case 'shortest':
      return card.trail.walkMeters;
  }
}

/** The trails as cards: ranked, measured from the user, filtered and sorted; ties keep the rank order. */
export function arrangeTrails(
  trails: readonly Trail[],
  { sort, filters, position }: Arrangement,
): TrailCard[] {
  const cards = trails.map((trail, index): TrailCard => {
    const card: TrailCard = { trail, rank: index + 1 };
    if (position) card.distanceMeters = distanceToTrail(trail, position);
    return card;
  });
  return cards
    .filter((card) => filters.every((filter) => keeps(card, filter)))
    .sort((a, b) => sortKey(a, sort) - sortKey(b, sort) || a.rank - b.rank);
}

export interface HealthSummary {
  /** The last two logs are both "Didn't find it". */
  dnfStreak: number;
  needsMaintenance: number;
  disabled: number;
}

/** How many of a trail's caches look doubtful, by kind. */
export function healthSummary(trail: Trail): HealthSummary {
  const summary: HealthSummary = {
    dnfStreak: 0,
    needsMaintenance: 0,
    disabled: 0,
  };
  for (const cache of trail.caches) {
    const health = cacheHealth(cache);
    if (health === 'dnf-streak') summary.dnfStreak++;
    else if (health === 'needs-maintenance') summary.needsMaintenance++;
    else if (health === 'disabled') summary.disabled++;
  }
  return summary;
}
