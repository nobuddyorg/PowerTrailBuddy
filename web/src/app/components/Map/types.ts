import type { Coordinates } from '../../lib/geocache/types';

/** How a cache is drawn; `faded` is an unselected trail while one is selected, `other` a cache on no trail. */
export type MarkerTone =
  | 'trail'
  | 'selected'
  | 'faded'
  | 'other'
  | 'disabled'
  | 'found'
  | 'done'
  | 'dnf'
  | 'target';

export interface MapMarker extends Coordinates {
  /** The cache code: React-style key and what a tap selects. */
  code: string;
  tone: MarkerTone;
  /** The trail's colour for 'trail' and 'selected' markers; empty otherwise. */
  color: string;
  /** A DNF streak or a maintenance request: drawn with a warning ring. */
  warning: boolean;
  /** Plain text from the imported file; the map sets it as text, never as HTML. */
  label: string;
}

export type LineTone = 'trail' | 'selected' | 'faded' | 'walk' | 'guide';

export interface MapLine {
  key: string;
  tone: LineTone;
  color: string;
  points: Coordinates[];
  /** The trail a tap on this line selects; empty for none. */
  trailId: string;
}

/** A trail's rank, drawn at its first cache. */
export interface MapBadge extends Coordinates {
  trailId: string;
  rank: number;
  color: string;
  emphasised: boolean;
}

export interface MapContent {
  markers: MapMarker[];
  lines: MapLine[];
  badges: MapBadge[];
  parking: Coordinates[];
}

/** Numbered, so asking for the same view twice is a new object and still reads as a change. */
export interface MapFrame {
  id: number;
  points: Coordinates[];
}

export interface MapPosition {
  coordinates: Coordinates;
  accuracyMeters: number;
  /** Degrees clockwise from north, when known. */
  heading?: number;
}

export interface MapProps {
  content: MapContent;
  position?: MapPosition;
  /** A view to fit once: replaced to ask again. */
  frame?: MapFrame;
  /** Points to keep in view as they move; empty to leave the view to the user. */
  follow: Coordinates[];
  /** Share of the map's height covered by an overlay at the bottom, so framing keeps clear of it. */
  coveredBottom: number;
  onSelectTrail?: (trailId: string) => void;
  onSelectCache?: (code: string) => void;
  /** The user moved the map by hand, which ends following. */
  onUserPan?: () => void;
  /** Already translated; read once when the map loads. */
  labels: {
    region: string;
    attribution: string;
    zoomIn: string;
    zoomOut: string;
  };
}
