import { describe, expect, it } from 'vitest';

import { makeCache } from '../trails/trails.test-support';
import { pairKey } from '../trails/walkingDistances';
import { parseTable, ROUTER_ORIGIN, tableUrl } from './osrmTable';

const a = makeCache({ code: 'GCRA', latitude: 48.1, longitude: 11.5 });
const b = makeCache({ code: 'GCRB', latitude: 48.1012345678, longitude: 11.5 });
const c = makeCache({ code: 'GCRC', latitude: -33.9, longitude: -70.6 });

describe('tableUrl', () => {
  it('asks the foot router for distances among the caches, longitude first, six decimals', () => {
    expect(tableUrl([a, b, c])).toBe(
      `${ROUTER_ORIGIN}/routed-foot/table/v1/foot/` +
        '11.500000,48.100000;11.500000,48.101235;-70.600000,-33.900000' +
        '?annotations=distance',
    );
  });

  it('goes to the FOSSGIS routing server', () => {
    expect(ROUTER_ORIGIN).toBe('https://routing.openstreetmap.de');
  });
});

describe('parseTable', () => {
  it('reads every pair once, in meters', () => {
    const body = {
      code: 'Ok',
      distances: [
        [0, 140.5, 900],
        [140.5, 0, 800],
        [900, 800, 0],
      ],
    };
    expect(parseTable([a, b, c], body)).toEqual([
      [pairKey(a, b), 140.5],
      [pairKey(a, c), 900],
      [pairKey(b, c), 800],
    ]);
  });

  it('takes the longer way where there and back differ', () => {
    const body = {
      code: 'Ok',
      distances: [
        [0, 100],
        [130, 0],
      ],
    };
    expect(parseTable([a, b], body)).toEqual([[pairKey(a, b), 130]]);
    const reversed = {
      code: 'Ok',
      distances: [
        [0, 130],
        [100, 0],
      ],
    };
    expect(parseTable([a, b], reversed)).toEqual([[pairKey(a, b), 130]]);
  });

  it('makes a pair with no route either way round infinitely far', () => {
    expect(
      parseTable([a, b], {
        code: 'Ok',
        distances: [
          [0, null],
          [50, 0],
        ],
      }),
    ).toEqual([[pairKey(a, b), Infinity]]);
    expect(
      parseTable([a, b], {
        code: 'Ok',
        distances: [
          [0, 50],
          [null, 0],
        ],
      }),
    ).toEqual([[pairKey(a, b), Infinity]]);
  });

  it('refuses an error answer, naming its code', () => {
    expect(() => parseTable([a, b], { code: 'TooBig' })).toThrow(
      'Routing failed: TooBig',
    );
    expect(() => parseTable([a, b], 'Bad Gateway')).toThrow(
      'Routing failed: no answer',
    );
    expect(() => parseTable([a, b], null)).toThrow('Routing failed: no answer');
    expect(() => parseTable([a, b], [])).toThrow('Routing failed: no answer');
  });

  it('refuses a table that does not fit the caches', () => {
    const tooFewRows = { code: 'Ok', distances: [[0, 1]] };
    const shortRow = { code: 'Ok', distances: [[0, 1], [1]] };
    const notNumbers = {
      code: 'Ok',
      distances: [
        [0, '1'],
        [1, 0],
      ],
    };
    const notFinite = {
      code: 'Ok',
      distances: [
        [0, Infinity],
        [1, 0],
      ],
    };
    const rowNotList = { code: 'Ok', distances: [[0, 1], 'x'] };
    for (const body of [
      { code: 'Ok' },
      tooFewRows,
      shortRow,
      notNumbers,
      notFinite,
      rowNotList,
    ])
      expect(() => parseTable([a, b], body)).toThrow(
        'Routing answer without a distance table',
      );
  });
});
