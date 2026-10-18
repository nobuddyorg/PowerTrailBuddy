import { cacheHealth } from '../../lib/geocache/health';
import type { Coordinates, Geocache } from '../../lib/geocache/types';
import type { Trail } from '../../lib/trails/types';
import type { WalkState } from '../../lib/walk/walk';
import type {
  MapBadge,
  MapContent,
  MapLine,
  MapMarker,
  MarkerTone,
} from './types';

// Distinct on OpenStreetMap's greens and greys; orange stays free for the walk's target.
export const TRAIL_COLORS = [
  '#1d6b3a',
  '#2563eb',
  '#9333ea',
  '#db2777',
  '#0e7490',
  '#a16207',
  '#4f46e5',
  '#be123c',
];

export function trailColor(rank: number): string {
  return TRAIL_COLORS[(rank - 1) % TRAIL_COLORS.length];
}

const isDoubtful = (cache: Geocache) => {
  const health = cacheHealth(cache);
  return health === 'dnf-streak' || health === 'needs-maintenance';
};

function marker(
  cache: Geocache,
  { tone, color = '' }: { tone: MarkerTone; color?: string },
): MapMarker {
  return {
    code: cache.code,
    latitude: cache.latitude,
    longitude: cache.longitude,
    tone,
    color,
    warning: isDoubtful(cache),
    label: `${cache.code} · ${cache.name}`,
  };
}

function parkingOf(caches: readonly Geocache[]): Coordinates[] {
  const seen = new Set<string>();
  const parking: Coordinates[] = [];
  for (const { parking: spot } of caches) {
    if (!spot) continue;
    const key = `${spot.latitude},${spot.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parking.push(spot);
  }
  return parking;
}

function trailTone({
  selected,
  faded,
}: {
  selected: boolean;
  faded: boolean;
}): 'selected' | 'faded' | 'trail' {
  if (selected) return 'selected';
  return faded ? 'faded' : 'trail';
}

interface OverviewInput {
  caches: readonly Geocache[];
  trails: readonly Trail[];
  selectedTrailId: string;
  /** A cache the user picked, drawn as the highlight on top. */
  focusCode: string;
  locallyFound: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  showOtherCaches: boolean;
}

function otherTone(
  cache: Geocache,
  { locallyFound, ignored }: Pick<OverviewInput, 'locallyFound' | 'ignored'>,
): MarkerTone {
  if (cache.found || locallyFound.has(cache.code)) return 'found';
  if (!cache.available || cache.archived || ignored.has(cache.code))
    return 'disabled';
  return 'other';
}

/** Every trail in its colour with its rank, the selected one emphasised and the others faded; other caches dimmed. */
export function overviewContent(input: OverviewInput): MapContent {
  const { caches, trails, selectedTrailId, focusCode, showOtherCaches } = input;
  const hasSelection = trails.some((trail) => trail.id === selectedTrailId);
  const onTrail = new Set<string>();
  const trailMarkers: MapMarker[] = [];
  const selectedMarkers: MapMarker[] = [];
  const lines: MapLine[] = [];
  const badges: MapBadge[] = [];
  trails.forEach((trail, index) => {
    const color = trailColor(index + 1);
    const selected = trail.id === selectedTrailId;
    const faded = hasSelection && !selected;
    const tone = trailTone({ selected, faded });
    for (const cache of trail.caches) {
      onTrail.add(cache.code);
      (selected ? selectedMarkers : trailMarkers).push(
        marker(cache, { tone, color }),
      );
    }
    lines.push({
      key: trail.id,
      tone,
      color,
      points: trail.caches,
      trailId: trail.id,
    });
    badges.push({
      ...trail.caches[0],
      trailId: trail.id,
      rank: index + 1,
      color,
      emphasised: !faded,
    });
  });
  const others = showOtherCaches
    ? caches
        .filter((cache) => !onTrail.has(cache.code))
        .map((cache) => marker(cache, { tone: otherTone(cache, input) }))
    : [];
  const selectedTrail = trails.find((trail) => trail.id === selectedTrailId);
  const focused = caches.find((cache) => cache.code === focusCode);
  const isFocused = (entry: MapMarker) => entry.code === focusCode;
  // Drawn bottom to top: dimmed caches, other trails, the selected trail, then the picked cache over everything.
  return {
    markers: [
      ...[...others, ...trailMarkers, ...selectedMarkers].filter(
        (entry) => !isFocused(entry),
      ),
      ...(focused ? [marker(focused, { tone: 'target' })] : []),
    ],
    lines: [
      ...lines.filter((line) => line.tone !== 'selected'),
      ...lines.filter((line) => line.tone === 'selected'),
    ],
    badges,
    parking: selectedTrail ? parkingOf(selectedTrail.caches) : [],
  };
}

const walkTone = (
  walk: WalkState,
  code: string,
  targetCode: string,
): MarkerTone => {
  if (code === targetCode) return 'target';
  switch (walk.outcomes[code]?.outcome) {
    case 'found':
      return 'found';
    case 'dnf':
      return 'dnf';
    case 'skipped':
      return 'done';
    default:
      return 'selected';
  }
};

/** The walk's caches in walking order, done ones settled, the target last so nothing covers it; a guide line to it. */
export function walkContent({
  caches,
  otherCaches,
  walk,
  targetCode,
  position,
}: {
  caches: readonly Geocache[];
  /** Imported caches outside the walk, drawn dimmed underneath; empty to hide them. */
  otherCaches: readonly Geocache[];
  walk: WalkState;
  targetCode: string;
  position?: Coordinates;
}): MapContent {
  const color = trailColor(1);
  const markers = caches.map((cache) =>
    marker(cache, { tone: walkTone(walk, cache.code, targetCode), color }),
  );
  const target = caches.find((cache) => cache.code === targetCode);
  const lines: MapLine[] = [
    { key: 'walk', tone: 'walk', color, points: [...caches], trailId: '' },
  ];
  if (target && position) {
    lines.push({
      key: 'guide',
      tone: 'guide',
      color: '',
      points: [position, target],
      trailId: '',
    });
  }
  return {
    markers: [
      ...otherCaches.map((cache) => marker(cache, { tone: 'other' })),
      ...markers.filter((entry) => entry.tone !== 'target'),
      ...markers.filter((entry) => entry.tone === 'target'),
    ],
    lines,
    badges: [],
    parking: parkingOf(caches),
  };
}
