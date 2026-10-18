'use client';

import { useId, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import type { CacheType } from '../../lib/geocache/types';
import {
  DEFAULT_TRAIL_SETTINGS,
  type TrailSettings,
} from '../../lib/trails/types';
import {
  PRESET_NAMES,
  withPreset,
  type PresetName,
} from '../../lib/ui-logic/presets';
import { cacheTypeLabel, type Translate } from '../labels';
import { Modal } from '../Modal';
import { buttonClasses, CHIP_CLASSES } from '../ui/classes';
import {
  CACHE_TYPES,
  draftErrors,
  draftPreset,
  draftSettings,
  NUMERIC_FIELDS,
  toDraft,
  type Draft,
  type DraftErrors,
  type FieldSpec,
  type NumericField,
} from './fields';
import { IgnoredCaches, type IgnoredCache } from './IgnoredCaches';
import { NumberField } from './NumberField';

function fieldLabel(t: Translate, name: NumericField): string {
  switch (name) {
    case 'maxDifficulty':
      return t('settings.field.maxDifficulty');
    case 'maxTerrain':
      return t('settings.field.maxTerrain');
    case 'maxGapMeters':
      return t('settings.field.maxGapMeters');
    case 'minCaches':
      return t('settings.field.minCaches');
    case 'maxWalkKilometers':
      return t('settings.field.maxWalkKilometers');
    case 'walkingSpeedKmh':
      return t('settings.field.walkingSpeedKmh');
    case 'minutesPerCache':
      return t('settings.field.minutesPerCache');
    case 'detourFactor':
      return t('settings.field.detourFactor');
  }
}

function presetLabel(t: Translate, preset: PresetName): string {
  switch (preset) {
    case 'standard':
      return t('settings.preset.standard');
    case 'classic':
      return t('settings.preset.classic');
    case 'relaxed':
      return t('settings.preset.relaxed');
  }
}

function errorText(
  t: Translate,
  { spec, error }: { spec: FieldSpec; error: DraftErrors[NumericField] },
): string {
  if (error === 'range')
    return t('settings.error.range', { min: spec.min, max: spec.max });
  if (error === 'step' && spec.step === 1) return t('settings.error.whole');
  if (error === 'step') return t('settings.error.step', { step: spec.step });
  return t('settings.error.number');
}

const TRAIL_FIELDS: readonly NumericField[] = [
  'maxGapMeters',
  'minCaches',
  'maxWalkKilometers',
  'maxDifficulty',
  'maxTerrain',
];

interface SettingsDialogProps {
  settings: TrailSettings;
  locallyFoundCount: number;
  ignored: readonly IgnoredCache[];
  onApply: (settings: TrailSettings) => void;
  onResetLocallyFound: () => void;
  onUnignore: (code: string) => void;
  onClose: () => void;
}

/** Edits a draft of the trail settings; nothing changes until Apply, and Apply waits for valid values. */
export function SettingsDialog({
  settings,
  locallyFoundCount,
  ignored,
  onApply,
  onResetLocallyFound,
  onUnignore,
  onClose,
}: SettingsDialogProps) {
  const { t, tCount, locale } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings, locale));
  const errors = draftErrors(draft);
  const valid = Object.keys(errors).length === 0;
  const typesErrorId = useId();
  const preset = draftPreset(draft);

  const toggleType = (type: CacheType, checked: boolean) =>
    setDraft((current) => ({
      ...current,
      cacheTypes: checked
        ? [...current.cacheTypes, type]
        : current.cacheTypes.filter((entry) => entry !== type),
    }));

  const setValue = (name: NumericField, value: string) =>
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [name]: value },
    }));

  const choosePreset = (name: PresetName) => {
    const chosen = withPreset(DEFAULT_TRAIL_SETTINGS, name);
    const formatted = toDraft(chosen, locale).values;
    setDraft((current) => ({
      ...current,
      values: {
        ...current.values,
        maxGapMeters: formatted.maxGapMeters,
        minCaches: formatted.minCaches,
      },
    }));
  };

  const field = (spec: FieldSpec) => (
    <NumberField
      key={spec.name}
      spec={spec}
      label={fieldLabel(t, spec.name)}
      value={draft.values[spec.name]}
      error={
        errors[spec.name]
          ? errorText(t, { spec, error: errors[spec.name] })
          : ''
      }
      onChange={(value) => setValue(spec.name, value)}
    />
  );

  return (
    <Modal
      title={t('settings.title')}
      onClose={onClose}
      testId="settings-dialog"
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onApply(draftSettings(draft));
          onClose();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            {t('settings.preset.label')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {PRESET_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={preset === name}
                data-testid={`preset-${name}`}
                onClick={() => choosePreset(name)}
                className={CHIP_CLASSES}
              >
                {presetLabel(t, name)}
              </button>
            ))}
          </div>
          <p
            data-testid="preset-hint"
            className="text-xs text-muted-foreground"
          >
            {preset === 'custom'
              ? t('settings.preset.customHint', {
                  name: t('settings.preset.custom'),
                })
              : t('settings.preset.hint', { name: presetLabel(t, preset) })}
          </p>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">
            {t('settings.trailGroup')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {NUMERIC_FIELDS.filter((spec) =>
              TRAIL_FIELDS.includes(spec.name),
            ).map(field)}
          </div>
        </fieldset>
        <fieldset
          aria-describedby={errors.cacheTypes ? typesErrorId : undefined}
          className="space-y-1"
        >
          <legend className="text-sm font-semibold">
            {t('settings.cacheTypes')}
          </legend>
          <div className="grid grid-cols-2 gap-x-4">
            {CACHE_TYPES.map((type) => (
              <label
                key={type}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  data-testid={`cache-type-${type}`}
                  checked={draft.cacheTypes.includes(type)}
                  onChange={(event) =>
                    toggleType(type, event.currentTarget.checked)
                  }
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                {cacheTypeLabel(t, type)}
              </label>
            ))}
          </div>
          {errors.cacheTypes && (
            <p id={typesErrorId} className="text-sm text-destructive">
              {t('settings.error.cacheTypes')}
            </p>
          )}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">
            {t('settings.walkGroup')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {NUMERIC_FIELDS.filter(
              (spec) => !TRAIL_FIELDS.includes(spec.name),
            ).map(field)}
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(toDraft(DEFAULT_TRAIL_SETTINGS, locale))}
            data-testid="settings-reset"
            className={buttonClasses('ghost', 'mr-auto')}
          >
            {t('settings.resetDefaults')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={buttonClasses('secondary')}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!valid}
            data-testid="settings-apply"
            className={buttonClasses('primary')}
          >
            {t('settings.apply')}
          </button>
        </div>
        <div className="space-y-4 border-t border-border pt-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              {t('settings.locallyFound')}
            </h3>
            <button
              type="button"
              onClick={onResetLocallyFound}
              data-testid="reset-locally-found"
              disabled={locallyFoundCount === 0}
              className={buttonClasses('secondary')}
            >
              {tCount('settings.resetLocallyFound', {
                count: locallyFoundCount,
              })}
            </button>
          </section>
          <IgnoredCaches caches={ignored} onUnignore={onUnignore} />
        </div>
      </form>
    </Modal>
  );
}
