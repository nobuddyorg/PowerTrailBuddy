import { describe, expect, it } from 'vitest';

import { nearestParking } from './parking';
import { makeCache } from './ui.test-support';

describe('nearestParking', () => {
  const near = { latitude: 47.501, longitude: 9.5 };
  const far = { latitude: 47.51, longitude: 9.5 };
  const start = { latitude: 47.5, longitude: 9.5 };

  it('picks the listed spot closest to the point', () => {
    const caches = [
      makeCache({ code: 'GCSU1', parking: far }),
      makeCache({ code: 'GCSU2' }),
      makeCache({ code: 'GCSU3', parking: near }),
    ];
    expect(nearestParking(caches, start)).toEqual(near);
    expect(nearestParking(caches, far)).toEqual(far);
  });

  it('keeps the first of two equally close spots', () => {
    const twin = { latitude: 47.499, longitude: 9.5 };
    expect(
      nearestParking(
        [makeCache({ parking: near }), makeCache({ parking: twin })],
        start,
      ),
    ).toEqual(near);
  });

  it('has none when no cache lists one', () => {
    expect(nearestParking([makeCache()], start)).toBeUndefined();
  });
});
