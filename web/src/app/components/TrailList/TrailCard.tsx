'use client';

import { useI18n } from '../../i18n/useI18n';
import {
  formatDistance,
  formatDuration,
  formatRate,
} from '../../lib/format/format';
import {
  healthSummary,
  type TrailCard as Card,
} from '../../lib/ui-logic/trailCards';
import { Icon } from '../Icon';
import { trailColor } from '../Map/content';

/** The doubtful caches of a trail in a few words; nothing for a trail without any. */
function HealthLine({ card }: { card: Card }) {
  const { tCount } = useI18n();
  const { dnfStreak, needsMaintenance, disabled } = healthSummary(card.trail);
  const parts = [
    ...(dnfStreak > 0
      ? [tCount('trails.health.dnf', { count: dnfStreak })]
      : []),
    ...(needsMaintenance > 0
      ? [tCount('trails.health.maintenance', { count: needsMaintenance })]
      : []),
    ...(disabled > 0
      ? [tCount('trails.health.disabled', { count: disabled })]
      : []),
  ];
  if (parts.length === 0) return null;
  return (
    <p
      data-testid="trail-health"
      className="flex items-center gap-1 text-xs font-medium text-warning"
    >
      <Icon name="alert" className="h-3.5 w-3.5" />
      {parts.join(' · ')}
    </p>
  );
}

/** One ranked trail: how many caches, how far, how long, how fast, how far away. */
export function TrailCard({
  card,
  onSelect,
}: {
  card: Card;
  onSelect: () => void;
}) {
  const { t, tCount, locale } = useI18n();
  const { trail, rank, distanceMeters } = card;
  return (
    <button
      type="button"
      data-testid="trail-card"
      onClick={onSelect}
      className="flex w-full gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-1 ring-border/60 hover:ring-primary/50 motion-safe:transition-shadow"
    >
      <span
        aria-hidden="true"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
        style={{ background: trailColor(rank) }}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-baseline justify-between gap-2">
          <span data-testid="trail-card-name" className="font-semibold">
            {t('trails.name', { rank })}
          </span>
          <span className="shrink-0 text-sm font-bold text-primary">
            {t('trails.perHour', {
              rate: formatRate(trail.cachesPerHour, locale),
            })}
          </span>
        </span>
        <span
          data-testid="trail-card-summary"
          className="block text-sm text-muted-foreground"
        >
          {[
            tCount('trails.caches', { count: trail.caches.length }),
            formatDistance(trail.walkMeters, locale),
            formatDuration(trail.durationMinutes, locale),
          ].join(' · ')}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
            {trail.shape === 'line'
              ? t('trails.shape.line')
              : t('trails.shape.area')}
          </span>
          {distanceMeters !== undefined && (
            <span
              data-testid="trail-distance"
              className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary-strong"
            >
              <Icon name="pin" className="h-3 w-3" />
              {t('trails.away', {
                distance: formatDistance(distanceMeters, locale),
              })}
            </span>
          )}
        </span>
        <HealthLine card={card} />
      </span>
    </button>
  );
}
