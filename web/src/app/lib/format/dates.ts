// The stored log dates are calendar days without a zone; formatting them in UTC keeps the day as written.

/** A calendar day ("2026-03-12") in the locale's medium style: "12.03.2026", "12 Mar 2026". */
export function formatDay(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** A moment in the given time zone, date and time: "12.03.2026, 14:05". */
export function formatMoment(
  isoMoment: string,
  { locale, timeZone }: { locale: string; timeZone: string },
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(isoMoment));
}
