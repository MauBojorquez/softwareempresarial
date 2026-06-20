/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * StratiuMetrics brand mark.
 *
 * Renders the real logo image from /public/brand-logo.png. To set the logo,
 * drop the file at apps/web/public/brand-logo.png. The image is shown as-is
 * with rounded corners, so use a square version of the mark.
 *
 * If the file isn't present yet, it falls back to /favicon.svg so the UI never
 * shows a broken image.
 */

type Props = { className?: string };

export function Logo({ className = "h-8 w-8" }: Props) {
  return (
    <img
      src="/brand-logo.png"
      alt="StratiuMetrics"
      // The mark is dark on transparent; invert it in dark mode so it stays
      // visible against dark backgrounds.
      className={`${className} object-contain dark:invert`}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith("/favicon.svg")) img.src = "/favicon.svg";
      }}
    />
  );
}
