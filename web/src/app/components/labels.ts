import type { useI18n } from '../i18n/useI18n';
import type { CompassPoint } from '../lib/format/compass';
import type { CacheHealth } from '../lib/geocache/health';
import type { CacheType, RecentLogType } from '../lib/geocache/types';

// Each key spelled out, so the i18n parity test sees every one in use.

export type Translate = ReturnType<typeof useI18n>['t'];

export function cacheTypeLabel(t: Translate, type: CacheType): string {
  switch (type) {
    case 'traditional':
      return t('cacheType.traditional');
    case 'multi':
      return t('cacheType.multi');
    case 'mystery':
      return t('cacheType.mystery');
    case 'letterbox':
      return t('cacheType.letterbox');
    case 'wherigo':
      return t('cacheType.wherigo');
    case 'earthcache':
      return t('cacheType.earthcache');
    case 'virtual':
      return t('cacheType.virtual');
    case 'webcam':
      return t('cacheType.webcam');
    case 'event':
      return t('cacheType.event');
    case 'other':
      return t('cacheType.other');
  }
}

/** What a doubtful health means for the walker. */
export function healthLabel(t: Translate, health: Exclude<CacheHealth, 'ok'>): string {
  switch (health) {
    case 'disabled':
      return t('health.disabled');
    case 'dnf-streak':
      return t('health.dnfStreak');
    case 'needs-maintenance':
      return t('health.needsMaintenance');
  }
}

export function logTypeLabel(t: Translate, type: RecentLogType): string {
  switch (type) {
    case 'found':
      return t('log.found');
    case 'dnf':
      return t('log.dnf');
    case 'note':
      return t('log.note');
    case 'maintenance':
      return t('log.maintenance');
    case 'disabled':
      return t('log.disabled');
    case 'other':
      return t('log.other');
  }
}

export function directionName(t: Translate, point: CompassPoint): string {
  switch (point) {
    case 'N':
      return t('direction.N');
    case 'NE':
      return t('direction.NE');
    case 'E':
      return t('direction.E');
    case 'SE':
      return t('direction.SE');
    case 'S':
      return t('direction.S');
    case 'SW':
      return t('direction.SW');
    case 'W':
      return t('direction.W');
    case 'NW':
      return t('direction.NW');
  }
}
