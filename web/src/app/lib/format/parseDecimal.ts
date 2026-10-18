// Digits with at most one separator; a comma counts as the decimal point, as German keyboards type it.
const DECIMAL = /^\d+(?:[.,]\d+)?$/;

/** A non-negative number as typed, "1,5" and "1.5" alike; NaN for anything else, empty included. */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  return DECIMAL.test(trimmed) ? Number(trimmed.replace(',', '.')) : NaN;
}
