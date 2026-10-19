import type { Control, Map as LeafletMap } from 'leaflet';

// What Leaflet's keyboard handler pans or zooms on; it ignores keys held with Alt, Ctrl or Meta.
const MOVE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  '+',
  '=',
  '-',
  '_',
]);

/** Calls `onMove` whenever the user pans or zooms by hand, and never for the app's own fits; returns the way to stop. */
export function watchUserMoves(
  map: LeafletMap,
  zoomControl: Control.Zoom,
  onMove: () => void,
): () => void {
  const container = map.getContainer();
  const controls = zoomControl.getContainer();
  const listening = new AbortController();
  const options = { signal: listening.signal, passive: true };
  // Leaflet's input handlers start their zoom a frame later, as the app's animated fits do, so inputs are watched instead.
  map.on('dragstart boxzoomend', onMove);
  container.addEventListener('wheel', onMove, options);
  container.addEventListener('dblclick', onMove, options);
  container.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) onMove();
    },
    options,
  );
  container.addEventListener(
    'keydown',
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (MOVE_KEYS.has(event.key)) onMove();
    },
    options,
  );
  // Captured: the zoom buttons stop their clicks from bubbling.
  container.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Node && controls?.contains(event.target))
        onMove();
    },
    { ...options, capture: true },
  );
  return () => {
    listening.abort();
    map.off('dragstart boxzoomend', onMove);
  };
}
