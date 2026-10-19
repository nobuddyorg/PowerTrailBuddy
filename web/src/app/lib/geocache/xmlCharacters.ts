// Everything XML 1.0 cannot carry: C0 controls but tab, LF and CR; lone surrogates; U+FFFE and U+FFFF.
const NOT_XML_CHARACTER =
  /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

// A numeric character reference as XML 1.0 spells it: `&#` and decimal digits, or `&#x` and hex digits.
const CHARACTER_REFERENCE = /&#(?:x([\dA-Fa-f]+)|(\d+));/g;

const LAST_CODE_POINT = 0x10ffff;

/** The text without the characters XML 1.0 cannot carry. */
export function withoutNotXmlCharacters(text: string): string {
  return text.replace(NOT_XML_CHARACTER, '');
}

function isXmlCodePoint(codePoint: number): boolean {
  return (
    codePoint <= LAST_CODE_POINT &&
    withoutNotXmlCharacters(String.fromCodePoint(codePoint)) !== ''
  );
}

function codePointOf(hex: string | undefined, decimal: string): number {
  return hex === undefined ? Number(decimal) : Number.parseInt(hex, 16);
}

/** A document without what XML 1.0 forbids in it, raw or as a numeric character reference, either of which a strict parser refuses whole. */
export function withoutNotXmlContent(xml: string): string {
  return withoutNotXmlCharacters(xml).replace(
    CHARACTER_REFERENCE,
    (reference, hex: string | undefined, decimal: string) =>
      isXmlCodePoint(codePointOf(hex, decimal)) ? reference : '',
  );
}
