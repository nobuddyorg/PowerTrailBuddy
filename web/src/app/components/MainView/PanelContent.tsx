'use client';

import { useI18n } from '../../i18n/useI18n';
import type { Coordinates } from '../../lib/geocache/types';
import type { Trail } from '../../lib/trails/types';
import type { TrailCard } from '../../lib/ui-logic/trailCards';
import type { TrailFilter } from '../../lib/ui-logic/trailSort';
import type { AppState } from '../../useAppState';
import type { RouteCheck } from '../../useWalkingDistances';
import { CacheDetails } from '../CacheDetails';
import { Icon } from '../Icon';
import { RouteStatus } from '../RouteStatus';
import { CacheSearch } from '../Search';
import { TrailDetail } from '../TrailDetail';
import { TrailList } from '../TrailList';
import { buttonClasses } from '../ui/classes';
import type { PanelView } from './usePanel';

interface PanelContentProps {
  app: AppState;
  view: PanelView;
  backToList: boolean;
  onBack: () => void;
  trails: readonly Trail[];
  cards: readonly TrailCard[];
  pending: boolean;
  routeCheck: RouteCheck;
  filters: readonly TrailFilter[];
  onFiltersChange: (filters: TrailFilter[]) => void;
  position?: Coordinates;
  onSelectTrail: (trailId: string) => void;
  onSelectCache: (code: string) => void;
  onOpenSettings: () => void;
}

function Gone({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">{t('panel.gone')}</p>
      <button
        type="button"
        onClick={onBack}
        className={buttonClasses('secondary')}
      >
        <Icon name="back" />
        {t('common.back')}
      </button>
    </div>
  );
}

/** The panel's current view: the trail list with search, one trail, or one cache. */
export function PanelContent(props: PanelContentProps) {
  const { app, view, trails, position, onBack, onSelectTrail, onSelectCache } =
    props;
  const { t, tCount } = useI18n();

  if (view.kind === 'trail') {
    const rank = trails.findIndex((trail) => trail.id === view.trailId) + 1;
    // A walk found here, or new settings, can remove the trail being looked at.
    if (rank === 0) return <Gone onBack={onBack} />;
    return (
      <TrailDetail
        key={view.trailId}
        trail={trails[rank - 1]}
        rank={rank}
        position={position}
        onBack={onBack}
        onStartWalk={(start) => app.startWalk(trails[rank - 1], start)}
        onOpenCache={onSelectCache}
      />
    );
  }

  if (view.kind === 'cache') {
    const cache = app.caches.find((each) => each.code === view.code);
    if (!cache) return <Gone onBack={onBack} />;
    const rank =
      trails.findIndex((trail) =>
        trail.caches.some((each) => each.code === cache.code),
      ) + 1;
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          data-testid="cache-back"
          className={buttonClasses('ghost', '-ml-2')}
        >
          <Icon name="back" />
          {props.backToList ? t('panel.toList') : t('common.back')}
        </button>
        <CacheDetails
          cache={cache}
          position={position}
          trail={rank > 0 ? { id: trails[rank - 1].id, rank } : undefined}
          onOpenTrail={onSelectTrail}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p data-testid="cache-count" className="text-sm text-muted-foreground">
        {tCount('main.cacheCount', { count: app.caches.length })}
      </p>
      <CacheSearch caches={app.caches} onSelect={onSelectCache} />
      <TrailList
        cards={props.cards}
        trailCount={trails.length}
        pending={props.pending}
        sort={app.preferences.sort}
        filters={props.filters}
        located={position !== undefined}
        onSortChange={(sort) => app.setPreferences({ sort })}
        onFiltersChange={props.onFiltersChange}
        onSelect={onSelectTrail}
        onOpenSettings={props.onOpenSettings}
      />
      <RouteStatus check={props.routeCheck} />
    </div>
  );
}
