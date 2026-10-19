'use client';

import { useI18n } from '../../i18n/useI18n';
import { formatCoordinates } from '../../lib/format/coordinates';
import type { Geocache } from '../../lib/geocache/types';
import {
  cachePageUrl,
  geoUri,
  walkingDirectionsUrl,
} from '../../lib/navigation/links';
import { Icon, type IconName } from '../Icon';
import { useToast } from '../Toast/ToastProvider';

const LINK_CLASSES =
  'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-primary-soft px-2 py-1.5 text-center text-xs font-semibold text-primary-strong hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function LinkContent({ icon, label }: { icon: IconName; label: string }) {
  return (
    <>
      <Icon name={icon} className="h-5 w-5" />
      <span>{label}</span>
    </>
  );
}

/** Every way to the real cache: its listing, a navigation app, Google Maps walking directions, its coordinates. */
export function CacheLinks({ cache }: { cache: Geocache }) {
  const { t } = useI18n();
  const toast = useToast();
  const coordinates = formatCoordinates(cache);
  const copy = () => {
    // Inside a promise, so a browser without a clipboard (not a secure context) also lands in catch.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(coordinates))
      .then(() => toast.show(t('toast.copied', { coordinates })))
      .catch(() => toast.show(t('toast.copyFailed')));
  };
  return (
    <div className="grid grid-cols-4 gap-2" data-testid="cache-links">
      <a
        href={cachePageUrl(cache.code)}
        data-testid="cache-page-link"
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASSES}
      >
        <LinkContent icon="external" label={t('cache.page')} />
      </a>
      <a
        href={geoUri(cache, `${cache.code} ${cache.name}`)}
        data-testid="cache-navigate-link"
        className={LINK_CLASSES}
      >
        <LinkContent icon="navigate" label={t('cache.navigate')} />
      </a>
      <a
        href={walkingDirectionsUrl(cache)}
        data-testid="cache-directions-link"
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASSES}
      >
        <LinkContent icon="walk" label={t('cache.directions')} />
      </a>
      <button
        type="button"
        onClick={copy}
        data-testid="copy-coordinates"
        className={LINK_CLASSES}
        aria-label={t('cache.copyLabel', { coordinates })}
      >
        <LinkContent icon="copy" label={t('cache.copy')} />
      </button>
    </div>
  );
}
