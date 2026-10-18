export type SheetSnap = 'peek' | 'half' | 'full';

export const SHEET_SNAPS: readonly SheetSnap[] = ['peek', 'half', 'full'];

/** The share of the viewport's height the sheet covers at each snap point. */
export const SNAP_FRACTION: Record<SheetSnap, number> = {
  peek: 0.24,
  half: 0.55,
  full: 0.92,
};

/** The snap point closest to a height the user dragged to. */
export function nearestSnap(fraction: number): SheetSnap {
  return SHEET_SNAPS.reduce((best, snap) =>
    Math.abs(SNAP_FRACTION[snap] - fraction) <
    Math.abs(SNAP_FRACTION[best] - fraction)
      ? snap
      : best,
  );
}

/** One snap point up (taller) or down, stopping at either end. */
export function stepSnap(snap: SheetSnap, direction: 'up' | 'down'): SheetSnap {
  const index = SHEET_SNAPS.indexOf(snap) + (direction === 'up' ? 1 : -1);
  return SHEET_SNAPS[Math.min(SHEET_SNAPS.length - 1, Math.max(0, index))];
}

/** What a tap on the handle does: up one snap point, and from the top back to the bottom. */
export function cycleSnap(snap: SheetSnap): SheetSnap {
  return snap === 'full' ? 'peek' : stepSnap(snap, 'up');
}

/** The height a drag has reached, as a share of the viewport, kept between the lowest and highest snap. */
export function draggedFraction({
  startFraction,
  movedPixels,
  viewportHeight,
}: {
  startFraction: number;
  /** Positive when the finger moved up. */
  movedPixels: number;
  viewportHeight: number;
}): number {
  const fraction = startFraction + movedPixels / viewportHeight;
  return Math.min(SNAP_FRACTION.full, Math.max(SNAP_FRACTION.peek, fraction));
}
