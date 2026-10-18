'use client';

import { useDeferredValue, useId, useMemo, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { Geocache } from '../../lib/geocache/types';
import { searchCaches } from '../../lib/ui-logic/search';
import { Icon } from '../Icon';
import { cacheTypeLabel } from '../labels';

/** Finds an imported cache by code or name and opens it. */
export function CacheSearch({
  caches,
  onSelect,
}: {
  caches: readonly Geocache[];
  onSelect: (code: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchCaches(caches, { query: deferredQuery }),
    [caches, deferredQuery],
  );
  const inputId = useId();
  const listId = useId();
  const searching = query.trim() !== '';

  return (
    <div className="space-y-2" role="search">
      <label htmlFor={inputId} className="sr-only">
        {t('search.label')}
      </label>
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t('search.placeholder')}
          autoComplete="off"
          aria-controls={listId}
          className="min-h-11 w-full rounded-xl bg-muted py-2 pl-10 pr-3 text-sm outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary"
        />
      </div>
      <div id={listId}>
        {searching && results.length === 0 && deferredQuery === query && (
          <p className="px-1 text-sm text-muted-foreground">
            {t('search.none')}
          </p>
        )}
        {searching && results.length > 0 && (
          <ul
            aria-label={t('search.results')}
            className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border/60"
          >
            {results.map((cache) => (
              <li key={cache.code}>
                <button
                  type="button"
                  data-testid="search-result"
                  onClick={() => {
                    setQuery('');
                    onSelect(cache.code);
                  }}
                  className="flex min-h-11 w-full flex-col px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="text-sm font-semibold">{cache.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {cache.code} · {cacheTypeLabel(t, cache.type)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
