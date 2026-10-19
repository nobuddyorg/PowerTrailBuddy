'use client';

import { useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { relativeBearing } from '../../lib/format/compass';
import { unwrapRotation, type Heading } from '../../lib/ui-logic/heading';

interface CompassProps {
  /** Bearing from the walker to the target, degrees clockwise from north. */
  bearing: number;
  heading: Heading;
  close: boolean;
}

/** The angle to draw: each new one reached from the last the short way, so the transition never spins round. */
function useDrawnRotation(rotation: number): number {
  const [drawn, setDrawn] = useState({ angle: rotation, rotation });
  if (drawn.angle === rotation) return drawn.rotation;
  const next = {
    angle: rotation,
    rotation: unwrapRotation(drawn.rotation, rotation),
  };
  setDrawn(next);
  return next.rotation;
}

/** A big arrow to the target: relative to the way the phone faces when a heading is known, else north-up. */
export function Compass({ bearing, heading, close }: CompassProps) {
  const { t } = useI18n();
  const facing = heading.source !== 'none';
  const rotation = facing ? relativeBearing(bearing, heading.degrees) : bearing;
  const drawn = useDrawnRotation(rotation);
  const color = close ? 'var(--accent-bright)' : 'var(--primary)';
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={
          facing
            ? t('walk.compass.facing', { degrees: Math.round(rotation) })
            : t('walk.compass.north', { degrees: Math.round(bearing) })
        }
        data-testid="compass"
        className="h-32 w-32 shrink-0"
      >
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="var(--card)"
          stroke="var(--border)"
          strokeWidth="2"
        />
        {!facing && (
          <text
            x="60"
            y="17"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="var(--muted-foreground)"
          >
            {t('walk.compass.northMark')}
          </text>
        )}
        <g
          data-testid="compass-arrow"
          data-rotation={Math.round(drawn)}
          style={{
            transform: `rotate(${drawn}deg)`,
            transformOrigin: '60px 60px',
          }}
          className="motion-safe:transition-transform motion-safe:duration-300"
        >
          <path
            d="M60 18 L84 82 L60 70 L36 82 Z"
            fill={color}
            stroke="white"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <p className="max-w-32 text-center text-[11px] leading-tight text-muted-foreground">
        {heading.source === 'compass' && t('walk.compass.sourceCompass')}
        {heading.source === 'gps' && t('walk.compass.sourceGps')}
        {heading.source === 'none' && t('walk.compass.sourceNone')}
      </p>
    </div>
  );
}
