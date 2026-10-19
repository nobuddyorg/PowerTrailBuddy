'use client';

import { useI18n } from '../../i18n/useI18n';
import { compassPoint } from '../../lib/format/compass';
import { formatDistance } from '../../lib/format/format';
import type { Coordinates, Geocache } from '../../lib/geocache/types';
import type { Trail } from '../../lib/trails/types';
import { bearingDegrees, distanceMeters } from '../../lib/trails/geo';
import { Icon } from '../Icon';
import { directionName } from '../labels';
import { CacheFacts } from './CacheFacts';
import { CacheLinks } from './CacheLinks';
import { HealthBadge } from './HealthBadge';
import { HintSpoiler } from './HintSpoiler';
import { MarkButtons } from './MarkButtons';
import { RecentLogs } from './RecentLogs';
import { TrailMembership, type Membership } from './TrailMembership';

interface CacheDetailsProps {
  cache: Geocache;
  position?: Coordinates;
  membership: Membership;
  onOpenTrail: (trailId: string) => void;
  onStartWalkHere: (trail: Trail) => void;
  onOpenSettings: () => void;
}

/** Everything about one cache, and every way to reach it. */
export function CacheDetails({
  cache,
  position,
  membership,
  onOpenTrail,
  onStartWalkHere,
  onOpenSettings,
}: CacheDetailsProps) {
  const { t, locale } = useI18n();
  return (
    <article
      data-testid="cache-details"
      aria-labelledby={`cache-${cache.code}`}
      className="space-y-4"
    >
      <header className="space-y-1">
        <p
          data-testid="cache-code"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {cache.code}
        </p>
        <h2
          id={`cache-${cache.code}`}
          className="text-xl font-bold leading-tight"
        >
          {cache.name}
        </h2>
        <HealthBadge cache={cache} />
        <CacheFacts cache={cache} />
        {position && (
          <p
            data-testid="cache-distance"
            className="flex items-center gap-1 text-sm font-medium"
          >
            <Icon name="pin" className="h-4 w-4 text-position" />
            {t('cache.away', {
              distance: formatDistance(distanceMeters(position, cache), locale),
              direction: directionName(
                t,
                compassPoint(bearingDegrees(position, cache)),
              ),
            })}
          </p>
        )}
      </header>
      <CacheLinks cache={cache} />
      <TrailMembership
        cache={cache}
        membership={membership}
        onOpenTrail={onOpenTrail}
        onStartWalkHere={onStartWalkHere}
        onOpenSettings={onOpenSettings}
      />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t('cache.recentLogs')}</h3>
        <RecentLogs logs={cache.recentLogs} />
      </section>
      <HintSpoiler hint={cache.hint} />
      <MarkButtons cache={cache} />
    </article>
  );
}
