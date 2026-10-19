export type TrailSort = 'rate' | 'caches' | 'nearest' | 'shortest';
export type TrailFilter = 'short' | 'quick' | 'near';

export const TRAIL_SORTS: readonly TrailSort[] = [
  'rate',
  'caches',
  'nearest',
  'shortest',
];
export const TRAIL_FILTERS: readonly TrailFilter[] = ['short', 'quick', 'near'];
