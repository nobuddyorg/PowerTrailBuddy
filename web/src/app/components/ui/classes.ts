const BASE =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold select-none motion-safe:transition-[background-color,box-shadow,transform] motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS = {
  primary:
    'bg-primary text-primary-foreground shadow-soft hover:bg-primary-strong',
  accent: 'bg-accent text-accent-foreground shadow-soft hover:brightness-95',
  secondary:
    'bg-card text-card-foreground ring-1 ring-inset ring-border hover:bg-muted',
  soft: 'bg-primary-soft text-primary-strong hover:brightness-95',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:brightness-95',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/** The look of a button, or of a link that acts as one. */
export function buttonClasses(variant: ButtonVariant, className = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

/** A square, icon-only control of at least 44 px. */
export const ICON_BUTTON_CLASSES =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50';

export const FIELD_CLASSES =
  'w-full min-h-11 rounded-xl px-3 py-2 bg-card text-card-foreground ring-1 ring-inset ring-border focus:outline-2 focus:outline-primary aria-[invalid=true]:ring-destructive';

/** A toggle chip; `aria-pressed` styles the pressed state. */
export const CHIP_CLASSES =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset ring-border bg-card hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50';
