import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { distanceMeters } from '../trails/geo';
import {
  arrangeTrails,
  healthSummary,
  NEAR_METERS,
  type TrailCard,
} from './trailCards';
import { makeCache, makeCaches, makeTrail } from './ui.test-support';

// Four trails, ranked as findTrails returned them; each differs from the next in what a sort looks at.
const alpha = makeTrail({
  id: 'alpha',
  caches: makeCaches(12, 'GCSUA'),
  walkMeters: 6000,
  durationMinutes: 130,
});
const beta = makeTrail({
  id: 'beta',
  caches: makeCaches(30, 'GCSUB').map((cache) => ({
    ...cache,
    latitude: 48.5,
  })),
  walkMeters: 9000,
  durationMinutes: 200,
});
const gamma = makeTrail({
  id: 'gamma',
  caches: makeCaches(12, 'GCSUC').map((cache) => ({
    ...cache,
    latitude: 47.6,
  })),
  walkMeters: 3000,
  durationMinutes: 80,
});
const delta = makeTrail({
  id: 'delta',
  caches: makeCaches(15, 'GCSUD').map((cache) => ({
    ...cache,
    latitude: 47.45,
  })),
  walkMeters: 5000,
  durationMinutes: 120,
});
const TRAILS = [alpha, beta, gamma, delta];
const HOME = { latitude: 47.45, longitude: 9.5 };

const ids = (cards: TrailCard[]) => cards.map((card) => card.trail.id);

describe('arrangeTrails', () => {
  it('ranks in the given order and keeps the rank whatever the sort', () => {
    const cards = arrangeTrails(TRAILS, { sort: 'shortest', filters: [] });
    expect(cards.map(({ trail, rank }) => [trail.id, rank])).toEqual([
      ['gamma', 3],
      ['delta', 4],
      ['alpha', 1],
      ['beta', 2],
    ]);
  });

  it('sorts by rate as given, and by most caches, ties in rank order', () => {
    expect(ids(arrangeTrails(TRAILS, { sort: 'rate', filters: [] }))).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta',
    ]);
    expect(ids(arrangeTrails(TRAILS, { sort: 'caches', filters: [] }))).toEqual(
      ['beta', 'delta', 'alpha', 'gamma'],
    );
  });

  it('sorts by rate even when the trails come in another order', () => {
    const slow = makeTrail({ id: 'slow', cachesPerHour: 4 });
    const fast = makeTrail({ id: 'fast', cachesPerHour: 9 });
    const cards = arrangeTrails([slow, fast], { sort: 'rate', filters: [] });
    expect(cards.map(({ trail, rank }) => [trail.id, rank])).toEqual([
      ['fast', 2],
      ['slow', 1],
    ]);
  });

  it('measures each trail from the user to its nearest cache and sorts by it', () => {
    const cards = arrangeTrails(TRAILS, {
      sort: 'nearest',
      filters: [],
      position: HOME,
    });
    expect(ids(cards)).toEqual(['delta', 'alpha', 'gamma', 'beta']);
    expect(cards[0].distanceMeters).toBeCloseTo(0, 6);
    expect(cards[1].distanceMeters).toBeCloseTo(
      distanceMeters(HOME, alpha.caches[0]),
      6,
    );
  });

  it('falls back to the rank for "nearest" while the position is unknown', () => {
    const cards = arrangeTrails(TRAILS, { sort: 'nearest', filters: [] });
    expect(ids(cards)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    expect(cards.every((card) => card.distanceMeters === undefined)).toBe(true);
  });

  it('keeps walks of at most 5 km for "short", at most 2 h for "quick"', () => {
    expect(
      ids(arrangeTrails(TRAILS, { sort: 'rate', filters: ['short'] })),
    ).toEqual(['gamma', 'delta']);
    expect(
      ids(arrangeTrails(TRAILS, { sort: 'rate', filters: ['quick'] })),
    ).toEqual(['gamma', 'delta']);
    expect(
      ids(
        arrangeTrails(
          [
            alpha,
            gamma,
            makeTrail({
              id: 'long-quick',
              walkMeters: 5001,
              durationMinutes: 60,
            }),
          ],
          {
            sort: 'rate',
            filters: ['short', 'quick'],
          },
        ),
      ),
    ).toEqual(['gamma']);
  });

  it('keeps trails within 10 km for "near", and every trail while the position is unknown', () => {
    const near = arrangeTrails(TRAILS, {
      sort: 'rate',
      filters: ['near'],
      position: HOME,
    });
    expect(ids(near)).toEqual(['alpha', 'delta']);
    expect(
      ids(arrangeTrails(TRAILS, { sort: 'rate', filters: ['near'] })),
    ).toHaveLength(4);
  });

  it('counts exactly 10 km as near', () => {
    const edge = makeTrail({
      id: 'edge',
      caches: [makeCache({ code: 'GCSUE', latitude: 0, longitude: 0 })],
    });
    const position = {
      latitude: (NEAR_METERS / 6371008.8) * (180 / Math.PI),
      longitude: 0,
    };
    const [card] = arrangeTrails([edge], {
      sort: 'rate',
      filters: ['near'],
      position,
    });
    expect(card.distanceMeters).toBeCloseTo(NEAR_METERS, 3);
  });

  it('returns each kept trail once, whatever the sort and filters', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('rate', 'caches', 'nearest', 'shortest' as const),
        fc.subarray(['short', 'quick', 'near'] as const),
        fc.boolean(),
        (sort, filters, located) => {
          const cards = arrangeTrails(TRAILS, {
            sort,
            filters,
            position: located ? HOME : undefined,
          });
          expect(new Set(ids(cards)).size).toBe(cards.length);
          const unfiltered = arrangeTrails(TRAILS, {
            sort,
            filters: [],
            position: located ? HOME : undefined,
          });
          expect(unfiltered).toHaveLength(TRAILS.length);
        },
      ),
    );
  });
});

describe('healthSummary', () => {
  it('counts DNF streaks, maintenance requests and disabled caches separately', () => {
    const trail = makeTrail({
      caches: [
        makeCache({ code: 'GCSU1' }),
        makeCache({
          code: 'GCSU2',
          recentLogs: [
            { type: 'dnf', date: '2026-05-02' },
            { type: 'dnf', date: '2026-05-01' },
          ],
        }),
        makeCache({
          code: 'GCSU3',
          recentLogs: [
            { type: 'dnf', date: '2026-05-02' },
            { type: 'dnf', date: '2026-05-01' },
          ],
        }),
        makeCache({
          code: 'GCSU4',
          recentLogs: [{ type: 'maintenance', date: '2026-05-02' }],
        }),
        makeCache({ code: 'GCSU5', available: false }),
      ],
    });
    expect(healthSummary(trail)).toEqual({
      dnfStreak: 2,
      needsMaintenance: 1,
      disabled: 1,
    });
  });

  it('is all zeros for a healthy trail', () => {
    expect(healthSummary(makeTrail())).toEqual({
      dnfStreak: 0,
      needsMaintenance: 0,
      disabled: 0,
    });
  });
});
