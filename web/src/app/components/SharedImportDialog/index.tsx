'use client';

import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../Modal';
import { buttonClasses } from '../ui/classes';

interface SharedImportDialogProps {
  files: readonly File[];
  onImport: () => void;
  onCancel: () => void;
}

/** Any website can post a form to the share target, so a share names its files and waits for a tap; Cancel comes first. */
export function SharedImportDialog({
  files,
  onImport,
  onCancel,
}: SharedImportDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      title={t('shared.title')}
      description={t('shared.message')}
      onClose={onCancel}
      role="alertdialog"
      testId="shared-import-dialog"
    >
      <ul className="mb-4 space-y-1 text-sm">
        {files.map((file, index) => (
          <li
            // Two shared files can carry one name; the position cannot repeat.
            key={`${index}-${file.name}`}
            data-testid="shared-file"
            className="break-all font-medium"
          >
            {file.name}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid="shared-import-cancel"
          className={buttonClasses('secondary')}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onImport}
          data-testid="shared-import-accept"
          className={buttonClasses('primary')}
        >
          {t('shared.confirm')}
        </button>
      </div>
    </Modal>
  );
}
