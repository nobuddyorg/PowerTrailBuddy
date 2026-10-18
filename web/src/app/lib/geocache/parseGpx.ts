import type { Geocache } from './types';

export interface ParsedGpx {
  caches: Geocache[];
  /** Waypoints that carry no cache: additional waypoints, or ones with unusable coordinates. */
  skippedWaypoints: number;
}

export type GpxParseErrorCode = 'not-xml' | 'not-gpx';

export class GpxParseError extends Error {
  readonly code: GpxParseErrorCode;

  constructor(code: GpxParseErrorCode) {
    super(`Unusable GPX: ${code}`);
    this.name = 'GpxParseError';
    this.code = code;
  }
}

/** Reads the caches in one GPX document (Groundspeak extensions 1/0 or 1/0/1). */
export function parseGpx(xml: string): ParsedGpx {
  void xml;
  throw new Error('not implemented');
}
