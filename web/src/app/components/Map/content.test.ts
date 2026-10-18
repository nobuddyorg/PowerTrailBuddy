import { describe, expect, it } from 'vitest';

import type { WalkState } from '../../lib/walk/walk';
import { makeCache, makeCaches, makeTrail } from '../fixtures.test-support';
import {
  overviewContent,
  trailColor,
  TRAIL_COLORS,
  walkContent,
} from './content';

const first = makeTrail({ id: 'A', caches: makeCaches(3, 'GCSUA') });
const second = makeTrail({
  id: 'B',
  caches: makeCaches(2, 'GCSUB').map((cache, index) => ({
    ...cache,
    parking: index === 0 ? { latitude: 47.6, longitude: 9.6 } : undefined,
  })),
});
const loner = makeCache({ code: 'GCSUL', name: '<b>Loner</b>' });

const overview = (
  overrides: Partial<Parameters<typeof overviewContent>[0]> = {},
) =>
  overviewContent({
    caches: [...first.caches, loner, ...second.caches],
    trails: [first, second],
    selectedTrailId: '',
    focusCode: '',
    locallyFound: new Set(),
    ignored: new Set(),
    showOtherCaches: true,
    ...overrides,
  });

describe('trailColor', () => {
  it('gives each rank a colour and starts over after the last', () => {
    expect(trailColor(1)).toBe(TRAIL_COLORS[0]);
    expect(trailColor(2)).toBe(TRAIL_COLORS[1]);
    expect(trailColor(TRAIL_COLORS.length + 1)).toBe(TRAIL_COLORS[0]);
  });
});

describe('overviewContent', () => {
  it('draws every trail in its colour with its rank, none faded without a selection', () => {
    const { lines, badges, parking } = overview();
    expect(
      lines.map(({ key, tone, color, trailId }) => [key, tone, color, trailId]),
    ).toEqual([
      ['A', 'trail', trailColor(1), 'A'],
      ['B', 'trail', trailColor(2), 'B'],
    ]);
    expect(badges).toEqual([
      {
        ...first.caches[0],
        trailId: 'A',
        rank: 1,
        color: trailColor(1),
        emphasised: true,
      },
      {
        ...second.caches[0],
        trailId: 'B',
        rank: 2,
        color: trailColor(2),
        emphasised: true,
      },
    ]);
    expect(parking).toEqual([]);
  });

  it('emphasises the selected trail, fades the others, draws it last and shows its parking', () => {
    const { lines, markers, badges, parking } = overview({
      selectedTrailId: 'B',
    });
    expect(lines.map(({ key, tone }) => [key, tone])).toEqual([
      ['A', 'faded'],
      ['B', 'selected'],
    ]);
    expect(markers.map(({ code, tone }) => [code, tone])).toEqual([
      ['GCSUL', 'other'],
      ['GCSUA1', 'faded'],
      ['GCSUA2', 'faded'],
      ['GCSUA3', 'faded'],
      ['GCSUB1', 'selected'],
      ['GCSUB2', 'selected'],
    ]);
    expect(badges.map(({ emphasised }) => emphasised)).toEqual([false, true]);
    expect(parking).toEqual([{ latitude: 47.6, longitude: 9.6 }]);
  });

  it('treats an unknown selection as none', () => {
    expect(
      overview({ selectedTrailId: 'gone' }).lines.map(({ tone }) => tone),
    ).toEqual(['trail', 'trail']);
  });

  it('labels a marker with code and name as given, markup and all', () => {
    const [marker] = overview({ trails: [], caches: [loner] }).markers;
    expect(marker).toEqual({
      code: 'GCSUL',
      latitude: loner.latitude,
      longitude: loner.longitude,
      tone: 'other',
      color: '',
      warning: false,
      label: 'GCSUL · <b>Loner</b>',
    });
  });

  it('dims caches outside the trails by status: found, disabled, archived, ignored', () => {
    const caches = [
      makeCache({ code: 'GCSU1', found: true }),
      makeCache({ code: 'GCSU2' }),
      makeCache({ code: 'GCSU3', available: false }),
      makeCache({ code: 'GCSU4', archived: true }),
      makeCache({ code: 'GCSU5' }),
      makeCache({ code: 'GCSU6' }),
    ];
    const { markers } = overview({
      trails: [],
      caches,
      locallyFound: new Set(['GCSU2']),
      ignored: new Set(['GCSU5']),
    });
    expect(markers.map(({ tone }) => tone)).toEqual([
      'found',
      'found',
      'disabled',
      'disabled',
      'disabled',
      'other',
    ]);
  });

  it('rings a cache with a DNF streak or a maintenance request', () => {
    const doubtful = [
      makeCache({
        code: 'GCSU1',
        recentLogs: [
          { type: 'dnf', date: '2026-01-02' },
          { type: 'dnf', date: '2026-01-01' },
        ],
      }),
      makeCache({
        code: 'GCSU2',
        recentLogs: [{ type: 'maintenance', date: '2026-01-02' }],
      }),
      makeCache({
        code: 'GCSU3',
        recentLogs: [{ type: 'dnf', date: '2026-01-02' }],
      }),
      makeCache({ code: 'GCSU4', available: false }),
    ];
    expect(
      overview({ trails: [], caches: doubtful }).markers.map(
        ({ warning }) => warning,
      ),
    ).toEqual([true, true, false, false]);
  });

  it('leaves out the caches outside the trails when asked to', () => {
    const { markers } = overview({ showOtherCaches: false });
    expect(markers.map(({ code }) => code)).not.toContain('GCSUL');
    expect(markers).toHaveLength(5);
  });

  it('draws a picked cache last, as the highlight, even a hidden one', () => {
    const { markers } = overview({ focusCode: 'GCSUA2', selectedTrailId: 'B' });
    expect(markers.at(-1)).toMatchObject({ code: 'GCSUA2', tone: 'target' });
    expect(markers.filter(({ code }) => code === 'GCSUA2')).toHaveLength(1);
    const hidden = overview({
      focusCode: 'GCSUL',
      showOtherCaches: false,
    }).markers;
    expect(hidden.at(-1)).toMatchObject({ code: 'GCSUL', tone: 'target' });
  });

  it('shows each parking spot once, however many caches share it', () => {
    const spot = { latitude: 47.7, longitude: 9.7 };
    const trail = makeTrail({
      id: 'P',
      caches: makeCaches(3, 'GCSUP').map((cache) => ({
        ...cache,
        parking: spot,
      })),
    });
    expect(
      overview({ trails: [trail], caches: trail.caches, selectedTrailId: 'P' })
        .parking,
    ).toEqual([spot]);
  });
});

describe('walkContent', () => {
  const caches = makeCaches(5, 'GCSUW').map((cache, index) => ({
    ...cache,
    parking: index === 0 ? { latitude: 47.4, longitude: 9.4 } : undefined,
  }));
  const walk: WalkState = {
    trailId: 'W',
    codes: caches.map(({ code }) => code),
    startedAt: '2026-05-01T08:00:00Z',
    outcomes: {
      GCSUW1: { outcome: 'found', at: '2026-05-01T08:10:00Z' },
      GCSUW2: { outcome: 'dnf', at: '2026-05-01T08:20:00Z' },
      GCSUW3: { outcome: 'skipped', at: '2026-05-01T08:30:00Z' },
    },
    history: ['GCSUW1', 'GCSUW2', 'GCSUW3'],
  };

  it('settles done caches by outcome and draws the target last', () => {
    const { markers, badges, parking } = walkContent({
      caches,
      otherCaches: [],
      walk,
      targetCode: 'GCSUW4',
    });
    expect(markers.map(({ code, tone }) => [code, tone])).toEqual([
      ['GCSUW1', 'found'],
      ['GCSUW2', 'dnf'],
      ['GCSUW3', 'done'],
      ['GCSUW5', 'selected'],
      ['GCSUW4', 'target'],
    ]);
    expect(badges).toEqual([]);
    expect(parking).toEqual([{ latitude: 47.4, longitude: 9.4 }]);
  });

  it('draws the route, and a guide line from the walker to the target', () => {
    const position = { latitude: 47.49, longitude: 9.49 };
    const { lines } = walkContent({
      caches,
      otherCaches: [],
      walk,
      targetCode: 'GCSUW4',
      position,
    });
    expect(lines).toEqual([
      {
        key: 'walk',
        tone: 'walk',
        color: trailColor(1),
        points: caches,
        trailId: '',
      },
      {
        key: 'guide',
        tone: 'guide',
        color: '',
        points: [position, caches[3]],
        trailId: '',
      },
    ]);
  });

  it('draws the caches outside the walk dimmed, underneath', () => {
    const other = makeCache({ code: 'GCSUO' });
    const { markers } = walkContent({
      caches,
      otherCaches: [other],
      walk,
      targetCode: 'GCSUW4',
    });
    expect(markers[0]).toMatchObject({ code: 'GCSUO', tone: 'other' });
    expect(markers).toHaveLength(6);
  });

  it('has no guide line without a position or a target', () => {
    expect(
      walkContent({ caches, otherCaches: [], walk, targetCode: 'GCSUW4' })
        .lines,
    ).toHaveLength(1);
    expect(
      walkContent({
        caches,
        otherCaches: [],
        walk,
        targetCode: '',
        position: { latitude: 1, longitude: 1 },
      }).lines,
    ).toHaveLength(1);
  });
});
