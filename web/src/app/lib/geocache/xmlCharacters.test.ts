import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { withoutNotXmlCharacters, withoutNotXmlContent } from './xmlCharacters';

const FORBIDDEN =
  'A\u0000B\u0001C\u0008D\u000BE\u000CF\u001FG\uFFFEH\uFFFFI\uD800J\uDFFFK';
const ALLOWED = 'Tab\there\nline\r ä€\uD7FF\uE000\uFFFD😀\u{10FFFF}';

describe('withoutNotXmlCharacters', () => {
  it('drops each character XML 1.0 forbids', () => {
    expect(withoutNotXmlCharacters(FORBIDDEN)).toBe('ABCDEFGHIJK');
  });

  it('keeps every character XML 1.0 allows, at the edges of each range', () => {
    expect(withoutNotXmlCharacters(ALLOWED)).toBe(ALLOWED);
  });

  it('keeps a surrogate pair and drops a lone half of one', () => {
    expect(withoutNotXmlCharacters('😀\uD83D|\uDE00')).toBe('😀|');
  });
});

describe('withoutNotXmlContent', () => {
  it('drops raw forbidden characters as well', () => {
    expect(withoutNotXmlContent(`<a>${FORBIDDEN}</a>`)).toBe(
      '<a>ABCDEFGHIJK</a>',
    );
  });

  const dropped: [string, string][] = [
    ['decimal NUL', '&#0;'],
    ['decimal U+0001', '&#1;'],
    ['decimal vertical tab', '&#11;'],
    ['decimal U+001F, zero-padded', '&#0031;'],
    ['hex U+0001', '&#x1;'],
    ['hex U+000B, zero-padded', '&#x000B;'],
    ['hex U+001F in lower case', '&#x1f;'],
    ['hex U+001F in upper case', '&#x1F;'],
    ['hex surrogate', '&#xD800;'],
    ['decimal surrogate', '&#57343;'],
    ['hex U+FFFE', '&#xFFFE;'],
    ['hex U+FFFF in lower case', '&#xffff;'],
    ['just past the last code point', '&#x110000;'],
    ['far past the last code point', '&#99999999999999999999;'],
  ];
  for (const [label, reference] of dropped) {
    it(`drops a reference to ${label}`, () => {
      expect(withoutNotXmlContent(`a${reference}b`)).toBe('ab');
    });
  }

  const kept: [string, string][] = [
    ['decimal tab', '&#9;'],
    ['hex line feed', '&#xA;'],
    ['decimal carriage return', '&#13;'],
    ['decimal space', '&#32;'],
    ['hex space', '&#x20;'],
    ['decimal ä', '&#228;'],
    ['hex ü, zero-padded', '&#x00FC;'],
    ['hex U+D7FF', '&#xD7FF;'],
    ['hex U+E000', '&#xe000;'],
    ['hex U+FFFD', '&#xFFFD;'],
    ['hex U+10000', '&#x10000;'],
    ['the last code point', '&#x10FFFF;'],
    ['the last code point, in decimal', '&#1114111;'],
  ];
  for (const [label, reference] of kept) {
    it(`keeps a reference to ${label}`, () => {
      expect(withoutNotXmlContent(`a${reference}b`)).toBe(`a${reference}b`);
    });
  }

  it('drops each of several references and keeps the text between them', () => {
    expect(withoutNotXmlContent('x&#1;y&#228;z&#x2;w')).toBe('xy&#228;zw');
  });

  it('leaves what only looks like a reference alone', () => {
    const text = '&amp;#1; &#X1; &#x; &#; &#1 &#xG; &#-1; & #1;';
    expect(withoutNotXmlContent(text)).toBe(text);
  });

  it('keeps a document with nothing forbidden as it is', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (text) => {
        const clean = withoutNotXmlCharacters(text).replaceAll('&', '');
        expect(withoutNotXmlContent(clean)).toBe(clean);
      }),
    );
  });
});
