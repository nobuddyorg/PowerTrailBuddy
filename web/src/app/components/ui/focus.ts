'use client';

import { useEffect, type RefObject } from 'react';

/** Focus without scrolling: on a phone the view is already where it should be, under a sheet or beside the map. */
export function focusQuietly(element: HTMLElement) {
  element.focus({ preventScroll: true });
}

/** Whether a new view may take focus: not before the user has acted (a page load), nor from where they put it outside `scope`, such as the map. */
export function mayTakeFocus(scope?: Element): boolean {
  // Absent in older browsers (and jsdom), where taking focus is the safer default for keyboard users.
  if (navigator.userActivation?.hasBeenActive === false) return false;
  const current = document.activeElement;
  return (
    current === null ||
    current === document.body ||
    (scope?.contains(current) ?? false)
  );
}

/** Focuses the element once it has mounted, so a keyboard or screen-reader user lands in the view that just appeared. */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (ref.current && mayTakeFocus()) focusQuietly(ref.current);
  }, [ref]);
}
