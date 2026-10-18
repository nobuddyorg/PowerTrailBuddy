// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SheetSnap } from '../../lib/ui-logic/sheet';
import { renderWithI18n } from '../fixtures.test-support';
import { BottomSheet } from '.';

function Sheet({ initial = 'half' }: { initial?: SheetSnap }) {
  const [snap, setSnap] = useState<SheetSnap>(initial);
  return (
    <BottomSheet snap={snap} onSnapChange={setSnap} label="Trails">
      <p>Content</p>
    </BottomSheet>
  );
}

const sheet = () => screen.getByRole('region', { name: 'Trails' });
const handle = () => screen.getByTestId('sheet-handle');

beforeEach(() => {
  localStorage.setItem('lang', 'en');
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
});

describe('BottomSheet', () => {
  it('holds its content at the snap point it is given, its handle saying which', () => {
    renderWithI18n(<Sheet />);
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(sheet()).toHaveAttribute('data-snap', 'half');
    expect(sheet().style.height).toBe('55dvh');
    expect(handle()).toHaveAccessibleName('Resize panel, now half height');
  });

  it('grows with a tap on the handle and drops back from the top', () => {
    renderWithI18n(<Sheet initial="peek" />);
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-snap', 'half');
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-snap', 'full');
    expect(handle()).toHaveAccessibleName('Resize panel, now full height');
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-snap', 'peek');
    expect(handle()).toHaveAccessibleName('Resize panel, now small');
  });

  it('resizes from the keyboard', () => {
    renderWithI18n(<Sheet />);
    fireEvent.keyDown(handle(), { key: 'ArrowUp' });
    expect(sheet()).toHaveAttribute('data-snap', 'full');
    fireEvent.keyDown(handle(), { key: 'ArrowDown' });
    expect(sheet()).toHaveAttribute('data-snap', 'half');
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(sheet()).toHaveAttribute('data-snap', 'peek');
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(sheet()).toHaveAttribute('data-snap', 'full');
    fireEvent.keyDown(handle(), { key: 'Enter' });
    expect(sheet()).toHaveAttribute('data-snap', 'full');
  });

  it('follows a drag and settles at the nearest snap point, without the closing click counting as a tap', () => {
    renderWithI18n(<Sheet />);
    fireEvent.pointerDown(handle(), { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: 300, pointerId: 1 });
    expect(sheet().style.height).toBe('75dvh');
    fireEvent.pointerUp(handle(), { clientY: 300, pointerId: 1 });
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-snap', 'full');
    expect(sheet().style.height).toBe('92dvh');
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-snap', 'peek');
  });

  it('treats a wobble under a few pixels as a tap', () => {
    renderWithI18n(<Sheet />);
    fireEvent.pointerDown(handle(), { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: 497, pointerId: 1 });
    expect(sheet().style.height).toBe('55dvh');
    fireEvent.pointerUp(handle(), { clientY: 497, pointerId: 1 });
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-snap', 'full');
  });

  it('ignores pointer moves that did not start on the handle, and a cancelled drag settles too', () => {
    renderWithI18n(<Sheet />);
    fireEvent.pointerMove(handle(), { clientY: 100, pointerId: 1 });
    expect(sheet().style.height).toBe('55dvh');
    fireEvent.pointerUp(handle(), { clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(handle(), { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: 900, pointerId: 1 });
    fireEvent.pointerCancel(handle(), { pointerId: 1 });
    expect(sheet()).toHaveAttribute('data-snap', 'peek');
  });
});
