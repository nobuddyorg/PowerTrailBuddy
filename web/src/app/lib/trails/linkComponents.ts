import type { Coordinates } from '../geocache/types';
import { distanceMeters, EARTH_RADIUS_METERS, toRadians } from './geo';

interface Grid {
  cellMeters: number;
  /** Meters per radian of longitude, scaled so two linkable points are never more than one column apart. */
  eastScale: number;
  columnsAround: number;
}

function gridFor(points: readonly Coordinates[], cellMeters: number): Grid {
  const maxAbsoluteLatitude = points.reduce(
    (highest, point) => Math.max(highest, Math.abs(toRadians(point.latitude))),
    0,
  );
  // A path shorter than the gap reaches at most gap/R radians further from the equator than its ends.
  const highestPathLatitude = Math.min(
    Math.PI / 2,
    maxAbsoluteLatitude + cellMeters / EARTH_RADIUS_METERS,
  );
  const eastScale = EARTH_RADIUS_METERS * Math.cos(highestPathLatitude);
  // Rounding down makes the last column wider rather than narrower, so neighbours across ±180° stay one column apart.
  const columnsAround = Math.max(
    1,
    Math.floor((2 * Math.PI * eastScale) / cellMeters),
  );
  return { cellMeters, eastScale, columnsAround };
}

function rowOf(grid: Grid, point: Coordinates): number {
  return Math.floor(
    (EARTH_RADIUS_METERS * toRadians(point.latitude)) / grid.cellMeters,
  );
}

function columnOf(grid: Grid, point: Coordinates): number {
  const east = grid.eastScale * toRadians(point.longitude + 180);
  return Math.min(grid.columnsAround - 1, Math.floor(east / grid.cellMeters));
}

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/** Positions in the 3×3 cells of maxGapMeters around a point: all points closer than the gap, and a few farther. */
export function gridNeighbourhood(
  points: readonly Coordinates[],
  maxGapMeters: number,
): (position: number) => number[] {
  const grid = gridFor(points, maxGapMeters);
  const cells = new Map<string, number[]>();
  points.forEach((point, position) => {
    const key = cellKey(rowOf(grid, point), columnOf(grid, point));
    const cell = cells.get(key);
    if (cell) cell.push(position);
    else cells.set(key, [position]);
  });
  return (position) => {
    const row = rowOf(grid, points[position]);
    const column = columnOf(grid, points[position]);
    const columns = new Set(
      [column - 1, column, column + 1].map(
        (candidate) => (candidate + grid.columnsAround) % grid.columnsAround,
      ),
    );
    return [row - 1, row, row + 1].flatMap((neighbourRow) =>
      [...columns].flatMap(
        (neighbourColumn) =>
          cells.get(cellKey(neighbourRow, neighbourColumn)) ?? [],
      ),
    );
  };
}

/** Groups of points chained by gaps under maxGapMeters where isLinked agrees, in order of their first point; near-linear via the grid. */
export function linkComponentsWhere<T extends Coordinates>(
  points: readonly T[],
  {
    maxGapMeters,
    isLinked,
  }: { maxGapMeters: number; isLinked: (a: T, b: T) => boolean },
): T[][] {
  const neighbourhood = gridNeighbourhood(points, maxGapMeters);
  const visited = new Uint8Array(points.length);
  const components: T[][] = [];
  for (let start = 0; start < points.length; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const current = points[queue[head]];
      for (const candidate of neighbourhood(queue[head])) {
        if (
          visited[candidate] ||
          distanceMeters(current, points[candidate]) >= maxGapMeters ||
          !isLinked(current, points[candidate])
        )
          continue;
        visited[candidate] = 1;
        queue.push(candidate);
      }
    }
    components.push(queue.map((position) => points[position]));
  }
  return components;
}
