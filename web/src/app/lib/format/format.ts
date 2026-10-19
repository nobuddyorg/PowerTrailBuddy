// Pure display formatting: numbers in the given locale, units the same in German and English.

// A no-break space, so a value never wraps away from its unit.
const UNIT_SPACE = ' ';
const METERS_PER_KILOMETER = 1000;
const MINUTES_PER_HOUR = 60;

function decimal(value: number, locale: string, fractionDigits: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** "850 m" up to a kilometre, then "1,2 km" (German) or "1.2 km" (English). */
export function formatDistance(meters: number, locale: string): string {
  // Two significant digits, never finer than a metre: below 100 a walker counts every metre, above it tens will do.
  const step = 10 ** Math.max(0, Math.floor(Math.log10(meters)) - 1);
  const rounded = Math.round(meters / step) * step;
  if (rounded < METERS_PER_KILOMETER) {
    return `${decimal(rounded, locale, 0)}${UNIT_SPACE}m`;
  }
  return `${decimal(meters / METERS_PER_KILOMETER, locale, 1)}${UNIT_SPACE}km`;
}

/** "45 min", "2 h", "2 h 15 min", rounded to the minute. */
export function formatDuration(minutes: number, locale: string): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  const minutePart = `${decimal(rest, locale, 0)}${UNIT_SPACE}min`;
  if (hours === 0) return minutePart;
  const hourPart = `${decimal(hours, locale, 0)}${UNIT_SPACE}h`;
  return rest === 0 ? hourPart : `${hourPart} ${minutePart}`;
}

/** A difficulty or terrain rating: "1,5" or "2", never "2,0". */
export function formatRating(rating: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(rating);
}

/** Always one decimal, so a list of rates lines up: "12,0", "9,5". */
export function formatRate(rate: number, locale: string): string {
  return decimal(rate, locale, 1);
}
