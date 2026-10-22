# What is NEW with Electron 45.0.0: Chromium 153–156, V8 15.3–15.6, Node 24.21–24.22 and Electron's own features, judged for the TM console app

Scope: the delta between Electron 44 (Chromium 152 / V8 15.2 / Node 24.20) and Electron 45.0.0 (Chromium 156.0.8078.48 / V8 15.6 / Node 24.22.0). Anything that shipped in Chrome ≤152 belongs to the sibling notes (`chromium_toolbox_up_to_152.md`) and shows up here only as "already available before 45".

Method (2026-10-22): (1) the full chromestatus feature lists for milestones 153–156, pulled from the chromestatus JSON API (`/api/v0/features?milestone=N`, 72 entries) plus per-feature stage data; (2) **ground truth from the Chromium release branches**: Blink `runtime_enabled_features.json5` on branches 7977 (=152), 8059 (=155) and 8078 (=156), GPU/viz feature defaults (`gpu_finch_features.cc`, `viz/common/features.cc`) diffed 152→156, and V8 `feature-flags.h` on branch 15.6 against 15.2's `flag-definitions.h`; (3) MDN browser-compat-data 8.1.6 (2026-10-15) filtered to Chrome `version_added` 153–157; (4) the Electron v45.0.0 release notes, the v45.0.0 docs tree and individual PR descriptions; (5) Node 24.21.0 and 24.22.0 release posts. Where sources disagree, the branch source is treated as authoritative and the disagreement is written down.

**Important context: Chrome moved to a two-week stable cadence.** Stable dates: 152 = 2026-08-25, 153 = 2026-09-08, 154 = 2026-09-22, 155 = 2026-10-06, 156 = 2026-10-20, 157 = 2026-11-03 ([chromiumdash schedule 153](https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=153), [156](https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=156)). Branch↔V8 mapping: 153 = 8010/V8 15.3, 154 = 8037/15.4, 155 = 8059/15.5, 156 = 8078/15.6 ([chromiumdash milestones](https://chromiumdash.appspot.com/fetch_milestones?only_branched=true)). That is why a single Electron major now spans four Chrome milestones. **Each milestone is small**: 9 (153), 13 (154), 11 (155) and 10 (156) "enabled by default" entries, most of them irrelevant to us.

---

## Q1. Which web-platform features reached STABLE in Chromium 153, 154, 155 and 156, and do they matter to a gamepad-driven 4K TV Vue app?

### Takeaway
Across the four milestones, roughly 10 shipped features matter to this app. The useful ones are **CSS `random()` (156)**, **single-axis scroll containers `overflow: <scroll> clip` (156)**, **JPEG XL decoding (155)**, **`margin-trim` (155)**, the **`transitionrun` / media-query `change` timing fix (153)** (a behaviour change to check, not a feature), the **iterator helpers `join` / `zip` / `includes` (153–154)** and **`scroll-marker-group` tabs/links modes (154)**. Almost everything else is ads/privacy, networking, IWA/ChromeOS or WebTransport and can be ignored. Two items that were *announced* turned out to be off at the 156 branch head: `text-decoration-inset` (announced for 154, now slated for 157) and canvas `srgb-linear` / `display-p3-linear` (chromestatus lists it under 155, but the Blink runtime flag is still `experimental` in 155 and 156).

### Cited Findings

**Chrome 153 (stable 2026-09-08)**
- **`scroll-axis-lock`** (CSS, values `auto | none`) tells the browser not to lock a scroll gesture to one axis, which allows diagonal panning. Enabled by default in 153 — [chromestatus 5908461532610560](https://chromestatus.com/feature/5908461532610560). Blink flag `ScrollAxisLock`: `experimental` on the 152 branch, `stable` on 155 and 156 — [runtime_enabled_features.json5 @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/platform/runtime_enabled_features.json5), [@7977](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/7977/third_party/blink/renderer/platform/runtime_enabled_features.json5). BCD lists it as 153 [exp] — [BCD 8.1.6](https://unpkg.com/@mdn/browser-compat-data/data.json) `css.properties.scroll-axis-lock`. Firefox and Safari: no signal. **Relevance: low** — it only matters for touch or trackpad panning (Steam Deck touchscreen) of a scroll container, and we design for no-scroll.
- **Interoperable dispatch timing for `transitionrun` and the media-query `change` event.** `transitionrun` now fires at HTML event-loop step 3.11, even for transitions created earlier in the same iteration. The MQ `change` event fires at step 3.10, before pending animation events (previously the two were intermixed) — [chromestatus 6312504658624512](https://chromestatus.com/feature/6312504658624512). **Relevance: low–medium, as a behaviour change.** Anything that listens to `transitionrun`, or to `matchMedia('(prefers-reduced-motion: reduce)').onchange`, and relies on the old ordering could shift by one frame.
- **`Iterator.prototype.join()`** and **joint iteration `Iterator.zip()` / `Iterator.zipKeyed()`**. `zip` has the modes `"shortest"` (default), `"longest"` (with padding) and `"strict"` (throws on a length mismatch) — [chromestatus 5095183554314240](https://chromestatus.com/feature/5095183554314240), [chromestatus 6249068542164992](https://chromestatus.com/feature/6249068542164992), [New in Chrome 153](https://developer.chrome.com/blog/new-in-chrome-153). Firefox shipped; Safari in development (chromestatus signals). BCD: `javascript.builtins.Iterator.join/zip/zipKeyed` = 153.
- **WebAudio configurable render quantum**: `new AudioContext({ renderSizeHint: <int> | "default" | "hardware" })`, read back via `BaseAudioContext.renderQuantumSize` — [chromestatus 5078190552907776](https://chromestatus.com/feature/5078190552907776); BCD `api.BaseAudioContext.renderQuantumSize` 153 [exp]. **Relevance: low.** It is a latency/CPU trade-off and only matters if UI sound effects go through WebAudio.
- **WebGPU WGSL `buffer_view`** (`bufferView<T>()`, `bufferArrayView<T>()`, `bufferLength()`), feature-detected through `navigator.gpu.wgslLanguageFeatures` — [chromestatus 5094091886034944](https://chromestatus.com/feature/5094091886034944), [What's New in WebGPU 153–154](https://developer.chrome.com/blog/new-in-webgpu-153-154). **Relevance: none today** (we have no WebGPU code).
- **XML parsing in Rust** for `DOMParser`, `XMLHttpRequest.responseXML` and **SVG image parsing**; XSLT is excluded — [chromestatus 5309598397497344](https://chromestatus.com/feature/5309598397497344). **Relevance: low.** SVG loaded as an image (`<img src=*.svg>`, CSS `url(*.svg)`) goes through the new parser. Our inline DOM/SVG board is parsed by the HTML parser and is unaffected.
- Also enabled in 153: the `<camera>` / `<microphone>` capability elements, IAMF audio decoding via MSE, and the `autocorrect` global attribute (BCD only) — [chromestatus 5153829504024576](https://chromestatus.com/feature/5153829504024576), [chromestatus 5113656292540416](https://chromestatus.com/feature/5113656292540416), BCD `html.global_attributes.autocorrect`. **None** are relevant.
- Deprecations announced in 153: Protected Audience, Related Website Sets, Shared Storage, `document.requestStorageAccessFor`, Attribution Reporting. Non-standard `_current` navigation targets were removed — [Chrome 153 release notes](https://developer.chrome.com/release-notes/153). **No relevance.**

**Chrome 154 (stable 2026-09-22)**
- **`scroll-marker-group` modes `links` (default) and `tabs`.** In `tabs` mode the group gets the `tablist` role and markers get `tab`. Only the active marker is a tab stop and the arrow keys rove between markers. Tab moves focus into the active panel, and inactive panels are pruned from the accessibility tree (the same effect as `inert`/`aria-hidden`) — [chromestatus 5109685301673984](https://chromestatus.com/feature/5109685301673984), [New in Chrome 154](https://developer.chrome.com/blog/new-in-chrome-154). **Relevance: low–medium.** It only pays off if a paged surface (album pages, rulebook) is rebuilt as a CSS scroll-snap carousel. Our LB/RB paging is custom and gamepad-driven.
- **Light-dismiss improvements**: popovers and dialogs now light-dismiss on `click` instead of pointerdown/pointerup, so a scroll gesture or a right-click no longer closes them — [chromestatus 6209615938322432](https://chromestatus.com/feature/6209615938322432). **Relevance: low** (it only matters for `popover="auto"` or `<dialog closedby>` surfaces).
- **`Iterator.prototype.includes`** — [chromestatus 5205192866922496](https://chromestatus.com/feature/5205192866922496); BCD 154.
- **`FontFace.width` and the `@font-face font-width` descriptor**, aliases for `stretch` and `font-stretch` — [chromestatus 5145402365050880](https://chromestatus.com/feature/5145402365050880). Low.
- **The CSS Typed OM `CSSStyleValue` hierarchy is now exposed in Workers** — [chromestatus 5114591051907072](https://chromestatus.com/feature/5114591051907072). Low.
- **Responsively-sized `<iframe>`** (`frame-sizing: content-height` in the parent plus `<meta name="responsive-embedded-sizing">` in the child) — [chromestatus 5108373464547328](https://chromestatus.com/feature/5108373464547328); BCD also adds `api.Window.requestResize` at 154 [exp]. **None** for us (no iframes).
- **A `WebSocket` constructor options bag** (`new WebSocket(url, { protocols })`) and the `targetAddressSpace` option, which marks a public-hostname socket as local or loopback for Local Network Access — [chromestatus 5080055102439424](https://chromestatus.com/feature/5080055102439424), [chromestatus 4779920606756864](https://chromestatus.com/feature/4779920606756864). **Low**, but note it for the web build's LAN play.
- Fetch now forwards the abort reason to the `Response` body and stream. Background Fetch gets CORS and LNA rules. Ask-before-HTTP is on by default. The Window Shape API is IWA/ChromeOS-only — [Chrome 154 release notes](https://developer.chrome.com/release-notes/154). **None.**
- ⚠ **`text-decoration-inset` was advertised as shipping in 154** — [Chrome 154 release notes](https://developer.chrome.com/release-notes/154), [New in Chrome 154](https://developer.chrome.com/blog/new-in-chrome-154). **It is NOT on in 156**: chromestatus now shows the ship stage at **157** (updated 2026-10-15) — [chromestatus 5178263526834176](https://chromestatus.com/feature/5178263526834176). The Blink flag `CSSTextDecorationInset` is `experimental` on the 155 and 156 branches ([json5 @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/platform/runtime_enabled_features.json5)), and BCD has no 154 entry for it.

**Chrome 155 (stable 2026-10-06)**
- **JPEG XL decoding (`image/jxl`)** through jxl-rs, a memory-safe Rust decoder. It brings progressive decoding, wide gamut, HDR, high bit depth and animation — [chromestatus 5114042131808256](https://chromestatus.com/feature/5114042131808256); BCD `mediatypes.image.jxl` = 155. Verified on the 156 branch: `BASE_FEATURE(kJXLImageFormat, FEATURE_ENABLED_BY_DEFAULT)` inside `#if BUILDFLAG(ENABLE_JXL_DECODER)` ([blink/common/features.cc @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/common/features.cc)), and the GN default is `enable_jxl_decoder = true` ([blink/renderer/config.gni @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/config.gni)). Electron's `build/args/all.gn` does not override it ([all.gn v45.0.0](https://github.com/electron/electron/blob/v45.0.0/build/args/all.gn)). The chromestatus signals say Firefox and Safari ship JXL too. **Relevance: medium–high** for the asset pipeline (see Q2).
- **`margin-trim`** (`none | block | block-start | block-end`), which drops the first/last child margins. It works on block and multicol containers only; flex and grid support was removed from the spec — [chromestatus 5197863732772864](https://chromestatus.com/feature/5197863732772864); BCD 155; Blink `MarginTrim` is `stable` at 155. Safari shipped it. **Relevance: low–medium** (prose rule zones on the premium card face, journal entries).
- **CSS `symbols()`**: an inline anonymous counter style for `list-style-type` and `counter()` — [chromestatus 5146996093616128](https://chromestatus.com/feature/5146996093616128); Blink `CSSCounterStyleSymbolsFunction` is `stable` at 155. Low.
- **`text-decoration-skip-spaces`** — [chromestatus 4832783806627840](https://chromestatus.com/feature/4832783806627840). Low.
- **Import Text**: `import s from './x.txt' with { type: 'text' }` — [chromestatus 5191512456560640](https://chromestatus.com/feature/5191512456560640); BCD `import_attributes.type_text` = 155. **Low**, because webpack resolves imports at build time.
- **Additional Windowing Controls**: `window.maximize() / minimize() / restore() / setResizable()` and the `display-state` / `resizable` media features, for apps that hold the window-management permission — [chromestatus 5201832664629248](https://chromestatus.com/feature/5201832664629248). **Low**: Electron's main-process APIs already do this, and whether the permission is grantable inside Electron is untested.
- Also in 155: post-quantum WebCrypto plus an AEAD, Digital Credentials issuance, `chrome.debugger` restrictions, and pausing media in hidden iframes — [chromestatus milestone 155 API](https://chromestatus.com/api/v0/features?milestone=155). **None.**
- ⚠ **`PredefinedColorSpace` `srgb-linear` / `display-p3-linear`** for canvas is listed as "Enabled by default" in 155 by chromestatus ([5122501071994880](https://chromestatus.com/feature/5122501071994880)) and as "Shipped" by [What's New in WebGPU 155–156](https://developer.chrome.com/blog/new-in-webgpu-155-156). However, the Blink flag `ColorSpacePredefinedLinearSpaces` is **`experimental`** on the 152, 155 and 156 branches ([json5 @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/platform/runtime_enabled_features.json5)), and BCD has no entry. **Treat it as not shipped and feature-detect.**

**Chrome 156 (stable 2026-10-20). Electron 45.0.0 ships 156.0.8078.48** ([release v45.0.0](https://github.com/electron/electron/releases/tag/v45.0.0))
- **CSS `random()`**: `random([<random-key>,]? <calc-sum>, <calc-sum>[, <calc-sum> step]?)` with `<random-key> = auto | <random-cache-key> | fixed <number [0,1]>`. Both limits are inclusive, and the step restricts results to `min + N*step` — [CSS Values 5 §9](https://drafts.csswg.org/css-values-5/#random), [chromestatus 5324559251275776](https://chromestatus.com/feature/5324559251275776). By default every `random()` resolves to a distinct value; a key controls sharing across properties and elements (chromestatus summary). Blink `CSSRandomFunction`: `experimental` at 155, `stable` at 156. BCD `css.types.random` 156 includes `dashed-ident` and `step`. Safari shipped; Firefox is positive. **`random-item()` is not listed anywhere** for Chrome (no chromestatus entry, no BCD entry). **Relevance: medium** (decorative variance — see Q2).
- **Single-axis scroll containers**: `overflow: scroll clip` / `auto clip`. Stickiness is constrained per axis by different ancestors, and the `clip` axis "stays in place" — [chromestatus 5067363861004288](https://chromestatus.com/feature/5067363861004288) (dev trial 154, ship 156); Blink `SingleAxisScrollContainers` is `experimental` at 155 and `stable` at 156. Conflicts: [the Chrome 153 notes](https://developer.chrome.com/release-notes/153) present it under 153 ("available for testing"), and BCD lists the `@supports` named feature `single-axis-scroll-container` at 154 [exp]. The branch data says **156**. **Relevance: medium.**
- **`scroll-snap-type: … pair`**: when the container snaps to an element on one axis, it snaps to the same element on the other — [chromestatus 5124378896498688](https://chromestatus.com/feature/5124378896498688); BCD 156 [exp]; Blink `CSSScrollSnapTypePair` is `stable`. Safari: "Support". **Low** (only matters for scrolled 2-D grids).
- **`:navigation-source`**: matches the element that triggered the current navigation, a CSS reflection of the Navigation API's `sourceElement`. The spec's example uses it to set `view-transition-name` on the clicked thumbnail — [CSS Navigation 1](https://drafts.csswg.org/css-navigation-1/), [chromestatus 6327898878377984](https://chromestatus.com/feature/6327898878377984). **Low**, because our SPA navigates through Vue state, not the Navigation API.
- **Module load failures are no longer cached**, so `import()` can be retried — [chromestatus 5214647044145152](https://chromestatus.com/feature/5214647044145152); BCD `http_errors_not_cached` 156. Firefox and Safari already behave this way. **Low**: webpack's chunk loader uses its own script tags.
- **IndexedDB on a SQLite backend** for *new* data stores; existing LevelDB stores are untouched, and there is no API change — [chromestatus 5161589557821440](https://chromestatus.com/feature/5161589557821440). **Low–medium**, and only if the renderer uses IndexedDB.
- **WGSL `@builtin(frag_depth, less|greater)`** is listed as enabled — [chromestatus 5663304168112128](https://chromestatus.com/feature/5663304168112128) — but **"temporarily disabled on all platforms due to shader compilation errors on Windows"** per [What's New in WebGPU 155–156](https://developer.chrome.com/blog/new-in-webgpu-155-156).
- Also in 156: compression-dictionary transport updates, a WebRTC diagnostic logging API, WebTransport headers, and the removal of fenced frames — [chromestatus milestone 156 API](https://chromestatus.com/api/v0/features?milestone=156). **None.**

### Inferences
- **For the web build**: `random()` (Safari yes, Firefox not yet), single-axis overflow, `scroll-axis-lock`, `scroll-snap pair`, `:navigation-source` and `scroll-marker-group` modes need `@supports` guards or a graceful default. The iterator helpers need a polyfill or core-js for Safari. JXL needs `<picture>`/`image-set(type("image/jxl"))` fallbacks for older Chrome and any browser without it.
- Treat the developer.chrome.com release-note pages as *announcements*: two of their items (`text-decoration-inset` in 154, single-axis overflow in 153) do not match the branch flags. **Rule for this codebase: before relying on a 153–156 feature, check `CSS.supports(...)` in the actual Electron renderer once.**
- The real headline of this runtime bump is **not** the web platform (thin for us) but Electron 45's own changes (Q4) and the GPU and shader-cache fixes (Q5).

### Gaps
- The developer.chrome.com release-note pages for 155 and 156 returned 404 at research time, so their prose was not cross-checked; the chromestatus lists and branch flags were used instead.
- I could not verify whether `random()` values are re-rolled when an element's style is recomputed (for example on a class toggle) or stay stable per element and key. The spec's §9.3/9.4 caching text was only partially extracted. This must be tested before using `random()` on anything that re-styles during an animation.
- Whether `window.maximize()` (Additional Windowing Controls) is grantable inside Electron is untested.

---

## Q2. Which of these let us rewrite hand-rolled code (JS layout, positioning, animation, state-losing DOM moves, focus management, measurement loops) as native platform features?

### Takeaway
In the 153–156 window specifically, the rewrite opportunities are **modest**. The big native replacements for hand-rolled layout, animation and focus code (anchor positioning, view transitions incl. element-scoped, scroll-driven animations, `focusgroup`, `moveBefore`, …) all shipped at or before 152 and are covered by the sibling notes. The genuinely new rewrite levers are:
- **`protocol.registerSource()`** replacing our `protocol.handle` for the static bundle (Electron 45; see Q4);
- **JPEG XL** replacing PNG/WebP for large art;
- **CSS `random()`** replacing JS-generated decorative jitter;
- **`overflow: auto clip`** replacing wrapper/clip hacks;
- **`margin-trim`** replacing first/last-child margin resets;
- **iterator helpers** in view-models;
- **Electron's Window State API** replacing hand-rolled window persistence;
- **Node 24.22 `util.debounce`/`throttle`** in main/utility code.

Three features would be the real rewrite levers for this app (HTML-in-canvas, event-driven gamepad input, `text-decoration-inset`), and they are **not** in 156 stable (see Q6).

### Cited Findings
- `random()` can scatter elements (`top: random(0%, 100%)`) and supports keyed sharing and `fixed <number>` deterministic values — [chromestatus 5324559251275776](https://chromestatus.com/feature/5324559251275776), [CSS Values 5 §9](https://drafts.csswg.org/css-values-5/#random).
- With single-axis scroll containers, `overflow: scroll clip` lets `position: sticky` bind to different scroll containers per axis and keeps the `clip` axis in place — [chromestatus 5067363861004288](https://chromestatus.com/feature/5067363861004288).
- `margin-trim` omits the margins before the first child and after the last child of block and multicol containers — [chromestatus 5197863732772864](https://chromestatus.com/feature/5197863732772864).
- JPEG XL brings progressive decoding "for improved perceived loading performance", wide gamut, HDR, high bit depth and animation — [chromestatus 5114042131808256](https://chromestatus.com/feature/5114042131808256).
- `scroll-marker-group: tabs` provides roving-tabindex keyboard behaviour, focus-scope ownership and accessibility-tree pruning of inactive panels "saving developers from manually scripting state changes" — [chromestatus 5109685301673984](https://chromestatus.com/feature/5109685301673984).
- `protocol.registerSource()` serves a custom scheme from directories with no JavaScript handler. "no request touches the main thread, so pages and their subresources load at the same speed whether or not the main process is busy." It supports per-route `headers`, an `index` file for paths ending in `/`, `Content-Type` from the file extension, and asar archives — [Electron v45 protocol.md](https://github.com/electron/electron/blob/v45.0.0/docs/api/protocol.md). Benchmark from the PR (Linux x64, a page with 60 stylesheets): `protocol.handle` took 22 ms idle and 120 ms with a busy main thread; `registerSource` took 13 ms idle and 14 ms busy. The renderer `fetch()` round trip dropped from 0.33 to 0.20 ms — [electron#53220](https://github.com/electron/electron/pull/53220).
- Window State API: set a BrowserWindow `name` plus `windowStatePersistence: true | { bounds?: boolean, displayMode?: boolean }` (displayMode covers fullscreen, kiosk and maximized). It adds a `'persisted-state-restored'` event and `BaseWindow.clearPersistedState(name)`, and is _Experimental_ — [base-window-options.md v45](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/base-window-options.md), [window-state-persistence.md](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/window-state-persistence.md), [base-window.md](https://github.com/electron/electron/blob/v45.0.0/docs/api/base-window.md), [electron#51510](https://github.com/electron/electron/pull/51510).
- Node 24.22.0 adds `util.debounce()`, `util.throttle()` and `util.markPromiseAsHandled()` — [Node v24.22.0](https://nodejs.org/en/blog/release/v24.22.0).
- Not available in 156 (so no rewrite yet): HTML-in-canvas (ship stage 157), the Gamepad event-driven `rawgamepadinputchange` (flag/OT), `text-decoration-inset` (157) and CSS corner shorthands (157) — [chromestatus 5172548013916160](https://chromestatus.com/feature/5172548013916160), [chromestatus 5989275208253440](https://chromestatus.com/feature/5989275208253440), [chromestatus 5178263526834176](https://chromestatus.com/feature/5178263526834176), [chromestatus 5152215540039680](https://chromestatus.com/feature/5152215540039680).

### Inferences — concrete "what we could rewrite/build" ideas
1. **`app://` → `protocol.registerSource` (highest payoff, Electron-only).** Serve the packaged renderer (`dist/`, `assets/`) declaratively from asar, so the HTML, JS chunks, CSS, sprites and fonts never queue behind main-process JS during boot. Boot is exactly when our main process is busiest: window creation, the curtain `WebContentsView`, spawning the utilityProcess server. Constraints:
   - (a) **"A scheme has either a handler or a source"**. If our `app://` handler also proxies API, WebSocket or dynamic routes to the in-process server, those routes must move to another scheme or to the loopback HTTP server.
   - (b) GET/HEAD only. A missing file returns `ERR_FILE_NOT_FOUND`, so there is no SPA fallback rewrite. Query-string routing (`?console=1`) is fine; history-API deep paths are not.
   - (c) The route `headers` can carry `Cross-Origin-Opener-Policy`/`COEP`, or `Document-Policy: js-profiling` to enable the JS Self-Profiling API for perf probes.
   - (d) The API is experimental, so the API shape may change.
   - (e) `webRequest` listeners still apply. Registering any `webRequest` listener re-routes *all* renderer requests through the main thread (see Q4, #53115).
2. **JPEG XL for 4K art** (card art, planet and colony art, board and background plates, the lore archive). For the same visual quality it should be smaller than PNG/JPEG (a general property of JXL, not measured here). It also gives alpha, high bit depth for smooth gradients on the glass panels, and progressive decode. Ship `.jxl` in the Electron build with `<picture><source type="image/jxl">` or CSS `image-set(url(a.jxl) type("image/jxl"), url(a.webp) type("image/webp"))` for the web build. Check GPU decode and upload cost on the Steam Deck before a mass conversion. The wins are disk and asar size plus decode bandwidth, not GPU memory: decoded bitmaps are the same size.
3. **`random()` for decorative variance only**: starfield twinkle offsets, a tiny per-card fan rotation, scatter for the resource-token "pile", shimmer phase offsets on glass borders. Replace `Math.random()` in `:style` bindings and the GSAP `random()` used for *static* decoration. Use `fixed <n>` or a seeded custom property in e2e/storyboard runs so screenshots stay deterministic (our storyboard/probe tests compare frames). Do **not** use it for anything GSAP must tween from a known value, or where the re-style behaviour is unknown (see the Q1 gap).
4. **`overflow: auto clip` / `scroll clip`** for any horizontally paged rail (album page strip, played-cards stacks if they ever scroll) where the vertical axis must hard-clip at the box while hover/focus glow is allowed to bleed via `overflow-clip-margin`. Before this, `overflow-x: auto` coerced `overflow-y: visible` to `auto`, which forced wrapper elements or JS clipping.
5. **`margin-trim: block`** on the premium card's prose rule zone and the journal entry bodies, to delete the `:first-child { margin-top: 0 } / :last-child { margin-bottom: 0 }` resets. It is block containers only, so it is useless on our flex/grid layouts.
6. **Iterator helpers** in pure view-models (`insightEngine`, `endgameFacts`, `journalView`): `Iterator.zip([players, scores])`, `iter.includes(x)`, `iter.join(' · ')` without materialising arrays. These features postdate our TypeScript lib/target typings, which have not been checked (see Gaps).
7. **Window State API** to persist the TV window's fullscreen/kiosk state and its display placement. It fits with the v45 fix for BrowserWindow size corruption on secondary monitors with a different DPI (#51603; see Q4).
8. **`util.debounce`/`throttle`** in main-process or utilityProcess code only. The renderer still needs its own (or `@vueuse/core`'s `useDebounceFn`).

### Gaps
- Whether our `app://` handler serves *only* static files, or also dynamic routes, decides whether registerSource is a drop-in replacement. That is a codebase question outside this research.
- Our TypeScript version's lib typings for `Iterator.zip/join/includes` and `import … with { type: 'text' }` were not checked.
- No source measured JXL decode and upload cost on the Steam Deck's Van Gogh APU or on Graphite/D3D11.

---

## Q3. What landed in V8 15.3–15.6 (JS features, runtime/performance) and in Node 24.21–24.22?

### Takeaway
Only **four** JavaScript language features flipped to *shipped* between V8 15.2 and 15.6: **`Iterator.prototype.join`**, **joint iteration (`Iterator.zip`/`zipKeyed`)**, **`Iterator.prototype.includes`** and **import text**. One spec fix also shipped: **`Promise.try` no longer wraps a non-throwing result in an extra promise**. **Immutable ArrayBuffer, `import bytes` and `import defer` are only *staged*** (not on by default), and decorators, source-phase imports, ShadowRealm and shared structs are experimental. Temporal, upsert (`Map.prototype.getOrInsert`), iterator sequencing, `Math.sumPrecise`, explicit resource management, `Error.isError`, `RegExp.escape`, Float16Array and Uint8Array base64/hex were **already shipping in V8 15.2**, so they are not new in Electron 45. No V8 performance write-ups exist for 15.3–15.6. Electron 45 itself brings V8 code-cache and snapshot fixes. Node 24.21/24.22 add small utilities (`util.debounce`/`throttle`, histogram statistics, `MIMEType.parse`, a sqlite `Symbol.dispose`).

### Cited Findings
- V8 **15.6 shipped list** (`FOREACH_SHIPPED_FEATURE_FLAG`) includes `js_iterator_join`, `js_joint_iteration`, `js_iterator_includes`, `js_import_text` and `js_pr_3883` ("Promise.try not wrapping the result in an extra promise in the non-throwing case", tc39/ecma262#3883), alongside the older `js_esm_ns_reexport` and `js_iterator_sequencing` — [V8 15.6 feature-flags.h](https://chromium.googlesource.com/v8/v8/+/refs/branch-heads/15.6/src/flags/feature-flags.h).
- V8 **15.6 staged (not shipped)**: `js_immutable_arraybuffer`, `js_import_bytes`, `js_defer_import_eval`. **Experimental**: `harmony_shadow_realm`, `harmony_struct`, `js_decorators`, `js_source_phase_imports`, `js_regexp_buffer_boundaries` — [V8 15.6 feature-flags.h](https://chromium.googlesource.com/v8/v8/+/refs/branch-heads/15.6/src/flags/feature-flags.h).
- V8 **15.2** already shipped `harmony_import_attributes`, `harmony_temporal`, `js_regexp_duplicate_named_groups`, `js_regexp_modifiers`, `js_promise_try`, `js_atomics_pause`, `js_error_iserror`, `js_regexp_escape`, `js_explicit_resource_management`, `js_float16array`, `js_base_64`, `js_esm_ns_reexport`, `js_upsert`, `js_iterator_sequencing`, `js_sum_precise` and `js_intl_locale_variants`. In 15.2 the join/zip/text/bytes/defer/includes features were *staged* — [V8 15.2 flag-definitions.h](https://chromium.googlesource.com/v8/v8/+/refs/branch-heads/15.2/src/flags/flag-definitions.h).
- Chrome ship milestones: Iterator join and joint iteration 153, Iterator includes 154, Import Text 155 — [chromestatus 5095183554314240](https://chromestatus.com/feature/5095183554314240), [6249068542164992](https://chromestatus.com/feature/6249068542164992), [5205192866922496](https://chromestatus.com/feature/5205192866922496), [5191512456560640](https://chromestatus.com/feature/5191512456560640). `import defer` has no ship milestone ([chromestatus 5071131271888896](https://chromestatus.com/feature/5071131271888896)). Temporal shipped at 144 ([chromestatus 5668291307634688](https://chromestatus.com/feature/5668291307634688)).
- The V8 blog listing as fetched shows no posts after "How we made JSON.stringify more than twice as fast" (2025-08-04), so there are no 15.3–15.6 release or perf posts — [v8.dev/blog](https://v8.dev/blog).
- Electron 45 V8/startup items:
  - every Node-hosting process (Node-integrated renderers, workers, the **utility-process node service**, `child_process.fork()`) now boots from the Node snapshot plus a build-time code cache for Node's `lib/` builtins (previously ~120–140 builtins were compiled from source on every start) — [electron#52873](https://github.com/electron/electron/pull/52873);
  - fixed a 1-in-200 renderer V8 code-cache miss on first page load on Windows (#52791);
  - fixed V8 code caching for https scripts from `file://` and custom-scheme pages (#53746);
  - fixed custom V8 snapshots having no effect in the main process (#52872);
  - fixed WebAssembly modules crashing after a patch-release update (#54237) — [Electron v45.0.0 release notes](https://github.com/electron/electron/releases/tag/v45.0.0).
- **Node 24.21.0 (2026-09-08)** — [Node v24.21.0](https://nodejs.org/en/blog/release/v24.21.0):
  - non-throwing `MIMEType.parse` (util);
  - faster `net.BlockList`;
  - an improved histogram implementation and statistical hypothesis testing for histograms (perf_hooks);
  - crypto private keys loadable through OpenSSL STORE loaders;
  - OpenSSL 3.5.8, Undici 7.29.1 and NSS 3.126 root certificates.
- **Node 24.22.0 (2026-10-14)** — [Node v24.22.0](https://nodejs.org/en/blog/release/v24.22.0):
  - util: `util.debounce()`, `util.throttle()`, `util.markPromiseAsHandled()`;
  - perf_hooks: `SlidingWindowHistogram`, QRDE analysis, `Histogram.prototype.meanCI`, CBOR export/import of histograms;
  - sqlite: `StatementSync.prototype.close()` and `[Symbol.dispose]()`;
  - net: `net.BoundSocket` transferable to threads and processes;
  - crypto: `crypto.parsePKCS12()`, generic `crypto.createMac()`, SIV/GCM-SIV modes, cipher and hash discovery from OpenSSL providers.

### Inferences
- **JS-wise this bump is nearly a no-op** for the renderer: three iterator helpers and text imports, which webpack already handles. The language features worth adopting (explicit resource management with `using`, `Map.getOrInsert`, `Iterator.concat`, Temporal, `Math.sumPrecise`) were already available in Electron 44. If the codebase doesn't use them yet, that is a sibling-scope finding.
- **The utilityProcess game server should boot faster** thanks to the Node snapshot and code cache (#52873), with no code change. It is worth re-measuring the server spawn-to-ready time after the upgrade.
- **e2e/perf tooling**: Node 24.21/24.22's histogram hypothesis testing and `Histogram.prototype.meanCI` could replace hand-rolled statistics in the A/B timing scripts (`scripts/e2e-timings-diff.mjs`). However, those scripts run on the *system* Node, not Electron's. The laptop shell reported **Node v22.22.3** during this research, so 24.22-only APIs cannot be used there without a Node upgrade or guards.
- Shared server code that also runs outside Electron (web deployment, dev server, tests) must not depend on Node 24.22-only APIs unless every runtime is upgraded.

### Gaps
- There is no public source describing Maglev/Turbolev/Sparkplug/GC changes in V8 15.3–15.6. The V8 blog is silent and V8 no longer publishes per-version posts, so nothing can be said about JS performance deltas beyond Electron's startup and code-cache fixes.
- The exact API shapes of the Node 24.21 "statistical hypothesis testing" and `meanCI` were not fetched beyond the release-note titles.

---

## Q4. Electron 45.0.0: what are its new features (full Features section), and what could we use? Which breaking changes bite us?

### Takeaway
Electron 45.0.0 was published **2026-10-21** ([GitHub API](https://api.github.com/repos/electron/electron/releases/tags/v45.0.0)). Its announcement blog post was not yet up: `electronjs.org/blog/electron-45-0` returned 404. For us, the most valuable items are:
- **`protocol.registerSource()`**: static `app://` serving off the main thread;
- **the Skia GPU shader-cache persistence fix**: roughly 400–480 ms of per-launch shader compilation removed on Windows;
- a **broad perf sweep**: renderer requests no longer routed through the main thread, cheaper `contextBridge`/IPC/asar, Node-snapshot boot for the utility process;
- **WebContentsView and utilityProcess fixes** that match our architecture (curtain-overlay focus, blank WCV, messages and stdout dropped at exit);
- the experimental **Window State API**;
- the **Windows Error Reporting helper**.

The **breaking changes to audit** are:
- sandboxed preloads lose `Buffer` / `setImmediate` / `require('events'|'timers'|'url')`;
- ASAR file descriptors are fs-only;
- `contentTracing` writes Perfetto only;
- synchronous `safeStorage` is deprecated;
- the clipboard module is async and main-only;
- on Linux, the dummy ANGLE `libEGL.so`/`libGLESv2.so` are gone from the dist.

### Cited Findings

**Stack**: Chromium 156.0.8078.48, Node v24.22.0, V8 15.6. End of support for 42.x — [release notes](https://github.com/electron/electron/releases/tag/v45.0.0).

**Features (complete list from the release notes), with relevance**
- **Experimental `protocol.registerSource(scheme, { routes })`** and `protocol.getSource(scheme)`; `isProtocolHandled` reports both handlers and sources; `unhandle` removes either — [protocol.md v45](https://github.com/electron/electron/blob/v45.0.0/docs/api/protocol.md), [#54521](https://github.com/electron/electron/pull/54521). Routes match by `host` and then the longest `path` prefix and resolve inside a route `root`. Files stream like `file:` URLs, asar included; there is range support, `Content-Type` comes from the extension, routes can add `headers`, and paths ending in `/` serve the route's `index`. Anything else fails with `ERR_FILE_NOT_FOUND`. It works through an IO-thread `URLLoaderFactory` plus an `AsarURLLoader` on a blocking sequence, with **no main-thread involvement** — [electron#53220](https://github.com/electron/electron/pull/53220). **HIGH relevance.**
- **The Save/Restore Window State API** (GSoC 2025): `name` plus `windowStatePersistence`, the `persisted-state-restored` event and `BaseWindow.clearPersistedState()`. It is "automatically disabled when there is no available display" — [base-window-options.md](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/base-window-options.md), [#51510](https://github.com/electron/electron/pull/51510). A related fix: window state is now persisted for fullscreen/maximize changes made without movement (#53577). **Medium.**
- **A Windows Error Reporting helper**: `electron_wer.dll`, renamed to `<app>_wer.dll` next to the exe, lets `crashReporter` capture `__fastfail` and other crashes that bypass the in-process handler — [#53851](https://github.com/electron/electron/pull/53851). **Medium.** The packaging must ship this DLL beside the executable.
- **The Prompt API via `localAIHandler`** in a UtilityProcess. The main process calls `ses.registerLocalAIHandler(handler)` (passing `null` unregisters). In the utility process, `localAIHandler.setPromptAPIHandler(details => LanguageModelSubclass | null)` receives `webContentsId`, `securityOrigin`, `frameToken` and `renderProcessId`. A `ReadableStream` return value supports `promptStreaming()`. Requests are queued until the handler is set, and the oldest is dropped on overflow. There is no service-worker support. It can be compiled out with the `enable_prompt_api` GN arg — [local-ai-handler.md](https://github.com/electron/electron/blob/v45.0.0/docs/api/local-ai-handler.md), [#50659](https://github.com/electron/electron/pull/50659). **Low–medium**: the renderer would call the standard `LanguageModel` API and our utility process would answer with any local model.
- **`disableWakeLocks`** in WebPreferences stops page activity such as audio playback from blocking system sleep — [#52342](https://github.com/electron/electron/pull/52342), [web-preferences.md](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/web-preferences.md). **Low.** For a TV game we usually want the opposite (`powerSaveBlocker`).
- **`child-process-gone` gains launch-failure reporting with `systemErrorCode`** (#54230). **Medium**: it gives diagnostics when the utilityProcess server fails to launch.
- **`fs.open`, `createReadStream`, `copyFile` and `cp` now read ASAR entries directly**, without temp extraction; `fs.opendir` and `fs.readlink` work on archives — [#52833](https://github.com/electron/electron/pull/52833). **Medium** for any server or main code that reads bundled assets.
- **`webFrame.getIsolatedWorlds()` and the `isolated-world-created` event** (#50633); **`initiatorOrigin`** on webRequest/protocol handler requests, `DownloadItem.getInitiatorOrigin()`, and a `frame` argument on `will-download`/`preconnect` (#53700). Low.
- **Linux**: Notification action buttons (#54889); `app.setBadgeCount` and `win.setProgressBar` restored via the LauncherEntry D-Bus API (#52739); frameless windows get system-themed Window Controls Overlay icons (#52461). Low for SteamOS game mode.
- **Other**:
  - `process.getSystemMemoryInfo().available` on Linux (#52299) — low–medium: it could drive a quality tier on the Deck;
  - `webContents.caretBrowsingEnabled` (#52696);
  - `webFrameMain.printToPDF()` (#52439);
  - the `ELECTRON_DEBUG_DRAGGABLE_REGIONS` env var (#53626);
  - a `badge` on `MenuItem` (macOS 14+), macOS app shims, `app.configureWebAuthn()`, and streaming/resumable/delta macOS `autoUpdater` downloads;
  - fixed `getDisplayMedia({audio:{restrictOwnAudio}})`.

  All of these are low or none — [release notes](https://github.com/electron/electron/releases/tag/v45.0.0).

**Performance changes that matter to us**
- **Renderer network requests and `file://` loads no longer wait on the main process** unless a session has a `webRequest` listener, an intercepted scheme matching the request, or `--ignore-connections-limit`. Example: 150 subresources with a busy main thread went from 152 to 51 ms; with **any** `webRequest` listener it stayed unchanged at 152→155 ms — [electron#53115](https://github.com/electron/electron/pull/53115).
- A Linux test app went from launch to first contentful paint in **633 → 452 ms**, from four changes in [electron#52923](https://github.com/electron/electron/pull/52923):
  - first `new BrowserWindow()` on Linux: 100 → 18 ms;
  - `contextBridge` calls: 25–57 % cheaper;
  - MB-scale IPC: about a third cheaper;
  - `Buffer.allocUnsafe`: 6–80× cheaper.
- Linux startup skips the GDK OpenGL probe during `gtk_init()` and starts FontConfig early: about −35 ms to `ready` and −55 ms to FCP — [electron#53070](https://github.com/electron/electron/pull/53070).
- **Every Node-hosting process, including the utility process, boots from the Node snapshot and code cache** — [electron#52873](https://github.com/electron/electron/pull/52873).
- Native method and property calls on BrowserWindow/BaseWindow/WebContents/WebFrameMain/View are cheaper (#54359). `protocol.handle` responses taken straight from `net.fetch` are relayed without JS pumping (#53379). Idle main-process timer wakeups are reduced. The first sandboxed BrowserWindow starts with a pre-launched renderer when a session exists (#53116). A very large number of `app-region` elements no longer makes the app unresponsive (#53596) — [release notes](https://github.com/electron/electron/releases/tag/v45.0.0), [#54359](https://github.com/electron/electron/pull/54359).

**Fixes that map onto our architecture** (all from the [v45.0.0 release notes](https://github.com/electron/electron/releases/tag/v45.0.0))
- **Skia-compiled GPU shaders are now persisted between launches** (#54156, the backport of #54113). Details in Q5.
- WebContentsView:
  - a child `WebContentsView` no longer loses focus when the window is reactivated (#54454);
  - a `WebContentsView` no longer stays blank after the window is shown when `setBackgroundThrottling(false)` was called while it was hidden (#52844);
  - detached `WebContentsView` pages now see the correct window size (#53031);
  - hidden windows no longer keep rendering at full frame rate after a `setBackgroundThrottling` sequence (#54339);
  - Window Controls Overlay CSS variables are now populated for a WCV in a BaseWindow (#53811).
- utilityProcess:
  - messages posted before exit are no longer dropped (#54956);
  - stdout/stderr written before exit are no longer dropped (#54335);
  - `utilityProcess.postMessage()` after exit no longer crashes (#53299);
  - utility processes no longer crash at exit on Windows 11 24H2+ (#53038);
  - crashes in `utilityProcess.fork()` fixed (#53280).
- Windows display and window:
  - BrowserWindow size corruption with explicit x/y on a secondary monitor with a different DPI (#51603);
  - `win.isFullScreen()` stale inside fullscreen events (#55008);
  - `webContents` emitting `unresponsive` after system wake (#53760);
  - `app.disableHardwareAcceleration()` not fully disabling the GPU since Electron 38 (#51817);
  - `app.getGPUInfo('complete')` stalling the GPU process (#53645);
  - the GPU process crash-looping when the sandbox can't read the install folder (#54483);
  - the GPU process terminated in AppX/MSIX with the WebGPU SwiftShader fallback (#53174).
- Linux/Wayland:
  - a crash report when the X server or Wayland compositor exits (#52603);
  - a crash when starting with no display server (now exits with code 1, #54781);
  - `setIgnoreMouseEvents` gets Wayland support (#54394);
  - `globalShortcut` on GNOME Wayland (#52221);
  - a Pango/fontconfig startup race (#53338);
  - `GDK_BACKEND` leaking into child processes (#54424).
- Renderer:
  - a crash when a `ResizeObserver` loop-limit error handler modified layout (#54289);
  - `matchMedia('(display-mode: …)')` returning `browser` for overlay, frameless or fullscreen windows (#51396);
  - an exception thrown by a property getter through `contextBridge` being swallowed (#53297);
  - a renderer crash when an array with a throwing getter passes through `contextBridge` (#53069);
  - `webContents.executeJavaScript(…, userGesture)` not granting activation (#54959).

**Breaking changes** ([breaking-changes.md v45](https://github.com/electron/electron/blob/v45.0.0/docs/breaking-changes.md))
- **Sandboxed preload scripts** (the default since Electron 20) and service-worker preloads lose `require('events')`, `require('timers')`, `require('url')` and the `Buffer`, `setImmediate` and `clearImmediate` globals. `require` now loads only `electron` (plus `electron/renderer` and `electron/common`); `process` and `global` remain. The documented replacements: `EventTarget`/`Event`, `setTimeout`/`queueMicrotask`, `URL`/`URLSearchParams`, `Uint8Array`/`TextEncoder`/`atob`. `ipcRenderer`, `webFrame` and `process` now use a native EventEmitter; the static helpers `once`, `listenerCount` and `init` from `require('events')` are gone. The motivation is faster sandboxed startup: "Electron no longer evaluates a JavaScript bundle of its own in sandboxed renderers unless `webviewTag` is enabled" — [#54048](https://github.com/electron/electron/pull/54048).
- **ASAR file descriptors are only meaningful to Node's `fs`.** Raw-fd consumers fail with `EBADF`: native addons, `child_process` stdio, `net.Socket({fd})`, `http2stream.respondWithFile`/`respondWithFD`, and a `FileHandle` transferred to a worker. Write flags on archive entries give `EACCES`, and `fs.stat` follows archive symlinks. Only `process.dlopen` and `child_process.execFile*` still extract temp copies, and those copies are now read-only — [#52833](https://github.com/electron/electron/pull/52833).
- **`contentTracing` now writes only Perfetto protobuf** (no JSON). `contentTracing.enableHeapProfiling()` is removed in favour of `startRecording({ nativeHeapProfiling: { samplingInterval } })`.
- Screen, window and tab capture is reported as `display-capture` to `setPermissionRequestHandler`. `chromeMediaSource: 'desktop'` rejects WebContents ids. `document.requestStorageAccessFor` is disabled (restorable via `enableBlinkFeatures: 'RequestStorageAccessFor'`).
- `window.open()` children of unsandboxed windows get their own sandboxed process. Workers created from subframes need `nodeIntegrationInSubFrames` to get Node integration. Preloads run in DevTools extension frames only when those frames are hosted by DevTools.
- Other removals and deprecations — [release notes](https://github.com/electron/electron/releases/tag/v45.0.0), [#51707](https://github.com/electron/electron/pull/51707):
  - synchronous `safeStorage` methods are deprecated and will be removed in 46 (#53850);
  - the clipboard module is aligned with the W3C API: `read`/`write`/`readText`/`writeText` return Promises, and the module is **no longer available in the renderer**;
  - 32-bit Windows ia32 and Linux armv7l builds are removed;
  - `openAsHidden` is removed from `setLoginItemSettings`;
  - the Linux support policy is now vague ("major distributions", no version numbers) (#52429).
- **Linux dist no longer ships `libEGL.so` / `libGLESv2.so`.** They were non-functional stubs, because "since the Chromium 151.0.7900.0 roll, ANGLE is statically linked into the Electron binary on Linux". Electron's 44.0 breaking-changes doc "already states that apps can no longer swap out the ANGLE libraries on Linux" — [electron#52226](https://github.com/electron/electron/pull/52226).

### Inferences
- **Audit first, adopt second.**
  - **Preloads** (both of ours are sandboxed): any use of `Buffer`, `setImmediate`, `EventEmitter` from `events`, or `url` breaks at the upgrade. This is a likely silent failure inside `contextBridge` setup, so test that both preloads still expose their API.
  - **AppImage/Linux packaging scripts** that copy or patch `libEGL.so` / `libGLESv2.so` will fail.
  - **Velopack packaging** must include `<app>_wer.dll`.
  - **Perf tooling** that reads `contentTracing` JSON must switch to Perfetto or `traceconv`.
  - Any **`webRequest.on*` listener** in the main process silently opts the whole session back into main-thread request routing (#53115). It would also undo part of registerSource's benefit for observed requests, so remove CSP or header-injection listeners, or move them to registerSource route `headers`.
- **Curtain overlay (a WebContentsView) plus gamepad focus**: #54454 (child WCV focus lost on reactivation) and #52844/#54339 (blank or full-frame-rate background WCVs) are exactly the classes of bug a scene-transition overlay hits. Re-test the curtain's show/hide and focus hand-back after the upgrade; some workarounds may now be removable.
- **utilityProcess server**: #54956/#54335 mean final log lines and the last messages before exit (crash reports, the "saved" acknowledgement) now arrive. Any "sleep before exit" or "flush" workaround can go.
- **Window State API on a TV**: with `displayMode: true` it restores fullscreen/kiosk on the right display. The secondary-monitor DPI fix (#51603) matters when the TV is a second display at a different scale.
- **localAIHandler** would allow an offline, local-LLM "explain this move / rules Q&A" companion without exposing a network API to the renderer. That is speculative product work with no model shipped; low priority.
- **`process.getSystemMemoryInfo().available` (Linux)** could feed a "reduce effects" tier on the Deck. The value of that is speculative.

### Gaps
- The Electron 45 announcement blog post (which usually summarises highlights) was not published at research time (404).
- The PR for the `nodeIntegrationInWorker` change and several Linux PRs were not read in full; the summaries come from the release notes.
- Whether registerSource can coexist with `protocol.handle` on *different hosts of the same scheme* was not found in the docs. The docs say a scheme has either a handler or a source.

---

## Q5. GPU and rendering pipeline changes in Chromium 153–156 that affect a 4K TV (Windows, Graphite) or the Steam Deck (Linux, ANGLE/Vulkan, gamescope)

### Takeaway
There is **no platform-default flip** for Graphite or Vulkan in 153–156. At the 156 branch head, `kSkiaGraphite` is enabled by default **only on Apple**, and `kVulkan` only on Android. Windows and Linux stay on Ganesh/GL unless the app forces them, as ours does on Windows. The Graphite code path did change in 152→156:
- the Windows `kSkiaGraphiteDawnUseD3D12` toggle was removed;
- new Graphite params `triple_buffered_dcomp_root_surface` and `max_time_between_submits` were added;
- device-support gating was simplified.

In the compositor, **`kRenderNonMergedSurfaceAtBackingScale`** (keeps text sharp on non-mergeable surfaces) is new and on by default, and **`kScalableFrameEviction`** flipped to on. WebGPU gained:
- WGSL `buffer_view` and `swizzle_assignment`;
- `texture-compression-unaligned`;
- the `snorm10-10-10-2` vertex format;
- `shader-f16` on Linux/NVIDIA;
- HLSL 2021 on by default on D3D12.

`fragment_depth` is disabled, and canvas `display-p3-linear` is contested. The most impactful GPU item for us is Electron's own fix: **Skia's compiled shaders were never written to disk in Electron**, which cost about 480 ms of serialised shader compiles on every launch on Windows/ANGLE-D3D11. That is fixed in 45.

### Cited Findings
- 156 branch: `BASE_FEATURE(kSkiaGraphite, IS_APPLE ? ENABLED : DISABLED)`, overridable by `--enable-skia-graphite` / `--disable-skia-graphite`, with the Dawn backend selectable via `--skia-graphite-dawn-backend`. Graphite on Intel GPUs on Windows is governed separately by `kSkiaGraphiteWinIntel` (disabled; requires `kLateGraphiteFeatureCheck`) — [gpu_finch_features.cc @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/gpu/config/gpu_finch_features.cc).
- 156 branch: `BASE_FEATURE(kVulkan, IS_ANDROID ? ENABLED : DISABLED)` — [gpu_finch_features.cc @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/gpu/config/gpu_finch_features.cc).
- 152 → 156 diff of `gpu_finch_features.cc` — [@7977](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/7977/gpu/config/gpu_finch_features.cc) vs [@8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/gpu/config/gpu_finch_features.cc):
  - Windows `kSkiaGraphiteDawnUseD3D12` was removed;
  - new Graphite feature params `max_time_between_submits` and (Windows) `triple_buffered_dcomp_root_surface`;
  - new `kSkiaGraphiteDrawListLayer` (disabled);
  - `IsSkiaGraphiteSupportedByDevice()` no longer requires ANGLE-Metal, only the passthrough decoder;
  - `kWebGPUUseHLSL2021` went from disabled to **enabled**;
  - new `kWebGLDeleteBuffersInBackground` (disabled) and `kVulkanImaginationMSAA` (disabled);
  - the `kWebGPUSpontaneousWireServer` param and `kD3DBackingUploadWithUpdateSubresource` were removed.
- 152 → 156 diff of `components/viz/common/features.cc` — [@7977](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/7977/components/viz/common/features.cc) vs [@8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/components/viz/common/features.cc):
  - **`kRenderNonMergedSurfaceAtBackingScale` is new and ENABLED**: "a non-mergeable surface's root render pass backing is enlarged to match the scale at which the frame's content was rasterized. This avoids downsampling and then upsampling the content, keeping text sharp (crbug.com/513611535)";
  - **`kScalableFrameEviction` went from disabled to ENABLED**: "FrameEvictionManager scales its limit of max number of saved frames dynamically based on memory pressure";
  - new and disabled: `kCalculateDeadlineDerivedInterval`, `kMixedFixedIntervalMatcher`, `kPerDependencyDeadlines`, and (Mac only) `kUseDisplayRefreshRateForTimer`.
- `ui/gl/gl_features.cc`: the Windows/ChromeOS `kFallbackToSWIfGLES3NotSupported` feature was removed between 152 and 156 — [gl_features.cc @7977](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/7977/ui/gl/gl_features.cc) vs [@8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/ui/gl/gl_features.cc).
- **Electron shader-cache fix** — [electron#54113](https://github.com/electron/electron/pull/54113) (backport [#54156](https://github.com/electron/electron/pull/54156)):
  - The bug: Content asks the embedder for the shader disk-cache directories, and Electron "never answered", "so every shader Skia compiles for an app's UI is dropped on its way to disk and compiled again on the next launch".
  - The fix returns Chrome's four directories, rooted at `sessionData`: the display-compositor shader cache, `GrShaderCache`, `GraphiteDawnCache`, and `GPUPersistentCache` (non-Windows).
  - Measured on Windows 11, Intel Iris Xe, ANGLE D3D11: 31 `GrShaderCache::load` calls, all misses, and 31 × ~15 ms ≈ **480 ms** of serialised `D3DCompile` per launch with **0 frames presented meanwhile**. The demo shows "-400ms saved from the launch time".
  - `sessionData` must be set before `ready`. `clearStorageData({ storages: ['shadercache'] })` applies.
- **WebGPU 153–154** — [What's New in WebGPU 153–154](https://developer.chrome.com/blog/new-in-webgpu-153-154):
  - WGSL `buffer_view` and `swizzle_assignment` (`position.xy = vec2f(10.0, 20.0)`), both shipped and detectable via `wgslLanguageFeatures`;
  - `texture-formats-tier1` JS mapping fixed;
  - `subgroups` auto-enabled with `subgroup_size_control`;
  - Dawn: `BufferMapWriteExtendedUsages` (experimental; avoids the staging copy on Vulkan/D3D12); macOS 13+ is required.
  - Chromestatus shows no ship milestone for swizzle assignment, under the finch name `UnsafeWGSLFeatures` ([chromestatus 6229154029764608](https://chromestatus.com/feature/6229154029764608)), so it is uncertain.
- **WebGPU 155–156** — [What's New in WebGPU 155–156](https://developer.chrome.com/blog/new-in-webgpu-155-156):
  - `texture-compression-unaligned`, opt-in via `requiredFeatures` (BC/ETC2/ASTC without 4×4 padding);
  - the `snorm10-10-10-2` vertex format;
  - `shader-f16` on Linux with recent NVIDIA drivers;
  - a canvas `colorSpace: "display-p3-linear"` with `rgba16float` (blog: "Shipped"; see the Q1 conflict);
  - `fragment_depth` temporarily disabled;
  - Dawn: D3D adapter LUID query.
- **HDR**: no 2D-canvas HDR shipped in 153–156. "Canvas2D Target HDR Headroom" and "WebGL drawingBufferToneMapping" are Proposed with no milestone ([chromestatus 5858435803119616](https://chromestatus.com/feature/5858435803119616), [chromestatus 5424242161221632](https://chromestatus.com/feature/5424242161221632)). WebGPU extended-range (HDR) canvas shipped back in 129 ([chromestatus 6196313866895360](https://chromestatus.com/feature/6196313866895360)).

### Inferences
- **Graphite on Windows remains an app-forced, non-default configuration in 156.** Electron has no Finch field trials, so in Electron the compiled default is what you get unless a switch is set. That is an inference from how Finch works; it was not verified against Electron docs. The removal of `kSkiaGraphiteDawnUseD3D12` means that switch, if our main process sets it, is now a no-op. Re-verify which Dawn backend (D3D11 or D3D12) Graphite selects on our Windows boxes via `chrome://gpu` / `app.getGPUFeatureStatus()` after the upgrade.
- **The shader-cache fix directly targets our known "first draw of new content compiles shaders" stall** (cold GPU shader cache on GPU e2e). Cold *launch* costs go away from the second launch on, and the `GraphiteDawnCache` directory is now persisted for Graphite too. Shaders compiled on first use of a *new* effect within a session still compile once, but now persist across launches. E2e runs with fresh profiles still start cold, so to measure warm behaviour, keep a profile with a populated `GrShaderCache`/`GraphiteDawnCache`.
- `kRenderNonMergedSurfaceAtBackingScale` may improve text sharpness for content composited as a separate surface: possibly the curtain `WebContentsView`, or scaled TV-zoom layers. This is unverified, and it may also cost more GPU memory at 4K.
- `kScalableFrameEviction` means hidden or background surfaces (the curtain WCV when hidden) may be evicted earlier under memory pressure on the Deck. Re-test the curtain's first frame after a long hide for a blank flash. That classic symptom is consistent with the blank-WCV bug #52844 fixed in Electron.
- **Steam Deck**: nothing in 153–156 changes the Linux GL/Vulkan defaults. The `shader-f16` addition is NVIDIA-only. ANGLE is statically linked, so per-app ANGLE swaps are impossible. All Linux GPU choices stay switch-driven (`--use-angle=vulkan`, `--enable-features=Vulkan`, …) and should be re-verified on 156.

### Gaps
- No primary source (Chromium blog, chromestatus or release notes) documents a Graphite rollout to Windows or Linux in 153–156; the branch source only shows the defaults. I found no source on whether Graphite on Windows now defaults to the D3D12 or D3D11 Dawn backend after `kSkiaGraphiteDawnUseD3D12` was removed.
- I did not determine which surfaces count as "non-mergeable" for `kRenderNonMergedSurfaceAtBackingScale` (OOPIFs, WebContentsView, video?).
- The effect of `kFallbackToSWIfGLES3NotSupported`'s removal (whether its behaviour is now unconditional or gone) was not traced.

---

## Q6. Interesting features still behind a flag or origin trial at 156 — NOT generally usable (flag names for Electron)

### Takeaway
Several of the features most relevant to this app exist in 156 **only behind a flag**: event-driven gamepad input, Gamepad button types, HTML-in-canvas, `text-decoration-inset`, CSS corner shorthands, LoAF style/layout durations, JS self-profiling markers, web haptics, and the linear canvas color spaces. Blink runtime features whose status is `experimental` can in principle be switched on in Electron per window with `webPreferences.enableBlinkFeatures: 'Name1,Name2'`, or globally with `app.commandLine.appendSwitch('enable-blink-features', …)`. Origin trials are effectively unusable on an `app://` origin, so the runtime flag is the route. `test`-status features need test switches and should not be used.

### Cited Findings
**Mechanism**
- Electron's `enableBlinkFeatures` takes names from `runtime_enabled_features.json5` (linked from [web-preferences.md v45](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/web-preferences.md)). Electron's own breaking-changes doc uses `enableBlinkFeatures: 'RequestStorageAccessFor'` as the re-enable route for a disabled feature ([breaking-changes.md v45](https://github.com/electron/electron/blob/v45.0.0/docs/breaking-changes.md)).

**Status at the 156 branch head** (from [runtime_enabled_features.json5 @8078](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/platform/runtime_enabled_features.json5) unless noted)
- **Gamepad Event-Driven Input API.** A `rawgamepadinputchange` event fires whenever new input data arrives, "instead of relying on frequent polling via navigator.getGamepads()", for lower latency. Chrome flag `#gamepad-raw-input-change-event`; dev trial 147, origin trial from 149 — [chromestatus 5989275208253440](https://chromestatus.com/feature/5989275208253440). Blink `GamepadRawInputChangeEvent` is `experimental` (152, 155 and 156), with OT name `GamepadRawInputChangeEvent`. **HIGH relevance** (our input loop polls).
- **Gamepad button `type` attribute**: an interoperable identifier for non-standard buttons such as `"trackpad"`. Dev trial 152 — [chromestatus 5075054393163776](https://chromestatus.com/feature/5075054393163776). Blink `GamepadButtonTypes` is `experimental`. **Medium** (Steam Deck trackpads and back buttons, if they reach the Gamepad API at all).
- **HTML-in-canvas**: draw real HTML into a canvas, with DOM↔canvas sync. Flag `chrome://flags/#canvas-draw-element`; dev trial 138, OT 148, **ship stage 157** — [chromestatus 5172548013916160](https://chromestatus.com/feature/5172548013916160). Blink `CanvasDrawElement` is `experimental` (OT name `HTMLInCanvas`). **Potentially high** for card-face effects (dissolve, shatter, 3-D tilt with real lighting via WebGL/WebGPU), but not in 156 stable.
- **`text-decoration-inset`**: Blink `CSSTextDecorationInset` is `experimental`; ship 157 — [chromestatus 5178263526834176](https://chromestatus.com/feature/5178263526834176). Medium: animated underline reveals in menus and breadcrumbs without pseudo-elements.
- **CSS `corner` shorthands** (sets `border-radius` and `corner-shape` per corner): Blink `CSSCornersShorthand` is `experimental`; ship 157 — [chromestatus 5152215540039680](https://chromestatus.com/feature/5152215540039680). `corner-shape` itself shipped earlier (139 per [chromestatus 5357329815699456](https://chromestatus.com/feature/5357329815699456); sibling scope).
- **LoAF `styleDuration` / `forcedStyleDuration`**: Blink `LongAnimationFrameStyleDuration` is `experimental`, with an OT; ship 157 — [chromestatus 5171478175809536](https://chromestatus.com/feature/5171478175809536). **Medium** for our perf probes (separating style from layout inside a long frame).
- **LoAF in Web Workers**: Blink `LongAnimationFrameWorker` has status **`test`** (not even experimental) — [chromestatus 5387465121726464](https://chromestatus.com/feature/5387465121726464). Not usable.
- **JS Self-Profiling markers** (each sample tagged `script | gc | style | layout | paint | other`): OT 153–161; flag `--enable-blink-features=ExperimentalJSProfilerMarkers` — [chromestatus 5201297767792640](https://chromestatus.com/feature/5201297767792640). **js-profiling in dedicated workers** is a dev trial from 154 — [chromestatus 5159559872249856](https://chromestatus.com/feature/5159559872249856). Medium for perf tooling. The base Self-Profiling API (shipped in 94) needs a `Document-Policy: js-profiling` response header ([chromestatus 5170190448852992](https://chromestatus.com/feature/5170190448852992), header requirement per the WICG spec family; not re-verified here).
- **Web haptics** (semantic haptic effects such as hints, ticks and boundaries): dev trial 156; Blink `WebHaptics` is `experimental` — [chromestatus 5167864517623808](https://chromestatus.com/feature/5167864517623808). Low–medium: semantic UI haptics, separate from the Gamepad `vibrationActuator` rumble.
- **Canvas `srgb-linear` / `display-p3-linear`**: Blink `ColorSpacePredefinedLinearSpaces` is `experimental`, despite the chromestatus "155 enabled" claim — [chromestatus 5122501071994880](https://chromestatus.com/feature/5122501071994880).
- **WGSL `fragment_depth`**: shipping announced, but temporarily disabled — [What's New in WebGPU 155–156](https://developer.chrome.com/blog/new-in-webgpu-155-156). **WebGPU `atomic-vec2u-min-max`** is a dev trial (155) — [chromestatus 4882016087703552](https://chromestatus.com/feature/4882016087703552).

**JavaScript (V8) features staged but not shipped in 15.6**
- `import defer`, `import bytes` and Immutable ArrayBuffer — [V8 15.6 feature-flags.h](https://chromium.googlesource.com/v8/v8/+/refs/branch-heads/15.6/src/flags/feature-flags.h). In principle these could be enabled through `--js-flags=--js-defer-import-eval` etc. (V8 flag names derived from the feature list; untested in Electron). Low value given webpack.

**Not implemented or proposed only (no flag to flip)**
- **FocusgroupV2 `grid` / `feed` / `itemcontrols`**: two-dimensional declarative focus navigation for card grids — [chromestatus 5168133036965888](https://chromestatus.com/feature/5168133036965888). Proposed, no milestone.
- **`document.advanceFocus()` and a cancelable `beforefocus`** — [chromestatus 5134711960764416](https://chromestatus.com/feature/5134711960764416). Proposed.
- **The `focusreset` event** (fired when focus resets because an element was removed) — [chromestatus 5068521917775872](https://chromestatus.com/feature/5068521917775872). Proposed.
- **Enhanced Canvas TextMetrics** (ship 159) — [chromestatus 5075532483657728](https://chromestatus.com/feature/5075532483657728).

**Already STABLE before 45, not flag-gated (correcting a likely assumption)**
- **`focusgroup` v1** (declarative arrow-key roving, a guaranteed tab stop, last-focused memory). Blink `Focusgroup` is `stable` on the 152, 155 and 156 branches, and chromestatus has its ship stage at 150 — [chromestatus 5637601087193088](https://chromestatus.com/feature/5637601087193088), [json5 @7977](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/7977/third_party/blink/renderer/platform/runtime_enabled_features.json5). The chromestatus status text still says "In developer trial", which is stale. Already in Electron 44 (sibling scope), but relevant to gamepad focus.
- **CSS `border-shape`**: Blink `CSSBorderShape` is `stable` on 152, with ship 147 — [chromestatus 5459864205393920](https://chromestatus.com/feature/5459864205393920). Highly relevant to the clip-path borders on our sci-fi panels; sibling scope.

### Inferences
- **The only flagged feature worth trialling now is `GamepadRawInputChangeEvent`.** Enable it per window via `enableBlinkFeatures`, keep the rAF polling path as the fallback, and A/B the input-to-echo latency. Caveat from our own history: on Linux we already bypass the Gamepad API with a native bridge, so the event model would only help on Windows. And because it is experimental, its event shape may change before it ships.
- **HTML-in-canvas should be tracked for 157 (ship stage 157), which lands in a later Electron**, not prototyped on 156 stable. If prototyped, use `enableBlinkFeatures: 'CanvasDrawElement'` in a dev build only.
- **Origin trials**: OT tokens are bound to web origins and served via a `<meta>`/header. Our renderer runs on a custom `app://` scheme, so OTs should be assumed unusable. The runtime-feature switch is the only practical route (inference; not tested).
- Never ship `test`-status features or `--enable-experimental-web-platform-features` in the product build: it switches on dozens of unrelated experimental behaviours.

### Gaps
- I did not verify that `enableBlinkFeatures: 'GamepadRawInputChangeEvent'` actually exposes `rawgamepadinputchange` in an Electron 45 build. Some OT-guarded features also depend on a `base::Feature` (the json5 entry shows `base_feature: "none"` for this one, which suggests the Blink switch alone suffices). Test before relying on it.
- The Interest Invokers (`interestfor`) status at 156 could not be resolved: the runtime flag `HTMLInterestForAttribute` is not present in the 156 json5 (it may have shipped and had its flag cleaned up, or been renamed). Chromestatus still shows OT/142.
- No list exists of every experimental Blink feature added between 152 and 156. This section covers the ones surfaced by chromestatus milestone lists and targeted queries (gamepad, focus, canvas, view transitions, anchor, scroll, LoAF).
