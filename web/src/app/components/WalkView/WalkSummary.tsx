'use client';

import { useI18n } from '../../i18n/useI18n';
import { buildFieldNotes } from '../../lib/export/fieldNotes';
import { formatDuration, formatRate } from '../../lib/format/format';
import { DRAFTS_UPLOAD_URL } from '../../lib/navigation/links';
import { paceKnown, visitEntries } from '../../lib/ui-logic/walkStats';
import type { WalkPace, WalkProgress, WalkState } from '../../lib/walk/walk';
import { Icon } from '../Icon';
import { useToast } from '../Toast/ToastProvider';
import { buttonClasses } from '../ui/classes';
import { downloadFile } from '../ui/download';

interface WalkSummaryProps {
  walk: WalkState;
  progress: WalkProgress;
  pace: WalkPace;
  /** Caches still open: the walk was finished early and can be taken up again. */
  canResume: boolean;
  /** Something was recorded, so the last outcome can be taken back from here too. */
  canUndo: boolean;
  onResume: () => void;
  onUndo: () => void;
  onDone: () => void;
}

/** The end of a walk: what it came to, the field notes to log it all at once, and sharing. */
export function WalkSummary({
  walk,
  progress,
  pace,
  canResume,
  canUndo,
  onResume,
  onUndo,
  onDone,
}: WalkSummaryProps) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const entries = visitEntries(walk);
  const counts = {
    found: progress.found,
    total: progress.total,
    duration: formatDuration(pace.elapsedMinutes, locale),
  };
  const text = paceKnown(pace)
    ? t('summary.shareText', {
        ...counts,
        rate: formatRate(pace.cachesPerHour, locale),
      })
    : t('summary.shareTextShort', counts);

  const exportNotes = () => {
    downloadFile({
      name: 'geocache_visits.txt',
      // A copy on a plain ArrayBuffer, which is what Blob accepts.
      data: Uint8Array.from(buildFieldNotes(entries)),
      type: 'text/plain;charset=utf-16le',
    });
    toast.show(t('toast.notesSaved'));
  };

  const share = () => {
    // A dismissed share sheet rejects; that is the user's choice, not an error.
    navigator.share({ title: t('brand.name'), text }).catch(() => {});
  };

  return (
    <section
      data-testid="walk-summary"
      aria-labelledby="walk-summary-title"
      className="space-y-4"
    >
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon name="trophy" className="h-7 w-7" />
        </span>
        <h2 id="walk-summary-title" className="text-xl font-bold">
          {canResume ? t('summary.paused') : t('summary.title')}
        </h2>
        <p
          data-testid="walk-summary-text"
          className="text-sm text-muted-foreground"
        >
          {text}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-primary-soft px-3 py-2">
          <dt className="text-xs text-primary-strong">{t('summary.found')}</dt>
          <dd className="text-2xl font-extrabold text-primary-strong">
            {progress.found}
          </dd>
        </div>
        <div className="rounded-xl bg-muted px-3 py-2">
          <dt className="text-xs text-muted-foreground">{t('summary.dnf')}</dt>
          <dd className="text-2xl font-extrabold">{progress.dnf}</dd>
        </div>
      </dl>
      {entries.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-border/60">
          <button
            type="button"
            onClick={exportNotes}
            className={buttonClasses('primary', 'w-full')}
          >
            <Icon name="download" />
            {t('summary.exportNotes')}
          </button>
          <p className="text-xs text-muted-foreground">
            {t('summary.notesHelp')}{' '}
            <a
              href={DRAFTS_UPLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline"
            >
              {t('summary.notesLink')}
            </a>
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {'share' in navigator && (
          <button
            type="button"
            onClick={share}
            className={buttonClasses('secondary', 'flex-1')}
          >
            <Icon name="share" />
            {t('summary.share')}
          </button>
        )}
        {canResume && (
          <button
            type="button"
            onClick={onResume}
            className={buttonClasses('secondary', 'flex-1')}
          >
            <Icon name="walk" />
            {t('summary.resume')}
          </button>
        )}
        {!canResume && canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className={buttonClasses('secondary', 'flex-1')}
          >
            <Icon name="undo" />
            {t('walk.undo')}
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className={buttonClasses('soft', 'flex-1')}
        >
          <Icon name="list" />
          {t('summary.done')}
        </button>
      </div>
    </section>
  );
}
