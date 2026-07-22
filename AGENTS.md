# AGENTS.md — Working on the Cal Alton codebase

Conventions for AI coding agents (and humans). Every rule below reflects how this repo
actually works today; when you change a pattern, change this file in the same PR.

## Stack snapshot

Next.js 16 App Router (**Turbopack** for dev *and* build — `--turbopack` in both scripts) ·
React 19 · TypeScript 5 strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` ·
**Tailwind CSS v4** (CSS-first `@theme`, no `tailwind.config.js`) · CSS Modules for
effect-heavy components · **Three.js** (WebGL2) for the hero · Motion (`motion`) available
for JS animation · pnpm · ESLint 9 flat config. Package manager is **pnpm** — do not add
npm/yarn lockfiles.

## Folder structure (bulletproof-react)

```
src/
  app/            App Router. Thin files: route config, metadata, data, JSX delegation.
    layout.tsx    Root shell — loads fonts + globals, sets metadata.
    page.tsx      Home route — delegates to features/home.
    fonts.ts      All next/font loaders. Exposed as CSS vars; never import fonts elsewhere.
    globals.css   Tailwind import + the `@theme` design tokens + base layer.
    robots.ts / sitemap.ts   Metadata routes.
  components/     Shared, cross-feature only.
    brand/        CalAltonMark (the traced wordmark SVG + its hover treatment).
    effects/      Reusable visual effects (TvStatic).
    ui/           Primitives (add here as they appear — buttons, fields, …).
  features/<x>/   Feature-owned UI. Today: home/ (HeroSection, LiveClock).
    <x>/components/…
  content/        Cross-feature copy/config (hero.ts, site-metadata.ts).
  lib/            Cross-cutting utilities, domain-named (cn.ts, site.ts, motion.ts).
scripts/          Build-time tooling (trace-logo.mjs).
public/           Static assets (calaltonlogo.png — the logo source of truth).
```

Layering is one-way: `app → features → (components | content | lib)`. Shared layers never
import from `features/`. Move shared things down a layer (content/components/lib), never
sideways between features.

## Naming

- Shared component folders/files: PascalCase (`components/brand/CalAltonMark/CalAltonMark.tsx`),
  CSS module matches (`CalAltonMark.module.css`).
- Feature-private leaves: PascalCase file, co-located (`features/home/components/LiveClock.tsx`).
- `lib` utilities: kebab-case filenames, named by domain (`cn.ts`, `site.ts`). No `utils.ts`.
- Same-folder imports use `./Sibling`; everything else uses the `@/` alias. Never `../../`.

## Component patterns

- **Server-first.** Pages and sections are Server Components; interactivity lives in leaf
  components only. Every `"use client"` file carries a one-line justification comment on the
  first line: `// client: <reason>` (grep it — `HeroCanvas` follows this).
- The hero (`features/home/components/HeroSection`) is a Server Component. The giant mark
  is **one** `HeroCanvas` — a single transparent Three.js WebGL2 layer mounted **globally in
  the root layout** (fixed, `z-index:40`, `pointer-events:none`). It renders only the logo
  (transparent elsewhere) with a mouse-driven **flowmap distortion + chromatic aberration +
  grain**, and a scroll-driven **liquid migration**: on scroll the mark goes fluid with a
  comet tail, streaks to the top-left corner and settles there as the header logo, reforming
  in the centre on scroll back. There is deliberately **no second logo** — do not add a
  separate header mark. Scroll progress is published as the `--hero-p` CSS variable (drives
  the hero text fade). Hero background grain/vignette is the separate CSS `FilmGrain` layer.
  Tuning lives in `CONFIG` and the shader constants; see `HeroCanvas/shaders.ts`.
- No state libraries, no context. Data is static content from `src/content`. Add React state
  only in leaves, only when an effect genuinely needs it.

## Styling

- **Tokens first.** Every colour, space, timing and radius resolves to a token declared in
  the `@theme` block of `src/app/globals.css` (`--color-*`, `--font-*`, `--ease-*`,
  `--dur-*`, `--edge-*`, `--radius-*`). Add a token there before hard-coding a value.
- **Two layers, deliberately:** Tailwind utility classes for ordinary layout/spacing; **CSS
  Modules** for anything with keyframes, SVG filters, blend modes or `@media` motion queries
  (the logo treatment and TV static). Don't force complex effects into utility strings.
- Tokens are shared across both layers because they're plain CSS custom properties — a CSS
  Module reads `var(--color-spectrum-1)` and a JSX class reads `text-paper`.

## Motion & accessibility

- Reduced motion is non-negotiable. `globals.css` neutralises animation/transition durations
  under `@media (prefers-reduced-motion: reduce)`, and every animated component adds its own
  explicit fallback (see the reduced-motion blocks in `CalAltonMark.module.css` and the
  `reduced` branch in `TvStatic.tsx`). Match this when adding motion.
- JS timing comes from `src/lib/motion.ts` (`EASE`, `DUR`, `STAGGER`) mirroring the CSS
  `--ease-*` / `--dur-*` tokens. Keep the two in sync.

## The Cal Alton mark (brand)

- `public/calaltonlogo.png` is the source of truth. It is the texture sampled by the hero
  WebGL shader **and** the input to `scripts/trace-logo.mjs` (`pnpm trace:logo`), which
  potraces it into `src/components/brand/CalAltonMark/logo-path.ts` (auto-generated — never
  hand-edit) for the standalone SVG mark used outside the hero.
- `CalAltonMark.tsx` (the SVG) is available for small logo placements (nav/footer). The
  giant hero mark is the WebGL canvas, not this component.
- The accessible page `<h1>` is the top-left statement in `HeroSection`; the canvas and the
  SVG mark are decorative. Keep exactly one `h1` per route.

## TypeScript rules

- `type` aliases only — no `interface`. No `any`, no `@ts-ignore`, no non-null assertions;
  guard instead (`noUncheckedIndexedAccess` is on).
- `import type` everywhere (enforced by `verbatimModuleSyntax`).
- Read site constants from `src/lib/site.ts`; never scatter URLs/brand strings.

## Verification

`pnpm check` runs `typecheck` then `lint` and must stay green. `pnpm build` (Turbopack)
before shipping layout-affecting changes. `pnpm trace:logo` after any logo change.

Note: native build scripts (`sharp`, `unrs-resolver`) are approved via
`pnpm-workspace.yaml → onlyBuiltDependencies`. If `pnpm run *` starts failing with
`ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds --all` once.

## Anti-patterns specific to this codebase

- Don't hand-edit `logo-path.ts` — regenerate it.
- Don't convert the hero effect to CSS/2D-canvas — the reference (and this repo) use a real
  WebGL flowmap; keep the shader approach and its `prefers-reduced-motion` fallback (grain
  frozen, no flow updates).
- Keep the WebGL cheap: the flow field renders at `FLOW_SCALE` of canvas size and the DPR is
  capped at 2. Dispose GL resources on unmount (the effect cleanup already does).
- Don't add `tailwind.config.js` — this is Tailwind v4, config is the `@theme` block.
- Don't introduce a state library or context for the current static content.

## Doc map

- README.md — setup, scripts, structure
- DESIGN_SYSTEM.md — tokens, typography, effects, breakpoints
- docs/ARCHITECTURE.md — layers, rendering model, the logo pipeline
