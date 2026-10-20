import type { CircleMarkerOptions, PolylineOptions } from 'leaflet';

import type { LineTone, MapMarker, MarkerTone } from './types';

// Fixed colours: the canvas renderer cannot read CSS variables.
const WHITE = '#ffffff';
const MUTED = '#7b8579';
const WARNING = '#d97706';
const TARGET = '#f97316';

export function markerStyle({
  tone,
  color,
  warning,
}: MapMarker): CircleMarkerOptions {
  const ring = warning
    ? { color: WARNING, weight: 3 }
    : { color: WHITE, weight: 1.5 };
  const styles: Record<MarkerTone, CircleMarkerOptions> = {
    trail: { radius: 6, fillColor: color, fillOpacity: 0.95, ...ring },
    selected: {
      radius: 7.5,
      fillColor: color,
      fillOpacity: 1,
      ...ring,
      weight: warning ? 3 : 2,
    },
    faded: {
      radius: 4.5,
      fillColor: color,
      fillOpacity: 0.35,
      color: WHITE,
      weight: 1,
      opacity: 0.5,
    },
    other: {
      radius: 4,
      fillColor: MUTED,
      fillOpacity: 0.6,
      ...ring,
      weight: warning ? 2 : 1,
    },
    disabled: {
      radius: 4,
      fillColor: WHITE,
      fillOpacity: 1,
      color: MUTED,
      weight: 2,
      dashArray: '2 2',
    },
    found: { radius: 0, opacity: 0, fillOpacity: 0 },
    done: {
      radius: 5,
      fillColor: '#9ca3af',
      fillOpacity: 0.9,
      color: WHITE,
      weight: 1.5,
    },
    dnf: {
      radius: 5,
      fillColor: WHITE,
      fillOpacity: 1,
      color: '#b42318',
      weight: 2.5,
    },
    target: {
      radius: 11,
      fillColor: TARGET,
      fillOpacity: 1,
      color: WHITE,
      weight: 3,
    },
  };
  return styles[tone];
}

export function lineStyle(tone: LineTone, color: string): PolylineOptions {
  const styles: Record<LineTone, PolylineOptions> = {
    trail: { color, weight: 4, opacity: 0.85 },
    selected: { color, weight: 6, opacity: 1 },
    faded: { color, weight: 3, opacity: 0.3 },
    walk: { color, weight: 5, opacity: 0.6 },
    guide: { color: TARGET, weight: 3, opacity: 0.9, dashArray: '6 8' },
  };
  return styles[tone];
}
