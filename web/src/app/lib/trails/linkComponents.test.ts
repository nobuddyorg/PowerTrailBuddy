import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
import { distanceMeters } from './geo';
import { gridNeighbourhood, linkComponentsWhere } from './linkComponents';
import {
  DEGREES_PER_METER,
  eastwardChain,
  linkComponents,
} from './trails.test-support';

interface Labelled extends Coordinates {
  label: string;
}

function labelled(points: readonly Coordinates[], prefix: string): Labelled[] {
  return points.map((point, index) => ({
    ...point,
    label: `${prefix}${index}`,
  }));
}

function labelsOf(components: readonly Labelled[][]): string[][] {
  return components.map((component) =>
    component.map((point) => point.label).sort(),
  );
}

describe('linkComponents', () => {
  it('returns nothing for nothing', () => {
    expect(linkComponents([], 300)).toEqual([]);
  });

  it('links a chain whose steps are shorter than the gap into one component', () => {
    const chain = labelled(
      eastwardChain(
        { latitude: 48, longitude: 11 },
        { count: 5, spacingMeters: 250 },
      ),
      'a',
    );
    expect(labelsOf(linkComponents(chain, 300))).toEqual([
      ['a0', 'a1', 'a2', 'a3', 'a4'],
    ]);
  });

  it('separates two chains farther apart than the gap, in order of their first point', () => {
    const second = labelled(
      eastwardChain(
        { latitude: 48.01, longitude: 11 },
        { count: 2, spacingMeters: 100 },
      ),
      'b',
    );
    const first = labelled(
      eastwardChain(
        { latitude: 48, longitude: 11 },
        { count: 2, spacingMeters: 100 },
      ),
      'a',
    );
    expect(labelsOf(linkComponents([...first, ...second], 300))).toEqual([
      ['a0', 'a1'],
      ['b0', 'b1'],
    ]);
    expect(labelsOf(linkComponents([...second, ...first], 300))).toEqual([
      ['b0', 'b1'],
      ['a0', 'a1'],
    ]);
  });

  it('links only pairs strictly closer than the gap', () => {
    const pair = labelled(
      eastwardChain(
        { latitude: 0, longitude: 0 },
        { count: 2, spacingMeters: 300 },
      ),
      'p',
    );
    expect(linkComponents(pair, 300.001)).toHaveLength(1);
    expect(linkComponents(pair, 299.999)).toHaveLength(2);
  });

  it('does not link a pair exactly the gap apart', () => {
    const pair = labelled(
      eastwardChain(
        { latitude: 30, longitude: 30 },
        { count: 2, spacingMeters: 250 },
      ),
      'p',
    );
    const gap = distanceMeters(pair[0], pair[1]);
    expect(linkComponents(pair, gap)).toHaveLength(2);
    expect(linkComponents(pair, gap + 1e-9)).toHaveLength(1);
  });

  it('links points that share a position', () => {
    const same = labelled(
      [
        { latitude: 50, longitude: 8 },
        { latitude: 50, longitude: 8 },
        { latitude: 50, longitude: 8 },
      ],
      's',
    );
    expect(labelsOf(linkComponents(same, 1))).toEqual([['s0', 's1', 's2']]);
  });

  it('links nothing for a gap of zero or less', () => {
    const same = labelled(
      [
        { latitude: 50, longitude: 8 },
        { latitude: 50, longitude: 8 },
      ],
      's',
    );
    expect(labelsOf(linkComponents(same, 0))).toEqual([['s0'], ['s1']]);
    expect(labelsOf(linkComponents(same, -5))).toEqual([['s0'], ['s1']]);
  });

  it('links across the antimeridian, including a point at exactly 180°', () => {
    const points = labelled(
      [
        { latitude: 0, longitude: 179.999 },
        { latitude: 0, longitude: 180 },
        { latitude: 0, longitude: -179.999 },
        { latitude: 0, longitude: -180 + 200 * DEGREES_PER_METER },
      ],
      'm',
    );
    expect(labelsOf(linkComponents(points, 150))).toEqual([
      ['m0', 'm1', 'm2', 'm3'],
    ]);
  });

  it('links neighbours east and west of a cell boundary, and north and south of one', () => {
    const points = labelled(
      [
        { latitude: 0, longitude: -0.0001 },
        { latitude: 0, longitude: 0.0001 },
        { latitude: -0.0001, longitude: 0.0001 },
        { latitude: 0.0001, longitude: 0.0001 },
      ],
      'c',
    );
    expect(labelsOf(linkComponents(points, 30))).toEqual([
      ['c0', 'c1', 'c2', 'c3'],
    ]);
  });

  it('links near a pole across longitudes, where meridians converge', () => {
    const points = labelled(
      [
        { latitude: 89.999, longitude: 0 },
        { latitude: 89.999, longitude: 90 },
        { latitude: 89.999, longitude: 180 },
        { latitude: 89.999, longitude: -90 },
      ],
      'n',
    );
    expect(labelsOf(linkComponents(points, 200))).toEqual([
      ['n0', 'n1', 'n2', 'n3'],
    ]);
  });

  it('links points at the same high latitude whose longitudes are many grid columns apart only when close', () => {
    const chain = labelled(
      eastwardChain(
        { latitude: 75, longitude: -40 },
        { count: 4, spacingMeters: 290 },
      ),
      'h',
    );
    const far = labelled([{ latitude: 75, longitude: -39 }], 'f');
    expect(labelsOf(linkComponents([...chain, ...far], 300))).toEqual([
      ['h0', 'h1', 'h2', 'h3'],
      ['f0'],
    ]);
  });

  it('links a gap wider than the whole Earth into one component', () => {
    const points = labelled(
      [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 179 },
        { latitude: 45, longitude: -90 },
      ],
      'g',
    );
    expect(labelsOf(linkComponents(points, 30_000_000))).toEqual([
      ['g0', 'g1', 'g2'],
    ]);
  });
});

describe('gridNeighbourhood', () => {
  const gap = 300;

  function neighboursOf(
    points: readonly Coordinates[],
    position: number,
  ): number[] {
    return [...gridNeighbourhood(points, gap)(position)].sort((a, b) => a - b);
  }

  it('offers a point itself and the points within the gap', () => {
    const points = [
      { latitude: 48, longitude: 11 },
      { latitude: 48 + 250 * DEGREES_PER_METER, longitude: 11 },
      {
        latitude: 48,
        longitude:
          11 + (250 * DEGREES_PER_METER) / Math.cos((48 * Math.PI) / 180),
      },
    ];
    expect(neighboursOf(points, 0)).toEqual([0, 1, 2]);
  });

  it('leaves out points several cells away to the east, west, north and south', () => {
    const metersEast = (meters: number) =>
      (meters * DEGREES_PER_METER) / Math.cos((48 * Math.PI) / 180);
    const points = [
      { latitude: 48, longitude: 11 },
      { latitude: 48, longitude: 11 + metersEast(1000) },
      { latitude: 48, longitude: 11 - metersEast(1000) },
      { latitude: 48 + 1000 * DEGREES_PER_METER, longitude: 11 },
      { latitude: 48 - 1000 * DEGREES_PER_METER, longitude: 11 },
    ];
    expect(neighboursOf(points, 0)).toEqual([0]);
  });

  it('leaves out a point a few gaps east even at a high latitude', () => {
    const points = eastwardChain(
      { latitude: 80, longitude: 20 },
      { count: 2, spacingMeters: 1500 },
    );
    expect(neighboursOf(points, 0)).toEqual([0]);
    expect(neighboursOf(points, 1)).toEqual([1]);
  });

  it('offers neighbours across the antimeridian from both sides', () => {
    const points = [
      { latitude: 10, longitude: 179.999 },
      { latitude: 10, longitude: -179.999 },
      { latitude: 10, longitude: 0 },
    ];
    expect(neighboursOf(points, 0)).toEqual([0, 1]);
    expect(neighboursOf(points, 1)).toEqual([0, 1]);
  });
});

describe('linkComponentsWhere', () => {
  const chain = labelled(
    eastwardChain(
      { latitude: 48, longitude: 11 },
      { count: 6, spacingMeters: 250 },
    ),
    'c',
  );
  const blocking =
    (...blocked: [string, string][]) =>
    (a: Labelled, b: Labelled) =>
      !blocked.some(
        ([first, second]) =>
          (a.label === first && b.label === second) ||
          (a.label === second && b.label === first),
      );

  it('splits a chain where its only link is refused, either way round', () => {
    const expected = [
      ['c0', 'c1', 'c2'],
      ['c3', 'c4', 'c5'],
    ];
    expect(
      labelsOf(
        linkComponentsWhere(chain, {
          maxGapMeters: 300,
          isLinked: blocking(['c2', 'c3']),
        }),
      ),
    ).toEqual(expected);
    expect(
      labelsOf(
        linkComponentsWhere(chain, {
          maxGapMeters: 300,
          isLinked: blocking(['c3', 'c2']),
        }),
      ),
    ).toEqual(expected);
  });

  it('keeps a group together while another link still joins it', () => {
    // At 600 m every cache reaches the next two, so one refused gap leaves a way round.
    expect(
      labelsOf(
        linkComponentsWhere(chain, {
          maxGapMeters: 600,
          isLinked: blocking(['c2', 'c3']),
        }),
      ),
    ).toEqual([['c0', 'c1', 'c2', 'c3', 'c4', 'c5']]);
  });

  it('never links a gap over maxGapMeters, whatever isLinked says', () => {
    expect(
      linkComponentsWhere(chain, { maxGapMeters: 200, isLinked: () => true }),
    ).toHaveLength(6);
  });
});
