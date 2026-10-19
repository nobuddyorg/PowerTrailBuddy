'use client';

import { useI18n } from '../../i18n/useI18n';
import type { RouteCheck } from '../../useWalkingDistances';

// FOSSGIS's routing policy asks every user of the server to show this link.
const FIX_THE_MAP_URL = 'https://www.openstreetmap.org/fixthemap';

function statusText(
  { t, tCount }: ReturnType<typeof useI18n>,
  check: Exclude<RouteCheck, { status: 'off' }>,
): string {
  switch (check.status) {
    case 'checking':
      return tCount('routes.checking', { count: check.remaining });
    case 'done':
      return t('routes.done');
    case 'limited':
      return t('routes.limited');
    case 'failed':
      return t('routes.failed');
  }
}

/** How far the walking-route check has got, with the routing server's attribution; nothing while it is off. */
export function RouteStatus({ check }: { check: RouteCheck }) {
  const i18n = useI18n();
  if (check.status === 'off') return null;
  return (
    <section
      data-testid="route-status"
      aria-live="polite"
      className="space-y-1 text-xs text-muted-foreground"
    >
      <p data-testid="route-status-text" data-status={check.status}>
        {statusText(i18n, check)}
      </p>
      <p>
        {i18n.t('routes.attribution')} ·{' '}
        <a
          href={FIX_THE_MAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {i18n.t('routes.fixMap')}
        </a>
      </p>
    </section>
  );
}
