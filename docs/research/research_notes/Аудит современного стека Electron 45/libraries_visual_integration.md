# Modern libraries for visuals, animation, rendering and platform integration (Vue 3.5 + Electron 45 console board game) — state as of 2026-10-22

Method note: versions / publish dates / licenses / weekly downloads were read directly from the npm registry (`registry.npmjs.org/<pkg>`, `api.npmjs.org/downloads/point/last-week/<pkg>`) on 2026-10-22 — treat them as primary. Sizes are bundlephobia figures for the package's main entry (min / gzip, NOT tree-shaken, WASM excluded). Some GitHub-release pages were summarised by a fetch tool that printed the year as "2024" for releases npm dates to 2026; where they conflict, the npm timestamp wins. Repo facts come from read-only greps of `C:\Projects\Mods\terraforming-mars` (package.json, `src/client`, `src/styles`, `electron/`).

**Repo baseline found during this research (relevant to every verdict below):**
- `gsap ^3.15.0` is used in **85 import sites, core only** — no plugin is imported or registered anywhere (`grep "from 'gsap/"` / `registerPlugin` = 0 hits).
- `motion-v ^2.3.0` is in `dependencies` but **imported nowhere** in `src/`, `tests/`, `electron/` (only hit for "motion-v" is the unrelated attribute `data-motion-variant`). Added in commit `acdd0a607f "UI rework"`.
- GSAP tweens overwhelmingly use stock eases (`power2.out` ×155, `power1.out` ×103, `power1.in` ×65, `power2.in` ×64, `expo.out` ×43 …), while the design tokens `MOTION_EASE` in `src/client/components/motion/motionTokens.ts` are CSS `cubic-bezier(...)` strings; an in-house solver `src/client/components/motion/cubicBezier.ts` (`cubicBezierEase`) already exists.
- No WebGL/WebGPU/canvas rendering layer (only `consoleTextMeasure.ts` and `favicon.ts` use a 2D context). `backdrop-filter` appears 45× in `src/styles`.
- **No haptics at all** (`vibrationActuator` / `playEffect` on a gamepad: 0 hits; `electron/nativeGamepadLinux.ts` has no `EV_FF`/`FF_RUMBLE`).
- Audio = upstream `src/client/utils/SoundManager.ts`: oscillator-generated notes via a raw `AudioContext` (no samples, no library).
- Fonts in LESS: `Prototype` (247), `Ubuntu` (26), `Russo One` (20), `Orbitron` (13), `Literata`, `Newsreader`.
- Electron main appends only `no-sandbox` and `disable-gpu-sandbox` switches (`electron/main.ts:76-77`). No vue-router, no Pinia in package.json. `@vueuse/core` 14.4.0 is used mainly for `useResizeObserver` (39), `useEventListener` (18), `useIntervalFn`, `useDebounceFn`, `useMediaQuery`.

## 1. Animation: GSAP after Webflow, Motion / motion-v, Anime.js v4, Theatre.js

### Takeaway
Since **GSAP 3.13 (npm 2025-04-30)** every former Club plugin (SplitText, MorphSVG, Flip, MotionPath, Inertia, Physics2D, CustomEase/Bounce/Wiggle, ScrambleText, DrawSVG, ScrollSmoother…) ships free in the public `gsap` package, including commercial use, under Webflow's "Standard No Charge" license whose only notable prohibition is building no-code visual animation tools that compete with Webflow — irrelevant to a game. We already pay GSAP's bundle cost but use only core; the cheapest premium gains are **`gsap.registerEase` for our MOTION_EASE tokens, MotionPathPlugin for token arcs, Flip for reparenting flights, SplitText/ScrambleText for ceremony type**. motion-v is an unused dependency → remove (or justify); Anime.js and Theatre.js → skip.

### Cited Findings
**GSAP — licensing and versions**
- GSAP 3.13 announcement (2025-04-29): "Thanks to Webflow, GSAP is now 100% FREE including ALL of the bonus plugins like SplitText, MorphSVG, and all the others that were exclusively available to Club GSAP members… even for commercial use"; all plugins moved into the main public repo/npm package — [gsap.com/blog/3-13](https://gsap.com/blog/3-13/); [Webflow blog](https://webflow.com/blog/gsap-becomes-free)
- npm publish dates: 3.13.0 = 2025-04-30, 3.14.0 = 2025-12-08, 3.14.2 = 2025-12-12, **3.15.0 = 2026-04-13 (current latest)**; ~3.74 M weekly downloads; npm `license` field reads "Standard 'no charge' license: https://gsap.com/standard-license" — [npm registry: gsap](https://registry.npmjs.org/gsap)
- `gsap-trial` (the old paid-plugin trial package) is deprecated — [npm: gsap-trial](https://npmjs.com/package/gsap-trial)
- GreenSock's own skills docs: "Every GSAP plugin is free, including for commercial use… no plugin requires a membership, license key, or auth token… `npm install gsap`… import them as `gsap/SplitText`, `gsap/MorphSVGPlugin`" — [greensock/gsap-skills (tessl mirror)](https://tessl.io/registry/skills/github/greensock/gsap-skills/gsap-plugins)
- License text: permitted use on "any website, web application, or digital interface"; **Prohibited Uses** = "any implementation and/or use of GSAP Products in tools that allow users to build visual animations without code that… competes with Webflow's visual animation building capabilities" — [ScanCode LicenseDB copy of "GSAP Standard No Charge 2025"](https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html); [Wind River license list](https://open.windriver.com/info/uni-license-list/licenses/gsap-standard-no-charge-2025.html). (gsap.com/standard-license itself was unreachable during this pass — forums were offline for a PHP security issue.)
- 3.13 also: SplitText rewritten — ~50 % smaller, 14 new features: screen-reader aria labels, responsive re-splitting (`autoSplit` / `onSplit()` when fonts load or on resize), `deepSlice` nested elements, masking for reveal effects, better emoji/foreign-character handling; plus animating to named CSS variables — [gsap.com/blog/3-13](https://gsap.com/blog/3-13/)
- 3.14 (2025-12-08): MorphSVG `smooth` option (`smooth: 80` or `"auto"`) and evener anchor insertion; demo hub demos.gsap.com — [gsap.com/blog/3-14](https://gsap.com/blog/3-14/)
- 3.15 (2026-04-13): new **`easeReverse`** tween property — a separate ease for backwards playhead movement, recalculated "from precisely where the playhead changed direction", for "interruptible, reversible animations… modals, menus, drawers"; `yoyoEase` deprecated in favour of it — [gsap.com/blog/3-15](https://gsap.com/blog/3-15/)
- Size: gsap@3.15.0 main entry 70.6 KB min / 27.4 KB gzip — [bundlephobia](https://bundlephobia.com/package/gsap@3.15.0)

**GSAP plugins that map onto our problems**
- **Flip**: `Flip.getState()` → DOM change → `Flip.from()`; options `absolute` (position:absolute during the flip, solves flex/grid reflow), `nested` (prevents offset compounding when parent and child both move), `scale`, `targets`, `prune`, `toggleClass`, `onEnter/onLeave`; `Flip.fit()` "repositions/resizes one element so that it appears to fit exactly into the same area as another"; `Flip.batch()` to sequence multiple flips; docs warn frameworks may not render immediately — use lifecycle hooks / rAF — [gsap.com/docs Flip](https://gsap.com/docs/v3/Plugins/Flip/)
- **MotionPathPlugin**: animate along an SVG path *or an array of points* with `curviness` (0 sharp … 2 very curved), `autoRotate`, `align` "regardless of how deeply nested they are inside different transformed containers", `alignOrigin`; helpers `convertCoordinates()` / `getRelativePosition()` for cross-container coordinates — [gsap.com/docs MotionPathPlugin](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/)
- **CustomEase** "recognizes standard `cubic-bezier()` strings containing four numbers… e.g. `".17,.67,.83,.67"`"; companions CustomBounce, CustomWiggle; `getSVGData()` — [gsap.com/docs CustomEase](https://gsap.com/docs/v3/Eases/CustomEase/)
- **Core** already has `gsap.registerEase("name", fn)` — "register your own easing function with GSAP, giving it a name that can be referenced in any animations" — [gsap.com/docs registerEase](https://gsap.com/docs/v3/GSAP/gsap.registerEase())

**Motion (motion.dev) / motion-v**
- `motion` (vanilla/React) latest **14.5.0 = 2026-10-21**; majors: 12.0.0 = 2025-01-20, 13.0.0 = 2026-08-05, 14.0.0 = 2026-10-02; MIT; ~15.8 M weekly — [npm registry: motion](https://registry.npmjs.org/motion)
- Changelog highlights: 13.3 `animate.addEffect()` with Three.js/"VGPU" effects; 13.4 `AnimateView` for React view transitions + "spring retargeting (80% reduction), animate startup (20%), frame scheduling (10%)"; 13.5 negative `bounce` (overdamped springs); 14.0 removed internal framer-motion 13.0–13.4 compat APIs; **14.1 `animateLayout` (layout animations in vanilla JS)**; **14.2 "Hardware accelerated independent transforms (x, y, scaleX…)"**; 14.3 grid `stagger`, `scaleZ`; 14.4 drag in JS API; 14.5 `scopeMotion` — [motion.dev/changelog](https://motion.dev/changelog)
- `motion-v` latest **2.8.0 = 2026-10-16**; 1.0.0 = 2025-04-26, 2.0.0 = 2026-02-24; MIT; ~460 k weekly; peer deps `vue >=3.0.0`, `@vueuse/core >=10` — [npm registry: motion-v](https://registry.npmjs.org/motion-v)
- motion-v 2.5 added `AnimateView` + `startTransition`, 2.6 moved to framer-motion/motion-dom v14, 2.7 `usePresence`, 2.8 synced motion 14.3 — [motion-vue releases](https://github.com/motiondivision/motion-vue/releases) (page dates printed as 2024 by the fetch tool; npm dates are 2026)
- Motion for Vue offers springs, keyframes, layout + shared-layout animations, gestures, `AnimatePresence`, `LazyMotion`, `v-motion` directive — [motion.dev: introducing Motion for Vue](https://motion.dev/blog/introducing-motion-for-vue)
- Size: motion-v@2.8.0 211 KB min / 70 KB gzip; motion@14.5.0 169 KB / 57 KB gzip (whole entry) — [bundlephobia motion-v](https://bundlephobia.com/package/motion-v@2.8.0), [bundlephobia motion](https://bundlephobia.com/package/motion@14.5.0)
- **Motion+** is a paid one-time $299 lifetime tier with exclusive components (AnimateNumber, Ticker, Typewriter, **ScrambleText, splitText**, Cursor, Carousel) — the GSAP equivalents (SplitText, ScrambleText) are now free — [motion.dev/pricing](https://motion.dev/pricing), [motion.dev/plus](https://motion.dev/plus)

**Anime.js / Theatre.js**
- animejs latest 4.5.0 = 2026-06-22 (4.0.0 = 2025-04-03), **5.0.0-beta.2 = 2026-08-17** on the beta tag; MIT; ~634 k weekly; 4.5.0 lists `three >=0.150` in peerDependencies; 117 KB min / 40 KB gzip — [npm registry: animejs](https://registry.npmjs.org/animejs), [bundlephobia](https://bundlephobia.com/package/animejs@4.5.0)
- v4: ES-module modular imports (`animejs/animation`, `/timeline`…), a ~3 KB WAAPI mode, draggable, `createSeededRandom()`, CSS-variable values (4.2) — [newreleases: animejs 4.2.0](https://newreleases.io/project/npm/animejs/release/4.2.0)
- `@theatre/core` latest **0.7.2, last published 2024-05-19** (Apache-2.0); `@theatre/studio` 0.7.2, **AGPL-3.0-only**; ~12 k weekly — [npm registry: @theatre/core](https://registry.npmjs.org/@theatre/core), [@theatre/studio](https://registry.npmjs.org/@theatre/studio)
- Theatre's README says 1.0 is "around the corner" and development "temporarily moved to a private repo" — [README mirror on gitee](https://gitee.com/DannyJones/theatre); licensing split core Apache / studio AGPL — [docs.theatrejs.com](https://docs.theatrejs.com/)

### Inferences
- **GSAP plugins: ADOPT selectively (cost ≈ 0 € and ≈ 0 KB extra bundle beyond each plugin's own size).** Concretely:
  - *Easing unification* — no plugin needed: register each `MOTION_EASE` token once with `gsap.registerEase('tm.standard', cubicBezierEase(...))` (or `CustomEase.create('tm.standard', '0.22,0.61,0.36,1')`) so JS tweens and CSS share bit-identical curves; then migrate the ~480 `power*` eases gradually (this directly serves invariant 6 "one motion system"). A guard test could assert every registered GSAP ease equals its CSS token.
  - *Token arcs* — MotionPathPlugin `path: [p0, apex, p1]`, `curviness`, `autoRotate` replaces hand-rolled bezier math; `align`/`convertCoordinates` handles the TV-scaled / zoomed containers (relevant to the 4K TV-scale layer).
  - *Card flights with reparenting* ("result detaches into an app-level layer… then flies to the measured destination") — Flip's `absolute`, `nested`, `Flip.fit()` are exactly this; TRIAL on the next new flight rather than migrating the existing hand-written FLIP flights (high regression risk, e2e timing specs depend on them).
  - *Ceremony titles / sci-fi readouts* — SplitText (aria-safe, re-splits on font load, masks) and ScrambleText. Note RU text: SplitText 3.13 improved foreign-character handling.
  - `easeReverse` (3.15, already installed) fits reversible beats (collapse/restore, back = one level).
  - Skip ScrollSmoother/ScrollTrigger (no-scroll product), Physics2D (no use case), Inertia only if analog-stick momentum panning of the board is wanted.
- **motion-v: SKIP / REMOVE from dependencies.** It is not imported, so webpack ships 0 bytes of it today; it only adds upgrade/lockfile noise. Running both GSAP and Motion would duplicate engines (two rAF schedulers, two easing vocabularies) against invariant 6. Re-consider only if declarative spring/layout animations (`layout` prop / `AnimatePresence`) become a requirement GSAP Flip can't meet.
- **Anime.js v4/v5: SKIP** (redundant with GSAP, no capability we lack). **Theatre.js: SKIP** (no npm release for ~2.5 years, 1.0 developed privately, studio AGPL).

### Gaps
- Could not read gsap.com/standard-license directly (site forum outage); relied on two license-database copies of the 2025 text.
- No GitHub release notes for GSAP 3.15 patch contents (the GSAP repo has no GitHub Releases).
- No independent benchmark of Motion 14 "hardware accelerated independent transforms" vs GSAP for our tween volumes.

## 2. Rich vector / state-machine animation: Rive, dotLottie / lottie-web, Spline

### Takeaway
**Rive** is the strongest option for a stateful animated character (MarsBot avatar/emotes) or reactive ceremony emblems: MIT runtimes (2.45.0, 2026-10-17), state machines, data binding, Luau scripting (since 2026-01-13), WebGL2 "Rive Renderer" — but the editor moved exports to paid plans on 2025-10-20 (Cadet $9/seat/mo) and the WebGL2 runtime is ~648 KB brotli. **dotLottie-web** (ThorVG WASM, 0.81.0) is the lighter, MIT, marketplace-friendly choice for animated icons/stingers. Both are TRIAL-only, gated on having an animator; Spline → skip.

### Cited Findings
- Rive packages `@rive-app/canvas`, `/webgl2`, `/canvas-lite` all **2.45.0 = 2026-10-17**, MIT; weekly ~696 k / ~393 k / ~91 k — [npm registry: @rive-app/canvas](https://registry.npmjs.org/@rive-app/canvas)
- Runtime choice: `webgl2` = "The Rive Renderer on WebGL2", matches Editor fidelity, supports **vector feathering**; `canvas` uses Canvas2D (no feathering, different fill rules, but native blend modes are cheaper on mobile); `canvas-lite` strips text, layout, audio and scripting; WebGL2 hits browser **WebGL context limits** with many instances → `useOffscreenRenderer: true` shares one context — [rive.app docs: canvas vs webgl](https://rive.app/docs/runtimes/web/canvas-vs-webgl)
- Runtime sizes: WebGL2 2179 KB uncompressed / **648 KB brotli**; canvas 567 KB brotli; canvas-lite 222 KB brotli — [rive.app docs: runtime sizes](https://rive.app/docs/runtimes/runtime-sizes.md) (via search snippet, not fully fetched); bundlephobia shows only the JS wrapper (275 KB min / 69 KB gzip) — [bundlephobia](https://bundlephobia.com/package/@rive-app/canvas@2.45.0)
- Pricing page now: Free $0 ("Build and ship with a Rive splash screen"), **Cadet $9/seat/mo** (max 3 seats; export .riv without splash screen), Voyager $32/seat/mo (max 25), Enterprise $120/seat/mo ($10M+ revenue); runtimes MIT and free — [rive.app/pricing](https://rive.app/pricing)
- Pricing change: "As of October 20, 2025, creating new exports will move to Rive's paid plans"; "no runtime fees, and once exported, files will continue to work forever, regardless of plan status" — [rive.app/blog/new-pricing](https://rive.app/blog/new-pricing). **Conflict:** the current pricing page implies Free can ship with a splash screen; the Oct-2025 blog says exports need a paid plan — likely a later revision; verify before relying on Free.
- Rive Scripting live since **2026-01-13**, language **Luau**, typed APIs in the Editor — [rive.app blog: scripting is live](https://rive.app/blog/scripting-is-live-in-rive), [why Luau](https://rive.app/blog/why-scripting-runs-on-luau); data binding via View Models, supported by web runtimes — [rive.app docs: data binding](https://rive.app/docs/editor/data-binding/overview)
- `@lottiefiles/dotlottie-web` **0.81.0 = 2026-10-06** (0.50.0 = 2025-08-13), MIT, ~949 k weekly; `@lottiefiles/dotlottie-vue` 0.11.28 (2026-10-06), ~24 k weekly — [npm registry: dotlottie-web](https://registry.npmjs.org/@lottiefiles/dotlottie-web), [dotlottie-vue](https://registry.npmjs.org/@lottiefiles/dotlottie-vue)
- dotlottie-web: "Rust + WASM core powered by ThorVG", renderers Software (Canvas2D), WebGL2, WebGPU (experimental); dotLottie v2 **interactive state machines**; runtime **theming** (palettes, gradients, text, images); **`DotLottieWorker`** off-main-thread rendering via OffscreenCanvas; per-renderer WASM builds — [github.com/LottieFiles/dotlottie-web](https://github.com/LottieFiles/dotlottie-web); JS entry 165 KB min / 33 KB gzip (WASM extra) — [bundlephobia](https://bundlephobia.com/package/@lottiefiles/dotlottie-web@0.81.0)
- `lottie-web` 5.13.0 = 2025-05-21 (slow cadence), MIT, 306 KB min / 77 KB gzip — [npm registry: lottie-web](https://registry.npmjs.org/lottie-web), [bundlephobia](https://bundlephobia.com/package/lottie-web@5.13.0)
- `@splinetool/runtime` 2.0.103 = 2026-10-21, npm `license` field empty (no OSS license declared), ~379 k weekly — [npm registry: @splinetool/runtime](https://registry.npmjs.org/@splinetool/runtime)

### Inferences
- **Rive — TRIAL** for (a) a MarsBot avatar with a state machine (idle / thinking / attack / defeated) driven by data binding from the existing bot-turn flow, (b) ceremony emblems. Use `@rive-app/webgl2` with `useOffscreenRenderer: true` (several instances on one screen), lazy-load the chunk only on screens that need it. Integration risks: its own render loop must be paused when hidden and its speed tied to `motionMs()`/`--motion-scale` and `prefers-reduced-motion` (invariant 6) — needs a thin wrapper; animation holds must release on Rive state-machine events, not timers. Cost: ≥ $9/seat/mo while authoring; zero runtime fee.
- **dotLottie — TRIAL** for animated icons / short stingers (e.g. award funded, milestone claimed) if assets are bought/authored in After Effects/LottieFiles; Worker mode keeps the main thread free during heavy board beats. **lottie-web — SKIP** (larger, slower SVG renderer, low cadence).
- **Spline — SKIP** (proprietary runtime, heavy 3D scenes, no fit with DOM card faces).
- Neither replaces the premium DOM card face (`.pcard`); keep them as decorative islands.

### Gaps
- No measured Rive/dotLottie performance on Steam Deck (AMD Van Gogh) or at 4K found.
- Exact current Free-plan export rights of Rive (conflict above) unresolved.

## 3. 2D/3D rendering layer: PixiJS v8, Three.js WebGPU, TresJS, Babylon, particles, shader glass — worth it vs DOM?

### Takeaway
All engines are healthy (Pixi 8.22, three r186, TresJS 5.9, Babylon 9.31), but **WebGPU is NOT default for AMD GPUs on Linux in Chromium** (only Intel Gen12+ since Chrome 144 and NVIDIA-on-Wayland since 147), so on Steam Deck any engine would run its WebGL2 fallback. Given a DOM-first product with e2e hooks on DOM attributes, a full canvas board is not worth it; the defensible option is a **single, lazy-loaded, pointer-events-none overlay canvas for particles/ceremony effects** (TRIAL tsParticles-slim or a small Pixi stage). Shader "liquid glass" via SVG `backdrop-filter: url()` is Chromium-only and heavy — skip on the TV/Deck budget.

### Cited Findings
- `pixi.js` **8.22.0 = 2026-10-01** (8.0.0 = 2024-03-05, 8.20.0 = 2026-08-20), MIT, ~846 k weekly; 925 KB min / 265 KB gzip whole entry — [npm registry: pixi.js](https://registry.npmjs.org/pixi.js), [bundlephobia](https://bundlephobia.com/package/pixi.js@8.22.0)
- Pixi v8 launch benchmarks vs v7 (Bunnymark 100k sprites): moving CPU ~50 ms → ~15 ms, static CPU ~21 ms → ~0.12 ms; "WebGPU does not automatically guarantee improved performance over WebGL in all scenarios"; HTMLText integrated as standard — [pixijs.com/blog/pixi-v8-launches](https://pixijs.com/blog/pixi-v8-launches)
- Pixi 8.20 focused on the WebGPU path (WGSL overrides, render bundles, depth-stencil formats…); `autoDetectRenderer` prefers webgpu then webgl — [gamedev.net: PixiJS v8.20.0](https://gamedev.net/news/5221-pixijs-v8200-released/)
- Vue binding `vue3-pixi` 1.0.3 (2026-10-09) has only ~1.3 k weekly downloads — [npm registry: vue3-pixi](https://registry.npmjs.org/vue3-pixi)
- `three` **0.186.1 = 2026-09-24**, MIT, ~14.1 M weekly; 736 KB min / 185 KB gzip — [npm registry: three](https://registry.npmjs.org/three), [bundlephobia](https://bundlephobia.com/package/three@0.186.1)
- WebGPURenderer described as production-ready since r171 (npm 2024-11-29) with automatic WebGL2 fallback; TSL compiles to WGSL or GLSL — [utsubo WebGPU migration guide 2026](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) (secondary); "as of r185 it's the path the project actively points developers at" — [buildmvpfast (secondary)](https://www.buildmvpfast.com/blog/threejs-webgl-to-webgpu-renderer-migration-2026)
- `@tresjs/core` **5.9.3 = 2026-10-06** (5.0.0 = 2025-09-20), MIT, ~21 k weekly, peers `vue >=3.4`, `three >=0.133` — [npm registry: @tresjs/core](https://registry.npmjs.org/@tresjs/core); v5 adds WebGPU via WebGPURenderer, new pointer-events module, breaking composable refactor — [besthub summary of TresJS v5](https://www.besthub.dev/articles/tresjs-v5-brings-webgpu-and-full-vue-integration-to-3d-web-development-469779e1b7c6) (secondary)
- `@babylonjs/core` **9.31.3 = 2026-10-21** (8.0 = 2025-03-27, 9.0 = 2026-03-26), Apache-2.0, ~234 k weekly — [npm registry: @babylonjs/core](https://registry.npmjs.org/@babylonjs/core)
- **Chromium WebGPU on Linux:** "✅ Intel Gen12+: 144 · ✅ NVIDIA (driver 535.183.01+) Wayland: 147 · 👷 Others: Behind a flag" (`--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE`) — [gpuweb Implementation Status wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- Chrome 146 shipped a WebGPU "compatibility mode" running on OpenGL ES 3.1 / D3D11 — [cinevva news (secondary)](https://app.cinevva.com/news/2026-03-10-chrome-146-webgpu-compatibility)
- Electron 45.0.0 (2026-10-21) ships **Chromium 156.0.8078.48**, Node 24.22.0, V8 15.6 — [releases.electronjs.org v45.0.0](https://releases.electronjs.org/release/v45.0.0)
- Steam Deck + Chrome WebGL: a Babylon.js developer reported markedly worse performance than an M1 Mac Mini (no metrics, 2024) and that browsers reported no Steam Deck gamepads — [Babylon forum](https://forum.babylonjs.com/t/steam-deck-linux-and-chrome-performance/47555)
- Particles: `tsparticles` / `@tsparticles/engine` **4.4.0 = 2026-08-31** (4.0.0 = 2026-05-15), MIT; `@tsparticles/slim` 110 KB min / 30 KB gzip — [npm registry: @tsparticles/engine](https://registry.npmjs.org/@tsparticles/engine), [bundlephobia](https://bundlephobia.com/package/@tsparticles/slim@4.4.0); v4 = modular plugin architecture (PluginManager, better tree-shaking), HDR / auto Display-P3 canvas, blend-mode plugin — [dev.to: Meet tsParticles v4](https://dev.to/tsparticles/meet-tsparticles-v4-richer-colors-modular-plugins-and-a-brand-new-paint-system-5bhe)
- `@pixi/particle-emitter` 5.0.10 (2026-01-08, ~9 k weekly); `three.quarks` 0.17.1 (2026-05-21, ~13 k weekly) — [npm: @pixi/particle-emitter](https://registry.npmjs.org/@pixi/particle-emitter), [npm: three.quarks](https://registry.npmjs.org/three.quarks)
- Shader helpers: `ogl` 1.0.11 (2025-01-27, Unlicense, ~450 k weekly); `curtainsjs` 8.1.6 last published 2024-05-02 (~1 k weekly) — [npm: ogl](https://registry.npmjs.org/ogl), [npm: curtainsjs](https://registry.npmjs.org/curtainsjs)
- "Liquid glass" on the web = `backdrop-filter: url(#svgFilter)` with `<feDisplacementMap>`, which works only in Chromium-based browsers; SVG-filter cost "can be heavy"; some libs add a Three.js/WebGL fallback — [ekino: Liquid Glass in CSS and SVG](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d), [dev.to: 6 ways to build liquid glass](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)

### Inferences
- **Full WebGL/WebGPU board: SKIP.** The board, card faces, cursor grammar, `data-*` e2e hooks (invariant 14) and `ConsoleBoardInput` cell-binder are all DOM; rendering them in canvas would forfeit DOM-based testing, i18n text layout, focus/ARIA and the existing motion system — a rewrite with no product-goal gain. WebGPU would not even be the active backend on the Deck (AMD → "behind a flag").
- **Overlay effects canvas: TRIAL.** One fixed, `pointer-events:none` canvas above the board for ceremony bursts / terraforming particles / ocean shimmer, lazy-loaded per scene: `@tsparticles/slim` (30 KB gzip, presets like confetti/fireworks) is the low-effort path; a small Pixi v8 stage (WebGL2 preference) if custom shaders/filters are needed. Must obey `motionMs`, reduced motion, and animation holds; measure on real GPUs (headless SwiftShader numbers are misleading — see the repo memory note "perf measure on GPU not SwiftShader").
- **TresJS / Three.js: TRIAL only for a 3D planet** (e.g. a rotating Mars on the menu/endgame) — TresJS works as components inside Options-API templates; three r186 + WebGPURenderer falls back to WebGL2 on the Deck. **Babylon: SKIP** (heavier, game-engine scope we don't need).
- **Shader glass (ogl/curtains/liquid-glass libs): SKIP** for now — 45 `backdrop-filter` uses already cost GPU fill-rate at 4K; Chromium-only SVG refraction is fine for Electron but is a perf risk on the Deck. If wanted, apply to ONE hero surface and profile.

### Gaps
- No published fps/frametime data for Pixi/three/Rive in Chromium on the Steam Deck APU or at 3840×2160; must be measured in-house.
- Whether Electron 45 enables WebGPU on AMD/Linux when the flags above are appended was not verified.

## 4. Vue ecosystem: Vue 3.6 Vapor + alien-signals, Pinia, VueUse, vue-router

### Takeaway
**Vue 3.6 is still RC** (latest `3.6.0-rc.12`, 2026-10-16; stable = 3.5.44). Its alien-signals reactivity rewrite benefits every component including Options API, but **Vapor mode explicitly does not support the Options API** (our whole client, incl. a >20k-line ConsoleShell.vue), so Vapor is out of reach without rewrites. Adopt 3.6 when stable for the reactivity gains; skip Vapor, Pinia (4.x, ESM-only) and vue-router; upgrade VueUse 14 → 15 deliberately (breaking changes).

### Cited Findings
- npm dist-tags: `latest` = **3.5.44 (2026-10-13)**, `rc` = **3.6.0-rc.12 (2026-10-16)**; 3.6.0-alpha.1 = 2025-07-12, beta.1 = 2025-12-23, rc.1 = 2026-07-18 — [npm registry: vue](https://registry.npmjs.org/vue); GitHub releases agree that v3.6.0 is not stable — [github.com/vuejs/core/releases](https://github.com/vuejs/core/releases). **Conflict:** a Juejin article headline claims "Vue 3.6 发布" — [juejin](https://juejin.cn/post/7662256328783200319); npm shows no stable 3.6.
- 3.6.0-rc.1 notes: Vapor Mode feature-complete, "same level of performance as Solid and Svelte 5 in third-party benchmarks"; Vapor supports template-only SFCs and `<script setup>`, VDOM interop via `vaporInteropPlugin`, pure apps via `createVaporApp()`; **Not supported: Options API**, `app.config.globalProperties`, `getCurrentInstance()` (returns null), `@vue:xxx` per-element lifecycle events, `v-memo`, template refs exposing `$el/$props/$attrs/$slots/$refs`; render functions/JSX stay VDOM; event delegation at document level so `stopPropagation()` blocks delegated handlers; custom directives use a different interface; `@vue/reactivity` refactored on **alien-signals** — "significantly improves the reactivity system's performance and memory usage"; recommended: Vapor for performance-sensitive pages or small new apps — [newreleases: vue v3.6.0-rc.1](https://newreleases.io/project/github/vuejs/core/release/v3.6.0-rc.1)
- `pinia` latest **4.1.0 = 2026-10-14**; 3.0.0 = 2025-02-11; 4.0.0 = 2026-07-14; peers `vue ^3.5.11`, `@vue/devtools-api ^8.2.1` — [npm registry: pinia](https://registry.npmjs.org/pinia); "Pinia 4 contains only technically breaking changes: ESM only", devtools-api v8 — [github.com/vuejs/pinia/releases](https://github.com/vuejs/pinia/releases); 18 KB min / 6.7 KB gzip — [bundlephobia](https://bundlephobia.com/package/pinia@4.1.0)
- `@vueuse/core` latest **15.0.0 = 2026-09-16** (14.0.0 = 2025-10-22), peer `vue ^3.5.0` — [npm registry: @vueuse/core](https://registry.npmjs.org/@vueuse/core). v15 breaking: dropped `templateRef`, removed Node 20, "Remove deprecated timer options in favor of `scheduler`", `useThrottleFn` default `trailing` false → true, `useIDBKeyval` cross-tab sync; new `useWebMCP`, `useLiveAnnouncer`, `useTemporalNow`. v14 required Vue 3.5, moved to tsdown, `computedAsync` default `flush: 'sync'` — [github.com/vueuse/vueuse/releases](https://github.com/vueuse/vueuse/releases)
- `vue-router` latest 5.4.0 (2026-10-07; 5.0.0 = 2026-01-29) with peers incl. `vite`, `pinia`, `@pinia/colada` — [npm registry: vue-router](https://registry.npmjs.org/vue-router). The repo has no vue-router dependency (package.json).

### Inferences
- **Vue 3.6 (non-Vapor): ADOPT when it goes stable** — the reactivity package is shared by all components, so Options-API code should get the alien-signals memory/perf improvements for free; validate with the client suite + e2e timing specs (reactivity scheduling changes can shift frame-exact motion witnesses). **Vapor: SKIP** (Options API unsupported; document-level event delegation + `stopPropagation` semantics would also interact with the gamepad/keyboard routing).
- **Pinia: SKIP** — the fork's module reactive state (`journalState`, `notificationState`, `presentationFlow`…) is a deliberate shared-layer pattern; Pinia would add devtools/time-travel but a migration has no user-visible payoff.
- **VueUse 15: TRIAL upgrade** — check `useIntervalFn(…, {immediate:false})` in `GamepadLayer.vue` against the new `scheduler` API and any `useThrottleFn` defaults; `useLiveAnnouncer` could help announce prompts for accessibility. **VueUse `useGamepad`: SKIP** — it wraps `navigator.getGamepads()`, which is blind on Linux/Deck in our setup (native /dev/input bridge exists for that reason).
- **vue-router: SKIP** (single-shell app; not used).

### Gaps
- No published alien-signals benchmark numbers in the release notes; actual gain for a large Options-API app is unmeasured.
- Stable 3.6 date unknown.

## 5. Steam / platform integration for Electron: steamworks.js, steamworks-ffi-node, greenworks; Steam Input, overlay, achievements; AppID requirement

### Takeaway
Every Steamworks feature (achievements, rich presence, cloud, Steam Input action sets + official glyph API, Remote Play Together) requires a **real AppID owned by the user** — a non-Steam shortcut cannot legitimately use them (AppID 480 "Spacewar" is a dev-test hack). Of the bindings, **steamworks-ffi-node** (0.11.3, 2026-09-24, Koffi FFI, SDK 1.64, Steam Input incl. haptics, an OSR-based overlay path) is the only actively released one; **steamworks.js** has had no npm release since 2024-08 and **greenworks** is dead. Verdict: **SKIP Steamworks while shipping as a non-Steam shortcut**; keep the self-written shortcuts.vdf + persona reading; optionally add the overlay flags for Windows.

### Cited Findings
- `steamworks-ffi-node` **0.11.3 = 2026-09-24** (0.11.0 = 2026-08-15), MIT, ~1.4 k weekly — [npm registry](https://registry.npmjs.org/steamworks-ffi-node). README: TypeScript wrapper over Steamworks SDK (README says v1.64) using **Koffi FFI — no C++ compilation**; Windows/macOS/Linux x64+ARM64; "Only initialize in main process"; SDK redistributables, native addons and koffi binaries must stay outside `.asar` (`asarUnpack`); **no `steam_appid.txt` required — it sets `SteamAppId` env on `init()`**; Steam Input 35+ functions (Xbox/PlayStation/Switch/Steam Controller/Steam Deck detection, action sets/layers, analog/digital actions, motion data, "vibration, LED control for DualShock/DualSense") but "Tested with virtual gamepad only"; also achievements, stats, leaderboards, rich presence, overlay, cloud, workshop, screenshots, networking — [steamworks-ffi-node README](https://raw.githubusercontent.com/ArtyProf/steamworks-ffi-node/main/README.md)
- Its Electron overlay = **offscreen rendering**: frames captured via `beginFrameSubscription()` are drawn into a native OpenGL (Win/Linux) / Metal (macOS) window where Steam injects the overlay; tested on Win, macOS and "Steam Deck Desktop Mode"; "Linux Wayland support not available (X11 only)"; cost "~1-3% additional CPU" and "~50-100 MB" — [STEAM_OVERLAY_INTEGRATION.md](https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md)
- `steamworks.js` npm latest **0.4.0 = 2024-08-06**, MIT, ~12 k weekly — [npm registry](https://registry.npmjs.org/steamworks.js); repo last push 2026-04-08, 52 open issues — [gittrend](https://gittrend.io/repo/ceifa/steamworks.js); setup asks for `contextIsolation: false` + `nodeIntegration: true` to use it from the renderer; overlay via `electronEnableSteamOverlay()`; appId via argument or `steam_appid.txt`; no Steam Input mentioned — [github.com/ceifa/steamworks.js](https://github.com/ceifa/steamworks.js)
- `greenworks` npm 0.1.0 (2016), ~9 weekly downloads — [npm registry](https://registry.npmjs.org/greenworks); steamworks.js positions itself as the replacement because Greenworks "is no longer being maintained" — [steamworks.js README](https://github.com/ceifa/steamworks.js)
- `SteamAPI_Init` fails unless the Steam client runs, the App ID can be determined (`steam_appid.txt` when not launched by Steam), same OS user, and **"you own a license for the App ID… your game must show up in your Steam library"**; AppID 480 = Spacewar test app — [Steamworks: steam_api](https://partner.steamgames.com/doc/api/steam_api)
- Steam Input: action manifests (16 analog / 128 digital actions), API returns art paths for the controller's actual glyphs; games without integration get "gamepad emulation" (appears as Xbox input) but lose action-based rebinding; config files are named by **the game's AppID** — [Steamworks: Steam Input getting started](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs)
- Steam Direct fee: **$100 per app**, non-refundable, recouped after $1,000 adjusted gross revenue — [Steamworks: app fee](https://partner.steamgames.com/doc/gettingstarted/appfee)
- Electron overlay workaround: `--in-process-gpu` (lets Steam hook the render process) + `--disable-direct-composition` (avoids white/glitched overlay on Windows); overlay may not refresh if the app doesn't repaint continuously; game must be launched through Steam — [electron-steam-notes](https://github.com/JamesMoulang/electron-steam-notes); Construct's analysis: the overlay "only supports rendering over graphics rendered from the main app process" — [Construct blog: Steam Overlay over WebView2](https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861)
- Remote Play Together is not officially supported for non-Steam shortcuts; community workarounds exist (Remote Play Whatever, NonSteamLaunchers) — [steamdeckhq: NonSteamLaunchers adds Remote Play](https://steamdeckhq.com/news/nonsteamlaunchers-adds-remote-play/), [XDA](https://www.xda-developers.com/steam-remote-play-together-now-supports-non-steam-users/)
- Known gamescope issue: Electron apps added as non-Steam games could hang in Game Mode / not gain focus — [steam-for-linux #8513](https://github.com/ValveSoftware/steam-for-linux/issues/8513)
- Electron 45 changed ASAR handling ("direct archive reads instead of temporary extraction") — [releases.electronjs.org v45.0.0](https://releases.electronjs.org/release/v45.0.0)

### Inferences
- **Steamworks bindings: SKIP while the product is a non-Steam shortcut.** Without an owned AppID, `SteamAPI_Init` fails (or works only under AppID 480, which would show the user as "playing Spacewar" — unacceptable for a product). Shipping a real Steam app means the $100 Steam Direct route *and* a store presence; for a fork of a commercial board-game IP whose digital edition belongs to another publisher this is very likely not available — **flag for the owner as a legal/IP question, not a technical one**.
- If an AppID ever exists: **steamworks-ffi-node** is the only binding to TRIAL (main-process only — bridge via IPC like the existing native pad bridge; `asarUnpack` its binaries; its Steam Input haptics/LED support is "tested with virtual gamepad only"). Its OSR overlay path would re-route all rendering through `beginFrameSubscription` — risky at 4K (frame copies) and X11-only on Linux.
- Without Steamworks the current approach is right: Steam Input's per-shortcut gamepad emulation already delivers a virtual Xbox pad; our `glyphSets.ts` + persona/shortcut code cover glyphs and identity. Low-cost option: TRIAL `--in-process-gpu` + `--disable-direct-composition` on Windows only, to make the Steam overlay (Shift+Tab, screenshots, chat) inject into the non-Steam shortcut — measure GPU stability/perf first (GPU-process crashes would then take down the browser process).

### Gaps
- No primary source found on whether the Steam overlay works for an Electron non-Steam shortcut under gamescope Game Mode (gamescope composites its own overlay layer; untested here).
- Whether Steam's virtual (uinput) Xbox pad forwards rumble to the Deck's haptics for non-Steam shortcuts — not found.

## 6. Sound for UI sound design

### Takeaway
We currently have only upstream oscillator beeps. Howler.js is stable but frozen (2.2.4, 2023-09), Tone.js is synthesis-oriented; for a calm Ark-Nova-style UI soundscape a thin in-house Web Audio sprite player (or Howler for its sprite/fade API) is enough. **TRIAL Howler (9.7 KB gzip) or raw Web Audio; SKIP Tone.js unless procedural/musical audio is wanted.**

### Cited Findings
- Repo: `src/client/utils/SoundManager.ts` synthesises notes with `AudioContext` oscillators (`playActivePlayerSound`, `newLog`) — local file.
- `howler` latest **2.2.4 = 2023-09-19** (no release since), MIT, ~601 k weekly, 36.5 KB min / 9.7 KB gzip — [npm registry: howler](https://registry.npmjs.org/howler), [bundlephobia](https://bundlephobia.com/package/howler@2.2.4); features: Web Audio default with HTML5 Audio fallback, sprites, fades, multiple simultaneous sounds, 3D positioning — [alternativeto summary](https://alternativeto.net/software/howler-js)
- `tone` `latest` = 15.1.22 (2025-04-27) but `next` = 15.5.58 with registry activity on 2026-10-21; MIT; ~223 k weekly — [npm registry: tone](https://registry.npmjs.org/tone)

### Inferences
- UI sound design (focus tick, confirm, card deal, resource touchdown, ceremony swell) is best authored as a small sample set and played through ONE audio module that reads the same clock/holds as motion (touchdown sound fires on the flight's own completion signal, never a timeout), with a master volume + mute in settings. Howler gives sprites/fades out of the box; raw Web Audio avoids a frozen dependency. Either is low risk.
- Electron allows disabling autoplay gating via a Chromium switch (`autoplay-policy`) — not verified in this pass; the browser build needs first-gesture unlock anyway.

### Gaps
- No 2025–2026 "game-audio for web" library with active development and clear advantages over Howler was found.

## 7. Haptics: controller rumble in Chromium and via Steam Input

### Takeaway
The web platform already has what we need on Windows: `gamepad.vibrationActuator.playEffect('dual-rumble' | 'trigger-rumble', …)` (trigger rumble for Xbox impulse triggers via Windows.Gaming.Input). On Linux/Deck our input bypasses Chromium's Gamepad API, so rumble must be added to the **native bridge via evdev force-feedback** (`EVIOCSFF` + `EV_FF` write on the matching `/dev/input/eventX`, not `js*`). **ADOPT a tiny haptics module (no library)**: subtle pulses on confirm/commit/touchdown, gated by a setting and reduced-motion.

### Cited Findings
- Effects: `dual-rumble` (params `duration`, `startDelay`, `strongMagnitude`, `weakMagnitude` 0–1) and `trigger-rumble` (`duration`, `leftTrigger`, `rightTrigger`); feature-detect via `vibrationActuator.effects.includes('trigger-rumble')` — [web.dev: Gamepad API](https://web.dev/articles/gamepad)
- Trigger-rumble extension for Xbox impulse triggers, Xbox One controllers on Windows 10+, via the Windows Gaming Input data fetcher; reported to ship in Chrome 126 — [blink-dev Intent to Prototype](https://groups.google.com/a/chromium.org/g/blink-dev/c/ncvmDRl0AzM/m/z4v34arEAQAJ), [Windows Report](https://windowsreport.com/google-chrome-introduces-trigger-rumble-for-gamepads-the-browser-will-also-support-xbox-one-controllers-on-windows-10-and-later/) (version claim from secondary press)
- Chromium Linux backend: gamepad input via joydev, haptics via evdev — detects `FF_RUMBLE` with `EVIOCGBIT(EV_FF)`, uploads `ff_effect` via `EVIOCSFF`, plays with an `EV_FF` write, removes with `EVIOCRMFF`; some devices use hidraw instead — [Chromium `device/gamepad/gamepad_device_linux.cc` (mirror)](https://gitcode.com/openharmony-tpc/chromium_src/blob/master/device/gamepad/gamepad_device_linux.cc)
- Kernel FF API: upload with `EVIOCSFF` (id −1 → driver assigns), play by writing `input_event{type: EV_FF, code: effect.id, value: count}`, `EVIOCRMFF` to free; needs write access to `/dev/input/eventXX`; FF_PERIODIC often supported too — [kernel.org: Force feedback for Linux](https://docs.kernel.org/input/ff.html)
- Steam Input API exposes vibration and DualShock/DualSense LED control (requires Steamworks/AppID) — [steamworks-ffi-node README](https://raw.githubusercontent.com/ArtyProf/steamworks-ffi-node/main/README.md)
- Repo: no `vibrationActuator`/`playEffect` usage; `electron/nativeGamepadLinux.ts` has no FF code (read-only grep).

### Inferences
- Windows: call `vibrationActuator.playEffect` from the console input layer (one `haptics.ts` with named semantic pulses like `confirm`, `commit`, `reward-touchdown`, `error`) — mirrors the "semantic names only" glyph rule (invariant 12).
- Linux/Deck: extend `nativeGamepadLinux.ts` to open the evdev node that pairs with each `js*` device (O_RDWR), upload one FF_RUMBLE effect per semantic pulse and play via IPC request from the renderer. Doing ioctls from Node needs a native helper (koffi or a tiny N-API addon) — moderate integration cost; the Deck's built-in haptics under Steam Input's virtual pad are the unknown (see gap).
- Keep pulses short and weak (calm Ark-Nova feel), user-toggleable, and fully off under reduced-motion/"haptics off".

### Gaps
- Unverified whether the Steam Input virtual Xbox pad on SteamOS forwards `FF_RUMBLE` to the Deck's trackpad/rumble motors for a non-Steam shortcut; must be tested on-device.
- Exact Chrome version for trigger-rumble from a primary chromestatus page not fetched.

## 8. Typography and icons

### Takeaway
Our sci-fi display font **Orbitron is Latin-only** (Google Fonts serves only the `latin` subset), so every Russian string in an Orbitron style silently falls back. For a RU-first console UI, **TRIAL a variable sci-fi face with Cyrillic — Tektur (wdth 75–100 + wght 400–900), Exo 2 (wght 100–900) or Unbounded (200–900)** — and replace static Ubuntu with **Ubuntu Sans (variable wdth+wght, Cyrillic)**. Icons: unplugin-icons (Iconify, webpack-compatible, build-time on-demand) if a new icon pipeline is needed.

### Cited Findings
- Google Fonts CSS2 API responses (queried 2026-10-22): Orbitron `wght 400..900` variable, subsets **latin only**; Exo 2 `100..900` + cyrillic/cyrillic-ext; Unbounded `200..900` + cyrillic; Jura `300..700` + cyrillic; **Tektur `wdth 75..100, wght 400..900` + cyrillic**; Sofia Sans `1..1000` + cyrillic; Onest `100..900` + cyrillic; Golos Text `400..900` + cyrillic; **Ubuntu Sans `wdth 75..100, wght 100..800` + cyrillic**; Russo One static + cyrillic; Play static + cyrillic; Oxanium, Saira, Chakra Petch, Rajdhani, Michroma, Audiowide — **no Cyrillic** — [Google Fonts CSS2 API, e.g. Orbitron](https://fonts.googleapis.com/css2?family=Orbitron:wght@400..900), [Tektur](https://fonts.googleapis.com/css2?family=Tektur:wdth,wght@75..100,400..900), [Exo 2 specimen](https://fonts.google.com/specimen/Exo+2/about)
- Repo font usage: `Prototype` 247, `Ubuntu` 26, `Russo One` 20, `Orbitron` 13 (LESS grep).
- GSAP SplitText 3.13 re-splits automatically when fonts load (`autoSplit`/`onSplit`) — [gsap.com/blog/3-13](https://gsap.com/blog/3-13/)
- unplugin-icons: icons as components on demand, powered by Iconify, works with Webpack and Vue 3, only referenced icons bundled — [Iconify docs: Unplugin Icons](https://iconify.design/docs/usage/svg/unplugin/)

### Inferences
- Variable fonts let the TV profile tune weight/width per tier (e.g. slightly heavier weight at 4K viewing distance, condensed width for long RU labels instead of truncation) from one file — fits the "length-tier ladder" and "survive desaturation by weight" grammar. Self-host WOFF2 (offline Electron); subset to Latin+Cyrillic.
- Swapping Orbitron requires a visual pass; at minimum audit where Orbitron renders RU text.

### Gaps
- `Prototype` (upstream TM font) Cyrillic coverage not checked. No measured 4K legibility comparison of candidates.

## 9. Other notable 2025–2026 platform features for premium game-like UIs

### Takeaway
Electron 45 = Chromium 156 makes several CSS features "free" premium tools with zero dependencies: **`corner-shape` (bevel/notch/squircle, Chrome 139+)** for sci-fi panel geometry whose borders follow the shape, **element-scoped View Transitions (Chrome 147)** for in-workspace crossfades, and **CSS anchor positioning (Baseline 2026)** replacing Floating-UI-style tooltip math. Liquid-glass SVG refraction exists but is costly.

### Cited Findings
- `corner-shape` keywords `round`, `squircle`, `square`, `bevel`, `scoop`, `notch` (+ `superellipse(K)`), pairs with `border-radius`, borders follow the shape, animatable between shapes; Chrome/Edge 139+ unflagged, not in Safari/Firefox (as of June 2026) — [squircle.js.org: Squircles in CSS (2026)](https://squircle.js.org/blog/squircles-in-css), [Smashing Magazine, Mar 2026](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/)
- Element-scoped view transitions: `Element.startViewTransition()` on a DOM subtree, stable in **Chrome 147**; allows concurrent and nested transitions, fixes `position: fixed` layering, rest of page stays interactive — [developer.chrome.com: element-scoped view transitions](https://developer.chrome.com/blog/element-scoped-view-transitions)
- CSS anchor positioning reached Baseline Newly Available in **January 2026** (Chrome 125, Safari 26, Firefox 147); `@position-try`, `position-try-fallbacks` too — [web.dev: New to the web platform in January 2026](https://web.dev/blog/web-platform-01-2026); caveat: corner-anchored menus overflowing both axes need explicit fallbacks — [buildmvpfast](https://www.buildmvpfast.com/blog/css-anchor-positioning-baseline-delete-floating-ui-2026) (secondary)
- `@floating-ui/dom` 1.8.0 (2026-07-11), `@floating-ui/vue` 2.0.1, MIT — [npm registry: @floating-ui/dom](https://registry.npmjs.org/@floating-ui/dom)
- Liquid glass = Chromium-only SVG `backdrop-filter: url()` refraction — [ekino](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)

### Inferences
- **`corner-shape: bevel/notch` — ADOPT (progressive enhancement)** for glass panels/chips: it can replace `clip-path: polygon()` cuts, which clip away borders, outlines and shadows; the browser build degrades to plain rounded corners in Firefox/Safari.
- **Element-scoped View Transitions — TRIAL** for the RELEASE→UNFOLD stage swaps inside a workspace (snapshot crossfade of one zone while the frame stays live), but they must still register animation holds and respect `--motion-scale`; GSAP remains the tool for physical flights.
- **Anchor positioning — ADOPT for new tooltips/popovers** (`.premium-tooltip()`), no Floating UI needed in an Electron-only primary target; the repo has no Floating UI dependency to delete.
- `@starting-style`, `interpolate-size`, scroll-driven animations etc. were not researched in this pass.

### Gaps
- No perf data for `corner-shape` vs `clip-path` at 4K; no primary chromestatus fetch for the 139 ship.

## 10. Consolidated shortlist (objective deliverable — verdict per library)

### Takeaway
Highest value / lowest risk: **use the GSAP plugins we already pay for (registerEase/CustomEase, MotionPath, Flip, SplitText/ScrambleText), add native haptics, fix Cyrillic-less fonts, use Chromium-156 CSS (`corner-shape`, scoped view transitions, anchor positioning)**. Trial islands: Rive (MarsBot), dotLottie (icons), one particle canvas, Vue 3.6 when stable. Skip: motion-v (remove), Anime.js, Theatre.js, full WebGL board, Pinia, Vapor, vue-router, Steamworks bindings (no AppID).

### Cited Findings
| Library / tech | Version (npm date) | License / cost | Size (gzip, main entry) | Verdict |
|---|---|---|---|---|
| GSAP + plugins | 3.15.0 (2026-04-13) | Webflow "No Charge" std license, free incl. commercial since 3.13 | core 27 KB | **Adopt plugins** (MotionPath, Flip, SplitText, ScrambleText; registerEase/CustomEase) |
| motion-v | 2.8.0 (2026-10-16) | MIT (Motion+ extras $299) | 70 KB | **Skip / remove** (unused) |
| motion (vanilla) | 14.5.0 (2026-10-21) | MIT | 57 KB | Skip |
| animejs | 4.5.0 (2026-06-22), 5.0 beta | MIT | 40 KB | Skip |
| @theatre/core | 0.7.2 (2024-05-19) | Apache-2.0 / studio AGPL | — | Skip |
| Rive (@rive-app/webgl2) | 2.45.0 (2026-10-17) | MIT runtime; editor exports paid ($9/seat/mo Cadet) | ~648 KB brotli WASM | **Trial** (MarsBot, emblems) |
| dotLottie-web | 0.81.0 (2026-10-06) | MIT | 33 KB + WASM | **Trial** (icons, stingers) |
| lottie-web | 5.13.0 (2025-05-21) | MIT | 77 KB | Skip |
| Spline runtime | 2.0.103 (2026-10-21) | no OSS license declared | — | Skip |
| pixi.js | 8.22.0 (2026-10-01) | MIT | 265 KB (tree-shakable) | Trial only as overlay FX canvas |
| three / TresJS | r186.1 (2026-09-24) / 5.9.3 | MIT | 185 KB | Trial only for a 3D planet |
| Babylon.js | 9.31.3 (2026-10-21) | Apache-2.0 | large | Skip |
| tsParticles slim | 4.4.0 (2026-08-31) | MIT | 30 KB | **Trial** (ceremony bursts) |
| ogl / curtainsjs / liquid-glass libs | 1.0.11 / 8.1.6 (2024) | Unlicense / MIT | small | Skip |
| Vue 3.6 (alien-signals) | rc.12 (2026-10-16) | MIT | — | **Adopt when stable**; Vapor skip |
| Pinia | 4.1.0 (2026-10-14) | MIT | 6.7 KB | Skip |
| @vueuse/core | 15.0.0 (2026-09-16) | MIT | — | Trial upgrade (breaking) |
| steamworks-ffi-node | 0.11.3 (2026-09-24) | MIT; needs AppID ($100 Steam Direct) | native | Skip unless an AppID exists |
| steamworks.js / greenworks | 0.4.0 (2024-08) / 0.1.0 (2016) | MIT / — | native | Skip |
| howler | 2.2.4 (2023-09-19) | MIT | 9.7 KB | Trial (or raw Web Audio) |
| tone | 15.1.22 (2025-04) | MIT | — | Skip |
| Gamepad haptics + evdev FF | Chromium 156 built-in / kernel API | free | 0 | **Adopt** |
| Variable Cyrillic fonts (Tektur / Exo 2 / Unbounded / Ubuntu Sans) | Google Fonts | OFL | per font | **Trial** |
| CSS corner-shape / scoped VT / anchor positioning | Chrome 139 / 147 / 125 | free | 0 | **Adopt / Trial / Adopt** |

Sources for every row: the per-question sections above ([npm registry](https://registry.npmjs.org/), [bundlephobia](https://bundlephobia.com/), vendor docs cited in §1–§9).

### Inferences
- Suggested order (cheapest wins first): (1) `registerEase` the MOTION_EASE tokens + guard test; (2) haptics module (Windows via Gamepad API, Linux via evdev in the native bridge); (3) Cyrillic variable display font; (4) `corner-shape` on glass panels; (5) MotionPath for token arcs on the next flight touched; (6) Rive MarsBot prototype; (7) Vue 3.6 when stable.
- Every adoption must route through the one motion system (motionMs / `--motion-scale` / reduced motion / animation holds) and keep e2e `data-*` hooks DOM-based.

### Gaps
- No in-house measurements yet: every "trial" verdict needs a GPU (not SwiftShader) measurement on the 4K TV profile and on the Steam Deck before adoption.
