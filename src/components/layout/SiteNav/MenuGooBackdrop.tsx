// client: gooey blob reveal for the mobile menu — blobs bloom from the toggle
// and merge into a full-screen field under an SVG goo filter, then retract.
"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import styles from "./SiteNav.module.css";

type MenuGooBackdropProps = {
  open: boolean;
  className?: string;
};

// Bloom order fans out from the toggle (top-right) toward the far corner.
const BLOBS = [
  { x: "98%", y: "-2%", order: 0 },
  { x: "70%", y: "18%", order: 1 },
  { x: "38%", y: "36%", order: 2 },
  { x: "72%", y: "58%", order: 3 },
  { x: "12%", y: "70%", order: 3 },
  { x: "90%", y: "96%", order: 4 },
  { x: "34%", y: "102%", order: 5 },
];

export function MenuGooBackdrop({ open, className }: MenuGooBackdropProps) {
  return (
    <div
      className={cn(styles.menuBackdrop, className)}
      data-open={open ? "true" : "false"}
      aria-hidden="true"
    >
      <div className={styles.gooField}>
        {BLOBS.map((blob, index) => (
          <span
            key={index}
            className={styles.gooBlob}
            style={
              {
                left: blob.x,
                top: blob.y,
                "--blob-order": blob.order,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <svg className={styles.gooDefs} aria-hidden="true" focusable="false">
        <filter
          id="menuGoo"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -9"
          />
        </filter>
      </svg>
    </div>
  );
}
