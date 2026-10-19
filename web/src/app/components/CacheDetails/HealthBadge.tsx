'use client';

import { useI18n } from '../../i18n/useI18n';
import { cacheHealth } from '../../lib/geocache/health';
import type { Geocache } from '../../lib/geocache/types';
import { Icon } from '../Icon';
import { healthLabel } from '../labels';

/** A warning chip for a doubtful cache; nothing for a healthy one. */
export function HealthBadge({ cache }: { cache: Geocache }) {
  const { t } = useI18n();
  const health = cacheHealth(cache);
  if (health === 'ok') return null;
  const tone =
    health === 'disabled'
      ? 'bg-muted text-muted-foreground'
      : 'bg-warning-soft text-warning';
  return (
    <span
      data-testid="health-badge"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      <Icon
        name={health === 'needs-maintenance' ? 'wrench' : 'alert'}
        className="h-3.5 w-3.5"
      />
      {healthLabel(t, health)}
    </span>
  );
}
