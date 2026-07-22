"use client";

import { useEffect, useState } from "react";

const SCRAMBLE_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=?/<>[]{}";

type MenuScrambleTextProps = {
  text: string;
  startDelayMs: number;
  letterDelayMs?: number;
};

function randomCharacter() {
  const index = Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length);
  return SCRAMBLE_CHARACTERS.charAt(index);
}

export function MenuScrambleText({
  text,
  startDelayMs,
  letterDelayMs = 80,
}: MenuScrambleTextProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const scrambleDuration = letterDelayMs * 4;
    const totalDuration =
      startDelayMs +
      Math.max(0, text.length - 1) * letterDelayMs +
      scrambleDuration;

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setElapsedMs(elapsed);
      if (elapsed >= totalDuration) window.clearInterval(interval);
    }, 40);

    return () => window.clearInterval(interval);
  }, [letterDelayMs, startDelayMs, text]);

  const scrambleDuration = letterDelayMs * 4;
  const colorPhaseDuration = letterDelayMs * 2;

  return (
    <span aria-label={text}>
      {Array.from(text).map((character, index) => {
        if (character === " ") {
          return (
            <span key={`${index}-space`} aria-hidden="true">
              {" "}
            </span>
          );
        }

        const characterStart = startDelayMs + index * letterDelayMs;
        const characterAge = elapsedMs - characterStart;
        let displayedCharacter = character;
        let opacity = 1;
        let color: string | undefined;

        if (characterAge < 0) {
          opacity = 0;
        } else if (characterAge < scrambleDuration) {
          displayedCharacter = randomCharacter();
          color = characterAge < colorPhaseDuration ? "#c0fe04" : "#dfff81";
        }

        return (
          <span
            key={`${index}-${character}`}
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
