# Cal Alton

Independent creative studio site. Expressive, dark, high-craft landing hero with a traced
brand mark, an animated multicolour hover, and a film-grain overlay.

## Stack

- **Next.js 16** App Router · **Turbopack** (dev + build)
- **React 19** · **TypeScript** (strict + `noUncheckedIndexedAccess`)
- **Tailwind CSS v4** (CSS-first `@theme`) + CSS Modules for effect-heavy components
- **Motion** for JS animation · **pnpm**

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

If `pnpm run *` ever fails with `ERR_PNPM_IGNORED_BUILDS`, approve the native builds once:

```bash
pnpm approve-builds --all
```

## Scripts

| Script             | Does                                                         |
| ------------------ | ----------------------------------------------------------- |
| `pnpm dev`         | Dev server (Turbopack)                                       |
| `pnpm build`       | Production build (Turbopack)                                 |
| `pnpm start`       | Serve the production build                                   |
| `pnpm check`       | `typecheck` + `lint` (keep green)                            |
| `pnpm typecheck`   | `tsc --noEmit`                                               |
| `pnpm lint`        | ESLint                                                       |
| `pnpm format`      | Prettier write                                               |
| `pnpm trace:logo`  | Re-trace `public/calaltonlogo.png` → the mark's path module  |

## Project layout

```
src/
  app/         routing, metadata, fonts, globals.css (@theme tokens)
  components/  brand/ (CalAltonMark), effects/ (TvStatic), ui/
  features/    home/ (HeroSection)
  content/     hero.ts, site-metadata.ts
  lib/         cn.ts, site.ts, motion.ts
scripts/       trace-logo.mjs
public/        calaltonlogo.png (logo source of truth)
```

## The brand mark

`public/calaltonlogo.png` is potraced into
`src/components/brand/CalAltonMark/logo-path.ts` by `pnpm trace:logo`. That module is
committed, so builds don't need potrace. Re-run the script whenever the PNG changes.

## Docs

- [AGENTS.md](AGENTS.md) — conventions for agents/humans
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — tokens, type, effects
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, rendering, logo pipeline
