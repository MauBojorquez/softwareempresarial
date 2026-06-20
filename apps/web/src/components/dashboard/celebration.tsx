"use client";

import { useEffect, useState } from "react";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];
const PIECES = 90;

type Piece = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  drift: number;
};

/**
 * A lightweight, dependency-free confetti burst. Mount it to celebrate a win
 * (e.g. a goal hitting 100%). It cleans itself up after the animation and is
 * skipped entirely for users who prefer reduced motion.
 */
export function Celebration({ onDone }: { onDone?: () => void }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { onDone?.(); return; }
    setPieces(
      Array.from({ length: PIECES }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        duration: 1.6 + Math.random() * 1.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 7,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 160,
      }))
    );
    const t = setTimeout(() => onDone?.(), 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!pieces) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
