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

/** 2-opt with free endpoints: reverse path[start ..= end] whenever that shortens it, within the move budget. */
function improveByTwoOpt(path: PathPoint[], maxMoveEvaluations: number): void {
  const last = path.length - 1;
  // An edge past either end of the open path does not exist, so it costs nothing.
  const edge = (from: number, to: number): number =>
    from < 0 || to > last ? 0 : planeDistance(path[from], path[to]);
  let evaluations = 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let end = 1; end <= last; end++) {
      let rightEdge = edge(end, end + 1);
      for (let start = end - 1; start >= 0; start--) {
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
  improveByTwoOpt(path, maxMoveEvaluations);
  return path.map(({ position }) => points[position]);
}
