'use client';

import { useI18n } from '../../i18n/useI18n';
import { POCKET_QUERY_URL } from '../../lib/navigation/links';
import { Icon, type IconName } from '../Icon';
import { ImportButton } from '../ImportButton';
import { buttonClasses } from '../ui/classes';

interface EmptyStateProps {
  importing: boolean;
  onImport: (files: File[]) => void;
  onTrySample: () => void;
}

function Step({
  number,
  icon,
  title,
  children,
}: {
  number: number;
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon name={icon} className="h-6 w-6" />
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white"
        >
          {number}
        </span>
      </span>
      <div className="space-y-1 text-sm">
        <h3 className="text-base font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/** The first run: what a power trail is, how to get a Pocket Query here, and a sample to try it with. */
export function EmptyState({
  importing,
  onImport,
  onTrySample,
}: EmptyStateProps) {
  const { t } = useI18n();
  return (
    <div
      data-testid="empty-state"
      className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6"
    >
      <section className="space-y-2 text-center">
        <svg
          viewBox="0 0 240 80"
          aria-hidden="true"
          className="mx-auto h-20 w-60"
        >
          <path
            d="M10 66 C 50 10, 90 74, 130 36 S 200 12, 230 22"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          {[
            [10, 66],
            [52, 36],
            [92, 54],
            [130, 36],
            [176, 22],
            [230, 22],
          ].map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="7"
              fill="var(--primary)"
              stroke="white"
              strokeWidth="3"
            />
          ))}
          <circle
            cx="130"
            cy="36"
            r="10"
            fill="var(--accent-bright)"
            stroke="white"
            strokeWidth="3"
          />
        </svg>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t('page.tagline')}
        </p>
        <h2
          data-testid="empty-title"
          className="text-2xl font-extrabold tracking-tight"
        >
          {t('empty.title')}
        </h2>
        <p className="text-muted-foreground">{t('empty.lead')}</p>
      </section>
      <ol className="space-y-3">
        <Step number={1} icon="search" title={t('empty.step1.title')}>
          <p>{t('empty.step1.text')}</p>
          <a
            href={POCKET_QUERY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline"
          >
            {t('empty.step1.link')}
            <Icon name="external" className="h-4 w-4" />
          </a>
        </Step>
        <Step number={2} icon="download" title={t('empty.step2.title')}>
          <p>{t('empty.step2.text')}</p>
        </Step>
        <Step number={3} icon="upload" title={t('empty.step3.title')}>
          <p>{t('empty.step3.text')}</p>
        </Step>
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ImportButton
          label={importing ? t('import.importing') : t('import.button')}
          onFiles={onImport}
          disabled={importing}
          className="flex-1 text-base"
        />
        <button
          type="button"
          onClick={onTrySample}
          disabled={importing}
          data-testid="try-sample"
          className={buttonClasses('secondary', 'flex-1')}
        >
          <Icon name="sparkle" />
          {t('empty.sample')}
        </button>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Icon name="hide" className="mt-0.5 h-4 w-4 shrink-0" />
        {t('empty.privacy')}
      </p>
    </div>
  );
}
