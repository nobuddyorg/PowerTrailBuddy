'use client';

import { useI18n } from '../../i18n/useI18n';
import { formatDay } from '../../lib/format/dates';
import type { RecentLog, RecentLogType } from '../../lib/geocache/types';
import { Icon, type IconName } from '../Icon';
import { logTypeLabel } from '../labels';

const LOOK: Record<RecentLogType, { icon: IconName; className: string }> = {
  found: { icon: 'check', className: 'bg-primary-soft text-primary' },
  dnf: { icon: 'dnf', className: 'bg-destructive-soft text-destructive' },
  note: { icon: 'note', className: 'bg-muted text-muted-foreground' },
  maintenance: { icon: 'wrench', className: 'bg-warning-soft text-warning' },
  disabled: { icon: 'alert', className: 'bg-muted text-muted-foreground' },
  other: { icon: 'note', className: 'bg-muted text-muted-foreground' },
};

/** The newest logs as icons with their dates, newest first. */
export function RecentLogs({ logs }: { logs: readonly RecentLog[] }) {
  const { t, locale } = useI18n();
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('cache.noLogs')}</p>;
  }
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={t('cache.recentLogs')}>
      {logs.map((log, index) => (
        <li
          // Two logs of one type on one day are possible; their order is not.
          key={`${index}-${log.date}`}
          data-testid="recent-log"
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${LOOK[log.type].className}`}
        >
          <Icon name={LOOK[log.type].icon} className="h-3.5 w-3.5" />
          <span className="sr-only">{logTypeLabel(t, log.type)}</span>
          <span>{formatDay(log.date, locale)}</span>
        </li>
      ))}
    </ol>
  );
}
