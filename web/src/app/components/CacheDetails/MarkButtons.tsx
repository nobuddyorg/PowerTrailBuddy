'use client';

import { useI18n } from '../../i18n/useI18n';
import type { Geocache } from '../../lib/geocache/types';
import { Icon } from '../Icon';
import { buttonClasses } from '../ui/classes';
import { useCacheMarks } from './marks';

/** Found here / ignore, and taking either back; a cache the Pocket Query already lists as found has nothing to mark. */
export function MarkButtons({ cache }: { cache: Geocache }) {
  const { t } = useI18n();
  const marks = useCacheMarks();
  const found = marks.locallyFound.has(cache.code);
  const ignored = marks.ignored.has(cache.code);
  return (
    <div className="flex flex-wrap gap-2">
      {!cache.found &&
        (found ? (
          <button
            type="button"
            onClick={() => marks.unmarkFound(cache.code)}
            className={buttonClasses('secondary')}
          >
            <Icon name="undo" />
            {t('cache.unmarkFound')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => marks.markFound(cache.code)}
            className={buttonClasses('soft')}
          >
            <Icon name="check" />
            {t('cache.markFound')}
          </button>
        ))}
      {ignored ? (
        <button
          type="button"
          onClick={() => marks.unignore(cache.code)}
          className={buttonClasses('secondary')}
        >
          <Icon name="show" />
          {t('cache.unignore')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => marks.ignore(cache.code)}
          className={buttonClasses('ghost')}
        >
          <Icon name="hide" />
          {t('cache.ignore')}
        </button>
      )}
    </div>
  );
}
