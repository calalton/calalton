// client: rotary-phone contact dial — hovering a hole reveals its action in the
// center; clicking spins the finger-wheel round to the stop, then dials the link.
"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import styles from "./ContactDial.module.css";

type DialLink = {
  label: string;
  href: string;
  external?: boolean;
  icon: ReactNode;
};

// The finger-stop sits lower-right; each hole dials clockwise round to it, like a
// real rotary phone. Angles are degrees clockwise from 12 o'clock.
const STOP_ANGLE = 124;
const HOLE_ANGLE = [0, 30, 150, 180, 210, 240, 270, 300, 330] as const;

// Matching hole centres as a percent of the plate (radius 38.8% of the dial),
// leaving the 60–120° gap on the right open for the finger-stop.
const HOLE_POS = [
  { x: 50.0, y: 11.2 },
  { x: 69.4, y: 16.4 },
  { x: 69.4, y: 83.6 },
  { x: 50.0, y: 88.8 },
  { x: 30.6, y: 83.6 },
  { x: 16.4, y: 69.4 },
  { x: 11.2, y: 50.0 },
  { x: 16.4, y: 30.6 },
  { x: 30.6, y: 16.4 },
] as const;

const HOLE_LINKS: Record<number, DialLink> = {
  2: {
    label: "open github",
    href: "https://github.com/calalton",
    external: true,
    icon: <GitHubIcon />,
  },
  3: {
    label: "open twitter",
    href: "https://x.com/calalton",
    external: true,
    icon: <XIcon />,
  },
  4: {
    label: "visit site",
    href: "https://calalton.cc",
    external: true,
    icon: <GlobeIcon />,
  },
  6: { label: "send email", href: `mailto:${site.email}`, icon: <MailIcon /> },
};

export function ContactDial({ className }: { className?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const spinningRef = useRef(false);

  const handleDial = (
    event: MouseEvent<HTMLAnchorElement>,
    index: number,
    href: string,
  ) => {
    const wheel = wheelRef.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!wheel || reduced) return;
    event.preventDefault();
    if (spinningRef.current) return;
    spinningRef.current = true;

    const holeAngle = HOLE_ANGLE[index] ?? 0;
    const delta = (((STOP_ANGLE - holeAngle) % 360) + 360) % 360;
    const forward = wheel.animate(
      [{ transform: "rotate(0deg)" }, { transform: `rotate(${delta}deg)` }],
      {
        duration: 220 + delta * 0.6,
        easing: "cubic-bezier(0.3, 0.7, 0.4, 1)",
        fill: "forwards",
      },
    );
    forward.onfinish = () => {
      const back = wheel.animate(
        [{ transform: `rotate(${delta}deg)` }, { transform: "rotate(0deg)" }],
        {
          duration: 200 + delta * 0.55,
          easing: "cubic-bezier(0.45, 0, 0.55, 1)",
          fill: "forwards",
        },
      );
      back.onfinish = () => {
        spinningRef.current = false;
        window.location.href = href;
      };
    };
  };

  return (
    <div
      className={cn(styles.dial, className)}
      data-active={label ? "true" : "false"}
      onMouseLeave={() => setLabel(null)}
    >
      <div className={styles.plate} aria-hidden="true" />

      <div className={styles.wheel} ref={wheelRef}>
        {HOLE_POS.map((pos, index) => {
          const link = HOLE_LINKS[index];
          const style = { left: `${pos.x}%`, top: `${pos.y}%` };
          if (!link) {
            return (
              <span
                key={index}
                className={styles.hole}
                style={style}
                aria-hidden="true"
              />
            );
          }
          const rel = link.external
            ? { target: "_blank", rel: "noreferrer" }
            : {};
          return (
            <a
              key={index}
              href={link.href}
              className={cn(styles.hole, styles.holeLink)}
              style={style}
              aria-label={link.label}
              onClick={(event) => handleDial(event, index, link.href)}
              onMouseEnter={() => setLabel(link.label)}
              onFocus={() => setLabel(link.label)}
              onBlur={() => setLabel(null)}
              {...rel}
            >
              <span className={styles.icon}>{link.icon}</span>
            </a>
          );
        })}
      </div>

      <div className={styles.decor} aria-hidden="true">
        <svg viewBox="0 0 77 107" className={styles.decorSvg}>
          <path
            className={styles.decorHalo}
            d="M6.9209 5.5459C8.38176 4.28202 10.2008 3.83535 11.918 4.05371C15.1927 4.47022 17.6543 7.09176 18.7227 10.1162C30.0765 42.2583 50.2347 56.9993 65.5869 63.0166C72.0105 65.5343 75.3562 74.2228 70.1641 80.1074L53.3516 99.1621C48.5571 104.596 39.3875 103.464 36.0674 97.0146C32.4932 90.0715 26.4449 78.2445 16.8525 59.1289C5.05257 35.6139 2.84593 19.832 4.47168 10.1836C4.76146 8.46393 5.50555 6.77044 6.9209 5.5459Z"
          />
          <path
            className={styles.decorBody}
            d="M20.4273 57.3349C8.80573 34.1755 6.99199 19.302 8.41654 10.8481C9.13465 6.5865 13.5113 7.37355 14.9507 11.4484C26.7155 44.754 47.7629 60.3268 64.1277 66.7408C68.4153 68.4212 70.2117 74.0083 67.1648 77.4613L50.3523 96.5156C47.4185 99.8406 41.6538 99.1266 39.6243 95.1841C36.0565 88.2533 30.0137 76.4389 20.4273 57.3349Z"
          />
        </svg>
      </div>

      <div className={styles.center} aria-hidden="true">
        <span className={styles.hub}>
          <span
            className={styles.label}
            data-visible={label ? "true" : "false"}
          >
            {label}
          </span>
          <span className={styles.people} data-hidden={label ? "true" : "false"}>
            People
          </span>
        </span>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.4 3.8 5.7 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.7-3.8-9s1.3-6.6 3.8-9Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
