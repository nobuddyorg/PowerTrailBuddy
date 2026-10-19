// A stand-in for the Leaflet map in jsdom: `vi.mock('../Map', () => import('../Map/mapStub.test-support'))`.
import { useEffect } from 'react';

import type { MapProps } from './types';

/** The props of the map's latest render, for asserting what a screen asked it to draw. */
export const mapStub: { props?: MapProps } = {};

/** Shows what it was given as text, and offers a button per tappable thing the real map would draw. */
export default function MapStub(props: MapProps) {
  useEffect(() => {
    mapStub.props = props;
  });
  const { content, onSelectTrail, onSelectCache, onUserPan } = props;
  const trailIds = [
    ...new Set(content.lines.map((line) => line.trailId).filter(Boolean)),
  ];
  return (
    <div
      role="region"
      aria-label={props.labels.region}
      data-testid="map"
      data-frame={props.frame?.id}
      data-follow={props.follow.length}
    >
      {trailIds.map((trailId) => (
        <button
          key={trailId}
          type="button"
          onClick={() => onSelectTrail?.(trailId)}
        >
          {`map trail ${trailId}`}
        </button>
      ))}
      {content.markers.map((marker) => (
        <button
          key={marker.code}
          type="button"
          data-tone={marker.tone}
          onClick={() => onSelectCache?.(marker.code)}
        >
          {`map cache ${marker.code}`}
        </button>
      ))}
      <button type="button" onClick={() => onUserPan?.()}>
        map pan
      </button>
    </div>
  );
}
