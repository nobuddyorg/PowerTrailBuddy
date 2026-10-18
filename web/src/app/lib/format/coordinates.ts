import type { Coordinates } from '../geocache/types';

const THOUSANDTHS_PER_DEGREE = 60_000;
const THOUSANDTHS_PER_MINUTE = 1000;

function hemispherePart(
  value: number,
  {
    positive,
    negative,
    degreeDigits,
  }: { positive: string; negative: string; degreeDigits: number },
): string {
  // Integer thousandths of a minute, so 59.9996′ carries into the next degree instead of printing 60.000′.
  const thousandths = Math.round(Math.abs(value) * THOUSANDTHS_PER_DEGREE);
  const degrees = Math.floor(thousandths / THOUSANDTHS_PER_DEGREE);
  const rest = thousandths % THOUSANDTHS_PER_DEGREE;
  const minutes = Math.floor(rest / THOUSANDTHS_PER_MINUTE);
  const fraction = rest % THOUSANDTHS_PER_MINUTE;
  // Signed and rounded like the digits, so a value that prints as 0° 00.000′ is never south or west.
  const hemisphere =
    Math.round(value * THOUSANDTHS_PER_DEGREE) < 0 ? negative : positive;
  return `${hemisphere} ${String(degrees).padStart(degreeDigits, '0')}° ${String(minutes).padStart(2, '0')}.${String(fraction).padStart(3, '0')}′`;
}

/** Degrees and decimal minutes as geocachers write them: "N 48° 08.123′ E 011° 34.567′". */
export function formatCoordinates({
  latitude,
  longitude,
}: Coordinates): string {
  const north = hemispherePart(latitude, {
    positive: 'N',
    negative: 'S',
    degreeDigits: 2,
  });
  const east = hemispherePart(longitude, {
    positive: 'E',
    negative: 'W',
    degreeDigits: 3,
  });
  return `${north} ${east}`;
}
