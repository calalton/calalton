"use client";
// client: faint measurement grid — a faithful port of the reference
// (haoqi.design) overlay. Four vertical guides make three equal desktop columns
// and two horizontal guides split the viewport into thirds. Rules leave a small
// gap around every "+" crosshair. Painted with
// mix-blend-difference so it reads as a faint light grid over the dark stage.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import styles from "./HeroGrid.module.css";

type HeroGridProps = {
  className?: string;
};

const GAP = 12; // half-gap in a rule around a crosshair
const ARM = 6; // half-length of a crosshair arm

function gridInset(width: number) {
  return Math.round(Math.min(Math.max(width * 0.045, 24), 88));
}

export function HeroGrid({ className }: HeroGridProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inset = gridInset(w);
  const inner = w - inset * 2;
  const xs =
    w > 0
      ? [
          inset,
          Math.round(inset + inner / 3),
          Math.round(inset + (inner * 2) / 3),
          w - inset,
        ]
      : [];
  const ys = h > 0 ? [Math.round(h / 3), Math.round((h * 2) / 3)] : [];

  // Rules broken by a GAP around each crossing.
  const segments = (span: number, cuts: number[]) => {
    const stops = [0, ...cuts.flatMap((c) => [c - GAP, c + GAP]), span];
    const out: [number, number][] = [];
    for (let i = 0; i < stops.length; i += 2) {
      const a = stops[i]!;
      const b = stops[i + 1]!;
      if (b > a) out.push([a, b]);
    }
    return out;
  };

  const rules = [
    ...xs.map((x) =>
      segments(h, ys)
        .map(([a, b]) => `M${x} ${a}V${b}`)
        .join(""),
    ),
    ...ys.map((y) =>
      segments(w, xs)
        .map(([a, b]) => `M${a} ${y}H${b}`)
        .join(""),
    ),
  ].join("");

  const crosses = xs
    .flatMap((x) =>
      ys.map((y) => `M${x} ${y - ARM}V${y + ARM}M${x - ARM} ${y}H${x + ARM}`),
    )
    .join("");

  return (
    <div ref={ref} className={cn(styles.grid, className)} aria-hidden="true">
      {w > 0 && h > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <path
            d={rules}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={1}
            fill="none"
          />
          <path
            d={crosses}
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth={1}
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}
