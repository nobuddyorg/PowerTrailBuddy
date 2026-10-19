import type { Geocache } from '../geocache/types';
import { pairKey } from '../trails/walkingDistances';

/** FOSSGIS's public OSRM server, foot profile; its policy allows one request per second and no heavy use. */
export const ROUTER_ORIGIN = 'https://routing.openstreetmap.de';

/** The table request for every walking distance among the caches, in meters. */
export function tableUrl(caches: readonly Geocache[]): string {
  const coordinates = caches
    .map(
      (cache) => `${cache.longitude.toFixed(6)},${cache.latitude.toFixed(6)}`,
    )
    .join(';');
  // The server ignores the profile segment; routed-foot picks the foot graph.
  return `${ROUTER_ORIGIN}/routed-foot/table/v1/foot/${coordinates}?annotations=distance`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isDistanceRow(
  value: unknown,
  size: number,
): value is (number | null)[] {
  return (
    Array.isArray(value) &&
    value.length === size &&
    value.every((cell) => cell === null || Number.isFinite(cell))
  );
}

function matrixOf(body: unknown, size: number): (number | null)[][] {
  if (!isRecord(body) || body.code !== 'Ok')
    throw new Error(
      `Routing failed: ${isRecord(body) ? String(body.code) : 'no answer'}`,
    );
  const { distances } = body;
  if (
    !Array.isArray(distances) ||
    distances.length !== size ||
    !distances.every((row) => isDistanceRow(row, size))
  )
    throw new Error('Routing answer without a distance table');
  return distances;
}

/** Every pair's walking meters from a table answer; Infinity where no path joins them, either way round. */
export function parseTable(
  caches: readonly Geocache[],
  body: unknown,
): [string, number][] {
  const matrix = matrixOf(body, caches.length);
  const entries: [string, number][] = [];
  caches.forEach((from, row) => {
    caches.slice(row + 1).forEach((to, offset) => {
      const column = row + 1 + offset;
      const there = matrix[row][column];
      const back = matrix[column][row];
      entries.push([
        pairKey(from, to),
        there === null || back === null ? Infinity : Math.max(there, back),
      ]);
    });
  });
  return entries;
}
