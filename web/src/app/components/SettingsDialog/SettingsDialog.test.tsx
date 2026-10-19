// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TRAIL_SETTINGS } from '../../lib/trails/types';
import { renderWithI18n } from '../fixtures.test-support';
import { SettingsDialog } from '.';

function renderDialog(
  overrides: Partial<Parameters<typeof SettingsDialog>[0]> = {},
) {
  const props = {
    settings: DEFAULT_TRAIL_SETTINGS,
    locallyFoundCount: 2,
    ignored: [
      { code: 'GCSU1', name: 'Old Oak' },
      { code: 'GCSU9', name: '' },
    ],
    onApply: vi.fn(),
    onResetLocallyFound: vi.fn(),
    onUnignore: vi.fn(),
    walkingRoutes: false,
    onWalkingRoutesChange: vi.fn(),
    canInstall: false,
    onInstall: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithI18n(<SettingsDialog {...props} />);
  return props;
}

const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const apply = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('SettingsDialog', () => {
  it('applies every edited field and closes', () => {
    const { onApply, onClose } = renderDialog();
    type('Largest gap between caches (m)', '250');
    type('Fewest caches per trail', '8');
    type('Longest walk (km)', '12.5');
    type('Longest way back to the start (m)', '400');
    type('Highest difficulty', '3');
    type('Highest terrain', '2.5');
    type('Walking speed (km/h)', '5');
    type('Minutes per cache', '2');
    type('Detour factor (path vs. straight line)', '1.5');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Multi-cache' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Round trips only' }));
    apply();
    expect(onApply).toHaveBeenCalledWith({
      cacheTypes: ['traditional', 'multi'],
      maxGapMeters: 250,
      minCaches: 8,
      maxWalkKilometers: 12.5,
      loopsOnly: true,
      maxReturnMeters: 400,
      maxDifficulty: 3,
      maxTerrain: 2.5,
      walkingSpeedKmh: 5,
      minutesPerCache: 2,
      detourFactor: 1.5,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the preset in use, and fills in the gap and size of a chosen one', () => {
    const { onApply } = renderDialog();
    expect(screen.getByRole('button', { name: 'Standard' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('preset-hint')).toHaveTextContent(
      'Standard: gap and trail size as the preset sets them.',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Classic power trail' }),
    );
    expect(field('Largest gap between caches (m)')).toHaveValue('200');
    expect(field('Fewest caches per trail')).toHaveValue('20');
    fireEvent.click(screen.getByRole('button', { name: 'Relaxed' }));
    expect(screen.getByRole('button', { name: 'Relaxed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    type('Fewest caches per trail', '7');
    expect(screen.getByTestId('preset-hint')).toHaveTextContent(
      'Custom: your own gap and trail size.',
    );
    apply();
    expect(onApply).toHaveBeenCalledWith({
      ...DEFAULT_TRAIL_SETTINGS,
      maxGapMeters: 500,
      minCaches: 7,
    });
  });

  it('explains each invalid value at its field and refuses to apply', () => {
    const { onApply } = renderDialog();
    type('Highest terrain', '7');
    type('Fewest caches per trail', '2.5');
    type('Highest difficulty', '1.3');
    type('Walking speed (km/h)', 'fast');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Traditional' }));
    expect(screen.getByText('Enter a value from 1 to 5.')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number.')).toBeInTheDocument();
    expect(screen.getByText('Enter a multiple of 0.5.')).toBeInTheDocument();
    expect(screen.getByText('Enter a number.')).toBeInTheDocument();
    expect(
      screen.getByText('Choose at least one cache type.'),
    ).toBeInTheDocument();
    expect(field('Highest terrain')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.submit(field('Highest terrain').closest('form')!);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('resets the draft to the defaults', () => {
    renderDialog({
      settings: { ...DEFAULT_TRAIL_SETTINGS, maxGapMeters: 800 },
    });
    expect(field('Largest gap between caches (m)')).toHaveValue('800');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(field('Largest gap between caches (m)')).toHaveValue('300');
  });

  it('forgets the caches marked found, unless there are none', () => {
    const { onResetLocallyFound } = renderDialog();
    fireEvent.click(
      screen.getByRole('button', { name: 'Forget 2 caches marked found' }),
    );
    expect(onResetLocallyFound).toHaveBeenCalledTimes(1);
  });

  it('has nothing to forget without found marks', () => {
    renderDialog({ locallyFoundCount: 0 });
    expect(
      screen.getByRole('button', { name: 'Forget 0 caches marked found' }),
    ).toBeDisabled();
  });

  it('lists the ignored caches and lets one back in', () => {
    const { onUnignore } = renderDialog();
    expect(screen.getByText('Ignored caches (2)')).toBeInTheDocument();
    expect(
      screen.getAllByTestId('ignored-cache').map((item) => item.textContent),
    ).toEqual(['GCSU1 Old Oak', 'GCSU9 ']);
    fireEvent.click(
      screen.getByRole('button', { name: 'Stop ignoring GCSU9' }),
    );
    expect(onUnignore).toHaveBeenCalledWith('GCSU9');
  });

  it('says when nothing is ignored', () => {
    renderDialog({ ignored: [] });
    expect(
      screen.getByText('You have not ignored any cache.'),
    ).toBeInTheDocument();
  });

  it('turns walking routes on at once, without Apply, and says what leaves the device', () => {
    const { onWalkingRoutesChange, onApply } = renderDialog();
    const toggle = screen.getByRole('checkbox', {
      name: 'Check trails on real footpaths',
    });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(
      expect.stringContaining('routing.openstreetmap.de'),
    );
    fireEvent.click(toggle);
    expect(onWalkingRoutesChange).toHaveBeenCalledWith(true);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('turns walking routes off again', () => {
    const { onWalkingRoutesChange } = renderDialog({ walkingRoutes: true });
    const toggle = screen.getByRole('checkbox', {
      name: 'Check trails on real footpaths',
    });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onWalkingRoutesChange).toHaveBeenCalledWith(false);
  });

  it('closes without applying on Cancel', () => {
    const { onApply, onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('switches the language at once and marks the current one', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.getItem('lang')).toBe('de');
    expect(
      screen.getByRole('dialog', { name: 'Einstellungen' }),
    ).toBeInTheDocument();
  });

  it('offers to install only while the browser does', () => {
    renderDialog();
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });

  it('installs from the offer', () => {
    const { onInstall } = renderDialog({ canInstall: true });
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });
});
