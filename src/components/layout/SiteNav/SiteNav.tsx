// client: mobile menu state and scroll-stage anchor handling.
"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { navLinks } from "@/content/hero";
import { GooText } from "@/components/effects/GooText/GooText";
import { useScrollStage } from "@/features/home/components/ScrollStage/ScrollStage";
import { MenuGooBackdrop } from "./MenuGooBackdrop";
import styles from "./SiteNav.module.css";

/**
 * Persistent primary nav. Fixed to the top-right of the viewport so it stays
 * put as the page scrolls (rendered at the page level, outside the hero's
 * clipping context).
 */
export function SiteNav() {
  const scrollStage = useScrollStage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRendered, setMenuRendered] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.mobileMenuOpen = menuOpen
      ? "true"
      : "false";
    return () => {
      delete document.documentElement.dataset.mobileMenuOpen;
    };
  }, [menuOpen]);

  // Keep the panel mounted through the close so its links can goo back out.
  useEffect(() => {
    if (menuOpen || !menuRendered) return;
    const timer = window.setTimeout(() => setMenuRendered(false), 720);
    return () => window.clearTimeout(timer);
  }, [menuOpen, menuRendered]);

  const handleMenuToggle = () => {
    if (!menuOpen) setMenuRendered(true);
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
        {navLinks.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            onClick={(event) => handleClick(event, link.href)}
          >
            <GooText delay={index * 80} persist>{link.label}</GooText>
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
        </span>
      </button>

      <MenuGooBackdrop open={menuOpen} />

      {menuRendered ? (
        <div
          id="mobile-primary-menu"
          className={styles.menuPanel}
          data-open={menuOpen ? "true" : "false"}
        >
          <div className={styles.menuList}>
            <Link
              href="/"
              className={styles.menuLink}
              onClick={() => setMenuOpen(false)}
            >
              <GooText delay={320} show={menuOpen}>
                HOME
              </GooText>
            </Link>
            {navLinks.map((link, index) => (
              <Link
                key={`mobile-${link.href}`}
                href={link.href}
                className={styles.menuLink}
                onClick={(event) => handleClick(event, link.href)}
              >
                <GooText delay={380 + index * 70} show={menuOpen}>
                  {link.label}
                </GooText>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
