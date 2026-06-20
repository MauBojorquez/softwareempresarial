/**
 * StratiuMetrics brand mark. Uses the SVG in /public/logo.svg via an <img>,
 * sized by className. The mark adapts to the current text color through
 * currentColor, so it works on both light and dark backgrounds.
 *
 * To swap the logo, just replace /public/logo.svg — no code changes needed.
 */

type Props = { className?: string };

export function Logo({ className = "h-8 w-8" }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 22 L70 38" />
        <path d="M44 36 L74 80" />
        <path d="M24 80 L44 48 L62 74" />
        <path d="M24 80 L72 80" />
      </g>
    </svg>
  );
}
