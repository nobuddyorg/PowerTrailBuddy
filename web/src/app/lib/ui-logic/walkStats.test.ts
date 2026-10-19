import { describe, expect, it } from 'vitest';

import { distanceMeters } from '../trails/geo';
import { DEFAULT_TRAIL_SETTINGS } from '../trails/types';
import type { WalkState } from '../walk/walk';
import { paceKnown, remainingWalkMinutes, visitEntries } from './walkStats';

const A = { latitude: 47.5, longitude: 9.5 };
const B = { latitude: 47.5, longitude: 9.51 };
const C = { latitude: 47.51, longitude: 9.51 };
const SETTINGS = { detourFactor: 1.5, walkingSpeedKmh: 3, minutesPerCache: 4 };

const minutesFor = (meters: number) => ((meters * 1.5) / 1000 / 3) * 60;

describe('remainingWalkMinutes', () => {
  it('walks from the user through each remaining cache back to the start, and searches each', () => {
    const minutes = remainingWalkMinutes({
      position: A,
      remaining: [B, C],
      returnTo: A,
      settings: SETTINGS,
    });
    const meters =
      distanceMeters(A, B) + distanceMeters(B, C) + distanceMeters(C, A);
    expect(minutes).toBeCloseTo(minutesFor(meters) + 2 * 4, 9);
  });

  it('starts at the next cache while the position is unknown', () => {
    const minutes = remainingWalkMinutes({
      remaining: [B, C],
      returnTo: A,
      settings: SETTINGS,
    });
    const meters = distanceMeters(B, C) + distanceMeters(C, A);
    expect(minutes).toBeCloseTo(minutesFor(meters) + 8, 9);
  });

  it('is nothing once no cache is left', () => {
    expect(
      remainingWalkMinutes({
        position: B,
        remaining: [],
        returnTo: A,
        settings: DEFAULT_TRAIL_SETTINGS,
      }),
    ).toBe(0);
  });

  it('is only the search time for the last cache when standing on it at the start', () => {
    expect(
      remainingWalkMinutes({
        position: A,
        remaining: [A],
        returnTo: A,
        settings: SETTINGS,
      }),
    ).toBe(4);
  });
});

describe('visitEntries', () => {
  const walk: WalkState = {
    trailId: 'T',
    codes: ['GCSU1', 'GCSU2', 'GCSU3', 'GCSU4'],
    startedAt: '2026-05-01T08:00:00Z',
    outcomes: {
      GCSU3: { outcome: 'dnf', at: '2026-05-01T08:30:00Z' },
      GCSU1: { outcome: 'found', at: '2026-05-01T08:10:00Z' },
      GCSU2: { outcome: 'skipped', at: '2026-05-01T08:20:00Z' },
    },
    history: ['GCSU1', 'GCSU2', 'GCSU3'],
  };

  it('lists finds and DNFs in walking order with their times, without skips or open caches', () => {
    expect(visitEntries(walk)).toEqual([
      { code: 'GCSU1', outcome: 'found', at: '2026-05-01T08:10:00Z' },
      { code: 'GCSU3', outcome: 'dnf', at: '2026-05-01T08:30:00Z' },
    ]);
  });
});

describe('paceKnown', () => {
  it('waits ten minutes before a rate means anything', () => {
    expect(paceKnown({ elapsedMinutes: 9.99 })).toBe(false);
    expect(paceKnown({ elapsedMinutes: 10 })).toBe(true);
  });
});
