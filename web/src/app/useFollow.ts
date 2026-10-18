'use client';

import { useCallback, useState } from 'react';

import { useToast } from './components/Toast/ToastProvider';
import { useI18n } from './i18n/useI18n';
import type { GeolocationState } from './useGeolocation';

/** The locate button: starts the position, follows it on the map until the user pans, explains a refusal. */
export function useFollow({
  location,
  start,
  initiallyFollowing,
}: {
  location: GeolocationState;
  start: () => void;
  initiallyFollowing: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [following, setFollowing] = useState(initiallyFollowing);

  const locate = useCallback(() => {
    if (location.status === 'denied') {
      toast.show(t('location.denied'));
      return;
    }
    if (location.status === 'unavailable') {
      toast.show(t('location.unavailable'));
      return;
    }
    start();
    setFollowing(true);
  }, [location.status, start, t, toast]);

  return {
    following,
    locate,
    stopFollowing: useCallback(() => setFollowing(false), []),
  };
}
