/* eslint-disable @next/next/no-img-element */
/**
 * StratiuMetrics brand mark.
 *
 * Renders the app icon (white mark on the brand gradient square) from
 * /public/brand-icon.png. The colored square keeps the logo legible on any
 * background — light, dark, or colored tab bars.
 */

type Props = { className?: string };

export function Logo({ className = "h-8 w-8" }: Props) {
  return (
    <img
      src="/brand-icon.png"
      alt="StratiuMetrics"
      className={`${className} rounded-[22%] object-contain`}
    />
  );
}
