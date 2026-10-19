import type { Geocache } from '../geocache/types';
import { tableUrl } from './osrmTable';

/** FOSSGIS's policy: one request a second at most. */
export const REQUEST_INTERVAL_MS = 1000;

/** Requests per page load: the trails of a few Pocket Queries, never heavy use of a volunteer-run server. */
export const MAX_REQUESTS = 60;

export type RouteCheck =
  | { status: 'off' }
  | { status: 'checking'; remaining: number }
  | { status: 'done' }
  | { status: 'failed' }
  | { status: 'limited' };

/** A table request, named by its URL so that a batch of the same caches is the same request. */
interface TableRequest {
  url: string;
  caches: readonly Geocache[];
}

export const NO_REQUEST: TableRequest = { url: '', caches: [] };

/** The request to send next: none once requests must stop, the current one while the plan is behind its input, else the plan's first batch. */
export function nextRequest({
  mayRequest,
  planned,
  batches,
  current,
}: {
  mayRequest: boolean;
  planned: boolean;
  batches: readonly (readonly Geocache[])[];
  current: TableRequest;
}): TableRequest {
  if (!mayRequest) return NO_REQUEST;
  if (!planned) return current;
  if (batches.length === 0) return NO_REQUEST;
  return { url: tableUrl(batches[0]), caches: batches[0] };
}

/** Whether this visit may still send a request. */
export function belowRequestCap(requestCount: number): boolean {
  return requestCount < MAX_REQUESTS;
}

/** Milliseconds to wait before the next request may go, so two never start less than REQUEST_INTERVAL_MS apart. */
export function nextRequestDelay({
  lastRequestAt,
  now,
}: {
  lastRequestAt: number;
  now: number;
}): number {
  return Math.max(0, lastRequestAt + REQUEST_INTERVAL_MS - now);
}

/** The route status: off wins, then a failure, then nothing left, then the cap. */
export function checkOf({
  enabled,
  failed,
  remaining,
  requestCount,
}: {
  enabled: boolean;
  failed: boolean;
  remaining: number;
  requestCount: number;
}): RouteCheck {
  if (!enabled) return { status: 'off' };
  if (failed) return { status: 'failed' };
  if (remaining === 0) return { status: 'done' };
  if (!belowRequestCap(requestCount)) return { status: 'limited' };
  return { status: 'checking', remaining };
}
