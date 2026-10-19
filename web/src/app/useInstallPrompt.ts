'use client';

import { useCallback, useEffect, useState } from 'react';

// Chromium's event, not in the DOM typings.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The browser's install offer, kept for a button; none when installed, unsupported or already used. */
export function useInstallPrompt(): {
  canInstall: boolean;
  install: () => void;
} {
  const [offer, setOffer] = useState<InstallPromptEvent>();

  useEffect(() => {
    const onOffer = (event: Event) => {
      event.preventDefault();
      setOffer(event as InstallPromptEvent);
    };
    const onInstalled = () => setOffer(undefined);
    window.addEventListener('beforeinstallprompt', onOffer);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onOffer);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!offer) return;
    // An offer can be shown once; afterwards the button goes, whatever the answer.
    setOffer(undefined);
    void offer.prompt().catch(() => {});
  }, [offer]);

  return { canInstall: offer !== undefined, install };
}
