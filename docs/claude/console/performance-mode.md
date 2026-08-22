<!-- Reference material, NOT auto-loaded. Read on demand when working on this subsystem. -->

## Console PAINT BASELINE — permanent, not a mode (2026-08)

**History.** Until 2026-08 this was the opt-in performance profile «Производительность» (`con-perf-lite`, `consolePerfMode.ts`, persisted `tm_console_perf_lite`, URL `?perfLite=1`). The first Steam-Deck performance iteration made its enabled behaviour the ONLY production behaviour: the toggle, the runtime flag, the persistence and the localization are gone. The old persisted localStorage key is simply never read again — old installs start fine. Do not reintroduce the expensive effects through another flag or a renamed setting.

**What the baseline is** (`src/styles/console_paint_baseline.less`, one universal rule under `html.console-native`): `filter: none !important; text-shadow: none !important;` for the whole console-native subtree.

- `filter` (blur / drop-shadow) is the big win: each forces its OWN compositing layer + a costly per-frame raster (the Layerize bottleneck measured in the original traces). In console it was purely decorative (planet/icon glows, ambient blooms).
- `text-shadow` is a small per-frame paint across the glass typography.
- **`box-shadow` is DELIBERATELY KEPT** — it is the sole carrier of the state-coloured focus/selection/cursor rings (con-mint = active, con-amber = attention, con-cyan = selected). Cutting it once shipped as a bug (the player lost every navigation cue). Its cost is modest and mostly at mount.
- **Motion is untouched** — transforms, opacity and every GSAP/CSS animation run identically.

The desktop UI (frozen) is out of scope: the gate is `html.console-native`, which only exists while a console-native surface is mounted.

**The contract for new console UI** (same three rules as before, now unconditional):
1. Motion lives in `transform` / `opacity` only.
2. Functional state — focus, selection, cursor, availability, "your turn" — rides `box-shadow` / `outline` / colour. A `filter`/`drop-shadow`/`text-shadow` cue never renders in console.
3. Don't author new decorative `filter`/`text-shadow` in console styles — it is dead weight (the baseline strips it). Existing inert declarations in shared files are tolerated where the same rule serves the desktop fallback.

**Verification:** there is nothing to toggle any more — the baseline is always on. `make:css` compiles `console_paint_baseline.less`; visual checks happen in the normal console shell.
