import { describe, expect, it } from 'vitest';

import { makeCache } from '../trails/trails.test-support';
import type { Trail } from '../trails/types';
import {
  nextCode,
  orientWalk,
  recordOutcome,
  reverseWalk,
  startWalk,
  undoLast,
  walkPace,
  walkProgress,
  type WalkOutcome,
  type WalkState,
} from './walk';

const START = '2001-02-03T10:00:00.000Z';
const LATER = '2001-02-03T10:05:00.000Z';

const trail: Trail = {
  id: 'GCW1-3',
  caches: ['GCW2', 'GCW1', 'GCW3'].map((code) => makeCache({ code })),
  pathMeters: 200,
  returnMeters: 150,
  walkMeters: 455,
  durationMinutes: 15.8,
  cachesPerHour: 11.4,
  shape: 'line',
  center: { latitude: 0, longitude: 0 },
};

const fiveCaches: Trail = {
  ...trail,
  id: 'GCA-5',
  caches: ['GCA', 'GCB', 'GCC', 'GCD', 'GCE'].map((code) =>
    makeCache({ code }),
  ),
};

function record(
  state: WalkState,
  ...steps: [string, WalkOutcome][]
): WalkState {
  return steps.reduce(
    (walk, [code, outcome]) => recordOutcome(walk, code, outcome, LATER),
    state,
  );
}

describe('startWalk', () => {
  it('starts with every cache of the trail open, in walking order', () => {
    expect(startWalk(trail, START)).toEqual({
      trailId: 'GCW1-3',
      codes: ['GCW2', 'GCW1', 'GCW3'],
      startedAt: START,
      outcomes: {},
      history: [],
    });
  });

  it('starts at the first cache with nothing done', () => {
    const walk = startWalk(trail, START);
    expect(nextCode(walk)).toBe('GCW2');
    expect(walkProgress(walk)).toEqual({ done: 0, total: 3, found: 0, dnf: 0 });
  });
});

describe('recordOutcome', () => {
  it('records an outcome and its time without changing the state it was given', () => {
    const walk = startWalk(trail, START);
    const after = recordOutcome(walk, 'GCW2', 'found', LATER);
    expect(after).toEqual({
      ...walk,
      outcomes: { GCW2: { outcome: 'found', at: LATER } },
      history: ['GCW2'],
    });
    expect(walk).toEqual(startWalk(trail, START));
  });

  it('lets a later outcome replace an earlier one and moves it to the end of the history', () => {
    const walk = record(
      startWalk(trail, START),
      ['GCW1', 'skipped'],
      ['GCW2', 'dnf'],
      ['GCW1', 'found'],
    );
    expect(walk.outcomes.GCW1).toEqual({ outcome: 'found', at: LATER });
    expect(walk.history).toEqual(['GCW2', 'GCW1']);
  });

  it('ignores a code that is not part of the walk', () => {
    const walk = startWalk(trail, START);
    expect(recordOutcome(walk, 'GCELSEWHERE', 'found', LATER)).toBe(walk);
  });
});

describe('undoLast', () => {
  it('takes back the most recent outcome, leaving the walking order alone', () => {
    const walk = record(
      startWalk(trail, START),
      ['GCW2', 'found'],
      ['GCW1', 'dnf'],
    );
    const undone = undoLast(walk);
    expect(undone).toEqual(record(startWalk(trail, START), ['GCW2', 'found']));
    expect(nextCode(undone)).toBe('GCW1');
    expect(walk.history).toEqual(['GCW2', 'GCW1']);
  });

  it('takes back outcomes one after another until none is left', () => {
    const walk = record(
      startWalk(trail, START),
      ['GCW2', 'found'],
      ['GCW1', 'dnf'],
    );
    expect(undoLast(undoLast(walk))).toEqual(startWalk(trail, START));
  });

  it('leaves a walk without outcomes as it is', () => {
    const walk = startWalk(trail, START);
    expect(undoLast(walk)).toBe(walk);
  });

  it('removes a re-recorded cache entirely, not back to its first outcome', () => {
    const walk = record(
      startWalk(trail, START),
      ['GCW2', 'skipped'],
      ['GCW2', 'found'],
    );
    expect(undoLast(walk)).toEqual(startWalk(trail, START));
  });

  it('keeps outcomes of caches outside the walk from a stored state', () => {
    const stored: WalkState = {
      ...startWalk(trail, START),
      outcomes: {
        GCOLD: { outcome: 'found', at: LATER },
        GCW1: { outcome: 'dnf', at: LATER },
      },
      history: ['GCW1'],
    };
    expect(undoLast(stored).outcomes).toEqual({
      GCOLD: { outcome: 'found', at: LATER },
    });
  });
});

describe('orientWalk and reverseWalk', () => {
  const walk = startWalk(fiveCaches, START);

  it('reverses the walk to start at the last cache', () => {
    expect(orientWalk(walk, 'GCE').codes).toEqual([
      'GCE',
      'GCD',
      'GCC',
      'GCB',
      'GCA',
    ]);
  });

  it('keeps the walk as it is when asked to start at the first cache', () => {
    expect(orientWalk(walk, 'GCA')).toEqual(walk);
  });

  it('rotates the round trip to start at a cache in the middle', () => {
    expect(orientWalk(walk, 'GCC').codes).toEqual([
      'GCC',
      'GCD',
      'GCE',
      'GCA',
      'GCB',
    ]);
    expect(orientWalk(walk, 'GCD').codes).toEqual([
      'GCD',
      'GCE',
      'GCA',
      'GCB',
      'GCC',
    ]);
  });

  it('ignores a code outside the walk', () => {
    expect(orientWalk(walk, 'GCZ')).toEqual(walk);
  });

  it('orients only the open caches, keeping the done ones in front', () => {
    const started = record(walk, ['GCA', 'found'], ['GCC', 'dnf']);
    expect(orientWalk(started, 'GCE').codes).toEqual([
      'GCA',
      'GCC',
      'GCE',
      'GCD',
      'GCB',
    ]);
    expect(orientWalk(started, 'GCD').codes).toEqual([
      'GCA',
      'GCC',
      'GCD',
      'GCE',
      'GCB',
    ]);
    expect(nextCode(orientWalk(started, 'GCD'))).toBe('GCD');
  });

  it('ignores a code that already has an outcome', () => {
    const started = record(walk, ['GCB', 'found']);
    expect(orientWalk(started, 'GCB').codes).toEqual([
      'GCB',
      'GCA',
      'GCC',
      'GCD',
      'GCE',
    ]);
  });

  it('keeps outcomes, history and start time when reorienting', () => {
    const started = record(walk, ['GCA', 'found']);
    const oriented = orientWalk(started, 'GCE');
    expect([oriented.outcomes, oriented.history, oriented.startedAt]).toEqual([
      started.outcomes,
      started.history,
      START,
    ]);
  });

  it('reverses the open caches and leaves the state it was given alone', () => {
    const started = record(walk, ['GCB', 'skipped']);
    const reversed = reverseWalk(started);
    expect(reversed).toEqual({
      ...started,
      codes: ['GCB', 'GCE', 'GCD', 'GCC', 'GCA'],
    });
    expect(started.codes).toEqual(['GCA', 'GCB', 'GCC', 'GCD', 'GCE']);
    expect(reverseWalk(reversed).codes).toEqual([
      'GCB',
      'GCA',
      'GCC',
      'GCD',
      'GCE',
    ]);
  });
});

describe('nextCode and walkProgress', () => {
  it('moves on past found, missed and skipped caches, counting finds and misses', () => {
    const walk = record(
      startWalk(fiveCaches, START),
      ['GCA', 'skipped'],
      ['GCB', 'found'],
      ['GCC', 'dnf'],
      ['GCD', 'found'],
    );
    expect(nextCode(walk)).toBe('GCE');
    expect(walkProgress(walk)).toEqual({ done: 4, total: 5, found: 2, dnf: 1 });
  });

  it('returns to a cache left open out of order', () => {
    const walk = record(startWalk(trail, START), ['GCW1', 'found']);
    expect(nextCode(walk)).toBe('GCW2');
  });

  it('has no next cache once every cache has an outcome', () => {
    const walk = record(
      startWalk(trail, START),
      ['GCW2', 'found'],
      ['GCW1', 'found'],
      ['GCW3', 'dnf'],
    );
    expect(nextCode(walk)).toBeUndefined();
    expect(walkProgress(walk)).toEqual({ done: 3, total: 3, found: 2, dnf: 1 });
  });

  it('counts only outcomes of caches in the walk, from a stored state', () => {
    const stored: WalkState = {
      trailId: 'GCW1-3',
      codes: ['GCW1'],
      startedAt: START,
      outcomes: {
        GCW1: { outcome: 'skipped', at: LATER },
        GCOLD: { outcome: 'found', at: LATER },
        GCGONE: { outcome: 'dnf', at: LATER },
      },
      history: ['GCOLD', 'GCW1', 'GCGONE'],
    };
    expect(walkProgress(stored)).toEqual({
      done: 1,
      total: 1,
      found: 0,
      dnf: 0,
    });
  });

  it('treats codes named like object properties as ordinary codes', () => {
    const odd: Trail = {
      ...trail,
      caches: ['toString', '__proto__', 'constructor'].map((code) =>
        makeCache({ code }),
      ),
    };
    const walk = record(startWalk(odd, START), ['__proto__', 'found']);
    expect(nextCode(walk)).toBe('toString');
    expect(walkProgress(walk)).toEqual({ done: 1, total: 3, found: 1, dnf: 0 });
    expect(undoLast(walk).outcomes).toEqual({});
  });
});

describe('walkPace', () => {
  const walk = record(
    startWalk(fiveCaches, START),
    ['GCA', 'found'],
    ['GCB', 'dnf'],
    ['GCC', 'found'],
    ['GCD', 'skipped'],
  );

  it('measures the time since the start and counts finds per hour', () => {
    expect(walkPace(walk, '2001-02-03T10:30:00.000Z')).toEqual({
      elapsedMinutes: 30,
      cachesPerHour: 4,
    });
  });

  it('reads times with an offset', () => {
    expect(walkPace(walk, '2001-02-03T12:15:00+02:00').elapsedMinutes).toBe(15);
  });

  it('reports no pace before any time has passed', () => {
    expect(walkPace(walk, START)).toEqual({
      elapsedMinutes: 0,
      cachesPerHour: 0,
    });
  });

  it('counts a clock before the start as no time', () => {
    expect(walkPace(walk, '2001-02-03T09:00:00.000Z')).toEqual({
      elapsedMinutes: 0,
      cachesPerHour: 0,
    });
  });

  it('counts an unreadable time as no time', () => {
    expect(walkPace(walk, 'later')).toEqual({
      elapsedMinutes: 0,
      cachesPerHour: 0,
    });
  });

  it('reports no finds per hour for a walk without finds', () => {
    expect(walkPace(startWalk(trail, START), LATER)).toEqual({
      elapsedMinutes: 5,
      cachesPerHour: 0,
    });
  });
});
