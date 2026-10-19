'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { Geocache } from '../../lib/geocache/types';
import type { Trail } from '../../lib/trails/types';
import { pickHeading } from '../../lib/ui-logic/heading';
import { SNAP_FRACTION, type SheetSnap } from '../../lib/ui-logic/sheet';
import { arrangeTrails } from '../../lib/ui-logic/trailCards';
import type { TrailFilter } from '../../lib/ui-logic/trailSort';
import type { AppState } from '../../useAppState';
import { useMediaQuery } from '../../useBrowserState';
import { useFollow } from '../../useFollow';
import type { GeolocationState } from '../../useGeolocation';
import type { RouteCheck } from '../../useWalkingDistances';
import { BottomSheet } from '../BottomSheet';
import MapView from '../Map';
import { overviewContent } from '../Map/content';
import type { MapFrame, MapPosition } from '../Map/types';
import { useMapLabels } from '../Map/useMapLabels';
import { MapControls } from './MapControls';
import { PanelContent } from './PanelContent';
import { usePanel } from './usePanel';

interface MainViewProps {
  app: AppState;
  trails: readonly Trail[];
  pending: boolean;
  routeCheck: RouteCheck;
  location: GeolocationState;
  startLocation: () => void;
  onOpenSettings: () => void;
}

function framePoints(
  trails: readonly Trail[],
  caches: readonly Geocache[],
): Geocache[] {
  const trailCaches = trails.flatMap((trail) => trail.caches);
  return trailCaches.length > 0 ? trailCaches : [...caches];
}

/** The map with every trail and the panel beside it (wide screens) or over it (phones). */
export function MainView({
  app,
  trails,
  pending,
  routeCheck,
  location,
  startLocation,
  onOpenSettings,
}: MainViewProps) {
  const { t } = useI18n();
  const labels = useMapLabels();
  const wide = useMediaQuery('(min-width: 1024px)');
  const panel = usePanel();
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [filters, setFilters] = useState<TrailFilter[]>([]);
  const [frame, setFrame] = useState<MapFrame>(() => ({
    id: 0,
    points: framePoints(trails, app.caches),
  }));
  const [framedTrails, setFramedTrails] = useState(trails.length > 0);
  const { following, locate, stopFollowing } = useFollow({
    location,
    start: startLocation,
    initiallyFollowing: false,
  });

  const located = location.status === 'located' ? location : undefined;
  const position = located?.position;

  // The first search can finish after the first paint; the map then frames the trails once.
  if (!framedTrails && trails.length > 0) {
    setFramedTrails(true);
    setFrame((current) => ({
      id: current.id + 1,
      points: framePoints(trails, []),
    }));
  }

  const view = panel.view;
  const selectedTrailId = view.kind === 'trail' ? view.trailId : '';
  const focusCode = view.kind === 'cache' ? view.code : '';

  const content = useMemo(
    () =>
      overviewContent({
        caches: app.caches,
        trails,
        selectedTrailId,
        focusCode,
        locallyFound: app.locallyFound,
        ignored: app.ignored,
        showOtherCaches: app.preferences.showOtherCaches,
      }),
    [
      app.caches,
      trails,
      selectedTrailId,
      focusCode,
      app.locallyFound,
      app.ignored,
      app.preferences.showOtherCaches,
    ],
  );

  const cards = useMemo(
    () =>
      arrangeTrails(trails, { sort: app.preferences.sort, filters, position }),
    [trails, app.preferences.sort, filters, position],
  );

  const mapPosition = useMemo<MapPosition | undefined>(() => {
    if (!located) return undefined;
    const heading = pickHeading({
      gpsHeading: located.gpsHeading,
      speed: located.speed,
    });
    return {
      coordinates: located.position,
      accuracyMeters: located.accuracyMeters,
      heading: heading.source === 'none' ? undefined : heading.degrees,
    };
  }, [located]);

  const follow = useMemo(
    () => (following && position ? [position] : []),
    [following, position],
  );

  const showAndFrame = (points: Geocache[]) => {
    stopFollowing();
    setFrame((current) => ({ id: current.id + 1, points }));
    if (!wide && snap === 'peek') setSnap('half');
  };

  const selectTrail = (trailId: string) => {
    const trail = trails.find((each) => each.id === trailId);
    if (!trail) return;
    panel.open({ kind: 'trail', trailId });
    showAndFrame(trail.caches);
  };

  const selectCache = (code: string) => {
    const cache = app.caches.find((each) => each.code === code);
    if (!cache) return;
    panel.open({ kind: 'cache', code });
    showAndFrame([cache]);
  };

  const panelContent = (
    <PanelContent
      app={app}
      view={view}
      backToList={panel.backToList}
      onBack={panel.back}
      trails={trails}
      cards={cards}
      pending={pending}
      routeCheck={routeCheck}
      filters={filters}
      onFiltersChange={setFilters}
      position={position}
      onSelectTrail={selectTrail}
      onSelectCache={selectCache}
      onOpenSettings={onOpenSettings}
    />
  );

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <MapView
            content={content}
            position={mapPosition}
            frame={frame}
            follow={follow}
            coveredBottom={wide ? 0 : SNAP_FRACTION[snap]}
            onSelectTrail={selectTrail}
            onSelectCache={selectCache}
            onUserPan={stopFollowing}
            labels={labels}
          />
        </div>
        <MapControls
          following={following && position !== undefined}
          onLocate={locate}
          showOtherCaches={app.preferences.showOtherCaches}
          onToggleOtherCaches={() =>
            app.setPreferences({
              showOtherCaches: !app.preferences.showOtherCaches,
            })
          }
        />
      </div>
      {wide ? (
        <aside
          aria-label={t('panel.label')}
          data-testid="side-panel"
          className="w-[27rem] shrink-0 overflow-y-auto border-l border-border bg-background px-4 py-4"
        >
          {panelContent}
        </aside>
      ) : (
        <BottomSheet
          snap={snap}
          onSnapChange={setSnap}
          label={t('panel.label')}
        >
          {panelContent}
        </BottomSheet>
      )}
    </div>
  );
}
