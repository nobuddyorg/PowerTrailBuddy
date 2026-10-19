// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../fixtures.test-support';
import { ErrorNotice } from '.';

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('ErrorNotice', () => {
  it.each([
    ['load-failed', 'Your stored data could not be read.'],
    ['import-failed', 'The import failed.'],
    ['save-failed', 'Saving to this browser failed'],
    ['sample-failed', 'The sample data could not be loaded.'],
    ['share-empty', 'No file arrived from the share.'],
  ] as const)('announces %s', (error, text) => {
    renderWithI18n(<ErrorNotice error={error} onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });

  it('is dismissed by its button', () => {
    const onDismiss = vi.fn();
    renderWithI18n(<ErrorNotice error="save-failed" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
