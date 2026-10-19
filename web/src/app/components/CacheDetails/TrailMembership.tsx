'use client';

import { useI18n } from '../../i18n/useI18n';
import { formatRating } from '../../lib/format/format';
import type { Geocache } from '../../lib/geocache/types';
import type { ExclusionReason } from '../../lib/trails/filterCaches';
import type { Trail, TrailSettings } from '../../lib/trails/types';
import { Icon } from '../Icon';
import { cacheTypeLabel, type Translate } from '../labels';
import { buttonClasses } from '../ui/classes';

/** The trail a cache walks in, or why it walks in none: the filter's reasons, empty when it passes them all. */
export type Membership =
  | { kind: 'on-trail'; trail: Trail; rank: number }
  | {
      kind: 'left-out';
      reasons: readonly ExclusionReason[];
      settings: TrailSettings;
    };

interface TrailMembershipProps {
  cache: Geocache;
  membership: Membership;
  onOpenTrail: (trailId: string) => void;
  onStartWalkHere: (trail: Trail) => void;
  onOpenSettings: () => void;
}

interface ReasonContext {
  t: Translate;
  locale: string;
  cache: Geocache;
  settings: TrailSettings;
}

const SETTINGS_REASONS: readonly ExclusionReason[] = [
  'type',
  'difficulty',
  'terrain',
];

function reasonText(
  reason: ExclusionReason,
  { t, locale, cache, settings }: ReasonContext,
): string {
  switch (reason) {
    case 'type':
      return t('cache.leftOut.type', { type: cacheTypeLabel(t, cache.type) });
    case 'difficulty':
      return t('cache.leftOut.difficulty', {
        rating: formatRating(cache.difficulty, locale),
        limit: formatRating(settings.maxDifficulty, locale),
      });
    case 'terrain':
      return t('cache.leftOut.terrain', {
        rating: formatRating(cache.terrain, locale),
        limit: formatRating(settings.maxTerrain, locale),
      });
    case 'disabled':
      return t('cache.leftOut.disabled');
    case 'archived':
      return t('cache.leftOut.archived');
    case 'found':
      return t('cache.leftOut.found');
    case 'marked':
      return t('cache.leftOut.marked');
  }
}

/** On a trail: open it, or start its walk at this cache. Left out: why, and the way to the settings when they decide it. */
export function TrailMembership({
  cache,
  membership,
  onOpenTrail,
  onStartWalkHere,
  onOpenSettings,
}: TrailMembershipProps) {
  const { t, locale } = useI18n();

  if (membership.kind === 'on-trail') {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onOpenTrail(membership.trail.id)}
          data-testid="cache-trail"
          className="flex min-h-11 w-full items-center justify-between rounded-xl bg-muted px-3 text-sm font-semibold hover:brightness-95"
        >
          <span className="flex items-center gap-2">
            <Icon name="route" />
            {t('cache.onTrail', { rank: membership.rank })}
          </span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          onClick={() => onStartWalkHere(membership.trail)}
          data-testid="start-walk-here"
          className={buttonClasses('soft', 'w-full')}
        >
          <Icon name="flag" />
          {t('cache.startWalkHere')}
        </button>
      </div>
    );
  }

  const { reasons, settings } = membership;
  const lines =
    reasons.length === 0
      ? [t('cache.leftOut.noTrail', { count: settings.minCaches })]
      : reasons.map((reason) =>
          reasonText(reason, { t, locale, cache, settings }),
        );
  const settingsDecide =
    reasons.length === 0 ||
    reasons.some((reason) => SETTINGS_REASONS.includes(reason));
  return (
    <section
      data-testid="cache-left-out"
      aria-labelledby={`left-out-${cache.code}`}
      className="space-y-2 rounded-xl bg-muted px-3 py-2 text-sm"
    >
      <h3 id={`left-out-${cache.code}`} className="font-semibold">
        {t('cache.leftOut.title')}
      </h3>
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line) => (
          <li key={line} data-testid="left-out-reason">
            {line}
          </li>
        ))}
      </ul>
      {settingsDecide && (
        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="left-out-settings"
          className={buttonClasses('secondary')}
        >
          <Icon name="settings" />
          {t('trails.openSettings')}
        </button>
      )}
    </section>
  );
}
