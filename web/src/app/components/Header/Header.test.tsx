// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../fixtures.test-support';
import { Header } from '.';

function renderHeader(walking = false) {
  const onOpenData = vi.fn();
  const onOpenSettings = vi.fn();
  renderWithI18n(
    <Header
      walking={walking}
      onOpenData={onOpenData}
      onOpenSettings={onOpenSettings}
    />,
  );
  return { onOpenData, onOpenSettings };
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
  });
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

afterEach(() => {
  setOnline(true);
});

describe('Header', () => {
  it('names the app', () => {
    renderHeader();
    expect(screen.getByTestId('home-title')).toHaveTextContent(
      'PowerTrailBuddy',
    );
  });

  it('links the logo and the name to the start of the app', () => {
    renderHeader();
    const link = screen.getByTestId('home-link');
    expect(link).toHaveAttribute('href', '/');
    expect(link).toContainElement(screen.getByTestId('home-title'));
  });

  // The wordmark every nobuddyorg app shares: an ink rule under the first word, the brand orange on "Buddy".
  it('underscores "PowerTrail" and puts the brand orange on "Buddy"', () => {
    renderHeader();
    expect(screen.getByText('PowerTrail').className).toContain('border-b-2');
    expect(screen.getByText('Buddy').className).toContain('text-brand-accent');
  });

  it('opens the data and settings dialogs', () => {
    const { onOpenData, onOpenSettings } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Your data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onOpenData).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps data and settings out of the way during a walk', () => {
    renderHeader(true);
    expect(
      screen.queryByRole('button', { name: 'Your data' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Settings' }),
    ).not.toBeInTheDocument();
  });

  it('shows when the device is offline', () => {
    renderHeader();
    expect(screen.queryByTestId('offline')).not.toBeInTheDocument();
    setOnline(false);
    expect(screen.getByTestId('offline')).toHaveTextContent('Offline');
    setOnline(true);
    expect(screen.queryByTestId('offline')).not.toBeInTheDocument();
  });
});
