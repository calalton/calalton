// client: mobile menu state and scroll-stage anchor handling.
"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { heroContent, navLinks } from "@/content/hero";
import { EntryScrambleText } from "@/features/home/components/EntryScrambleText/EntryScrambleText";
import { useScrollStage } from "@/features/home/components/ScrollStage/ScrollStage";
import { MenuScrambleText } from "./MenuScrambleText";
import { MenuTransitionCanvas } from "./MenuTransitionCanvas";
import styles from "./SiteNav.module.css";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Persistent primary nav. Fixed to the top-right of the viewport so it stays
 * put as the page scrolls (rendered at the page level, outside the hero's
 * clipping context).
 */
export function SiteNav() {
  const scrollStage = useScrollStage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [backdropMounted, setBackdropMounted] = useState(false);
  const [time, setTime] = useState("--:--");

  useEffect(() => {
    const update = () => setTime(timeFormatter.format(new Date()));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mobileMenuOpen = menuOpen
      ? "true"
      : "false";
    return () => {
      delete document.documentElement.dataset.mobileMenuOpen;
    };
  }, [menuOpen]);

  const handleBackdropComplete = useCallback((open: boolean) => {
    if (!open) setBackdropMounted(false);
  }, []);

  const handleMenuToggle = () => {
    if (!menuOpen) setBackdropMounted(true);
    setMenuOpen((open) => !open);
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) {
      setMenuOpen(false);
      return;
    }
    event.preventDefault();

    scrollStage?.scrollTo(href);
    window.history.replaceState(null, "", href);
    setMenuOpen(false);
  };

  return (
    <nav
      className={styles.nav}
      data-menu-open={menuOpen ? "true" : "false"}
      aria-label="Primary"
    >
      <div className={styles.links}>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            onClick={(event) => handleClick(event, link.href)}
          >
            <EntryScrambleText
              text={link.label}
              startDelayMs={0}
              scrambleColors={false}
            />
          </Link>
        ))}
      </div>

      <button
        type="button"
        className={styles.menuButton}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="mobile-primary-menu"
        onClick={handleMenuToggle}
      >
        <span className={styles.menuLabel}>
          {menuOpen ? "Close menu" : "Open menu"}
        </span>
        <span className={styles.menuIcon} aria-hidden="true">
          <span className={`${styles.menuLine} ${styles.lineTop}`} />
          <span className={`${styles.menuLine} ${styles.lineBottom}`} />
          <span className={`${styles.menuLine} ${styles.lineCrossA}`} />
          <span className={`${styles.menuLine} ${styles.lineCrossB}`} />
        </span>
      </button>

      {backdropMounted ? (
        <MenuTransitionCanvas
          className={styles.menuBackdrop}
          open={menuOpen}
          onComplete={handleBackdropComplete}
        />
      ) : null}

      {menuOpen ? (
        <>
          <div id="mobile-primary-menu" className={styles.menuPanel}>
            <div className={styles.menuList}>
              <Link
                href="/"
                className={styles.menuLink}
                onClick={() => setMenuOpen(false)}
              >
                <MenuScrambleText text="HOME" startDelayMs={300} />
              </Link>
              {navLinks.map((link, index) => (
                <Link
                  key={`mobile-${link.href}`}
                  href={link.href}
                  className={styles.menuLink}
                  onClick={(event) => handleClick(event, link.href)}
                >
                  <MenuScrambleText
                    text={link.label}
                    startDelayMs={400 + index * 100}
                  />
                </Link>
              ))}
            </div>
            <div className={styles.menuFooter}>
              <span className={styles.menuReadout}>
                {time} {heroContent.telemetry.temperature}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </nav>
  );
}
