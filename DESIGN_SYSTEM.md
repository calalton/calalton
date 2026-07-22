# Cal Alton — Design System

Single source of truth: the `@theme` block in [src/app/globals.css](src/app/globals.css).
Component CSS consumes tokens — never raw values. If a value is missing, add a token first.

## Colour

Near-black stage + paper-white mark, plus a six-stop spectrum used only for the logo
hover and small accents.

| Token                              | Value     | Role                                   |
| ---------------------------------- | --------- | -------------------------------------- |
| `--color-void`                     | `#050506` | page background                        |
| `--color-ink` / `--color-ink-soft` | `#0b0b0d` / `#131317` | raised surfaces (CTA button) |
| `--color-paper`                    | `#f4f4f2` | primary text + the mark at rest        |
| `--color-paper-dim` / `-faint`     | greys     | secondary / tertiary text              |
| `--color-spectrum-1…6`             | pink→violet | logo hover gradient, focus ring, accents |

Never hard-code a hex in component CSS — reference the token.

## Typography

- **Montserrat** (variable), loaded once in [src/app/fonts.ts](src/app/fonts.ts) and wired
  through `--font-sans-var`. Both `--font-sans` and `--font-display` resolve to it.
- The giant brand is **not type** — it's the traced SVG mark. The visible hero `<h1>` is a
  bold Montserrat statement.
- Scale is fluid via `clamp()` in component CSS; the eyebrow/labels use letter-spacing.

## Motion

- CSS: `--dur-fast|base|slow` (180/420/900ms) × `--ease-out-soft` / `--ease-in-out-soft`.
- JS mirrors in [src/lib/motion.ts](src/lib/motion.ts) (`DUR`, `EASE`, `STAGGER`).
- Every animation ships a `prefers-reduced-motion` fallback; the global reset in
  `globals.css` also neutralises durations.

## Effects

- **Hero (`features/home/components/HeroCanvas`)** — a Three.js WebGL2 layer. The logo PNG
  is a texture; a ping-pong **flowmap** accumulates pointer velocity (radius/dissipation in
  `CONFIG`) and displaces the logo UVs, with the displacement magnitude driving a
  **chromatic aberration** (RGB channel split). A fine per-pixel **shader film grain** and
  soft vignette finish it. Under reduced motion the flow field is frozen and grain is
  minimal. Shaders live in `HeroCanvas/shaders.ts`; tuning lives in `CONFIG`.
- **Standalone mark (`components/brand/CalAltonMark`)** — the traced SVG for small logo
  placements. Its CSS spectrum-hover is available but the hero does not use it.

## Layout & spacing

- Page edges: `--edge-x` / `--edge-y` (fluid `clamp`).
- Radius: `--radius-pill`; ad-hoc small radii (button 8px) are local.
- Breakpoint: the hero nav appears at **48rem** (`min-width: 48rem`). Add new breakpoints
  sparingly and document them here.
