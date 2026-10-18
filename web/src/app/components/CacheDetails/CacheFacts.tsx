'use client';

import { useI18n } from '../../i18n/useI18n';
import { formatRating } from '../../lib/format/format';
import type { Geocache } from '../../lib/geocache/types';
import { cacheTypeLabel } from '../labels';

/** Type, difficulty and terrain, size and owner on one wrapping line. */
export function CacheFacts({ cache }: { cache: Geocache }) {
  const { t, locale } = useI18n();
  const facts = [
    cacheTypeLabel(t, cache.type),
    t('cache.rating', {
      difficulty: formatRating(cache.difficulty, locale),
      terrain: formatRating(cache.terrain, locale),
    }),
    t('cache.size', { size: cache.container }),
    ...(cache.placedBy ? [t('cache.placedBy', { owner: cache.placedBy })] : []),
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {facts.map((fact) => (
        <li key={fact}>{fact}</li>
      ))}
    </ul>
  );
}
