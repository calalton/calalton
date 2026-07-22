"use client";
// client: live mobile hero clock synced after hydration.

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { heroContent } from "@/content/hero";
import styles from "./HeroTelemetry.module.css";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getTimeLabel() {
  return timeFormatter.format(new Date());
}

type ProgressStyle = CSSProperties & {
  "--progress-angle": string;
};

export function HeroTelemetry() {
  const [time, setTime] = useState("--:--");
  const [progressAngle, setProgressAngle] = useState("0deg");

  useEffect(() => {
    const update = () => setTime(getTimeLabel());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScrollStage = (event: Event) => {
      const detail = (event as CustomEvent<{ progress?: number }>).detail;
      if (typeof detail?.progress !== "number") return;
      setProgressAngle(`${Math.round(detail.progress * 360)}deg`);
    };

    window.addEventListener("cal-scroll-stage", handleScrollStage);
    return () =>
      window.removeEventListener("cal-scroll-stage", handleScrollStage);
  }, []);

  const progressStyle: ProgressStyle = {
    "--progress-angle": progressAngle,
  };

  return (
    <div className={styles.telemetry} aria-label="Local time and scroll progress">
      <span className={styles.readout}>
        {time} {heroContent.telemetry.temperature}
      </span>
      <span
        className={styles.progress}
        style={progressStyle}
        aria-hidden="true"
      />
    </div>
  );
}
