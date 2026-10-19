import type { Coordinates } from '../geocache/types';
import {
  nearestNeighbourOrder,
  nearestOthers,
  planeDistance,
} from './nearestNeighbour';
import { projectToPlane, type PlanePoint } from './projection';

/** Counted 2-opt move evaluations; bounds the work for a huge component while staying deterministic. */
const DEFAULT_MAX_MOVE_EVALUATIONS = 20_000_000;

/** Counted distance evaluations of each nearest-neighbour search; the sweep needs far fewer unless a group runs north–south. */
const DEFAULT_MAX_NEIGHBOUR_EVALUATIONS = 20_000_000;

/** By walking legs, each step and each move looks at this many plane-nearest points: both ways along a line, and across it. */
const NEAR_COUNT = 8;

// A move must save more than rounding noise in the edges it removes, or two moves could undo each other forever.
const NOISE_TOLERANCE = 1e-9;

export interface OrderOptions<T> {
  /** Walking meters between two points, the same either way round; plane distance when left out. */
  legMeters?: (from: T, to: T) => number;
  maxMoveEvaluations?: number;
  maxNeighbourEvaluations?: number;
}

interface PathPoint extends PlanePoint {
  position: number;
}

interface Metric {
  between: (a: PathPoint, b: PathPoint) => number;
  /** Only a move that joins a point to one of its nearest is measured; every move when left out. */
  isNear?: (a: PathPoint, b: PathPoint) => boolean;
}

const PLANE_METRIC: Metric = { between: planeDistance };

/** Legs by legMeters, measured only for moves near in the plane: a leg costs far more than a plane distance. */
function legMetric<T extends Coordinates>(
  points: readonly T[],
  {
    legMeters,
    plane,
    maxEvaluations,
  }: {
    legMeters: (from: T, to: T) => number;
    plane: readonly PlanePoint[];
    maxEvaluations: number;
  },
): Metric {
  const nearest = nearestOthers(plane, { count: NEAR_COUNT, maxEvaluations });
  return {
    between: (a, b) => legMeters(points[a.position], points[b.position]),
    isNear: (a, b) =>
      nearest[a.position].includes(b.position) ||
      nearest[b.position].includes(a.position),
  };
}

function squaredNorm({ x, y }: PlanePoint): number {
  return x * x + y * y;
}

/** The point farthest from the center, the earliest on a tie: on a chain, one of its ends. */
function extremePoint(plane: readonly PlanePoint[]): number {
  return plane.reduce(
    (farthest, point, position) =>
      squaredNorm(point) > squaredNorm(plane[farthest]) ? position : farthest,
    0,
  );
}

/** Which of the nearest, given nearest first, has the shortest leg from `from`: the nearer in the plane on a tie. */
function shortestLeg<T>(
  points: readonly T[],
  legMeters: (from: T, to: T) => number,
): (from: number, nearest: readonly number[]) => number {
  return (from, nearest) => {
    let chosen = 0;
    let shortest = legMeters(points[from], points[nearest[0]]);
    for (let candidate = 1; candidate < nearest.length; candidate++) {
      const leg = legMeters(points[from], points[nearest[candidate]]);
      if (leg < shortest) {
        chosen = candidate;
        shortest = leg;
      }
    }
    return chosen;
  };
}

function pathOf(
  order: readonly number[],
  plane: readonly PlanePoint[],
): PathPoint[] {
  return order.map((position) => ({ ...plane[position], position }));
}

function lengthOf(path: readonly PathPoint[], metric: Metric): number {
  let total = 0;
  for (let index = 1; index < path.length; index++) {
    total += metric.between(path[index - 1], path[index]);
  }
  return total;
}

function reverseSegment(
  path: PathPoint[],
  { start, end }: { start: number; end: number },
): void {
  path
    .slice(start, end + 1)
    .reverse()
    .forEach((point, offset) => {
      path[start + offset] = point;
    });
}

/** An open path's ends join nothing; a closed tour's last point joins its first. */
type Ends = 'open' | 'closed';

/** The length of edge path[from] → path[to]: an open path has none past either end, a closed tour wraps round. */
function edgeOf(
  path: readonly PathPoint[],
  { ends, between }: { ends: Ends; between: Metric['between'] },
): (from: number, to: number) => number {
  const last = path.length - 1;
  switch (ends) {
    case 'open':
      return (from, to) =>
        from < 0 || to > last ? 0 : between(path[from], path[to]);
    case 'closed': {
      const wrap = (position: number) => (position + path.length) % path.length;
      return (from, to) => between(path[wrap(from)], path[wrap(to)]);
    }
  }
}

/** Whether a move's new edges join no near points, so it is not worth measuring. */
function skipsOf(
  path: readonly PathPoint[],
  { ends, isNear }: { ends: Ends; isNear: NonNullable<Metric['isNear']> },
): (start: number, end: number) => boolean {
  const last = path.length - 1;
  const wrap = (position: number) => (position + path.length) % path.length;
  const joinsNear =
    ends === 'open'
      ? (from: number, to: number) =>
          from >= 0 && to <= last && isNear(path[from], path[to])
      : (from: number, to: number) => isNear(path[wrap(from)], path[wrap(to)]);
  return (start, end) =>
    !joinsNear(start - 1, end) && !joinsNear(start, end + 1);
}

/** 2-opt: reverse path[start ..= end] whenever that shortens the path or tour, within the move budget. */
function improveByTwoOpt(
  path: PathPoint[],
  {
    ends,
    metric,
    maxMoveEvaluations,
  }: { ends: Ends; metric: Metric; maxMoveEvaluations: number },
): void {
  const last = path.length - 1;
  const edge = edgeOf(path, { ends, between: metric.between });
  const { isNear } = metric;
  // None in the plane, where every move is measured, so its tight loop calls nothing more.
  const skips =
    isNear === undefined ? undefined : skipsOf(path, { ends, isNear });
  // A tour reversed whole is the same tour, so its first point stays put.
  const firstStart = ends === 'closed' ? 1 : 0;
  let evaluations = 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let end = 1; end <= last; end++) {
      let rightEdge = edge(end, end + 1);
      for (let start = end - 1; start >= firstStart; start--) {
        if (evaluations >= maxMoveEvaluations) return;
        evaluations++;
        if (skips?.(start, end)) continue;
        // Reversing swaps edges (start-1, start) and (end, end+1) for (start-1, end) and (start, end+1).
        const removed = edge(start - 1, start) + rightEdge;
        const added = edge(start - 1, end) + edge(start, end + 1);
        const saving = removed - added;
        // Leaving out a leg no path walks is worth it, however long the new ones.
        if (saving === Infinity || saving > removed * NOISE_TOLERANCE) {
          reverseSegment(path, { start, end });
          rightEdge = edge(end, end + 1);
          improved = true;
        }
      }
    }
  }
}

/** Walking order of an open path through all points: nearest neighbour from an extreme point, then 2-opt; by legMeters where given. */
export function orderPath<T extends Coordinates>(
  points: readonly T[],
  {
    legMeters,
    maxMoveEvaluations = DEFAULT_MAX_MOVE_EVALUATIONS,
    maxNeighbourEvaluations = DEFAULT_MAX_NEIGHBOUR_EVALUATIONS,
  }: OrderOptions<T> = {},
): T[] {
  if (points.length === 0) return [];
  const plane = projectToPlane(points);
  const start = extremePoint(plane);
  const planePath = pathOf(
    nearestNeighbourOrder(plane, {
      start,
      count: 1,
      choose: () => 0,
      maxEvaluations: maxNeighbourEvaluations,
    }),
    plane,
  );
  improveByTwoOpt(planePath, {
    ends: 'open',
    metric: PLANE_METRIC,
    maxMoveEvaluations,
  });
  if (legMeters === undefined)
    return planePath.map(({ position }) => points[position]);
  const metric = legMetric(points, {
    legMeters,
    plane,
    maxEvaluations: maxNeighbourEvaluations,
  });
  const legPath = pathOf(
    nearestNeighbourOrder(plane, {
      start,
      count: NEAR_COUNT,
      choose: shortestLeg(points, legMeters),
      maxEvaluations: maxNeighbourEvaluations,
    }),
    plane,
  );
  // 2-opt never lengthens a path, so the result is never a longer walk than the plane order.
  const path =
    lengthOf(legPath, metric) < lengthOf(planePath, metric)
      ? legPath
      : planePath;
  improveByTwoOpt(path, { ends: 'open', metric, maxMoveEvaluations });
  return path.map(({ position }) => points[position]);
}

/** The same points as a round trip back to the first: 2-opt over the closed tour, from the given order; by legMeters where given. */
export function shortenLoop<T extends Coordinates>(
  ordered: readonly T[],
  {
    legMeters,
    maxMoveEvaluations = DEFAULT_MAX_MOVE_EVALUATIONS,
    maxNeighbourEvaluations = DEFAULT_MAX_NEIGHBOUR_EVALUATIONS,
  }: OrderOptions<T> = {},
): T[] {
  const plane = projectToPlane(ordered);
  const metric =
    legMeters === undefined
      ? PLANE_METRIC
      : legMetric(ordered, {
          legMeters,
          plane,
          maxEvaluations: maxNeighbourEvaluations,
        });
  const path = pathOf(
    ordered.map((_, position) => position),
    plane,
  );
  improveByTwoOpt(path, { ends: 'closed', metric, maxMoveEvaluations });
  return path.map(({ position }) => ordered[position]);
}
