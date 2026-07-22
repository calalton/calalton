import localFont from "next/font/local";

/**
 * Fonts are loaded once here and exposed as CSS variables consumed by the
 * Tailwind `@theme` (`--font-sans`, `--font-display`, `--font-mono`). Never
 * import fonts in a component — add them here and wire the variable through
 * the theme.
 *
 * Local type system:
 * - `tiktok` sans: local TikTokSans variable TTF.
 * - `tiktok` display: the original local TikTokSans variable TTF.
 * - `mono`: local Geist Mono variable TTF.
 * - `tronica-mono`: local Departure Mono regular OTF.
 */
export const fontSans = localFont({
  src: "../../public/fonts/TikTokSans.ttf",
  display: "block",
  variable: "--font-sans-var",
  weight: "100 900",
});

export const fontDisplay = localFont({
  src: "../../public/fonts/TikTokSans.ttf",
  display: "block",
  variable: "--font-display-var",
  weight: "100 900",
});

export const fontMono = localFont({
  src: "../../public/fonts/GeistMono[wght].ttf",
  display: "block",
  variable: "--font-mono-var",
  weight: "100 900",
});

export const fontMono2 = localFont({
  src: "../../public/fonts/DepartureMono-Regular.otf",
  display: "block",
  variable: "--font-mono-2-var",
  weight: "400",
});

export const fontVariables = `${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} ${fontMono2.variable}`;
