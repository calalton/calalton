import Link from "next/link";
import { CAL_ALTON_PATH } from "@/components/brand/CalAltonMark/logo-path";
import { cn } from "@/lib/cn";
import styles from "./HeroGlobeMark.module.css";

type HeroGlobeMarkProps = {
  className?: string;
};

// Podium's organic circle badge outline.
const BADGE_PATH =
  "M48.5486 9.07252C46.8124 5.11836 42.8921 3.44168 38.9548 2.3658C35.6123 1.40885 32.2508 0.522195 28.8049 0.222812C26.4314 0.0153391 24.0397 -0.0312916 21.6575 0.0180424C15.486 0.0241246 10.16 2.09615 5.59559 6.24494C3.01941 8.67176 -0.334629 12.4049 0.0269287 16.107C0.188447 17.4951 0.789916 18.6724 1.57385 20.0537C2.30305 21.3107 3.13294 22.5191 3.96959 23.7125C6.37614 27.2213 8.84622 30.5321 13.2059 31.51C16.9377 32.3054 20.8526 32.1135 24.6399 31.9337C26.5287 31.8168 28.4122 31.583 30.2605 31.1768C34.8952 30.1564 39.4691 28.3053 43.1279 25.2338C47.5646 21.3864 51.164 14.9176 48.5608 9.0982L48.5493 9.07252H48.5486Z";

// Centres the traced mark in the blob at a smaller size (transforms apply right
// to left: recentre the native crop, distort/scale down, move to blob centre).
const MARK_TRANSFORM =
  "translate(25.4 15.6) rotate(-10) scale(0.0122 0.008) translate(-2975 -2175)";

export function HeroGlobeMark({ className }: HeroGlobeMarkProps) {
  return (
    <div className={cn(styles.root, className)}>
      <Link href="/" aria-label="Cal Alton - home" className={styles.link}>
        <svg viewBox="-1 -1 53 34" className={styles.svg} aria-hidden="true">
          <defs>
            <mask
              id="heroGlobeMarkCutout"
              maskUnits="userSpaceOnUse"
              x="-1"
              y="-1"
              width="53"
              height="34"
            >
              <rect x="-1" y="-1" width="53" height="34" fill="white" />
              <g transform={MARK_TRANSFORM}>
                <path d={CAL_ALTON_PATH} fill="black" fillRule="evenodd" />
              </g>
            </mask>
          </defs>
          <path
            className={styles.logo}
            d={BADGE_PATH}
            mask="url(#heroGlobeMarkCutout)"
          />
        </svg>
      </Link>
    </div>
  );
}

