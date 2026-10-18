'use client';

import { useI18n } from '../../i18n/useI18n';
import type { MapProps } from './types';

/** The map's translated labels. */
export function useMapLabels(): MapProps['labels'] {
  const { t } = useI18n();
  return {
    region: t('map.region'),
    attribution: t('map.attribution'),
    zoomIn: t('map.zoomIn'),
    zoomOut: t('map.zoomOut'),
  };
}
