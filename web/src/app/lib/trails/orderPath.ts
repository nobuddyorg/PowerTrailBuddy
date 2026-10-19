import type { Coordinates } from '../geocache/types';
import { projectToPlane, type PlanePoint } from './projection';

/** Counted 2-opt move evaluations; bounds the work for a huge component while staying deterministic. */
const DEFAULT_MAX_MOVE_EVALUATIONS = 20_000_000;

// A move must save more than rounding noise in the edges it removes, or two moves could undo each other forever.
const NOISE_TOLERANCE = 1e-9;

function planeDistance(a: PlanePoint, b: PlanePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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

/** From the extreme point, always on to the nearest unvisited point, the earliest on a tie. */
function nearestNeighbourOrder(plane: readonly PlanePoint[]): number[] {
  let current = extremePoint(plane);
  const order = [current];
  const remaining = plane
    .map((_, position) => position)
    .filter((position) => position !== current);
  while (remaining.length > 0) {
    let nearest = 0;
    let nearestDistance = planeDistance(plane[current], plane[remaining[0]]);
    for (let candidate = 1; candidate < remaining.length; candidate++) {
      const distance = planeDistance(
        plane[current],
        plane[remaining[candidate]],
      );
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    current = remaining[nearest];
    order.push(current);
    remaining.splice(nearest, 1);
  }
  return order;
}

interface PathPoint extends PlanePoint {
  position: number;
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
  ends: Ends,
): (from: number, to: number) => number {
  const last = path.length - 1;
  switch (ends) {
    case 'open':
      return (from, to) =>
        from < 0 || to > last ? 0 : planeDistance(path[from], path[to]);
    case 'closed': {
      const wrap = (position: number) => (position + path.length) % path.length;
      return (from, to) => planeDistance(path[wrap(from)], path[wrap(to)]);
    }
  }
}

/** 2-opt: reverse path[start ..= end] whenever that shortens the path or tour, within the move budget. */
function improveByTwoOpt(
  path: PathPoint[],
  { ends, maxMoveEvaluations }: { ends: Ends; maxMoveEvaluations: number },
): void {
  const last = path.length - 1;
  const edge = edgeOf(path, ends);
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
        // Reversing swaps edges (start-1, start) and (end, end+1) for (start-1, end) and (start, end+1).
        const removed = edge(start - 1, start) + rightEdge;
        const added = edge(start - 1, end) + edge(start, end + 1);
        if (removed - added > removed * NOISE_TOLERANCE) {
          reverseSegment(path, { start, end });
          rightEdge = edge(end, end + 1);
          improved = true;
        }
      }
    }
  }
}

/** Walking order of an open path through all points: nearest neighbour from an extreme point, then 2-opt. */
export function orderPath<T extends Coordinates>(
  points: readonly T[],
  maxMoveEvaluations = DEFAULT_MAX_MOVE_EVALUATIONS,
): T[] {
  if (points.length === 0) return [];
  const plane = projectToPlane(points);
  const path = nearestNeighbourOrder(plane).map((position) => ({
    ...plane[position],
    position,
  }));
  improveByTwoOpt(path, { ends: 'open', maxMoveEvaluations });
  return path.map(({ position }) => points[position]);
}

/** The same points as a round trip back to the first: 2-opt over the closed tour, from the given order. */
export function shortenLoop<T extends Coordinates>(
  ordered: readonly T[],
  maxMoveEvaluations = DEFAULT_MAX_MOVE_EVALUATIONS,
): T[] {
  const path = projectToPlane(ordered).map((point, position) => ({
    ...point,
    position,
  }));
  improveByTwoOpt(path, { ends: 'closed', maxMoveEvaluations });
  return path.map(({ position }) => ordered[position]);
}
