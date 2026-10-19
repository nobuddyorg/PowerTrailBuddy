'use client';

import { Icon } from '../Icon';
import { buttonClasses, type ButtonVariant } from '../ui/classes';

// Extensions and the types Android's file picker and share sheet report for them.
const ACCEPT =
  '.zip,.gpx,application/zip,application/x-zip-compressed,application/gpx+xml';

interface ImportButtonProps {
  label: string;
  onFiles: (files: File[]) => void;
  disabled: boolean;
  variant?: ButtonVariant;
  className?: string;
}

/** A file input dressed as a button: a real, focusable input, so keyboard and screen readers reach it as one. */
export function ImportButton({
  label,
  onFiles,
  disabled,
  variant = 'primary',
  className = '',
}: ImportButtonProps) {
  return (
    <label
      className={buttonClasses(
        variant,
        `cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${className}`,
      )}
    >
      <input
        type="file"
        accept={ACCEPT}
        multiple
        disabled={disabled}
        data-testid="import-input"
        className="sr-only"
        onChange={(event) => {
          // A file input always has a FileList; null is for other input types.
          const files = [...event.currentTarget.files!];
          // Cleared, so choosing the same file again still fires a change.
          event.currentTarget.value = '';
          onFiles(files);
        }}
      />
      <Icon name="upload" />
      <span>{label}</span>
    </label>
  );
}
