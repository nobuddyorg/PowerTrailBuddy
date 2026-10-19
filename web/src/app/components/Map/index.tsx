'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type {
  Canvas,
  LatLngExpression,
  LayerGroup,
  Map as LeafletMap,
} from 'leaflet';

import type { Coordinates } from '../../lib/geocache/types';
import {
  badgeElement,
  foundElement,
  parkingElement,
  positionElement,
  targetPulseElement,
  textElement,
} from './elements';
import { lineStyle, markerStyle } from './styles';
import type { MapProps } from './types';
import { watchUserMoves } from './userMoves';

type Leaflet = typeof import('leaflet');

interface LoadedMap {
  L: Leaflet;
  map: LeafletMap;
  renderer: Canvas;
  lineLayer: LayerGroup;
  markerLayer: LayerGroup;
  overlayLayer: LayerGroup;
  positionLayer: LayerGroup;
}

const FIT_MAX_ZOOM = 17;
const FOLLOW_MIN_ZOOM = 16;
const EDGE_PADDING = 32;

const toLatLng = ({ latitude, longitude }: Coordinates): LatLngExpression => [
  latitude,
  longitude,
];

/** The only Leaflet wrapper: draws exactly the content and position it is given. */
export default function MapView({
  content,
  position,
  frame,
  follow,
  coveredBottom,
  onSelectTrail,
  onSelectCache,
  onUserPan,
  labels,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedMap>();
  const labelsRef = useRef(labels);
  const callbacks = useRef({ onSelectTrail, onSelectCache, onUserPan });
  const coveredRef = useRef(coveredBottom);

  useEffect(() => {
    callbacks.current = { onSelectTrail, onSelectCache, onUserPan };
    coveredRef.current = coveredBottom;
  });

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    let zoomAnimating = false;
    let stopWatching = () => {};
    void (async () => {
      // Imported here: Leaflet touches window on import, which the static prerender has none of.
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;
      const { zoomIn, zoomOut, attribution } = labelsRef.current;
      map = L.map(containerRef.current, { zoomControl: false }).setView(
        [51, 10],
        5,
      );
      const zoomControl = L.control
        .zoom({
          position: 'topright',
          zoomInTitle: zoomIn,
          zoomOutTitle: zoomOut,
        })
        .addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // A CORS tile is a readable response public/sw.js can keep for offline; an opaque one is not.
        crossOrigin: true,
        attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">${attribution}</a>`,
      }).addTo(map);
      stopWatching = watchUserMoves(map, zoomControl, () =>
        callbacks.current.onUserPan?.(),
      );
      map.on('zoomanim', () => (zoomAnimating = true));
      map.on('moveend', () => (zoomAnimating = false));
      setLoaded({
        L,
        map,
        // A generous tolerance, so a fingertip hits a thin trail line.
        renderer: L.canvas({ padding: 0.5, tolerance: 8 }),
        lineLayer: L.layerGroup().addTo(map),
        markerLayer: L.layerGroup().addTo(map),
        overlayLayer: L.layerGroup().addTo(map),
        positionLayer: L.layerGroup().addTo(map),
      });
    })();
    return () => {
      cancelled = true;
      stopWatching();
      setLoaded(undefined);
      const removed = map;
      // Leaflet 1.9 ends a zoom animation on a timer that remove() leaves running, which then reads the removed pane.
      if (zoomAnimating) removed?.once('moveend', () => removed.remove());
      else removed?.remove();
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const { L, renderer, lineLayer, markerLayer, overlayLayer } = loaded;
    lineLayer.clearLayers();
    markerLayer.clearLayers();
    overlayLayer.clearLayers();
    const selectTrail = (trailId: string) => () => {
      if (trailId) callbacks.current.onSelectTrail?.(trailId);
    };
    const selectCache = (code: string) => () =>
      callbacks.current.onSelectCache?.(code);
    for (const line of content.lines) {
      L.polyline(line.points.map(toLatLng), {
        renderer,
        ...lineStyle(line.tone, line.color),
        interactive: line.trailId !== '',
      })
        .on('click', selectTrail(line.trailId))
        .addTo(lineLayer);
    }
    for (const entry of content.markers) {
      if (entry.tone === 'found') {
        L.marker(toLatLng(entry), {
          icon: L.divIcon({
            html: foundElement(),
            className: '',
            iconSize: [20, 20],
          }),
          keyboard: false,
        })
          .bindTooltip(textElement(entry.label))
          .on('click', selectCache(entry.code))
          .addTo(overlayLayer);
        continue;
      }
      if (entry.tone === 'target') {
        L.marker(toLatLng(entry), {
          icon: L.divIcon({
            html: targetPulseElement(),
            className: '',
            iconSize: [34, 34],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(overlayLayer);
      }
      L.circleMarker(toLatLng(entry), { renderer, ...markerStyle(entry) })
        .bindTooltip(textElement(entry.label))
        .on('click', selectCache(entry.code))
        .addTo(markerLayer);
    }
    for (const badge of content.badges) {
      L.marker(toLatLng(badge), {
        icon: L.divIcon({
          html: badgeElement(badge),
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 30],
        }),
        keyboard: false,
        zIndexOffset: badge.emphasised ? 1000 : 0,
      })
        .on('click', selectTrail(badge.trailId))
        .addTo(overlayLayer);
    }
    for (const spot of content.parking) {
      L.marker(toLatLng(spot), {
        icon: L.divIcon({
          html: parkingElement(),
          className: '',
          iconSize: [22, 22],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(overlayLayer);
    }
  }, [loaded, content]);

  useEffect(() => {
    if (!loaded) return;
    const { L, positionLayer } = loaded;
    positionLayer.clearLayers();
    if (!position) return;
    const center = toLatLng(position.coordinates);
    L.circle(center, {
      radius: position.accuracyMeters,
      color: '#2563eb',
      weight: 1,
      opacity: 0.4,
      fillColor: '#2563eb',
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(positionLayer);
    L.marker(center, {
      icon: L.divIcon({
        html: positionElement(position.heading),
        className: '',
        iconSize: [44, 44],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(positionLayer);
  }, [loaded, position]);

  // Fits the frame once per frame object, keeping clear of what covers the map's bottom.
  useEffect(() => {
    if (!loaded || !frame || frame.points.length === 0) return;
    const { L, map } = loaded;
    // A fit against a container Leaflet has not measured yet frames the wrong box.
    map.invalidateSize();
    const covered = map.getSize().y * coveredRef.current;
    map.fitBounds(L.latLngBounds(frame.points.map(toLatLng)), {
      paddingTopLeft: [EDGE_PADDING, EDGE_PADDING],
      paddingBottomRight: [EDGE_PADDING, EDGE_PADDING + covered],
      maxZoom: FIT_MAX_ZOOM,
    });
  }, [loaded, frame]);

  useEffect(() => {
    if (!loaded || follow.length === 0) return;
    const { L, map } = loaded;
    const covered = map.getSize().y * coveredRef.current;
    if (follow.length > 1) {
      map.fitBounds(L.latLngBounds(follow.map(toLatLng)), {
        paddingTopLeft: [EDGE_PADDING * 2, EDGE_PADDING * 2],
        paddingBottomRight: [EDGE_PADDING * 2, EDGE_PADDING * 2 + covered],
        maxZoom: FIT_MAX_ZOOM + 1,
      });
      return;
    }
    // Centred in the part of the map left uncovered.
    const zoom = Math.max(map.getZoom(), FOLLOW_MIN_ZOOM);
    const point = map.project(toLatLng(follow[0]), zoom).add([0, covered / 2]);
    map.setView(map.unproject(point, zoom), zoom);
  }, [loaded, follow]);

  // Leaflet caches the container size, so a resize leaves grey tiles until it re-measures.
  useEffect(() => {
    const element = containerRef.current;
    if (!loaded || !element) return;
    const observer = new ResizeObserver(() => loaded.map.invalidateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, [loaded]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={labels.region}
      data-testid="map"
      className="h-full w-full"
    />
  );
}
