'use client';

import { useId } from 'react';

import { FIELD_CLASSES } from '../ui/classes';
import type { FieldSpec } from './fields';

interface NumberFieldProps {
  spec: FieldSpec;
  label: string;
  value: string;
  error: string;
  onChange: (value: string) => void;
}

/** A setting typed as text, so "1,5" and a half-typed value survive; the error is tied to the field. */
export function NumberField({
  spec,
  label,
  value,
  error,
  onChange,
}: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={spec.name}
        type="text"
        inputMode={spec.step === 1 ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        aria-invalid={error !== ''}
        aria-describedby={error ? errorId : undefined}
        className={FIELD_CLASSES}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
