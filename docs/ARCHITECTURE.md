# Architecture

## Rendering model

Next.js 16 App Router with **Turbopack** for both dev and build. Server Components by
default; interactivity is pushed to leaf Client Components:

- `HeroSection` (Server) composes the copy + nav over the WebGL background.
- `HeroCanvas` (`"use client"`) — a Three.js WebGL2 layer. Two passes: a **flow update**
  pass ping-pongs a velocity field from pointer movement, and a **composite** pass samples
  the logo texture with flow-driven UV displacement, a chromatic (RGB) split, and shader
  film grain. Reduced-motion freezes the flow and minimises grain. GL resources are disposed
  on unmount.

The hero effect is an original implementation of the standard "fluid flowmap" technique
(the reference hero uses the same approach). Tuning constants live in `HeroCanvas`'s
`CONFIG`.

## Layers (bulletproof-react)

```
app  →  features  →  (components | content | lib)
```

- `app/` — routing, metadata, fonts, global CSS. Thin; delegates JSX to features.
- `features/<x>/` — feature-owned UI (`home` today).
- `components/` — shared, cross-feature (`brand`, `effects`, and `ui` as it grows).
- `content/` — copy/config.
- `lib/` — domain-named utilities (`cn`, `site`, `motion`).

One-way imports only. Shared layers never import from `features/`. Move shared code down a
layer, never sideways between features.

## The logo pipeline

`public/calaltonlogo.png` → `scripts/trace-logo.mjs` (potrace) →
`src/components/brand/CalAltonMark/logo-path.ts` (auto-generated) → `CalAltonMark.tsx`.

The same source runs through `scripts/generate-logo-sdf.mjs` (`pnpm sdf:logo`) to produce
`public/media/calalton-logo-sdf.png`. `HeroGlass2D` samples that committed distance field so
the entry circle can morph smoothly into every disconnected part of the wordmark without a
runtime distance-transform pass.

Run `pnpm trace:logo` after changing the PNG. The generated module is committed so the app
builds without running potrace. The intermediate preview SVG lands in `.cache/`
(gitignored).

The hero samples the generated distance field in `HeroGlass2D`. One transparent WebGL canvas
draws the inverse white matte, the circle-to-letter entry morph, the pointer flow, and the
scroll-linked perspective/barrel pass. `HeroBackdrop` is an independent fixed cloud-tunnel
scene revealed through that aperture; pointer events are consumed by the logo treatment, not
by the backdrop.

## Styling strategy

Two deliberate layers sharing the same CSS-variable tokens:

1. **Tailwind v4 utilities** — ordinary layout/spacing (`@theme` tokens in `globals.css`,
   no `tailwind.config.js`).
2. **CSS Modules** — anything with keyframes, SVG filters, blend modes, or motion media
   queries (the mark treatment, the grain overlay, the hero layout).

## Metadata & SEO

- `src/content/site-metadata.ts` builds the base `Metadata` from `src/lib/site.ts`
  (title template, Open Graph, Twitter). Consumed by the root layout.
- `app/robots.ts` and `app/sitemap.ts` are metadata routes driven by the same `site` object.
