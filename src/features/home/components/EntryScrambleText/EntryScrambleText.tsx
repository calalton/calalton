"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const SCRAMBLE_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=?/<>[]{}";
const TICK_MS = 40;

type TickHandler = (now: number) => void;

const tickHandlers = new Set<TickHandler>();
let ticker: number | null = null;

function subscribeToTicker(handler: TickHandler) {
  tickHandlers.add(handler);

  if (ticker === null) {
    ticker = window.setInterval(() => {
      const now = performance.now();
      tickHandlers.forEach((tick) => tick(now));
    }, TICK_MS);
  }

  return () => {
    tickHandlers.delete(handler);
    if (tickHandlers.size === 0 && ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
  };
}

function randomCharacter() {
  const index = Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length);
  return SCRAMBLE_CHARACTERS.charAt(index);
}

type EntryScrambleTextProps = {
  text: string;
  className?: string;
  style?: CSSProperties;
  startDelayMs?: number;
  letterDelayMs?: number;
  scrambleColors?: boolean;
};

export function EntryScrambleText({
  text,
  className,
  style,
  startDelayMs = 0,
  letterDelayMs = 80,
  scrambleColors = true,
}: EntryScrambleTextProps) {
  const characters = useMemo(() => Array.from(text), [text]);
  const startedAtRef = useRef<number | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const totalDuration =
      startDelayMs +
      Math.max(0, characters.length - 1) * letterDelayMs +
      letterDelayMs * 4;

    const start = () => {
      if (startedAtRef.current !== null) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSettled(true);
        return;
      }

      const startedAt = performance.now();
      startedAtRef.current = startedAt;
      setStartedAt(startedAt);
      setClock(startedAt);
      unsubscribeRef.current = subscribeToTicker((now) => {
        setClock(now);
        if (now - startedAt >= totalDuration) {
          setSettled(true);
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
        }
      });
    };

    const entryState = document.documentElement.dataset.entryState;
    if (entryState === "content" || entryState === "ready") {
      start();
    } else {
      window.addEventListener("cal-entry-content", start, { once: true });
    }

    return () => {
      window.removeEventListener("cal-entry-content", start);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [characters.length, letterDelayMs, startDelayMs]);

  if (settled) {
    return (
      <span className={className} style={style}>
        {text}
      </span>
    );
  }

  const elapsed = startedAt === null ? 0 : clock - startedAt;
  const lineElapsed = elapsed - startDelayMs;
  const scrambleDuration = letterDelayMs * 4;
  const colorPhaseDuration = letterDelayMs * 2;
  const lineVisible = startedAt !== null && lineElapsed >= 0;

  return (
    <span
      className={className}
      style={{ ...style, opacity: lineVisible ? undefined : 0 }}
      aria-label={text}
      data-entry-scramble="true"
    >
      {characters.map((character, index) => {
        if (character === "\n") {
          return <br key={`newline-${index}`} />;
        }

        if (character === " ") {
          return (
            <span key={`space-${index}`} aria-hidden="true">
              {" "}
            </span>
          );
        }

        const characterAge = lineElapsed - index * letterDelayMs;
        let displayedCharacter = character;
        let opacity = 1;
        let color: string | undefined;

        if (characterAge < 0) {
          opacity = 0;
        } else if (characterAge < scrambleDuration) {
          displayedCharacter = randomCharacter();
          if (scrambleColors) {
            color = characterAge < colorPhaseDuration ? "#c0fe04" : "#dfff81";
          }
        }

        return (
          <span
            key={`character-${index}`}
            aria-hidden="true"
            style={{ color, opacity }}
          >
            {displayedCharacter}
          </span>
        );
      })}
    </span>
  );
}
