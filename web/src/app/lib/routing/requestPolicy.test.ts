import { describe, expect, it } from 'vitest';

import { makeCache } from '../trails/trails.test-support';
import { tableUrl } from './osrmTable';
import {
  belowRequestCap,
  checkOf,
  MAX_REQUESTS,
  nextRequest,
  nextRequestDelay,
  REQUEST_INTERVAL_MS,
} from './requestPolicy';

const first = [
  makeCache({ code: 'GCQA', latitude: 48, longitude: 11 }),
  makeCache({ code: 'GCQB', latitude: 48.001, longitude: 11 }),
];
const second = [
  makeCache({ code: 'GCQC', latitude: 49, longitude: 11 }),
  makeCache({ code: 'GCQD', latitude: 49.001, longitude: 11 }),
];
const inFlight = { url: tableUrl(second), caches: second };
// No URL to fetch and no caches to send.
const nothing = { url: '', caches: [] };

describe('nextRequest', () => {
  const planned = {
    mayRequest: true,
    planned: true,
    batches: [first, second],
    current: inFlight,
  };

  it("asks for the plan's first batch, named by its URL", () => {
    expect(nextRequest(planned)).toEqual({
      url: tableUrl(first),
      caches: first,
    });
  });

  it('asks for nothing once the plan is empty', () => {
    expect(nextRequest({ ...planned, batches: [] })).toEqual(nothing);
  });

  it('keeps the current request while the plan is behind its input', () => {
    expect(nextRequest({ ...planned, planned: false })).toBe(inFlight);
    expect(nextRequest({ ...planned, planned: false, batches: [] })).toBe(
      inFlight,
    );
  });

  it('asks for nothing once requests must stop, planned or not', () => {
    expect(nextRequest({ ...planned, mayRequest: false })).toEqual(nothing);
    expect(
      nextRequest({ ...planned, mayRequest: false, planned: false }),
    ).toEqual(nothing);
  });
});

const checking = {
  enabled: true,
  failed: false,
  remaining: 3,
  requestCount: 0,
};

describe('belowRequestCap', () => {
  it(`allows ${MAX_REQUESTS} requests a visit and no more`, () => {
    expect(MAX_REQUESTS).toBe(60);
    expect(belowRequestCap(0)).toBe(true);
    expect(belowRequestCap(MAX_REQUESTS - 1)).toBe(true);
    expect(belowRequestCap(MAX_REQUESTS)).toBe(false);
    expect(belowRequestCap(MAX_REQUESTS + 1)).toBe(false);
  });
});

describe('nextRequestDelay', () => {
  it('waits a full second after a request that has just gone', () => {
    expect(REQUEST_INTERVAL_MS).toBe(1000);
    expect(nextRequestDelay({ lastRequestAt: 5000, now: 5000 })).toBe(1000);
  });

  it('waits only what is left of the second', () => {
    expect(nextRequestDelay({ lastRequestAt: 5000, now: 5300 })).toBe(700);
    expect(nextRequestDelay({ lastRequestAt: 5000, now: 5999 })).toBe(1);
  });

  it('waits not at all once the second is over, or before any request', () => {
    expect(nextRequestDelay({ lastRequestAt: 5000, now: 6000 })).toBe(0);
    expect(nextRequestDelay({ lastRequestAt: 5000, now: 9000 })).toBe(0);
    expect(nextRequestDelay({ lastRequestAt: -Infinity, now: 0 })).toBe(0);
  });
});

describe('checkOf', () => {
  it('says how many requests are left while checking', () => {
    expect(checkOf(checking)).toEqual({ status: 'checking', remaining: 3 });
    expect(checkOf({ ...checking, requestCount: MAX_REQUESTS - 1 })).toEqual({
      status: 'checking',
      remaining: 3,
    });
  });

  it('is off while disabled, whatever else holds', () => {
    expect(
      checkOf({
        enabled: false,
        failed: true,
        remaining: 0,
        requestCount: MAX_REQUESTS,
      }),
    ).toEqual({ status: 'off' });
  });

  it('puts a failure before being done or limited', () => {
    expect(
      checkOf({
        ...checking,
        failed: true,
        remaining: 0,
        requestCount: MAX_REQUESTS,
      }),
    ).toEqual({ status: 'failed' });
  });

  it('is done with nothing left, even at the cap', () => {
    expect(
      checkOf({ ...checking, remaining: 0, requestCount: MAX_REQUESTS }),
    ).toEqual({ status: 'done' });
  });

  it('is limited at the cap with requests left', () => {
    expect(checkOf({ ...checking, requestCount: MAX_REQUESTS })).toEqual({
      status: 'limited',
    });
  });
});
