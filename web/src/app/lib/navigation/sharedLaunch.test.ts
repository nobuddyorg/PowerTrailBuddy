import { describe, expect, it } from 'vitest';

import { isSharedLaunch, withoutSharedParam } from './sharedLaunch';

describe('isSharedLaunch', () => {
  it.each([
    ['?shared=1', true],
    ['?lang=en&shared=1', true],
    ['', false],
    ['?shared=0', false],
    ['?shared', false],
    ['?shared=1x', false],
    ['?notshared=1', false],
  ])('reads "%s" as %s', (search, expected) => {
    expect(isSharedLaunch(search)).toBe(expected);
  });
});

describe('withoutSharedParam', () => {
  it('drops the marker and keeps the path, other parameters and the hash', () => {
    expect(
      withoutSharedParam(
        'https://example.test/PowerTrailBuddy/?a=1&shared=1&b=2#top',
      ),
    ).toBe('https://example.test/PowerTrailBuddy/?a=1&b=2#top');
  });

  it('leaves no dangling question mark when the marker was all there was', () => {
    expect(
      withoutSharedParam('https://example.test/PowerTrailBuddy/?shared=1'),
    ).toBe('https://example.test/PowerTrailBuddy/');
  });

  it('changes nothing in a URL without the marker', () => {
    expect(withoutSharedParam('https://example.test/x/?a=1')).toBe(
      'https://example.test/x/?a=1',
    );
  });
});
