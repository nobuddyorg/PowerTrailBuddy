'use client';

import { useI18n } from '../../i18n/useI18n';
import { Icon } from '../Icon';
import { ICON_BUTTON_CLASSES } from '../ui/classes';

export interface IgnoredCache {
  code: string;
  /** '' when the cache is no longer among the imported ones. */
  name: string;
}

/** The caches kept out of every trail, each one to let back in. */
export function IgnoredCaches({
  caches,
  onUnignore,
}: {
  caches: readonly IgnoredCache[];
  onUnignore: (code: string) => void;
}) {
  const { t, tCount } = useI18n();
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">
        {tCount('settings.ignored', { count: caches.length })}
      </h3>
      {caches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('settings.noneIgnored')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
          {caches.map(({ code, name }) => (
            <li
              key={code}
              data-testid="ignored-cache"
              className="flex items-center gap-2 pl-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold">{code}</span> {name}
              </span>
              <button
                type="button"
                onClick={() => onUnignore(code)}
                data-testid="unignore"
                aria-label={t('settings.unignore', { code })}
                className={ICON_BUTTON_CLASSES}
              >
                <Icon name="show" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
