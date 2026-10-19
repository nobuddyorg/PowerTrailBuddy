import { describe, expect, it } from 'vitest';

import { lineStyle, markerStyle } from './styles';
import type { MapMarker, MarkerTone } from './types';

const marker = (
  tone: MarkerTone,
  overrides: Partial<MapMarker> = {},
): MapMarker => ({
  code: 'GCSTYLE',
  latitude: 47.5,
  longitude: 9.5,
  tone,
  color: '#123456',
  warning: false,
  label: 'Style stop',
  ...overrides,
});

describe('markerStyle', () => {
  it('fills a trail cache in its trail colour, the selected trail larger', () => {
    expect(markerStyle(marker('trail'))).toMatchObject({
      radius: 6,
      fillColor: '#123456',
      color: '#ffffff',
      weight: 1.5,
    });
    expect(markerStyle(marker('selected'))).toMatchObject({
      radius: 7.5,
      fillColor: '#123456',
      weight: 2,
    });
  });

  it('rings a doubtful cache in amber, however it is drawn', () => {
    expect(markerStyle(marker('trail', { warning: true }))).toMatchObject({
      color: '#d97706',
      weight: 3,
    });
    expect(markerStyle(marker('selected', { warning: true }))).toMatchObject({
      color: '#d97706',
      weight: 3,
    });
    expect(markerStyle(marker('other', { warning: true }))).toMatchObject({
      fillColor: '#7b8579',
      color: '#d97706',
      weight: 2,
    });
    expect(markerStyle(marker('other'))).toMatchObject({ weight: 1 });
  });

  it('draws every other tone in its own fixed way', () => {
    expect(markerStyle(marker('faded'))).toMatchObject({ fillOpacity: 0.35 });
    expect(markerStyle(marker('disabled'))).toMatchObject({ dashArray: '2 2' });
    expect(markerStyle(marker('found'))).toMatchObject({ radius: 0 });
    expect(markerStyle(marker('done'))).toMatchObject({
      fillColor: '#9ca3af',
    });
    expect(markerStyle(marker('dnf'))).toMatchObject({ color: '#b42318' });
    expect(markerStyle(marker('target'))).toMatchObject({
      radius: 11,
      fillColor: '#f97316',
    });
  });
});

describe('lineStyle', () => {
  it('draws trails in their colour and the guide line dashed in the target colour', () => {
    expect(lineStyle('trail', 'red')).toEqual({
      color: 'red',
      weight: 4,
      opacity: 0.85,
    });
    expect(lineStyle('selected', 'red')).toMatchObject({ weight: 6 });
    expect(lineStyle('faded', 'red')).toMatchObject({ opacity: 0.3 });
    expect(lineStyle('walk', 'red')).toMatchObject({ weight: 5 });
    expect(lineStyle('guide', 'red')).toEqual({
      color: '#f97316',
      weight: 3,
      opacity: 0.9,
      dashArray: '6 8',
    });
  });
});
