'use client';

import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../Modal';
import { buttonClasses } from '../ui/classes';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before an action that cannot be undone; Cancel is first in focus order, so Enter never confirms by accident. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      title={title}
      description={message}
      onClose={onCancel}
      role="alertdialog"
      testId="confirm-dialog"
    >
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses('secondary')}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          data-testid="confirm-accept"
          className={buttonClasses('destructive')}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
