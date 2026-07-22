"use client";
// client: haoqi.design-style blueprint grid. A fixed, pointer-events-free
// overlay drawn with an SVG whose guide lines break at every intersection,
// leaving a small "+" crosshair — mix-blend-difference so it reads against
// whatever sits beneath. Recomputed on resize to stay crisp (no scaling).

import { useEffect, useState } from "react";
import styles from "./DesignGrid.module.css";

const GAP = 12; // half-gap the lines leave around each intersection
const TICK = 6; // half-length of the "+" crosshair arms

function buildPaths(w: number, h: number) {
  const margin = w < 480 ? 12 : w <= 1024 ? 24 : 56;
  const inner = Math.max(0, w - 2 * margin);
  const columnCount = w < 1280 ? 2 : 3;
  const cols = Array.from(
    { length: columnCount + 1 },
    (_, index) => Math.round(margin + (index / columnCount) * inner) + 0.5,
  );
  const segment = Math.max(0, h / 3 - GAP);
  const rowStart = segment + GAP * 2;
  const rowEnd = rowStart + segment;
  const rows = [segment + GAP, rowEnd + GAP];

  // Vertical lines, broken around each row.
  let vertical = "";
  for (const x of cols) {
    vertical += `M${x} 0V${segment}`;
    vertical += `M${x} ${rowStart}V${rowEnd}`;
    vertical += `M${x} ${rowEnd + GAP * 2}V${h}`;
  }

  // Horizontal lines, broken around each column.
  let horizontal = "";
  for (const y of rows) {
    if (cols.length < 2) continue;
    const first = cols[0] ?? 0;
    const last = cols[cols.length - 1] ?? w;
    horizontal += `M0 ${y}H${first - GAP}`;
    for (let index = 0; index < cols.length - 1; index += 1) {
      const start = cols[index] ?? 0;
      const end = cols[index + 1] ?? w;
      horizontal += `M${start + GAP} ${y}H${end - GAP}`;
    }
    horizontal += `M${last + GAP} ${y}H${w}`;
  }

  // "+" crosshair at every intersection.
  let cross = "";
  for (const x of cols) {
    for (const y of rows) {
      cross += `M${x} ${y - TICK}V${y + TICK}M${x - TICK} ${y}H${x + TICK}`;
    }
  }

  return { vertical, horizontal, cross };
}

export function DesignGrid() {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!size.w) return null;
  const { vertical, horizontal, cross } = buildPaths(size.w, size.h);
  const renderGrid = (className?: string) => (
    <div className={className} aria-hidden="true">
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className={styles.svg}
      >
        <path d={vertical} />
        <path d={horizontal} />
        <path d={cross} className={styles.cross} />
      </svg>
    </div>
  );

  return (
    <>
      {renderGrid(styles.gridRear)}
      {renderGrid(styles.gridFront)}
    </>
  );
}
