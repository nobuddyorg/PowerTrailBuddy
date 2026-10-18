'use client';

import { useId } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { TrailCard as Card } from '../../lib/ui-logic/trailCards';
import {
  TRAIL_FILTERS,
  TRAIL_SORTS,
  type TrailFilter,
  type TrailSort,
} from '../../lib/ui-logic/trailSort';
import type { Translate } from '../labels';
import { buttonClasses, CHIP_CLASSES } from '../ui/classes';
import { TrailCard } from './TrailCard';

function sortLabel(t: Translate, sort: TrailSort): string {
  switch (sort) {
    case 'rate':
      return t('trails.sort.rate');
    case 'caches':
      return t('trails.sort.caches');
    case 'nearest':
      return t('trails.sort.nearest');
    case 'shortest':
      return t('trails.sort.shortest');
  }
}

function filterLabel(t: Translate, filter: TrailFilter): string {
  switch (filter) {
    case 'short':
      return t('trails.filter.short');
    case 'quick':
      return t('trails.filter.quick');
    case 'near':
      return t('trails.filter.near');
  }
}

interface TrailListProps {
  cards: readonly Card[];
  /** Trails before the filters, to tell "none found" from "none left by the filters". */
  trailCount: number;
  pending: boolean;
  sort: TrailSort;
  filters: readonly TrailFilter[];
  /** "Nearest" and "near me" need the user's position. */
  located: boolean;
  onSortChange: (sort: TrailSort) => void;
  onFiltersChange: (filters: TrailFilter[]) => void;
  onSelect: (trailId: string) => void;
  onOpenSettings: () => void;
}

/** The ranked trails with sorting and quick filters; the list alternative to the map. */
export function TrailList({
  cards,
  trailCount,
  pending,
  sort,
  filters,
  located,
  onSortChange,
  onFiltersChange,
  onSelect,
  onOpenSettings,
}: TrailListProps) {
  const { t, tCount } = useI18n();
  const sortId = useId();
  const toggle = (filter: TrailFilter) =>
    onFiltersChange(
      filters.includes(filter)
        ? filters.filter((each) => each !== filter)
        : [...filters, filter],
    );

  if (trailCount === 0) {
    return (
      <section
        data-testid="trail-list"
        className="space-y-3 rounded-2xl bg-card p-4 text-sm shadow-soft"
      >
        <h2 data-testid="trail-count" className="text-base font-semibold">
          {tCount('trails.title', { count: 0 })}
        </h2>
        <p className="text-muted-foreground">
          {pending ? t('trails.updating') : t('trails.none')}
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="trails-open-settings"
          className={buttonClasses('secondary')}
        >
          {t('trails.openSettings')}
        </button>
      </section>
    );
  }

  return (
    <section data-testid="trail-list" aria-busy={pending} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 data-testid="trail-count" className="text-base font-semibold">
          {tCount('trails.title', { count: trailCount })}
          {pending && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t('trails.updating')}
            </span>
          )}
        </h2>
        <label htmlFor={sortId} className="sr-only">
          {t('trails.sort.label')}
        </label>
        <select
          id={sortId}
          data-testid="trail-sort"
          value={sort}
          onChange={(event) =>
            onSortChange(event.currentTarget.value as TrailSort)
          }
          className="min-h-11 shrink-0 rounded-xl bg-card px-3 text-sm ring-1 ring-inset ring-border focus:outline-2 focus:outline-primary"
        >
          {TRAIL_SORTS.map((each) => (
            <option
              key={each}
              value={each}
              disabled={each === 'nearest' && !located}
            >
              {sortLabel(t, each)}
            </option>
          ))}
        </select>
      </div>
      <div
        role="group"
        aria-label={t('trails.filter.label')}
        className="flex flex-wrap gap-2"
      >
        {TRAIL_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={filters.includes(filter)}
            data-testid={`trail-filter-${filter}`}
            disabled={filter === 'near' && !located}
            onClick={() => toggle(filter)}
            className={CHIP_CLASSES}
          >
            {filterLabel(t, filter)}
          </button>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">
          {t('trails.noneFiltered')}
        </p>
      ) : (
        <ol className="space-y-2">
          {cards.map((card) => (
            <li key={card.trail.id}>
              <TrailCard card={card} onSelect={() => onSelect(card.trail.id)} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
