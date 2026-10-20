'use client';

import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { Coordinates } from '../../lib/geocache/types';
import { exclusionReasons } from '../../lib/trails/filterCaches';
import type { Trail } from '../../lib/trails/types';
import type { TrailCard } from '../../lib/ui-logic/trailCards';
import type { TrailFilter } from '../../lib/ui-logic/trailSort';
import type { AppState } from '../../useAppState';
import type { RouteCheck } from '../../useWalkingDistances';
import { CacheDetails } from '../CacheDetails';
import type { Membership } from '../CacheDetails/TrailMembership';
import { Icon } from '../Icon';
import { RouteStatus } from '../RouteStatus';
import { CacheSearch } from '../Search';
import { TrailDetail } from '../TrailDetail';
import { TrailList } from '../TrailList';
import { buttonClasses } from '../ui/classes';
import { focusQuietly, mayTakeFocus } from '../ui/focus';
import type { PanelView } from './usePanel';

interface PanelContentProps {
  app: AppState;
  view: PanelView;
  /** After Back, the `data-focus-key` of the card or row that opened the view left. */
  returnFocus: string;
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
function CurrentView(props: PanelContentProps) {
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
    const trail = trails.find((each) =>
      each.caches.some((member) => member.code === cache.code),
    );
    const membership: Membership = trail
      ? { kind: 'on-trail', trail, rank: trails.indexOf(trail) + 1 }
      : {
          kind: 'left-out',
          // Ignored caches leave the trails the same way found ones do.
          reasons: exclusionReasons(cache, {
            settings: app.settings,
            locallyFound: new Set([...app.locallyFound, ...app.ignored]),
          }),
          settings: app.settings,
        };
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
          membership={membership}
          onOpenTrail={onSelectTrail}
          onStartWalkHere={(onTrail) =>
            app.startWalk(onTrail, { fromCode: cache.code })
          }
          onOpenSettings={props.onOpenSettings}
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

/** After Back, the card or row the view was opened from; else the view's heading; else the panel itself. */
function focusTarget(panel: HTMLElement, returnFocus: string): HTMLElement {
  const origin = [
    ...panel.querySelectorAll<HTMLElement>('[data-focus-key]'),
  ].find((element) => element.dataset.focusKey === returnFocus);
  return (
    origin ?? panel.querySelector<HTMLElement>('[data-view-heading]') ?? panel
  );
}

/** The current view, with focus moved into it whenever it changes, so keyboard and screen-reader users follow along. */
export function PanelContent(props: PanelContentProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { view, returnFocus } = props;
  useEffect(() => {
    const panel = panelRef.current!;
    if (mayTakeFocus(panel)) focusQuietly(focusTarget(panel, returnFocus));
  }, [view, returnFocus]);
  return (
    <div ref={panelRef} tabIndex={-1} className="outline-none">
      <CurrentView {...props} />
    </div>
  );
}
