'use client';

import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { useI18n } from '../../i18n/useI18n';
import {
  cycleSnap,
  draggedFraction,
  nearestSnap,
  SNAP_FRACTION,
  stepSnap,
  type SheetSnap,
} from '../../lib/ui-logic/sheet';
import type { Translate } from '../labels';

// Below this a pointer gesture is a tap on the handle, not a drag.
const DRAG_THRESHOLD_PX = 6;

interface Drag {
  startY: number;
  startFraction: number;
  moved: boolean;
}

function snapName(t: Translate, snap: SheetSnap): string {
  switch (snap) {
    case 'peek':
      return t('sheet.peek');
    case 'half':
      return t('sheet.half');
    case 'full':
      return t('sheet.full');
  }
}

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  label: string;
  children: ReactNode;
}

/** A panel over the map's bottom on phones: drag or tap its handle, or use the arrow keys on it, to resize. */
export function BottomSheet({
  snap,
  onSnapChange,
  label,
  children,
}: BottomSheetProps) {
  const { t } = useI18n();
  const [dragged, setDragged] = useState<number>();
  const drag = useRef<Drag>(undefined);
  const justDragged = useRef(false);
  const fraction = dragged ?? SNAP_FRACTION[snap];

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      startY: event.clientY,
      startFraction: fraction,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const movedPixels = current.startY - event.clientY;
    if (!current.moved && Math.abs(movedPixels) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    setDragged(
      draggedFraction({
        startFraction: current.startFraction,
        movedPixels,
        viewportHeight: window.innerHeight,
      }),
    );
  };

  const onPointerEnd = () => {
    const current = drag.current;
    drag.current = undefined;
    if (!current?.moved) return;
    justDragged.current = true;
    if (dragged !== undefined) onSnapChange(nearestSnap(dragged));
    setDragged(undefined);
  };

  const onClick = () => {
    // A drag ends with a click on the same element; the drag already chose the snap point.
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    onSnapChange(cycleSnap(snap));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next: Partial<Record<string, SheetSnap>> = {
      ArrowUp: stepSnap(snap, 'up'),
      ArrowDown: stepSnap(snap, 'down'),
      Home: 'peek',
      End: 'full',
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSnapChange(target);
  };

  return (
    <section
      aria-label={label}
      data-testid="bottom-sheet"
      data-snap={snap}
      style={{ height: `${Math.round(fraction * 1000) / 10}dvh` }}
      className={`fixed inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-3xl bg-background shadow-lifted ${
        dragged === undefined
          ? 'motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out'
          : ''
      }`}
    >
      <button
        type="button"
        aria-label={t('sheet.handle', { state: snapName(t, snap) })}
        data-testid="sheet-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="flex h-8 w-full shrink-0 touch-none items-center justify-center rounded-t-3xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden="true"
          className="block h-1.5 w-12 rounded-full bg-muted-foreground/40"
        />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
        {children}
      </div>
    </section>
  );
}
