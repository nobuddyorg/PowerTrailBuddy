'use client';

import { useI18n } from '../../i18n/useI18n';
import { Icon } from '../Icon';

const CONTROL_CLASSES =
  'grid h-11 w-11 place-items-center rounded-xl bg-card text-foreground shadow-soft ring-1 ring-border/70 hover:bg-muted aria-pressed:bg-position aria-pressed:text-white aria-pressed:ring-position focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface MapControlsProps {
  following: boolean;
  onLocate: () => void;
  showOtherCaches: boolean;
  onToggleOtherCaches: () => void;
}

/** Buttons over the map: find and follow me, and show or hide the caches outside any trail. */
export function MapControls({
  following,
  onLocate,
  showOtherCaches,
  onToggleOtherCaches,
}: MapControlsProps) {
  const { t } = useI18n();
  return (
    <div className="absolute right-2.5 top-24 z-[900] flex flex-col gap-2">
      <button
        type="button"
        aria-pressed={following}
        aria-label={t('map.locate')}
        onClick={onLocate}
        className={CONTROL_CLASSES}
      >
        <Icon name="locate" />
      </button>
      <button
        type="button"
        aria-pressed={showOtherCaches}
        aria-label={t('map.otherCaches')}
        onClick={onToggleOtherCaches}
        className={CONTROL_CLASSES}
      >
        <Icon name="layers" />
      </button>
    </div>
  );
}
