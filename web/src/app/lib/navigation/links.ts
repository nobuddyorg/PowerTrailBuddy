import type { Coordinates } from '../geocache/types';

// Six decimals is about 10 cm, finer than any GPS a walker carries.
const COORDINATE_DIGITS = 6;

function coordinatePair({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(COORDINATE_DIGITS)},${longitude.toFixed(COORDINATE_DIGITS)}`;
}

// encodeURIComponent leaves parentheses alone, but they delimit the label in a geo: query.
function encodeLabel(label: string): string {
  return encodeURIComponent(label)
    .replaceAll('(', '%28')
    .replaceAll(')', '%29');
}

/** A `geo:` URI with a label, which Android hands to the user's navigation app. */
export function geoUri(target: Coordinates, label: string): string {
  const pair = coordinatePair(target);
  return `geo:${pair}?q=${pair}(${encodeLabel(label)})`;
}

/** The cache's listing on geocaching.com, through its official short-link service; the Geocaching app opens it when installed. */
export function cachePageUrl(code: string): string {
  return `https://coord.info/${encodeURIComponent(code)}`;
}

/** Walking directions in Google Maps (app or web) from wherever the phone is. */
export function walkingDirectionsUrl(target: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coordinatePair(target)}&travelmode=walking`;
}

/** Where a Pocket Query is created on geocaching.com. */
export const POCKET_QUERY_URL = 'https://www.geocaching.com/pocket/';

/** Where the field-notes file is uploaded to log every visit at once. */
export const DRAFTS_UPLOAD_URL =
  'https://www.geocaching.com/my/uploadfieldnotes.aspx';
