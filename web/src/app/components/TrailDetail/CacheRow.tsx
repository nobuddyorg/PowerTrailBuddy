'use client';

import { useId, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { formatRating } from '../../lib/format/format';
import { cacheHealth } from '../../lib/geocache/health';
import type { Geocache } from '../../lib/geocache/types';
import { CacheLinks } from '../CacheDetails/CacheLinks';
import { HealthBadge } from '../CacheDetails/HealthBadge';
import { MarkButtons } from '../CacheDetails/MarkButtons';
import { Icon } from '../Icon';
import { viewKey } from '../MainView/usePanel';
import { buttonClasses } from '../ui/classes';

interface CacheRowProps {
  cache: Geocache;
  position: number;
  onOpenCache: (code: string) => void;
}

/** One stop of the trail; opens to the same actions the cache sheet has. */
export function CacheRow({ cache, position, onOpenCache }: CacheRowProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const doubtful = cacheHealth(cache) !== 'ok';
  return (
    <li
      data-testid="trail-cache"
      className="rounded-xl bg-card ring-1 ring-border/60"
    >
      <button
        type="button"
        aria-expanded={open}
        data-testid="trail-cache-toggle"
        data-focus-key={viewKey({ kind: 'cache', code: cache.code })}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
          {position}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {cache.name}
          </span>
          <span
            data-testid="trail-cache-facts"
            className="block text-xs text-muted-foreground"
          >
            {cache.code} ·{' '}
            {t('cache.rating', {
              difficulty: formatRating(cache.difficulty, locale),
              terrain: formatRating(cache.terrain, locale),
            })}{' '}
            · {cache.container}
          </span>
        </span>
        {doubtful && (
          <Icon name="alert" className="h-4 w-4 shrink-0 text-warning" />
        )}
        <Icon
          name="chevron"
          className={`h-4 w-4 shrink-0 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="space-y-3 border-t border-border px-3 py-3"
      >
        <HealthBadge cache={cache} />
        <CacheLinks cache={cache} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenCache(cache.code)}
            data-testid="trail-cache-open"
            className={buttonClasses('secondary')}
          >
            <Icon name="pin" />
            {t('detail.openCache')}
          </button>
        </div>
        <MarkButtons cache={cache} />
      </div>
    </li>
  );
}
