// @vitest-environment jsdom
import type { Control, Map as LeafletMap } from 'leaflet';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { watchUserMoves } from './userMoves';

// A stand-in for the few parts of Leaflet's map and zoom control the watcher touches.
function fakeMap() {
  const container = document.createElement('div');
  const controls = document.createElement('div');
  const zoomOut = document.createElement('a');
  controls.append(zoomOut);
  const marker = document.createElement('span');
  container.append(controls, marker);
  // Leaflet's zoom buttons stop their clicks from bubbling.
  zoomOut.addEventListener('click', (event) => event.stopPropagation());
  const handlers = new Map<string, () => void>();
  const map = {
    getContainer: () => container,
    on: vi.fn((events: string, handler: () => void) =>
      events.split(' ').forEach((event) => handlers.set(event, handler)),
    ),
    off: vi.fn((events: string) =>
      events.split(' ').forEach((event) => handlers.delete(event)),
    ),
  };
  return {
    map: map as unknown as LeafletMap,
    zoomControl: { getContainer: () => controls } as unknown as Control.Zoom,
    container,
    zoomOut,
    marker,
    fire: (event: string) => handlers.get(event)?.(),
  };
}

let fake: ReturnType<typeof fakeMap>;
let onMove: ReturnType<typeof vi.fn<() => void>>;
let stop: () => void;

beforeEach(() => {
  fake = fakeMap();
  onMove = vi.fn<() => void>();
  stop = watchUserMoves(fake.map, fake.zoomControl, onMove);
});

describe('watchUserMoves', () => {
  it("counts Leaflet's own drag and box zoom", () => {
    fake.fire('dragstart');
    fake.fire('boxzoomend');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('counts the wheel, a double tap and a pinch, but not one finger', () => {
    fireEvent.wheel(fake.container);
    fireEvent.dblClick(fake.container);
    fireEvent.touchStart(fake.container, { touches: [{}] });
    expect(onMove).toHaveBeenCalledTimes(2);
    fireEvent.touchStart(fake.container, { touches: [{}, {}] });
    expect(onMove).toHaveBeenCalledTimes(3);
  });

  it('counts the keys that pan or zoom, unless held with a modifier', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      fireEvent.keyDown(fake.container, { key });
    }
    for (const key of ['+', '=', '-', '_']) {
      fireEvent.keyDown(fake.container, { key });
    }
    expect(onMove).toHaveBeenCalledTimes(8);
    fireEvent.keyDown(fake.container, { key: 'Tab' });
    fireEvent.keyDown(fake.container, { key: '+', ctrlKey: true });
    fireEvent.keyDown(fake.container, { key: '-', altKey: true });
    fireEvent.keyDown(fake.container, { key: 'ArrowUp', metaKey: true });
    expect(onMove).toHaveBeenCalledTimes(8);
  });

  it('counts a zoom button, though it stops its click, and no other click', () => {
    fireEvent.click(fake.zoomOut);
    expect(onMove).toHaveBeenCalledTimes(1);
    fireEvent.click(fake.marker);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('stops listening when asked', () => {
    stop();
    fake.fire('dragstart');
    fireEvent.wheel(fake.container);
    fireEvent.click(fake.zoomOut);
    expect(onMove).not.toHaveBeenCalled();
  });
});
