'use client';

import { useI18n } from '../../i18n/useI18n';
import { formatDuration, formatRate } from '../../lib/format/format';
import { paceKnown } from '../../lib/ui-logic/walkStats';
import type { WalkPace, WalkProgress } from '../../lib/walk/walk';

function Figure({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-xl bg-card px-2 py-1.5 text-center ring-1 ring-border/60">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd data-testid={testId} className="text-sm font-bold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** Live numbers: progress, finds and DNFs, time so far, pace, and time still to go. */
export function WalkStats({
  progress,
  pace,
  remainingMinutes,
}: {
  progress: WalkProgress;
  pace: WalkPace;
  remainingMinutes: number;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label={t('walk.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary motion-safe:transition-[width]"
          style={{
            width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
          }}
        />
      </div>
      <dl className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        <Figure
          label={t('walk.stat.done')}
          value={`${progress.done}/${progress.total}`}
          testId="walk-progress"
        />
        <Figure
          label={t('walk.stat.foundDnf')}
          value={`${progress.found} / ${progress.dnf}`}
        />
        <Figure
          label={t('walk.stat.elapsed')}
          value={formatDuration(pace.elapsedMinutes, locale)}
        />
        <Figure
          label={t('walk.stat.rate')}
          value={paceKnown(pace) ? formatRate(pace.cachesPerHour, locale) : '–'}
        />
        <Figure
          label={t('walk.stat.remaining')}
          value={formatDuration(remainingMinutes, locale)}
        />
      </dl>
    </div>
  );
}
