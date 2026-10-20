import type { PlanePoint } from './projection';

export function planeDistance(a: PlanePoint, b: PlanePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Points in a west-to-east list that a point can be taken out of. */
interface Sweep {
  /** Positions west to east, the earlier position first among equals, as the sort is stable. */
  sorted: number[];
  /** The neighbouring index to the west, -1 past the first. */
  west: Int32Array;
  /** The neighbouring index to the east, sorted.length past the last. */
  east: Int32Array;
}

function sweepOf(plane: readonly PlanePoint[]): Sweep {
  const sorted = plane
    .map((_, position) => position)
    .sort((a, b) => plane[a].x - plane[b].x);
  return {
    sorted,
    west: Int32Array.from(sorted, (_, index) => index - 1),
    east: Int32Array.from(sorted, (_, index) => index + 1),
  };
}

function takeOut({ west, east }: Sweep, index: number): void {
  // A typed array ignores a write past either end, so the first and last need no check.
  east[west[index]] = east[index];
  west[east[index]] = west[index];
}

interface Candidate {
  /** Into the sweep. */
  index: number;
  position: number;
  meters: number;
}

/** Nearer, or as near and the earlier position. */
function isNearer(a: Candidate, b: Candidate): boolean {
  return (
    a.meters < b.meters ||
    (a.meters === b.meters && Math.min(a.position, b.position) === a.position)
  );
}

/** Adds a candidate in order, keeping no more than count. */
function keepNearest(
  found: Candidate[],
  { candidate, count }: { candidate: Candidate; count: number },
): void {
  if (found.length === count) {
    if (!isNearer(candidate, found[count - 1])) return;
    found.pop();
  }
  let at = found.length;
  while (at > 0 && isNearer(candidate, found[at - 1])) at--;
  found.splice(at, 0, candidate);
}

interface Search {
  /** The sweep index measured from. */
  from: number;
  count: number;
  maxEvaluations: number;
}

/** The count points of the sweep nearest sweep index `from`, nearest first, the earlier position on a tie; exact unless the evaluations run out. */
function nearestInSweep(
  plane: readonly PlanePoint[],
  { sweep, search }: { sweep: Sweep; search: Search },
): { found: Candidate[]; evaluations: number } {
  const { sorted, west, east } = sweep;
  const { from, count, maxEvaluations } = search;
  const origin = plane[sorted[from]];
  const found: Candidate[] = [];
  let evaluations = 0;
  // A point farther east or west than the count-th nearest so far is no nearer, nor is any point beyond it.
  const isWithinReach = (index: number) =>
    evaluations < maxEvaluations &&
    Math.abs(plane[sorted[index]].x - origin.x) <=
      (found.length === count ? found[count - 1].meters : Infinity);
  const measure = (index: number) => {
    evaluations++;
    const position = sorted[index];
    const meters = planeDistance(origin, plane[position]);
    keepNearest(found, { candidate: { index, position, meters }, count });
  };
  for (
    let index = west[from];
    index >= 0 && isWithinReach(index);
    index = west[index]
  )
    measure(index);
  for (
    let index = east[from];
    index < sorted.length && isWithinReach(index);
    index = east[index]
  )
    measure(index);
  return { found, evaluations };
}

/** The next point east of a point taken out, else the next west. */
function nextInSweep({ sorted, west, east }: Sweep, index: number): number {
  return east[index] < sorted.length ? east[index] : west[index];
}

export interface NeighbourSearch {
  start: number;
  /** How many of the nearest unvisited points each step chooses among. */
  count: number;
  /** Which of them, given nearest first, the path goes on to from `from`. */
  choose: (from: number, nearest: readonly number[]) => number;
  /** Counted distance evaluations for the whole path; once spent, each step goes on to the next point east, else west. */
  maxEvaluations: number;
}

/** From start, always on to one of the nearest unvisited points: a sweep west to east meets few points per step, not all of them. */
export function nearestNeighbourOrder(
  plane: readonly PlanePoint[],
  { start, count, choose, maxEvaluations }: NeighbourSearch,
): number[] {
  const sweep = sweepOf(plane);
  const { sorted } = sweep;
  const order = [start];
  let at = sorted.indexOf(start);
  let remaining = maxEvaluations;
  for (let step = 1; step < plane.length; step++) {
    takeOut(sweep, at);
    const { found, evaluations } = nearestInSweep(plane, {
      sweep,
      search: { from: at, count, maxEvaluations: remaining },
    });
    remaining -= evaluations;
    at =
      found.length === 0
        ? nextInSweep(sweep, at)
        : found[
            choose(
              sorted[at],
              found.map((candidate) => candidate.position),
            )
          ].index;
    order.push(sorted[at]);
  }
  return order;
}

/** Each point's count nearest others, nearest first, by position; within maxEvaluations distance evaluations in all. */
export function nearestOthers(
  plane: readonly PlanePoint[],
  { count, maxEvaluations }: { count: number; maxEvaluations: number },
): number[][] {
  const sweep = sweepOf(plane);
  let remaining = maxEvaluations;
  return sweep.sorted
    .map((position, from) => {
      const { found, evaluations } = nearestInSweep(plane, {
        sweep,
        search: { from, count, maxEvaluations: remaining },
      });
      remaining -= evaluations;
      return {
        position,
        nearest: found.map((candidate) => candidate.position),
      };
    })
    .sort((a, b) => a.position - b.position)
    .map(({ nearest }) => nearest);
}
