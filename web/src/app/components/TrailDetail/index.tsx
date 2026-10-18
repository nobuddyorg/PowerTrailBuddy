'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { buildTrailGpx } from '../../lib/export/trailGpx';
import { formatCoordinates } from '../../lib/format/coordinates';
import {
  formatDistance,
  formatDuration,
  formatRate,
} from '../../lib/format/format';
import type { Coordinates } from '../../lib/geocache/types';
import { geoUri } from '../../lib/navigation/links';
import { nearestEnd } from '../../lib/trails/nearby';
import type { Trail } from '../../lib/trails/types';
import { nearestParking } from '../../lib/ui-logic/parking';
import { healthSummary } from '../../lib/ui-logic/trailCards';
import type { WalkStart } from '../../useWalkActions';
import { Icon } from '../Icon';
import { trailColor } from '../Map/content';
import { useToast } from '../Toast/ToastProvider';
import { buttonClasses, CHIP_CLASSES } from '../ui/classes';
import { downloadFile } from '../ui/download';
import { CacheRow } from './CacheRow';

interface TrailDetailProps {
  trail: Trail;
  rank: number;
  position?: Coordinates;
  onBack: () => void;
  onStartWalk: (start: WalkStart) => void;
  onOpenCache: (code: string) => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-bold">{value}</dd>
    </div>
  );
}

/** One trail in full: its numbers, where to park, which way round, its caches in order, and the walk. */
export function TrailDetail({
  trail,
  rank,
  position,
  onBack,
  onStartWalk,
  onOpenCache,
}: TrailDetailProps) {
  const { t, tCount, locale } = useI18n();
  const toast = useToast();
  const [reversed, setReversed] = useState(false);
  const caches = useMemo(
    () => (reversed ? [...trail.caches].reverse() : trail.caches),
    [trail, reversed],
  );
  const parking = nearestParking(caches, caches[0]);
  const end = position ? nearestEnd(trail, position) : undefined;
  const health = healthSummary(trail);
  const title = t('trails.name', { rank });

  const exportGpx = () => {
    downloadFile({
      name: `powertrail-${rank}.gpx`,
      data: buildTrailGpx({ ...trail, caches }, `PowerTrailBuddy – ${title}`),
      type: 'application/gpx+xml',
    });
    toast.show(t('toast.gpxSaved'));
  };

  return (
    <article
      data-testid="trail-detail"
      aria-labelledby="trail-detail-title"
      className="space-y-4"
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          data-testid="trail-back"
          className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
        >
          <Icon name="back" />
        </button>
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
          style={{ background: trailColor(rank) }}
        >
          {rank}
        </span>
        <h2
          id="trail-detail-title"
          data-testid="trail-detail-title"
          className="flex-1 text-xl font-bold"
        >
          {title}
        </h2>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label={t('detail.stat.caches')}
          value={String(trail.caches.length)}
        />
        <Stat
          label={t('detail.stat.rate')}
          value={t('trails.perHour', {
            rate: formatRate(trail.cachesPerHour, locale),
          })}
        />
        <Stat
          label={t('detail.stat.walk')}
          value={formatDistance(trail.walkMeters, locale)}
        />
        <Stat
          label={t('detail.stat.duration')}
          value={formatDuration(trail.durationMinutes, locale)}
        />
        <Stat
          label={t('detail.stat.shape')}
          value={
            trail.shape === 'line'
              ? t('trails.shape.line')
              : t('trails.shape.area')
          }
        />
        {end && (
          <Stat
            label={t('detail.stat.away')}
            value={formatDistance(end.meters, locale)}
          />
        )}
      </dl>

      {health.dnfStreak + health.needsMaintenance + health.disabled > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {tCount('detail.doubtful', {
            count: health.dnfStreak + health.needsMaintenance + health.disabled,
          })}
        </p>
      )}

      {parking && (
        <a
          href={geoUri(parking, t('detail.parkingLabel', { rank }))}
          data-testid="trail-parking"
          className="flex min-h-11 items-center gap-3 rounded-xl bg-card px-3 py-2 ring-1 ring-border hover:bg-muted"
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-md bg-blue-800 text-xs font-extrabold text-white"
          >
            P
          </span>
          <span className="flex-1 text-sm">
            <span className="block font-semibold">{t('detail.parking')}</span>
            <span className="block text-xs text-muted-foreground">
              {formatCoordinates(parking)}
            </span>
          </span>
          <Icon name="navigate" className="h-5 w-5 text-primary" />
        </a>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onStartWalk({ reversed })}
          data-testid="start-walk"
          className={buttonClasses('primary', 'w-full text-base')}
        >
          <Icon name="walk" />
          {t('detail.startWalk')}
        </button>
        {end && (
          <button
            type="button"
            onClick={() => onStartWalk({ fromCode: end.code })}
            data-testid="start-nearest"
            className={buttonClasses('soft', 'w-full')}
          >
            <Icon name="flag" />
            {t('detail.startNearest', {
              distance: formatDistance(end.meters, locale),
            })}
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={reversed}
            data-testid="reverse-trail"
            onClick={() => setReversed((current) => !current)}
            className={CHIP_CLASSES}
          >
            <Icon name="reverse" className="h-4 w-4" />
            {t('detail.reverse')}
          </button>
          <button
            type="button"
            onClick={exportGpx}
            data-testid="export-gpx"
            className={CHIP_CLASSES}
          >
            <Icon name="download" className="h-4 w-4" />
            {t('detail.exportGpx')}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t('detail.cacheList')}</h3>
        <ol className="space-y-1.5">
          {caches.map((cache, index) => (
            <CacheRow
              key={cache.code}
              cache={cache}
              position={index + 1}
              onOpenCache={onOpenCache}
            />
          ))}
        </ol>
      </section>
    </article>
  );
}
