'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { Geocache } from '../../lib/geocache/types';
import type { TrailSettings } from '../../lib/trails/types';
import { remainingWalkMinutes } from '../../lib/ui-logic/walkStats';
import {
  nextCode,
  walkPace,
  walkProgress,
  type WalkOutcome,
  type WalkState,
} from '../../lib/walk/walk';
import { useNow } from '../../useBrowserState';
import { useCompass } from '../../useCompass';
import { useFollow } from '../../useFollow';
import type { GeolocationState } from '../../useGeolocation';
import { useWakeLock } from '../../useWakeLock';
import { Icon } from '../Icon';
import MapView from '../Map';
import { walkContent } from '../Map/content';
import type { MapPosition } from '../Map/types';
import { useMapLabels } from '../Map/useMapLabels';
import { MapControls } from '../MainView/MapControls';
import { buttonClasses } from '../ui/classes';
import { TargetCard } from './TargetCard';
import { useWalkGuide } from './useWalkGuide';
import { WalkStats } from './WalkStats';
import { WalkSummary } from './WalkSummary';

interface WalkViewProps {
  walk: WalkState;
  caches: readonly Geocache[];
  settings: TrailSettings;
  location: GeolocationState;
  startLocation: () => void;
  showOtherCaches: boolean;
  onToggleOtherCaches: () => void;
  onRecord: (code: string, outcome: WalkOutcome) => void;
  onUndo: () => void;
  onReverse: () => void;
  onEnd: () => void;
}

const TICK_MS = 5_000;

/** The guided walk: the map, the next cache with a compass, logging, live numbers, and the summary at the end. */
export function WalkView(props: WalkViewProps) {
  const { walk, caches, settings, location } = props;
  const { t } = useI18n();
  const labels = useMapLabels();
  const [finishedEarly, setFinishedEarly] = useState(false);
  const openCode = nextCode(walk);
  const targetCode = finishedEarly ? undefined : openCode;
  const done = targetCode === undefined;

  useWakeLock(!done);
  const compass = useCompass(!done);
  const now = useNow(TICK_MS, !done);
  const { following, locate, stopFollowing } = useFollow({
    location,
    start: props.startLocation,
    initiallyFollowing: true,
  });

  const byCode = useMemo(
    () => new Map(caches.map((cache) => [cache.code, cache])),
    [caches],
  );
  const walkCaches = useMemo(
    () =>
      walk.codes
        .map((code) => byCode.get(code))
        .filter((cache) => cache !== undefined),
    [walk.codes, byCode],
  );
  const walkCodes = useMemo(() => new Set(walk.codes), [walk.codes]);
  const target = byCode.get(targetCode ?? '');
  const located = location.status === 'located' ? location : undefined;
  const position = located?.position;
  const guide = useWalkGuide({
    target,
    location,
    compassHeading: compass.heading,
  });

  const progress = walkProgress(walk);
  const pace = walkPace(walk, new Date(now).toISOString());
  // Done caches stay in front of the walk's codes, so the first is where it began.
  const remainingMinutes = remainingWalkMinutes({
    position,
    remaining: walkCaches.filter(
      (cache) => !Object.hasOwn(walk.outcomes, cache.code),
    ),
    returnTo: walkCaches[0],
    settings,
  });

  const content = useMemo(
    () =>
      walkContent({
        caches: walkCaches,
        otherCaches: props.showOtherCaches
          ? caches.filter((cache) => !walkCodes.has(cache.code))
          : [],
        walk,
        targetCode: targetCode ?? '',
        position,
      }),
    [
      walkCaches,
      props.showOtherCaches,
      caches,
      walkCodes,
      walk,
      targetCode,
      position,
    ],
  );
  // Framed again when the walk ends, as following stops then.
  const frame = useMemo(
    () => ({ id: done ? 1 : 0, points: walkCaches }),
    [walkCaches, done],
  );
  const follow = useMemo(
    () => (following && position && target ? [position, target] : []),
    [following, position, target],
  );
  const mapPosition = useMemo<MapPosition | undefined>(
    () =>
      located && {
        coordinates: located.position,
        accuracyMeters: located.accuracyMeters,
        heading:
          guide.heading.source === 'none' ? undefined : guide.heading.degrees,
      },
    [located, guide.heading],
  );

  return (
    <div
      data-testid="walk-view"
      className="flex min-h-0 flex-1 flex-col lg:flex-row"
    >
      <div className="relative h-[36dvh] shrink-0 lg:h-auto lg:flex-1">
        <div className="absolute inset-0">
          <MapView
            content={content}
            position={mapPosition}
            frame={frame}
            follow={follow}
            coveredBottom={0}
            onUserPan={stopFollowing}
            labels={labels}
          />
        </div>
        <MapControls
          following={following && position !== undefined}
          onLocate={locate}
          showOtherCaches={props.showOtherCaches}
          onToggleOtherCaches={props.onToggleOtherCaches}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:w-[28rem] lg:flex-none lg:border-l lg:border-border">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('walk.title')}
          </p>
          {!done && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={props.onReverse}
                data-testid="walk-reverse"
                aria-label={t('walk.reverse')}
                className={buttonClasses('ghost', 'px-3')}
              >
                <Icon name="reverse" />
              </button>
              <button
                type="button"
                onClick={() => setFinishedEarly(true)}
                data-testid="walk-finish"
                className={buttonClasses('secondary')}
              >
                <Icon name="flag" />
                {t('walk.finish')}
              </button>
            </div>
          )}
        </div>

        {target ? (
          <TargetCard
            target={target}
            guide={guide}
            location={location}
            canUndo={walk.history.length > 0}
            compassNeedsPermission={compass.needsPermission}
            onEnableCompass={compass.requestPermission}
            onRecord={props.onRecord}
            onUndo={props.onUndo}
          />
        ) : (
          <WalkSummary
            walk={walk}
            progress={progress}
            pace={pace}
            canResume={openCode !== undefined}
            canUndo={walk.history.length > 0}
            onResume={() => setFinishedEarly(false)}
            onUndo={props.onUndo}
            onDone={props.onEnd}
          />
        )}
        <WalkStats
          progress={progress}
          pace={pace}
          remainingMinutes={remainingMinutes}
        />
      </div>
    </div>
  );
}
