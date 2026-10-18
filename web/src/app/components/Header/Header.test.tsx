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

function offerInstall(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = Object.assign(
    new Event('beforeinstallprompt', { cancelable: true }),
    { prompt },
  );
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
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

  it('switches the language and marks the current one', () => {
    renderHeader();
    const german = screen.getByRole('button', { name: 'DE' });
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(german);
    expect(screen.getByRole('button', { name: 'DE' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.getItem('lang')).toBe('de');
    expect(
      screen.getByRole('button', { name: 'Einstellungen' }),
    ).toBeInTheDocument();
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

  it('offers to install once the browser does, and shows the prompt only once', () => {
    renderHeader();
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
    const { event, prompt } = offerInstall();
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });

  it('tolerates a prompt the browser refuses', async () => {
    renderHeader();
    offerInstall(vi.fn().mockRejectedValue(new Error('refused')));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    });
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });

  it('drops the offer once the app is installed', () => {
    renderHeader();
    offerInstall();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });
});
