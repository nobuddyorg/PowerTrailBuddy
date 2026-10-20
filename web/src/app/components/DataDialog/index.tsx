'use client';

import { useState } from 'react';

import type { ImportInfo } from '../../data/store';
import { useI18n } from '../../i18n/useI18n';
import { formatMoment } from '../../lib/format/dates';
import { ConfirmDialog } from '../ConfirmDialog';
import { Icon } from '../Icon';
import { ImportButton } from '../ImportButton';
import { Modal } from '../Modal';
import { buttonClasses } from '../ui/classes';

interface DataDialogProps {
  cacheCount: number;
  trailCount: number;
  locallyFoundCount: number;
  ignoredCount: number;
  importInfo: ImportInfo | undefined;
  importing: boolean;
  onImport: (files: File[]) => void;
  onClear: () => void;
  onClose: () => void;
}

function Count({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className="text-lg font-bold">
        {value}
      </dd>
    </div>
  );
}

/** What is stored on this device, adding more, and wiping it. */
export function DataDialog(props: DataDialogProps) {
  const { t, locale } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const { importInfo } = props;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Modal
      title={t('data.title')}
      onClose={props.onClose}
      phoneLayout="fullScreen"
      testId="data-dialog"
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-2">
          <Count
            label={t('data.caches')}
            value={props.cacheCount}
            testId="data-caches"
          />
          <Count
            label={t('data.trails')}
            value={props.trailCount}
            testId="data-trails"
          />
          <Count
            label={t('data.locallyFound')}
            value={props.locallyFoundCount}
            testId="data-locally-found"
          />
          <Count
            label={t('data.ignored')}
            value={props.ignoredCount}
            testId="data-ignored"
          />
        </dl>
        {importInfo && (
          <section className="space-y-1 text-sm">
            <h3 className="font-semibold">{t('data.lastImport')}</h3>
            <p data-testid="last-import">
              {formatMoment(importInfo.at, { locale, timeZone })}
            </p>
            <p className="break-words text-muted-foreground">
              {importInfo.fileNames.join(', ')}
            </p>
          </section>
        )}
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('data.importHelp')}
          </p>
          <ImportButton
            label={props.importing ? t('import.importing') : t('data.import')}
            onFiles={props.onImport}
            disabled={props.importing}
            className="w-full"
          />
        </section>
        <section className="space-y-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{t('data.privacy')}</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            data-testid="clear-data"
            className={buttonClasses('secondary', 'w-full text-destructive')}
          >
            <Icon name="trash" />
            {t('data.clear')}
          </button>
        </section>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t('clear.title')}
          message={t('clear.message')}
          confirmLabel={t('clear.confirm')}
          onConfirm={() => {
            setConfirming(false);
            props.onClear();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Modal>
  );
}
