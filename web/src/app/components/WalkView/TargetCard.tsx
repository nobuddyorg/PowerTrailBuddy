'use client';

import { useI18n } from '../../i18n/useI18n';
import { compassPoint } from '../../lib/format/compass';
import { formatDistance } from '../../lib/format/format';
import type { Geocache } from '../../lib/geocache/types';
import type { WalkOutcome } from '../../lib/walk/walk';
import type { GeolocationState } from '../../useGeolocation';
import { CacheFacts } from '../CacheDetails/CacheFacts';
import { CacheLinks } from '../CacheDetails/CacheLinks';
import { HealthBadge } from '../CacheDetails/HealthBadge';
import { HintSpoiler } from '../CacheDetails/HintSpoiler';
import { Icon } from '../Icon';
import { directionName } from '../labels';
import { buttonClasses } from '../ui/classes';
import { Compass } from './Compass';
import type { Guide } from './useWalkGuide';

function Whereabouts({
  guide,
  location,
}: {
  guide: Guide;
  location: GeolocationState;
}) {
  const { t, locale } = useI18n();
  if (guide.status === 'guiding') {
    return (
      <div className="flex items-center gap-4">
        <Compass
          bearing={guide.bearing}
          heading={guide.heading}
          close={guide.close}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p
            data-testid="walk-distance"
            className="text-4xl font-extrabold tabular-nums tracking-tight"
          >
            {formatDistance(guide.distanceMeters, locale)}
          </p>
          <p className="text-sm font-medium">
            {t('walk.direction', {
              direction: directionName(t, compassPoint(guide.bearing)),
              degrees: Math.round(guide.bearing),
            })}
          </p>
          {location.status === 'located' && (
            <p className="text-xs text-muted-foreground">
              {t('walk.accuracy', {
                accuracy: formatDistance(location.accuracyMeters, locale),
              })}
            </p>
          )}
        </div>
      </div>
    );
  }
  const blocked = location.status === 'denied';
  const missing = location.status === 'unavailable';
  return (
    <p
      data-testid="walk-location"
      className="rounded-xl bg-muted px-3 py-3 text-center text-sm"
    >
      {blocked && t('location.denied')}
      {missing && t('location.unavailable')}
      {!blocked && !missing && t('location.waiting')}
    </p>
  );
}

interface TargetCardProps {
  target: Geocache;
  guide: Guide;
  location: GeolocationState;
  canUndo: boolean;
  compassNeedsPermission: boolean;
  onEnableCompass: () => void;
  onRecord: (code: string, outcome: WalkOutcome) => void;
  onUndo: () => void;
}

/** The next cache: where it is, how to log it, how to get there by other means. */
export function TargetCard({
  target,
  guide,
  location,
  canUndo,
  compassNeedsPermission,
  onEnableCompass,
  onRecord,
  onUndo,
}: TargetCardProps) {
  const { t } = useI18n();
  const close = guide.status === 'guiding' && guide.close;
  return (
    <section
      data-testid="walk-target"
      aria-labelledby="walk-target-name"
      className="space-y-4"
    >
      {close && (
        <p
          role="status"
          data-testid="walk-close"
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground"
        >
          <Icon name="sparkle" />
          {t('walk.close')}
        </p>
      )}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('walk.next')} · {target.code}
        </p>
        <h2 id="walk-target-name" className="text-lg font-bold leading-tight">
          {target.name}
        </h2>
        <HealthBadge cache={target} />
        <CacheFacts cache={target} />
      </div>
      <Whereabouts guide={guide} location={location} />
      {compassNeedsPermission && (
        <button
          type="button"
          onClick={onEnableCompass}
          className={buttonClasses('soft', 'w-full')}
        >
          <Icon name="compass" />
          {t('walk.compass.enable')}
        </button>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onRecord(target.code, 'found')}
          className={buttonClasses('primary', 'col-span-3 min-h-14 text-base')}
        >
          <Icon name="check" className="h-6 w-6" />
          {t('walk.found')}
        </button>
        <button
          type="button"
          onClick={() => onRecord(target.code, 'dnf')}
          className={buttonClasses('secondary')}
        >
          <Icon name="dnf" />
          {t('walk.dnf')}
        </button>
        <button
          type="button"
          onClick={() => onRecord(target.code, 'skipped')}
          className={buttonClasses('secondary')}
        >
          <Icon name="skip" />
          {t('walk.skip')}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={buttonClasses('ghost')}
        >
          <Icon name="undo" />
          {t('walk.undo')}
        </button>
      </div>
      <HintSpoiler hint={target.hint} />
      <CacheLinks cache={target} />
    </section>
  );
}
