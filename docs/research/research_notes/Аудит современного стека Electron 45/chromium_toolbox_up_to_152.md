# Modern Chromium platform toolbox, Chrome 111–152 (2023 → mid-2026), for an animation-heavy Vue 3 console app in Electron

Scope note: ceiling = Chrome 152. Anything first shipping in 153–156 belongs to the other researcher and is only mentioned as "(153+ — out of scope)". Electron 45 = Chromium 156, so everything below is available in the product; the cross-browser columns matter only for the secondary "served to ordinary browsers" target.

Method: version numbers were pulled programmatically on 2026-10-22 from (a) MDN browser-compat-data **8.1.6, timestamp 2026-10-15** (`data.json` from unpkg, queried by key path) and (b) the web-features dataset through the webstatus.dev API (1,217 features). Chrome ship milestones were cross-checked against chromestatus "Ship" stages (stage 160) where BCD lagged. Links below use the format `[BCD](repo) key.path` (the key path is the exact BCD entry), `[webstatus](…/features/<id>)`, and `[chromestatus](…/feature/<id>)`. "[exp]" means BCD flags the entry `experimental: true`, which for Chrome-only features usually means "shipped in Chrome, no second engine yet". It does NOT mean "behind a flag". Real flag/origin-trial status is called out explicitly.

## Q0. Master catalogue: what shipped to stable, and when (verified versions)

### Takeaway
About 270 web-features entries first reached full Chrome support between 111 and 156. The ones that matter most for this app are a cluster from 2025–26: element-scoped view transitions (147), nested VT groups (140), match-element (137), moveBefore (133), anchor positioning (125, with transforms 144 and anchored queries 143), corner-shape (139), border-shape (147), text-fit (150), background-clip: border-area (150), focusgroup (150, per chromestatus), sibling-index (138), if() (137), @function (139), interest invokers (142), popover=hint (fully conformant only from 151). Several "headline" versions in blogs differ from the BCD "full support" version because Chrome first shipped an older spec shape. Those cases are listed.

### Cited Findings
**Version table (Chrome stable = first full support; FF / Safari stable for progressive-enhancement planning):**

| Feature | Chrome | Firefox | Safari | Source |
|---|---|---|---|---|
| Same-document View Transitions (`document.startViewTransition`) | 111 | 144 | 18 | [BCD](https://github.com/mdn/browser-compat-data) api.Document.startViewTransition |
| VT `types` option + `:active-view-transition-type()` | 125 | 147 | 18.2 | [BCD](https://github.com/mdn/browser-compat-data) api.ViewTransition.types; css.selectors.active-view-transition-type |
| `view-transition-class` | 125 | 144 | 18.2 | [webstatus](https://webstatus.dev/features/view-transition-class) |
| Cross-document VT (`@view-transition`) | 126 | – | 18.2 | [webstatus](https://webstatus.dev/features/cross-document-view-transitions) |
| `view-transition-name: match-element` (auto naming) | 137 | 144 | 18.4 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.view-transition-name.match-element |
| Nested VT groups (`view-transition-group`, `::view-transition-group-children`) | 140 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) css.properties.view-transition-group; css.selectors.view-transition-group-children |
| `document.activeViewTransition` | 142 | 147 | 26.2 | [BCD](https://github.com/mdn/browser-compat-data) api.Document.activeViewTransition |
| `ViewTransition.waitUntil()` | 144 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.ViewTransition.waitUntil |
| Element-scoped VT (`Element.startViewTransition`, `view-transition-scope`, `ViewTransition.transitionRoot`) | 147 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.Element.startViewTransition; [Chrome blog](https://developer.chrome.com/blog/element-scoped-view-transitions) |
| `Element.moveBefore()` | 133 | 144 | – | [BCD](https://github.com/mdn/browser-compat-data) api.Element.moveBefore |
| Anchor positioning core (`anchor-name`, `position-anchor`, `anchor()`, `anchor-size()`, `@position-try`, `position-try-order`, `position-visibility`) | 125 | 147 | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.anchor-name, css.types.anchor, css.at-rules.position-try |
| `position-try-fallbacks` (renamed from `position-try-options`) | 128 (125 under old name) | 147 | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.position-try-fallbacks |
| `position-area` (renamed from `inset-area`) | 129 (125 under old name) | 147 | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.position-area |
| `anchor-scope` | 131 | 147 | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.anchor-scope |
| Anchored container queries (`container-type: anchored`, `@container anchored(fallback: …)`) | 143 [exp] | – | – | [webstatus](https://webstatus.dev/features/container-anchor-position-queries) |
| Anchor positioning takes anchor's CSS transforms into account | 144 | – | 27 | [webstatus](https://webstatus.dev/features/anchor-positioning-transforms) |
| `@starting-style` | 117 | 129 | 17.5 | [BCD](https://github.com/mdn/browser-compat-data) css.at-rules.starting-style |
| `transition-behavior: allow-discrete` | 117 | 129 (partial) | 17.4 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.transition-behavior |
| `display` / `content-visibility` animation | 117 | – | 18 | [webstatus](https://webstatus.dev/features/display-animation) |
| `overlay` (top-layer exit transitions) | 117 [exp] | – | – | [webstatus](https://webstatus.dev/features/overlay) |
| `interpolate-size` / `calc-size()` (animate to `height:auto`) | 129 [exp] | – | – | [chromestatus](https://chromestatus.com/feature/5196713071738880) |
| `animation-composition` | 112 | 115 | 16 | [webstatus](https://webstatus.dev/features/animation-composition) |
| `linear()` easing | 113 | 112 | 17.2 | [BCD](https://github.com/mdn/browser-compat-data) css.types.easing-function.linear-function |
| CSS trig functions | 111 | 108 | 15.4 | [webstatus](https://webstatus.dev/features/trig-functions) |
| `@property` (registered custom props) | 85 (pre-range; Baseline 2024 via FF 128) | 128 | 16.4 | [BCD](https://github.com/mdn/browser-compat-data) css.at-rules.property |
| Individual transforms (`translate`/`scale`/`rotate`) | 104 (pre-range) | 72 | 14.1 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.translate |
| Scroll-driven animations / `ScrollTimeline` | 115 | preview | 26 | [BCD](https://github.com/mdn/browser-compat-data) api.ScrollTimeline |
| `timeline-scope` | 116 | preview | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.timeline-scope |
| Scroll-triggered animations (`animation-trigger`) | 146 [exp] | – | – | [webstatus](https://webstatus.dev/features/scroll-triggered-animations) |
| `Animation.overallProgress` | 133 | 142 | 26.2 | [BCD](https://github.com/mdn/browser-compat-data) api.Animation.overallProgress |
| `AnimationEvent/TransitionEvent.animation` accessor | 151 | 152 | 27 | [webstatus](https://webstatus.dev/features/animations-css-animation-accessors) |
| `if()` | 137 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) css.types.if |
| `sibling-index()` / `sibling-count()` | 138 | 154 | 26.2 | [BCD](https://github.com/mdn/browser-compat-data) css.types.sibling-index |
| Typed `attr()` (`attr(x type(<length>))`, any property) | 133 | 155 | preview | [BCD](https://github.com/mdn/browser-compat-data) css.types.attr.type_function |
| `@function` (CSS custom functions) | 139 [exp] | – | preview | [BCD](https://github.com/mdn/browser-compat-data) css.at-rules.function |
| `corner-shape` (+ `superellipse()`) | 139 [exp] | preview | preview | [BCD](https://github.com/mdn/browser-compat-data) css.properties.corner-shape |
| `border-shape` | 147 [exp] | – | – | [webstatus](https://webstatus.dev/features/border-shape) |
| `shape()` | 135 | 148 | 18.4 | [BCD](https://github.com/mdn/browser-compat-data) css.types.basic-shape.shape |
| `text-box` / `text-box-trim` / `text-box-edge` | 133 | 154 | 18.2 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.text-box |
| `text-wrap: balance` / `pretty` | 114 / 117 | 121 / – | 17.5 / 26 | [webstatus](https://webstatus.dev/features/text-wrap-balance) |
| `text-fit` (scale font to fit inline size) | 150 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) css.properties.text-fit; [chromestatus](https://chromestatus.com/feature/5104141688635392) |
| `field-sizing` | 123 | 152 | 26.2 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.field-sizing |
| `light-dark()` | 123 | 120 | 17.5 | [BCD](https://github.com/mdn/browser-compat-data) css.types.color.light-dark |
| `color-mix()` | 111 | 113 | 16.2 | [BCD](https://github.com/mdn/browser-compat-data) css.types.color.color-mix |
| Relative color syntax | 119 (partial) → 122 (rgb/oklch) → 125 (hsl/hwb) | 128 | 18 | [BCD](https://github.com/mdn/browser-compat-data) css.types.color.*.relative_syntax |
| `contrast-color()` | 147 | 146 | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.types.color.contrast-color |
| `alpha()` | 152 | 155 | 27 | [webstatus](https://webstatus.dev/features/alpha) |
| `background-clip: border-area` (gradient borders) | 150 | – | 18.2 | [webstatus](https://webstatus.dev/features/background-clip-border-area) |
| Gap decorations (`column-rule`/`row-rule` on grid/flex, `rule-break`, insets) | 149 [exp] | – | – | [webstatus](https://webstatus.dev/features/gap-decorations) |
| `flex-wrap: balance` | 150 | – | – | [webstatus](https://webstatus.dev/features/flexbox-flex-wrap-balance) |
| `round()`/`mod()`/`rem()` | 125 | 118 | 17.2 | [webstatus](https://webstatus.dev/features/round-mod-rem) |
| `abs()`/`sign()`, `progress()`, `stretch` | 138 | 118 / 155 / – | 15.4 / 26 / 27 | [webstatus](https://webstatus.dev/features/progress-function) |
| `:has()` | 105 (pre-range) | 121 | 15.4 | [BCD](https://github.com/mdn/browser-compat-data) css.selectors.has |
| `@scope` | 118 (the `&` inside @scope arrived in 143) | 146 | 26.4 | [BCD](https://github.com/mdn/browser-compat-data) css.at-rules.scope; css.selectors.nesting.at-scope |
| CSS nesting | 112 (partial) → 120 (relaxed) | 117 | 17.2 | [BCD](https://github.com/mdn/browser-compat-data) css.selectors.nesting |
| `@layer` | 99 (pre-range) | 97 | 15.4 | [webstatus](https://webstatus.dev/features/cascade-layers) |
| Container size queries / style queries (custom props) / style-query range syntax | 105 / 111 / 142 | 110 / 151 / 151 | 16 / 18 / – | [BCD](https://github.com/mdn/browser-compat-data) css.at-rules.container.style_queries_for_custom_properties |
| Scroll-state container queries | 133 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) css.at-rules.container.scroll-state_queries |
| Name-only container queries | 148 | 149 | 26.4 | [webstatus](https://webstatus.dev/features/container-name-queries) |
| `reading-flow` / `reading-order` | 137 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) css.properties.reading-flow |
| Popover API | 114 (web-features says 116) | 125 | 17 | [BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.popover |
| `popover="hint"` | 133 partial (old spec) → **151 full** | 153 | preview | [BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.popover.hint |
| Invoker commands (`commandfor`/`command`, `CommandEvent`) | 135 (`request-close` 139) | 144 | 26.2 | [BCD](https://github.com/mdn/browser-compat-data) html.elements.button.commandfor |
| `<dialog closedby>`, `dialog.requestClose()` | 134 | 141 | preview / 18.4 | [BCD](https://github.com/mdn/browser-compat-data) html.elements.dialog.closedby |
| `CloseWatcher` | 126 | 149 | preview | [BCD](https://github.com/mdn/browser-compat-data) api.CloseWatcher |
| Interest invokers (`interestfor`, `:interest-source/target`) | 142 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) html.elements.button.interestfor |
| `ToggleEvent.source` | 140 | 145 | 26.5 | [BCD](https://github.com/mdn/browser-compat-data) api.ToggleEvent.source |
| Customizable `<select>` (`appearance: base-select`) | 135 | flag | 27 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.appearance.base-select |
| `focusgroup` attribute | **150** (ship stage; OT 146–149). BCD/web-features have not recorded it yet | – | – | [chromestatus](https://chromestatus.com/feature/5637601087193088); [New in Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150) |
| `interactivity: inert` (CSS inert) | 135 [exp] | – | – | [webstatus](https://webstatus.dev/features/interactivity) |
| `focus({focusVisible})` | 145 | 104 | 18.4 | [BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.focus.options_focusVisible_parameter |
| `scrollIntoView({container})` / scroll method promises | 140 / 150 | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.Element.scrollIntoView.options_parameter.container_option; [webstatus](https://webstatus.dev/features/scroll-promises) |
| `ariaNotify()` | 141 | 150 | 27 | [BCD](https://github.com/mdn/browser-compat-data) api.Document.ariaNotify |
| Navigation API | 102 (pre-range; now cross-browser) | 147 | 26.2 | [BCD](https://github.com/mdn/browser-compat-data) api.Navigation |
| `scheduler.yield()` | 129 | 142 | – | [BCD](https://github.com/mdn/browser-compat-data) api.Scheduler.yield |
| `scheduler.postTask` / `TaskController` | 94 (pre-range) | 142 | – | [BCD](https://github.com/mdn/browser-compat-data) api.Scheduler.postTask |
| Long Animation Frames (LoAF) + `PerformanceScriptTiming` | 123 | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.PerformanceLongAnimationFrameTiming |
| `content-visibility` (85) + `contentvisibilityautostatechange` | 108 | 130 | 26 | [webstatus](https://webstatus.dev/features/content-visibility); [BCD](https://github.com/mdn/browser-compat-data) api.ContentVisibilityAutoStateChangeEvent |
| `contain-intrinsic-size: auto` | 117 | 117 | 17 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.contain-intrinsic-size.auto_none |
| Compute Pressure (`PressureObserver`) | 125 | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.PressureObserver |
| `blocking="render"` | 105 (pre-range) | – | 18.2 | [webstatus](https://webstatus.dev/features/blocking-render) |
| WebGPU | 113 Win/macOS/ChromeOS; **144 adds Linux, Intel Gen12+ GPUs only** | – (partial 141) | 26 | [BCD](https://github.com/mdn/browser-compat-data) api.GPU.requestAdapter (notes) |
| WebGPU compatibility mode (`featureLevel`) | 146, partial: **Android only** | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.GPU.requestAdapter.options_featureLevel |
| `dynamic-range-limit` (HDR headroom) | 136 | – | 26 | [BCD](https://github.com/mdn/browser-compat-data) css.properties.dynamic-range-limit |
| `color()` / display-p3, Oklab/OkLCh | 111 | 113 | 15 / 15.4 | [webstatus](https://webstatus.dev/features/color-function) |
| Gamepad `vibrationActuator.playEffect('dual-rumble')` | 68 (pre-range) | – | 16.4 | [BCD](https://github.com/mdn/browser-compat-data) api.GamepadHapticActuator.playEffect |
| Gamepad `trigger-rumble` + `effects` attribute | 126 (enabled by default) | – | – | [chromestatus](https://chromestatus.com/feature/5162940951953408); [BCD](https://github.com/mdn/browser-compat-data) api.GamepadHapticActuator.playEffect.type_trigger-rumble |
| WebHID | 89 (pre-range) | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.HID |
| `CSSPseudoElement` / `Element.pseudo()` (VT pseudos addressable from 152) | 149 / 152 [exp] | – | – | [BCD](https://github.com/mdn/browser-compat-data) api.Element.pseudo |

**Out of scope (153+), listed only so they are not double-counted:** `random()` Chrome 156; JPEG XL 155; text import attributes 155; `Iterator.prototype.join` / `Iterator.zip` 153; `Iterator.includes` and responsive iframes 154 ([webstatus](https://webstatus.dev/features/jpegxl); [BCD](https://github.com/mdn/browser-compat-data) css.types.random).

**Version discrepancies to know about:**
- `popover="hint"`: Chrome 133–150 "implements an older version of the specification with inconsistent behaviors" (crbug 499019927). Full support starts in 151 ([BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.popover.hint).
- `position-anchor` initial value changed three times: `implicit` (125–126), then `auto` (127–143), then `none` (144–150), then spec `normal` (151+) ([BCD](https://github.com/mdn/browser-compat-data) css.properties.position-anchor, notes).
- web-features marks overall "anchor-positioning" as not fully supported in Chrome (its support map lists only Safari 27), because sub-features such as `position-visibility: anchors-valid` are still "preview" in Chrome ([webstatus](https://webstatus.dev/features/anchor-positioning); [BCD](https://github.com/mdn/browser-compat-data) css.properties.position-visibility).
- A WebFetch summary of [Chrome's "view transitions in 2025" post](https://developer.chrome.com/blog/view-transitions-in-2025) said view-transition-class shipped in 137. BCD and webstatus both say 125, so 125 is used here.
- Chromestatus "status" text is stale for some newer entries: text-fit shows "Proposed", but its ship stage is 150 and BCD records 150 ([chromestatus](https://chromestatus.com/feature/5104141688635392)).

### Inferences
- Electron 45 (Chromium 156) is above every ceiling here, so the product can use all of these with no polyfill. The constraint is the secondary browser target. Chrome-only items (element-scoped VT, nested VT groups, corner-shape, border-shape, text-fit, if(), @function, interest invokers, gap decorations, interpolate-size, reading-flow, focusgroup) need `@supports` or JS feature detection plus the existing implementation as the fallback.

### Gaps
- BCD has no entry yet for `focusgroup`. Its shipped status rests on chromestatus's ship stage (150) and the Chrome 150 blog. chromestatus's top-level status still says "In developer trial (Behind a flag)", so it should be feature-detected rather than assumed.

## Q1. View Transitions: can they replace our JS FLIP and crossfades?

### Takeaway
Partly. Element-scoped view transitions (Chrome 147) are the first variant that fits a "workspace = one flow" UI. They run on one subtree, run concurrently and nest, keep the rest of the page interactive, and respect the scope root's clipping. That makes them a strong candidate for the breadcrumb stage crossfade and for "same element moves to a new slot" morphs. They are not a drop-in replacement for GSAP-driven, multi-beat phrases (COMMIT→RELEASE→UNFOLD→REVEAL), for flights to measured or moving targets, or for anything that has to stay interactive or hit-testable mid-animation, because the old state is a static image.

### Cited Findings
- Element-scoped VT is "a feature that lets you start a view transition on a subtree of the DOM by calling `Element.startViewTransition()`". It "enables multiple view transitions to run simultaneously, lets you nest ongoing view transitions, and resolves layering issues with `position: fixed` content—all while keeping the rest of the page interactive." It went to developer testing in 140 and stable in 147 ([Chrome blog](https://developer.chrome.com/blog/element-scoped-view-transitions)).
- Scope-root rules: "Scope roots are self-participating by default"; scoped transitions "automatically contain their nested pseudos by using nested view transition groups"; `::view-transition-group-children()` "automatically clips its contents if the scope root clips its overflow"; and the browser "automatically appl[ies] `contain: layout` and `view-transition-scope: all` onto the scope root during the transition" ([Chrome blog](https://developer.chrome.com/blog/element-scoped-view-transitions)).
- MDN summarises the element-scoped advantages: concurrent transitions, only the scope becomes non-interactive, the pseudo tree sits only over the element, and overflow clipping is respected ([MDN Element.startViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/Element/startViewTransition)). MDN still marks the API experimental and not Baseline ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/startViewTransition)).
- Snapshot semantics: the old snapshot is a static image, so "the user can't interact with it as it animates 'out'". The new snapshot is "an interactive DOM region" ([MDN Using the View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)).
- Uniqueness: if two rendered elements share a `view-transition-name`, "`ViewTransition.ready` will reject and the transition will be skipped". A transition started while the document is hidden is skipped entirely ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)).
- Rendering is paused during the update callback, and the `updateCallbackDone` promise fulfils after it ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)).
- Default motion is a cross-fade for appearance changes and smooth scaling/movement for size and position changes. Custom JS animation goes through `document.documentElement.animate(…, { pseudoElement: '::view-transition-new(root)' })` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)). The `pseudoElement` option has existed since Chrome 84 ([BCD](https://github.com/mdn/browser-compat-data) api.Element.animate.options_pseudoElement_parameter).
- Chrome 140 nested VT groups use `view-transition-group: nearest` on children to "retain 3D and clipping effects during the transition" ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Also in 140, VT pseudo-elements inherit animation-duration, -delay, -timing-function and related properties, and the `finished` promise was moved to run "asynchronously after lifecycle completion" to prevent flicker (WebFetch summary of [Chrome VT 2025 post](https://developer.chrome.com/blog/view-transitions-in-2025)).
- `match-element` "auto-generates unique names for elements based on identity" (WebFetch summary of [Chrome VT 2025 post](https://developer.chrome.com/blog/view-transitions-in-2025)); shipped in 137 ([BCD](https://github.com/mdn/browser-compat-data) css.properties.view-transition-name.match-element).
- `view-transition-class` (125) styles many groups with shared animation properties. `types` plus `:active-view-transition-type()` (125) let one stylesheet branch on the kind of transition ([BCD](https://github.com/mdn/browser-compat-data) api.ViewTransition.types; css.selectors.active-view-transition-type).
- `ViewTransition.waitUntil()` (Chrome 144, experimental) keeps a transition from finishing until a promise resolves ([BCD](https://github.com/mdn/browser-compat-data) api.ViewTransition.waitUntil).
- From Chrome 152 (experimental), `Element.pseudo()` accepts the VT pseudo types, which gives a `CSSPseudoElement` handle on `::view-transition-group` and related pseudos ([BCD](https://github.com/mdn/browser-compat-data) api.Element.pseudo.type_parameter.view-transition-group_pseudo).
- Snapshot memory: the CSSWG accepted that for very large elements UAs may clip the snapshot to "at least the intersection of the element's ink overflow rectangle and the visible viewport", and may limit rasterization while sizing as if fully rasterized ([CSSWG minutes 2023-03-15](https://lists.w3.org/Archives/Public/www-style/2023Mar/0009.html), via search summary). A secondary blog heuristic says each named element holds a raster snapshot pair in GPU memory, that fewer than five is safe, and that 20+ drops frames on low-end mobile ([pravinkumar.co](https://www.pravinkumar.co/blog/view-transitions-api-webflow-spa-navigation-tutorial-2026-fa861)). This is a non-primary source with no measurement methodology.
- In document-scoped VTs the `::view-transition` overlay "obstructs click interactions"; setting `pointer-events: none` on it keeps the document clickable ([DebugBear](https://www.debugbear.com/blog/view-transitions-spa-without-framework), via search summary).
- TypeScript 6.0.3's `lib.dom.d.ts` types `Document.startViewTransition(callbackOptions?: ViewTransitionUpdateCallback | StartViewTransitionOptions)` and `document.activeViewTransition`. It has no `Element.startViewTransition`, `waitUntil` or `transitionRoot` (local inspection of `node_modules/typescript/lib/lib.dom.d.ts` in this repo).
- Vue core has no view-transition integration: a GitHub search of vuejs/core for "startViewTransition" returned 0 issues or PRs (GitHub API search, 2026-10-22).

### Inferences
- **Breadcrumb stage crossfade (best fit).** An element-scoped VT whose scope root is the crumb's stage cell would give the "only the stage segment animates" crossfade without keeping two DOM nodes in a shared grid cell. Concurrency means it can run alongside a stage unfold in the band.
- **"Same instance moved by Teleport into a slot".** Give the moving element `view-transition-name: match-element` (or a fixed name) and start the transition on the workspace band. The browser then morphs the element from its old rect to its new one. That is FLIP without measuring code. Two caveats:
  - The old state is a bitmap. A large size change scales the old raster and the new live image. Use `object-fit`/`height:100%` overrides on the old/new pseudos to avoid stretched text.
  - The UA builds one before/after pair per transition. A four-beat phrase therefore needs chained transitions, or one transition with several named parts on staggered keyframes.
- **Vue timing.** Vue patches the DOM asynchronously, so the update callback must `await nextTick()` before resolving. Otherwise the "new" capture happens before Vue patches and the transition shows no change.
- **Motion system.** VT keyframes are ordinary CSS animations on pseudo-elements. Durations can use `calc(<base>ms * var(--motion-scale, 1))`, and since 140 the timing properties inherit down the pseudo tree. Gate the transition in `prefers-reduced-motion` (skip it, or set durations near 0).
- **GSAP interplay.** GSAP targets elements and objects, not pseudo-elements. Animating VT pseudos from JS means WAAPI `animate({pseudoElement})`, or in 152+ the experimental `Element.pseudo()`, with `MOTION_EASE` mirrored as `linear()` strings. Keep GSAP for flights whose destination is re-measured mid-flight (the "live ends" rule) and for anything that must stay hit-testable.
- **`contain: layout` on the scope root.** It is applied automatically during an element-scoped VT, and layout containment makes an element the containing block for fixed-position descendants. Any `position: fixed` layer inside the band (Teleported overlays, hint layers) could therefore re-anchor to the band for the transition's duration. Test this before adopting.
- **Input during document-scoped VTs.** Keyboard and gamepad handlers keep running while the overlay blocks only pointer hits, so the existing "none" B-verb gate (input absorbed during a beat) is still needed.
- **Performance on 4K.** Each snapshot is a texture at device resolution. Element-scoped transitions over a band are cheaper than document-scoped ones. Measure on the real GPU: per the project's notes, e2e under SwiftShader misreports perf.
- **Browser fallback.** In browsers without element-scoped VT, an unguarded `startViewTransition` call is just a synchronous update, i.e. a blink. Keep the current JS crossfade path as the fallback, which matches the "never a v-if blink" rule.

### Gaps
- No primary benchmark of VT cost at 3840×2160 (GPU memory per snapshot pair, capture time) was found.
- I did not verify whether a VT group keeps tracking its new element when that element moves mid-animation (e.g. a moving hand dock). My reading of the spec's per-frame "update pseudo-element styles" step suggests it does, but this needs a test.
- I did not confirm whether the Chrome 147 element-scoped implementation keeps the scope's old snapshot non-interactive only within the scope (MDN implies yes), or how focus behaves on elements inside the scope during the transition.

## Q2. Element.moveBefore(): state-preserving moves, and does Vue use it?

### Takeaway
`moveBefore()` shipped in Chrome 133 (Firefox 144; not in Safari). It moves a node atomically, preserving CSS animation and transition state, `:focus`/`:active`, iframe loading state, open popovers and modal dialogs. Vue 3.5 does not use it: Teleport moves still go through `insertBefore`. A PR to use it in Teleport (#14345) has been open since January 2026 and is labelled for a minor release. For a design built on moving the same instance via Teleport, this is the most directly relevant DOM primitive in the window.

### Cited Findings
- moveBefore shipped in Chrome 133 (released 4 Feb 2025), earlier behind `chrome://flags/#atomic-move`. It "takes the same arguments as `insertBefore()`" but performs an atomic move ([Chrome blog](https://developer.chrome.com/blog/movebefore-api)).
- Preserved: "Animation and transition state", "`<iframe>` loading state", "Interactivity states (for example, `:focus` and `:active`)", "Fullscreen element state", "Open/close state of popovers", "Modal state of `<dialog>` elements". Video/audio play state is not on the list because those "retain their state when removed and reinserted, regardless" ([MDN Element.moveBefore](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)).
- It throws `HierarchyRequestError` in four cases ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)):
  - the node is moved between connected and disconnected trees ("is not part of the DOM, and you are trying to move it inside a node that is part of the DOM, or vice versa");
  - the node is an ancestor of the target;
  - the move crosses documents;
  - the node is not an Element or CharacterData.
- Custom elements get `connectedMoveCallback()` instead of disconnected/connected. MutationObserver still records the move as a removed node plus an added node ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)).
- Support: Chrome 133, Firefox 144, no Safari ([BCD](https://github.com/mdn/browser-compat-data) api.Element.moveBefore; [webstatus](https://webstatus.dev/features/move-before)).
- Vue's `nodeOps.insert` is `parent.insertBefore(child, anchor || null)` ([vuejs/core nodeOps.ts](https://github.com/vuejs/vue-next/blob/master/packages/runtime-dom/src/nodeOps.ts), via search summary).
- vuejs/core PR **#14345 "feat(teleport): use moveBefore to preserve node state when possible"** was opened 2026-01-21 and was still **open** on 2026-10-22, with labels `scope: teleport`, `version: minor`. Its tests cover video playback across Teleport moves. A May 2026 reviewer comment flags an untested case: `to` bound to a ref of a component that gets destroyed ([GitHub API, vuejs/core#14345](https://github.com/vuejs/core/pull/14345)).
- vuejs/core issue **#13188** (open): v-for items "lose all their ongoing transitions when move up". A Vue team member pointed to `moveBefore` as a possible progressive enhancement that would maintain "Focus; Animation and transition states; Video playback state" ([vuejs/core#13188](https://github.com/vuejs/core/issues/13188)).
- TS 6.0.3 `lib.dom.d.ts` already types `moveBefore` (local inspection).

### Inferences
- With the stock Vue 3.5 Teleport, the component instance survives a slot change but the DOM nodes are removed and re-inserted. Any CSS `@keyframes` or transition running in the subtree restarts or snaps, and the focused element loses `:focus`. That matters if gamepad focus is real DOM focus. GSAP tweens survive, since GSAP writes inline styles from JS, which is consistent with the project's GSAP-heavy motion.
- Options, cheapest first:
  1. Wait for #14345.
  2. Build the app with `createRenderer({...nodeOps, insert})` and an `insert` that calls `parent.moveBefore(child, anchor ?? null)` when `child.isConnected && parent.isConnected && 'moveBefore' in parent`, falling back to `insertBefore` otherwise. A fallback is mandatory: first mounts move a disconnected node, which throws.
  3. Patch only the Teleport move path.
- Any MutationObserver in the codebase that treats a removed node as "unmounted" will still see remove+add under moveBefore.
- Reorders in keyed `v-for` (hand cards, rails) would also stop losing transitions once Vue adopts it (issue #13188).

### Gaps
- No Vue maintainer statement on whether `moveBefore` will become the default in `nodeOps.insert` (beyond Teleport) was found. PR #14345's target release is unknown.
- Whether `moveBefore` preserves the state of a running WAAPI `Animation` object (as opposed to CSS animations) is not stated explicitly. MDN's "Animation and transition state" probably covers it, but this is unverified.

## Q3. CSS anchor positioning for tooltips, popovers and "fly to target"

### Takeaway
Anchor positioning (Chrome 125) is now cross-engine (Firefox 147, Safari 26). In the window it gained the pieces that make it practical for this app: `position-try-fallbacks` (128), `position-area` (129), `anchor-scope` (131), anchored container queries for flipping arrows (143), and, crucially for a zoomed or transformed board, awareness of the anchor's transforms (144). It can replace JS tooltip placement entirely. For "fly to a live target" it is promising but unproven: `anchor()` values are animatable, and positioned elements follow a moving anchor automatically.

### Cited Findings
- The positioned element "needs to be absolutely or fixed positioned" ([MDN Using anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using)).
- If the anchor is hidden (e.g. `display: none`), "the positioned element will be positioned relative to its nearest positioned ancestor" ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using)).
- With duplicate `anchor-name`s, the positioned element binds to "the _last_ anchor element in the source order". `anchor-scope` limits binding to a subtree ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using)).
- Implicit anchors come from `popovertarget`/`commandfor` and customizable select. Those cannot be removed via `anchor-name`; use `position-anchor: none` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using)). In Chrome, implicit anchor references for popovertarget, showPopover's `source` and commandfor arrived in 133–135 ([BCD](https://github.com/mdn/browser-compat-data) api.HTMLButtonElement.commandForElement.implicit_anchor_reference).
- The position "needs to be maintained and adjusted as the anchor element moves or otherwise changes configuration", and the browser does this automatically ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using)).
- `anchor()` and `anchor-size()` "animate or transition on changes such as the anchor box moving or the anchor element changing" (Chrome 125) ([webstatus](https://webstatus.dev/features/anchor-positioning-animations)).
- "Anchor positioned elements take CSS transforms on their anchor elements into account" (Chrome 144, Safari 27) ([webstatus](https://webstatus.dev/features/anchor-positioning-transforms)).
- Anchored container queries: "`@container anchored(fallback: …)` … apply styles to an element based on the element's anchor position" (Chrome 143) ([webstatus](https://webstatus.dev/features/container-anchor-position-queries)). CSS Wrapped describes this as fixing tooltip-arrow placement with fallback awareness ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)).
- `position-visibility: anchors-visible` and `no-overflow` are in Chrome 125. `anchors-valid` and the newer `anchor-valid`/`anchor-visible` spellings are still "preview" in Chrome ([BCD](https://github.com/mdn/browser-compat-data) css.properties.position-visibility).
- `position-try-fallbacks` supports `flip-block`, `flip-inline` and `flip-start` (128), plus `flip-x`/`flip-y` (144) ([BCD](https://github.com/mdn/browser-compat-data) css.properties.position-try-fallbacks).

### Inferences
- **`.premium-tooltip` + `data-hint`.** Rebuild it as `popover="hint"` (fully conformant from 151) plus anchor positioning with `position-try-fallbacks: flip-block, flip-inline`, and an anchored container query to flip the arrow. The top layer escapes every stacking context and `overflow: clip` ancestor, which removes the recurring "fixed layer is a stacking context" and "con-main stacking trap" class of bugs. The browser does the measuring, with no rAF loop.
- **Repeated components** (every card face, every rail row) need `anchor-scope: --hint` (or `all`) on the component root. Otherwise the last card in the DOM wins the anchor name.
- **Board hints.** Anchors inside a scaled or zoomed board only position correctly from 144 (transform awareness). Electron at 156 is fine; older browsers would misplace hints on a transformed board.
- **"Fly to a live target" experiment.** Make the flight token `position: fixed`, with `position-anchor` switched from the source anchor to the destination anchor and a transition on `left`/`top` computed by `anchor()`. The browser then tracks the destination box. This would satisfy the "token never flies to a coordinate where the object isn't" direction natively. Unknown: whether an in-flight transition retargets smoothly when the destination moves (see Gaps). GSAP should stay the default until this is measured.
- **Vue Teleport compatibility.** A Teleported tooltip appended at the end of `<body>` is a good fit, since the positioned element should come after its anchor and be absolutely or fixed positioned. The tooltip should still be rendered (not `display:none`) for its transitions; use `@starting-style` with `overlay` + `allow-discrete` for entry and exit.

### Gaps
- No source confirms how an in-progress CSS transition on `anchor()`-derived insets behaves when the anchor keeps moving (retarget vs restart vs jump).
- "Acceptable anchor element" rules (tree order and containing-block constraints) were not fetched in full. Only the visibility and duplicate-name rules are cited.
- Anchor positioning for pseudo-elements (e.g. an anchored `::after` tooltip) was not verified.

## Q4. Entry/exit and intrinsic-size animation: @starting-style, allow-discrete, interpolate-size / calc-size, overlay

### Takeaway
All of these shipped in Chrome 117–129. They allow entry transitions on first render, display:none↔block and top-layer exit animations, and animating to `height: auto` in pure CSS. They suit the UNFOLD and REVEAL beats of embedded stages, but they do not replace Vue `<Transition>` for `v-if` exits: the node is gone immediately.

### Cited Findings
- `@starting-style` shipped in Chrome 117 (Firefox 129, Safari 17.5) ([BCD](https://github.com/mdn/browser-compat-data) css.at-rules.starting-style). CSS Wrapped 2024 notes it needs `transition-behavior: allow-discrete` for discretely animatable properties ([CSS Wrapped 2024](https://chrome.dev/css-wrapped-2024/)).
- `transition-behavior` 117; Firefox 129 is partial ([BCD](https://github.com/mdn/browser-compat-data) css.properties.transition-behavior).
- display animation: "You can animate elements between display: none and any other display value or animate between content-visibility: hidden and any other content-visibility value" (Chrome 117, Safari 18) ([webstatus](https://webstatus.dev/features/display-animation)).
- `overlay` "prevents a top layer element, such as a popover or a `<dialog>`, from being removed from the top layer before it has finished animating"; it is Chrome-only, from 117 ([webstatus](https://webstatus.dev/features/overlay)).
- `interpolate-size` and `calc-size()`: "allows a page to opt in to animations and transitions of CSS intrinsic sizing keywords such as auto, min-content, fit-content"; enabled by default in 129 ([chromestatus](https://chromestatus.com/feature/5196713071738880)). The opt-in is `interpolate-size: allow-keywords` on `:root` ([CSS Wrapped 2024](https://chrome.dev/css-wrapped-2024/)). Chrome-only ([BCD](https://github.com/mdn/browser-compat-data) css.properties.interpolate-size).
- `::details-content` (131) allows styled and animated `<details>` ([CSS Wrapped 2024](https://chrome.dev/css-wrapped-2024/)).

### Inferences
- **UNFOLD of a step zone.** `interpolate-size: allow-keywords` plus a `height` transition on the zone's grid row (or `grid-template-rows: 0fr → 1fr`, which works everywhere) replaces JS measure-then-tween. However, "UNFOLD from the rect the old one occupied" is a FLIP, so it belongs to view transitions or GSAP.
- **`v-show` surfaces** (collapse ≠ close). Pair `display` transitions with `allow-discrete` and `@starting-style` to fade or slide in and out without Vue `<Transition>` hooks.
- **`v-if` surfaces.** `@starting-style` handles entry only. Exit still needs `<Transition>` (or a deferred unmount).
- **Top-layer hint popovers.** Use `overlay` + `display` in `transition` with `allow-discrete` so they fade out instead of vanishing.

### Gaps
- No performance data on `calc-size()` transitions (each frame re-runs layout of the animated subtree) at 4K.

## Q5. Animation primitives: linear(), animation-composition, @property, trig, individual transforms, WAAPI, scroll-driven (N/A)

### Takeaway
`linear()` (113) brings arbitrary spring and bounce curves to CSS. `@property` became cross-browser in 2024 and enables animated gradients and conic borders. `animation-composition` (112) allows additive layering. Individual transforms compose with GSAP's `transform`. Scroll-driven and scroll-triggered animations have almost no use in a no-scroll UI.

### Cited Findings
- `linear()` easing: Chrome 113, Firefox 112, Safari 17.2. Baseline "widely available" ([webstatus](https://webstatus.dev/features/linear-easing)).
- `animation-composition`: Chrome 112, Firefox 115, Safari 16. Widely available ([webstatus](https://webstatus.dev/features/animation-composition)).
- `@property` "Registers custom properties with type, inheritance behavior, and initial values … Enables interpolation in transitions and animations; cross-browser support achieved in 2024" ([CSS Wrapped 2024](https://chrome.dev/css-wrapped-2024/)). Chrome 85, Firefox 128, Safari 16.4 ([BCD](https://github.com/mdn/browser-compat-data) css.at-rules.property).
- CSS trig functions 111; `round()`/`mod()`/`rem()` 125; `abs()`/`sign()` 138 ([webstatus](https://webstatus.dev/features/trig-functions); [webstatus](https://webstatus.dev/features/round-mod-rem); [webstatus](https://webstatus.dev/features/abs-sign)).
- Individual transform properties: Chrome 104, widely available ([webstatus](https://webstatus.dev/features/individual-transforms)).
- WAAPI: `commitStyles` and `finished` since 84; `overallProgress` 133; `AnimationEvent.animation` accessor 151 ([BCD](https://github.com/mdn/browser-compat-data) api.Animation.overallProgress; [webstatus](https://webstatus.dev/features/animations-css-animation-accessors)).
- Scroll-driven animations 115 and `timeline-scope` 116; scroll-triggered animations (`animation-trigger`) 146, Chrome-only ([webstatus](https://webstatus.dev/features/scroll-driven-animations); [webstatus](https://webstatus.dev/features/scroll-triggered-animations)).

### Inferences
- Generate `linear(...)` strings from the same spring parameters behind `MOTION_EASE`, exported from `motionTokens`. CSS, WAAPI and VT keyframes then share the one easing source with JS/GSAP. This is the cleanest way to keep "one motion system" once CSS-native transitions (VT, `@starting-style`) enter the mix.
- Register `@property --glow-angle { syntax: '<angle>' }` to animate conic-gradient sci-fi borders on the compositor-friendly custom-property path instead of rotating pseudo-elements in JS.
- GSAP writes `transform`. CSS `translate`/`scale`/`rotate` are separate properties applied before `transform`. A CSS hover lift (`translate`) and a GSAP flight (`x`/`y`) can therefore coexist without clobbering each other. `animation-composition: add` covers the same need for pure-CSS layers.
- Scroll timelines are not applicable (no scrolling). The only conceivable use is a `ScrollTimeline` over a programmatically scrolled internal container, which this UI avoids.

### Gaps
- No primary data comparing `@property`-animated gradients and GSAP-animated equivalents for paint cost at 4K.

## Q6. New CSS values and functions: corner-shape, border-shape, text-fit, sibling-index, if(), @function, typed attr(), text-box, gap decorations, colors, @scope, queries

### Takeaway
Four have direct product value:
- **`corner-shape` (139)** and **`border-shape` (147)** give sci-fi bevelled, notched and squircle panels whose borders, shadows, outlines and backdrop-filter follow the shape, which clip-path cannot do.
- **`background-clip: border-area` (150)** gives true gradient borders.
- **`text-fit` (150)** gives CSS-native fit-to-width for long Russian strings.
- **`sibling-index()` (138)** gives stagger without JS indices.

All but sibling-index, shape(), text-box, contrast-color and color-mix are Chrome-only, so they need `@supports` fallbacks for browsers.

### Cited Findings
- `corner-shape` "pairs with border-radius: the radius sets the corner size, corner-shape sets the geometry" and "has no visible effect unless a non-zero border-radius is also set". Values are round, bevel, scoop, notch, square, squircle and `superellipse()` ([savvy.co.il](https://savvy.co.il/en/blog/css/css-corner-shape/), via search summary). "Some styles follow the corner shape, such as border, outline, box-shadow, overflow, and backdrop-filter" ([ics.media](https://ics.media/en/entry/260226/), via search summary). Corner styles are animatable between each other ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome/Edge 139; Firefox and Safari preview only ([BCD](https://github.com/mdn/browser-compat-data) css.properties.corner-shape). Dave Rupert wrote it up as "sci-fi rectangles" ([daverupert.com](https://daverupert.com/2025/07/sci-fi-rectangles-with-corner-shape/), title only).
- `border-shape` "enables creating non-rectangular borders, with any arbitrary shape (polygon, circle, shape(), etc)… border-shape defines the shape of the border, decorates it, and clips only the inside" ([chromestatus](https://chromestatus.com/feature/5459864205393920)). It "sets the geometry of the border box, changing the shape of any applicable border, border image, focus outline, or shadow" (Chrome 147) ([webstatus](https://webstatus.dev/features/border-shape)).
- `background-clip: border-area` "clips an element's background to the area painted by its border strokes… Enables gradient borders directly in CSS without needing border-image workarounds" ([New in Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150)). Chrome 150, Safari 18.2 ([webstatus](https://webstatus.dev/features/background-clip-border-area)).
- `text-fit` "scales the font size of text nodes to perfectly fit the width of its containing box" ([New in Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150)). Syntax is `none | grow | shrink`, optionally `consistent`, `per-line` or `per-line-all`, plus a percentage limit ([MDN text-fit](https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/text-fit), via search summary). Chrome 150 only ([BCD](https://github.com/mdn/browser-compat-data) css.properties.text-fit). Chromestatus motivation: authors otherwise "manually adjust the font size through trial and error or using JavaScript" ([chromestatus](https://chromestatus.com/feature/5104141688635392)).
- `sibling-index()`/`sibling-count()` "enables staggered animations without hardcoded values" ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome 138, Firefox 154, Safari 26.2 ([BCD](https://github.com/mdn/browser-compat-data) css.types.sibling-index).
- `if()` works with `media()`, `supports()` and `style()` conditions ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome 137 only. Range syntax inside style queries and if() arrived in 142 ([BCD](https://github.com/mdn/browser-compat-data) css.types.if; css.at-rules.container.style_queries_for_custom_properties.range_syntax).
- `@function --name(args) { result: … }` supports default arguments ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome 139; Safari preview ([BCD](https://github.com/mdn/browser-compat-data) css.at-rules.function).
- Typed `attr()` "parses attribute values into typed data: colors, lengths, custom identifiers" and works in any property ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome 133; Firefox 155 (out of window) ([BCD](https://github.com/mdn/browser-compat-data) css.types.attr.type_function).
- `text-box: trim-both cap alphabetic` gives optical vertical centering from font metrics ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome 133, Safari 18.2, Firefox 154 ([BCD](https://github.com/mdn/browser-compat-data) css.properties.text-box).
- `shape()` gives "complex, non-polygonal, responsive shape" clipping with custom properties and animation ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Chrome 135, Firefox 148, Safari 18.4 ([BCD](https://github.com/mdn/browser-compat-data) css.types.basic-shape.shape).
- Gap decorations: "column-rule and row-rule CSS properties display decorative lines between columns and rows of a flex, grid, or multi-column layout", with `rule-break`, `rule-outset` and `rule-paint-order` (Chrome 149) ([webstatus](https://webstatus.dev/features/gap-decorations)).
- `contrast-color()` Chrome 147 / Firefox 146 / Safari 26; `alpha()` Chrome 152; relative colors fully from 125 ([BCD](https://github.com/mdn/browser-compat-data) css.types.color.contrast-color; [webstatus](https://webstatus.dev/features/alpha); [webstatus](https://webstatus.dev/features/relative-color)).
- `@scope` Chrome 118 (`&` in @scope from 143); Baseline newly available with Safari 26.4 ([BCD](https://github.com/mdn/browser-compat-data) css.at-rules.scope; [webstatus](https://webstatus.dev/features/scope)).
- `reading-flow`/`reading-order` (137, Chrome-only) make focus and reading order follow the visual flex/grid order ([BCD](https://github.com/mdn/browser-compat-data) css.properties.reading-flow).
- `stretch` sizing keyword (138) fills the containing block while respecting margins ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)).
- `flex-wrap: balance` (150) "distributes items in a multi-line flex container such that each line has about the same number of items" ([webstatus](https://webstatus.dev/features/flexbox-flex-wrap-balance)).
- `random()` is Chrome **156** (out of window) ([BCD](https://github.com/mdn/browser-compat-data) css.types.random).

### Inferences
- **Sci-fi panels.** `border-radius: 14px; corner-shape: bevel notch bevel notch` replaces clip-path chamfers. The border, `box-shadow` glow, focus outline and `backdrop-filter` blur then follow the cut. A clip-path cuts off outer shadows and outlines, which is why gradient borders are currently layered pseudo-elements. Combine with `background-clip: border-area` (150) to get gradient-stroked bevelled glass panels from a single element. Fallback for browsers: the current clip-path/mask implementation inside `@supports not (corner-shape: bevel)`.
- **Length tiers.** `text-fit: shrink` with a percentage floor on card titles, crumb segments and chips could replace JS measurement for single-line labels. Two limits: it only fits the inline dimension, and it changes the rendered font size, so verify the "layouts that must never reflow" rule by checking that the box's block size stays fixed. Keep the tier ladder for multi-line, Russian-heavy text and as the browser fallback.
- **Stagger without JS.** `transition-delay: calc(sibling-index() * 40ms * var(--motion-scale, 1))` on dealt cards and reward chips removes per-item `:style` index bindings. Vue's comment and fragment anchors are not elements, so they should not affect the count (inference, not verified).
- **Player-colour chips.** `contrast-color(var(--player))` chooses legible text automatically and works cross-browser. `color-mix()` and relative colours derive tints and glows from one token.
- **Chip and button labels.** `text-box: trim-both cap alphabetic` fixes the uppercase-label vertical-centering fudge padding common in sci-fi typography.
- **Gap decorations** draw rail and grid separators without border hacks on children (Chrome-only).
- **Low value here:** `if()` and `@function` (Less mixins and functions already cover authoring-time logic; their value is runtime-conditional values driven by custom properties); `light-dark()` (the UI is dark-only); `field-sizing` (few inputs).

### Gaps
- No primary source on `text-fit` performance (relayout cost) or on its interaction with `text-wrap: balance` and `line-clamp`.
- The corner-shape facts about which styles follow the shape come from secondary blogs. The Chrome developer blog article URL guessed (`/blog/corner-shape`) returned 404, and the primary article was not located.

## Q7. Popover, invoker commands, dialog closedby, CloseWatcher, interest invokers: useful for a gamepad UI?

### Takeaway
The top layer (Popover API, Chrome 114) is the valuable part. It is a browser-managed overlay that escapes every ancestor's stacking context, transform and overflow. Paired with anchor positioning it fixes tooltip and overlay clipping. Invoker commands are now cross-engine but add little to a JS-driven gamepad UI. `interestfor` (142) fires on focus as well as hover, so gamepad-driven DOM focus could reveal hints natively. `closedby` and CloseWatcher target pointer/Esc/back-button dismissal and duplicate the app's richer B-verb model.

### Cited Findings
- Popover API: Chrome 114, Firefox 125, Safari 17 ([BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.popover). It "Creates layered interfaces with built-in top-layer promotion and light-dismiss" ([CSS Wrapped 2024](https://chrome.dev/css-wrapped-2024/)).
- `popover="hint"` is "designed for ephemeral layered UI patterns, such as tooltips"; "unlike auto/manual popovers, doesn't close other open popovers" ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). It is "subordinate to popovers with a popover="auto" attribute" ([webstatus](https://webstatus.dev/features/popover-hint)). Full support from 151; 133–150 is partial ([BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.popover.hint).
- Invoker commands: "buttons can now perform actions on other elements declaratively", including custom commands (Chrome 135) ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Firefox 144, Safari 26.2 ([BCD](https://github.com/mdn/browser-compat-data) api.CommandEvent).
- `<dialog closedby>` takes `none`, `closerequest` or `any` (Chrome 134) ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)).
- CloseWatcher: Chrome 126, Firefox 149, Safari preview ([BCD](https://github.com/mdn/browser-compat-data) api.CloseWatcher).
- Interest invokers: "`interestfor` attribute activates on hover/focus without full activation", with a default 0.5 s interest delay, pairing well with `popover="hint"` ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)). Triggered "through behaviors such as hover, focus, or long-press" (Chrome 142, Chrome-only) ([webstatus](https://webstatus.dev/features/interest-invokers)).
- `ToggleEvent.source` (140) identifies which element triggered a popover, dialog or details toggle ([CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/)).
- TS 6.0.3 `lib.dom.d.ts` types popover, `CommandEvent`, `closedBy` and `ToggleEvent`. It has no `CloseWatcher` and no `interestForElement` (local inspection).

### Inferences
- **Use popovers as a layer, not for behaviour.** Render hints, the command-bar flyouts and "detached result" layers as `popover="manual"` or `"hint"` elements opened from JS (`showPopover({source})`). This gets top-layer escape plus implicit anchors. B/close logic stays in the console's own verb model.
- **Gamepad focus as interest.** If the d-pad cursor moves real DOM focus, `interestfor` would show hints after the interest delay with no JS. The delay is styleable via `interest-delay`, which should be set from motion tokens. If the cursor is a virtual highlight rather than DOM focus, `interestfor` won't help.
- CloseWatcher and `closedby` add value only for the browser and mouse target. In Electron with a gamepad, B is synthesised by the app.

### Gaps
- Whether top-layer popovers interfere with Electron's own overlay or fullscreen handling under gamescope was not researched.

## Q8. Focus and navigation primitives: focusgroup, inert, focus options, reading-flow, Navigation API, spatial navigation

### Takeaway
`focusgroup` shipped in Chrome 150 (after an origin trial in 146–149). It gives arrow-key roving focus, one guaranteed tab stop and last-focused memory for linear composites. Two-dimensional `grid` mode is still only proposed, so it does not replace the custom d-pad tile walker. `interactivity: inert` (135) moves inert into CSS. `focus({focusVisible: true})` (145) forces the focus ring on programmatic, gamepad-driven focus. No standard spatial navigation shipped.

### Cited Findings
- "The `focusgroup` attribute lets you declaratively give composite widgets arrow key navigation, a guaranteed tab stop, and last-focused memory", e.g. `<div focusgroup="toolbar wrap">` ([New in Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150)). On chromestatus, the origin trial ran 146–149 and the ship stage is 150. Its top-level status text still reads "In developer trial (Behind a flag)" ([chromestatus](https://chromestatus.com/feature/5637601087193088)).
- "FocusgroupV2: grid and feed" (`grid` = two-dimensional focus navigation, plus `feed` and an `itemcontrols` modifier) is in **Proposed** status ([chromestatus](https://chromestatus.com/feature/5168133036965888)).
- web-features lists `focusgroup` with an empty support map ([webstatus](https://webstatus.dev/features/focusgroup)).
- `interactivity: inert` "makes an element and its descendants inert, like when using the inert HTML attribute" (Chrome 135) ([webstatus](https://webstatus.dev/features/interactivity)). The `inert` attribute is Chrome 102 and widely available ([BCD](https://github.com/mdn/browser-compat-data) html.global_attributes.inert).
- `focus({focusVisible})` Chrome 145, Firefox 104, Safari 18.4; `preventScroll` since 64 ([BCD](https://github.com/mdn/browser-compat-data) api.HTMLElement.focus.options_focusVisible_parameter).
- `reading-flow` 137 (Chrome-only) ([BCD](https://github.com/mdn/browser-compat-data) css.properties.reading-flow).
- Navigation API: Chrome 102, now Firefox 147 and Safari 26.2 (Baseline newly) ([BCD](https://github.com/mdn/browser-compat-data) api.Navigation). Precommit handlers arrived in 146 ([webstatus](https://webstatus.dev/features/navigation-precommit-handlers)).
- `ariaNotify()` (141) announces to screen readers without live regions ([BCD](https://github.com/mdn/browser-compat-data) api.Document.ariaNotify).

### Inferences
- **focusgroup.** It could replace hand-written roving-tabindex code in one-dimensional strips (command bar, tab rows, an action wheel row), but only if the gamepad layer maps d-pad presses to arrow-key events or DOM focus. The board and card grids need 2D walking, which stays custom until FocusgroupV2 `grid` ships. Feature-detect, because BCD and web-features do not record it yet.
- **CSS inert.** `interactivity: inert` on collapsed-but-mounted workspaces, or on layers under a modal band, guarantees no stray focus or click reaches them, declaratively, with no attribute bookkeeping in Vue.
- **Visible focus.** Call `el.focus({ focusVisible: true, preventScroll: true })` from the cursor controller so `:focus-visible` styling applies on gamepad moves.
- **Navigation API.** Low relevance for a single-route console shell.

### Gaps
- Chromium's experimental spatial navigation (`--enable-spatial-navigation`) and the CSS Spatial Navigation draft were not researched in this pass. No shipped spatial navigation appears in BCD or web-features.

## Q9. Performance and scheduling: scheduler.yield, LoAF, content-visibility, containment, Compute Pressure

### Takeaway
`scheduler.yield()` (129) and LoAF (123) are the two high-value performance tools. One breaks long view-apply and journal tasks into input-friendly chunks without losing priority. The other attributes janky frames to specific scripts and to forced style/layout, which is a better probe than deduplicated long-task sampling. `content-visibility: hidden` / `auto` with `contain-intrinsic-size: auto` (117) lets hidden-but-kept surfaces skip rendering while keeping their state.

### Cited Findings
- `scheduler.yield()` Chrome 129, Firefox 142, no Safari; `scheduler.postTask` and `TaskController` since 94 ([BCD](https://github.com/mdn/browser-compat-data) api.Scheduler.yield; api.Scheduler.postTask).
- Long Animation Frames entries (`PerformanceLongAnimationFrameTiming`, `PerformanceScriptTiming`): Chrome 123, Chrome-only ([BCD](https://github.com/mdn/browser-compat-data) api.PerformanceLongAnimationFrameTiming; [webstatus](https://webstatus.dev/features/long-animation-frames)).
- `content-visibility` "delays rendering an element, including layout and painting, until it is needed" (web-features: Chrome 108 for the full feature, Firefox 130, Safari 26) ([webstatus](https://webstatus.dev/features/content-visibility)). `ContentVisibilityAutoStateChangeEvent` arrived in Chrome 108 ([BCD](https://github.com/mdn/browser-compat-data) api.ContentVisibilityAutoStateChangeEvent); the property itself in 85 ([BCD](https://github.com/mdn/browser-compat-data) css.properties.content-visibility).
- `contain-intrinsic-size: auto` Chrome 117 ([BCD](https://github.com/mdn/browser-compat-data) css.properties.contain-intrinsic-size.auto_none).
- Compute Pressure (`PressureObserver`): Chrome 125, Chrome-only ([BCD](https://github.com/mdn/browser-compat-data) api.PressureObserver).
- Event timing entries (76) are now cross-browser (Safari 26.2). Soft-navigation and interaction-contentful-paint entries arrived in 151 ([webstatus](https://webstatus.dev/features/event-timing); [webstatus](https://webstatus.dev/features/soft-navigations)).
- `requestVideoFrameCallback` 83; OffscreenCanvas 69 (widely available) ([BCD](https://github.com/mdn/browser-compat-data) api.HTMLVideoElement.requestVideoFrameCallback; [webstatus](https://webstatus.dev/features/offscreen-canvas)).
- TS 6.0.3 types `Scheduler`, `yield()` and `ContentVisibilityAutoStateChangeEvent`, but not LoAF or `PressureObserver` (local inspection).

### Inferences
- **Diagnostics.** A `PerformanceObserver({type: 'long-animation-frame', buffered: true})` in dev and e2e builds records `blockingDuration`, `forcedStyleAndLayoutDuration` and per-script `invoker`/`sourceURL`. This directly targets the "probe dedup hides stalls" and "first paint = shader compile" diagnostics in the project's notes. It must run on the real GPU box, not SwiftShader.
- **Yielding.** Wrap heavy view-apply or journal reconciliation loops with `await scheduler.yield()` between chunks, so a gamepad press or the next rAF can interleave. It is Chrome/Firefox only; in Safari, fall back to `setTimeout(0)` or `MessageChannel`.
- **Hidden surfaces.** For collapsed workspaces kept alive with `v-show` (display:none), `content-visibility: hidden` instead skips paint and layout while keeping layout state cached, so restoring is cheaper. That suits "collapse ≠ close, no replayed cinematic". `content-visibility` is animatable together with `allow-discrete` (Q4).
- **Adaptive quality.** `PressureObserver` could downgrade expensive effects (blur, glow, particle counts) on Steam Deck under thermal pressure, if Chromium on SteamOS reports it (see Gaps).
- **Not applicable:** speculation rules and render-blocking. This is a single-document app loaded locally.

### Gaps
- Platform support for Compute Pressure on Linux/SteamOS was not verified.
- No measured data on `content-visibility: hidden` vs `display: none` re-show cost for large Vue subtrees was found.

## Q10. Graphics and media: WebGPU, canvas, image formats, HDR/wide gamut, Houdini

### Takeaway
WebGPU is stable on Windows (113) but reached Linux only in 144 and only for Intel Gen12+ GPUs, so per BCD the AMD-based Steam Deck is not covered by default. Compatibility mode is Android-only (146). For this DOM/SVG UI, the practical wins are wide-gamut colour (`color(display-p3)`, OkLCh, both 111) for vivid accents on a 4K TV, and `dynamic-range-limit` (136) if HDR imagery is ever used. JPEG XL is 155, out of window.

### Cited Findings
- WebGPU `requestAdapter`: Chrome 113–143 "Supported on ChromeOS, macOS, and Windows"; from 144 "Supported on ChromeOS, macOS, Windows, and Linux (Intel Gen12+ GPUs only)" ([BCD](https://github.com/mdn/browser-compat-data) api.GPU.requestAdapter notes). web-features therefore lists Chrome 144 ([webstatus](https://webstatus.dev/features/webgpu)).
- WebGPU `featureLevel` (compatibility mode) Chrome 146: "Compatibility mode supported only on Android 10.0 and above (running OpenGL ES 3.1 and above)" ([BCD](https://github.com/mdn/browser-compat-data) api.GPU.requestAdapter.options_featureLevel).
- `color()`, Oklab/OkLCh and gradient interpolation (color-space in gradients) in Chrome 111 ([webstatus](https://webstatus.dev/features/color-function); [webstatus](https://webstatus.dev/features/gradient-interpolation)).
- `dynamic-range-limit` "controls the peak luminance of high dynamic range content" (Chrome 136, Safari 26) ([webstatus](https://webstatus.dev/features/dynamic-range-limit)). The `dynamic-range` and `color-gamut` media queries are older and widely available ([webstatus](https://webstatus.dev/features/dynamic-range); [webstatus](https://webstatus.dev/features/color-gamut)).
- AVIF Chrome 85, widely available; JPEG XL Chrome 155 ([webstatus](https://webstatus.dev/features/avif); [webstatus](https://webstatus.dev/features/jpegxl)).
- Canvas 2D: `roundRect`, `reset`, `createConicGradient` and `willReadFrequently` date from Chrome 99 (pre-window) ([webstatus](https://webstatus.dev/features/canvas-roundrect)). "HTML in canvas" is not shipped in Chrome ([webstatus](https://webstatus.dev/features/canvas-html)).

### Inferences
- Do not plan WebGPU-dependent board effects for the Deck without testing Electron flags. Windows TVs are covered. WebGL2 or CSS remain the portable choices.
- Define accent tokens in OkLCh with a `color(display-p3 …)` boost behind `@media (color-gamut: p3)`. A wide-gamut 4K TV then shows richer energy, cyan and amber glows at no cost.

### Gaps
- Houdini CSS Paint API (`paint()` worklets) was not checked in this pass. It shipped in Chrome long before 111 and is not cross-browser.
- Whether Electron 45 on SteamOS can enable WebGPU on the Deck's AMD APU via flags (e.g. Vulkan backend) was not researched. The 153–156 researcher may have newer Linux GPU coverage.

## Q11. Gamepad and input: haptics, trigger rumble, WebHID, Keyboard API

### Takeaway
Gamepad haptics are usable: `vibrationActuator.playEffect('dual-rumble')` has existed since Chrome 68, and impulse-trigger `trigger-rumble` (with `leftTrigger`/`rightTrigger` magnitudes and an `effects` list) is enabled by default from Chrome 126. That allows a tactile "commit" beat consistent with the action-commit grammar. WebHID (89) is the only route to raw device reports, and in Electron it needs explicit session handlers. Whether Steam Deck controls are reachable is unverified.

### Cited Findings
- `GamepadHapticActuator.playEffect` and `Gamepad.vibrationActuator`: Chrome 68, Safari 16.4, not Firefox ([BCD](https://github.com/mdn/browser-compat-data) api.GamepadHapticActuator.playEffect; api.Gamepad.vibrationActuator).
- Trigger-rumble extension: "Extend the GamepadHapticActuator interface to expose the trigger-rumble capability… for compatible gamepads". Its motivation names Xbox controllers' "impulse triggers"; status "Enabled by default", ship milestone 126 ([chromestatus](https://chromestatus.com/feature/5162940951953408)). BCD records `type_trigger-rumble`, the `leftTrigger`/`rightTrigger` params and `effects` at Chrome 126 ([BCD](https://github.com/mdn/browser-compat-data) api.GamepadHapticActuator.effects).
- TS 6.0.3 `lib.dom.d.ts` types `GamepadHapticEffectType = "dual-rumble" | "trigger-rumble"` (local inspection).
- WebHID: Chrome 89, Chrome-only ([BCD](https://github.com/mdn/browser-compat-data) api.HID). In Electron, "the `select-hid-device` event on the Session can be used to select a HID device when a call to `navigator.hid.requestDevice` is made". `ses.setDevicePermissionHandler` grants default permission and `setPermissionCheckHandler` restricts origins. Electron applies Chromium's HID blocklist unless the `disable-hid-blocklist` flag is set ([Electron docs: Device Access](https://www.electronjs.org/docs/latest/tutorial/devices)).
- Keyboard Lock (68) and Keyboard Map (69) are Chrome-only and pre-window ([webstatus](https://webstatus.dev/features/keyboard-lock)).
- TS 6.0.3 has no `HID` types (local inspection).

### Inferences
- **Haptics as one system.** Add a haptics token set next to the motion tokens (short `dual-rumble` on A Подтвердить, a softer pulse on the reward touchdown, `trigger-rumble` only when `effects.includes('trigger-rumble')`). Gate it on a user setting and probably on reduced-motion. Durations should go through the same scale so the e2e `?motion=` factor applies.
- e2e already stubs `navigator.getGamepads` (project notes), so haptics calls must tolerate a missing actuator.

### Gaps
- Platform coverage of `trigger-rumble` and `dual-rumble` on Linux/SteamOS and under Steam Input's virtual controller was not verified. The chromestatus motivation implies Xbox impulse triggers, probably Windows-centric.
- Whether Valve controller HID interfaces are on Chromium's HID blocklist, or are claimed exclusively by Steam, was not researched.

## Q12. JavaScript features shipped in V8 ≤ Chrome 152, and what our TypeScript 6 settings need

### Takeaway
Everything below is native in Electron 45. The repo's root `tsconfig.json` uses `target: "es2021"` and `lib: ["dom", "es2023"]`. Adopting the newer builtins needs `es2025` (Set methods, iterator helpers, `Promise.try`, `RegExp.escape`, `Float16Array`) or `esnext` (`Array.fromAsync`, `Error.isError`, `Uint8Array` base64, `Map.getOrInsert`, `using`/`DisposableStack`, Temporal). `Math.sumPrecise` (Chrome 147) has no typings in TS 6.0.3. For the browser target, Temporal and `using` are not in stable Safari.

### Cited Findings
- **Runtime support (Chrome / Firefox / Safari):**

  | Feature | Chrome | Firefox | Safari |
  |---|---|---|---|
  | `Promise.withResolvers` | 119 | 121 | 17.4 |
  | `Object.groupBy` | 117 | 119 | 17.4 |
  | `Array.fromAsync` | 121 | 115 | 16.4 |
  | Set methods (`union` etc.) | 122 | 127 | 17 |
  | Iterator helpers | 122 | 131 | 18.4 |
  | `Promise.try` | 128 | 134 | 18.2 |
  | `Atomics.pause` | 133 | 137 | 18.4 |
  | `using` / `await using` / `DisposableStack` | 134 | 141 | preview |
  | `Error.isError` | 134 | 138 | preview |
  | `Float16Array` | 135 | 129 | 18.2 |
  | `RegExp.escape` | 136 | 134 | 18.2 |
  | `Uint8Array.fromBase64` / `toBase64` | 140 | 133 | 18.2 |
  | Temporal | 144 | 139 | preview |
  | `Map`/`WeakMap.getOrInsert` | 145 | 144 | 26.2 |
  | `Iterator.concat` | 146 | 147 | 26.4 |
  | `Math.sumPrecise` | 147 | 137 | 26.2 |
  | Import attributes / JSON modules | 123 | 138 | 17.2 |
  | CSS module scripts (`type: 'css'`) | 123 | 147 | no |

  Source for all rows: [BCD](https://github.com/mdn/browser-compat-data) javascript.builtins.* and javascript.statements.*. Text import attributes are 155, out of window.
- Local inspection of the repo:
  - `package.json` pins `typescript ^6.0.3` (installed 6.0.3), `electron 45.0.0`, `vue ^3.5.40` and `gsap ^3.15.0`.
  - Root `tsconfig.json` has `"lib": ["dom", "es2023"]` and `"target": "es2021"`; `src/tsconfig.json` extends it.
  - TS 6.0.3 ships `lib.es2025.{collection,float16,intl,iterator,promise,regexp}.d.ts` and `lib.esnext.{array,collection,disposable,error,sharedmemory,typedarrays,temporal,date,…}.d.ts`.
  - Mapping: Set methods are in `es2025.collection`, `Promise.try` in `es2025.promise`, `RegExp.escape` in `es2025.regexp`, `Float16Array`/`Math.f16round` in `es2025.float16`, and `Promise.withResolvers` in `es2024.promise`.
  - `Array.fromAsync` is in `esnext.array`, `Error.isError` in `esnext.error`, `Uint8Array` base64/hex in `esnext.typedarrays`, `Map.getOrInsert(Computed)` in `esnext.collection`, `DisposableStack`/`AsyncDisposableStack`/`SuppressedError` in `esnext.disposable`, Temporal in `esnext.temporal`, and `Atomics.pause` in `esnext.sharedmemory`.
  - `Math.sumPrecise` appears in no TS 6.0.3 lib file.
- Secondary confirmation: "TypeScript 6.0 adds es2025 as a valid --target and --lib value… built-in types for APIs like RegExp.escape"; Temporal is typed under `esnext` / `temporal.esnext` ([OpenReplay](https://blog.openreplay.com/whats-new-typescript-6-0/), via search summary).
- TS 6.0.3 `lib.dom.d.ts` is missing several APIs (local inspection): `Element.startViewTransition`, `ViewTransition.waitUntil`/`transitionRoot`, `CloseWatcher`, `interestForElement`, LoAF entry types, `PressureObserver`, `HID` and `ariaNotify`.

### Inferences
- **Typings.** Moving the client lib to `["dom", "es2025"]` is safe for Electron and covers the most useful additions (Set ops for availability and target sets, iterator helpers for lazy pipelines over game-state collections, `Promise.try` and `Promise.withResolvers` for the animation-hold and transport funnels). Add specific `esnext.*` libs only when needed.
- **`using` / `await using`.** Explicit resource management is syntax, and TS downlevels it below `esnext`. It fits animation holds and GSAP context cleanup (`using hold = registerHold(...)`). Safari stable lacks `Symbol.dispose`/`DisposableStack`, so the browser target needs a small polyfill.
- **Temporal** is not in stable Safari. Keep it Electron-only or polyfill.
- **Missing DOM types.** Write ambient `declare global` augmentations in one file for the DOM APIs TS 6.0.3 lacks (element-scoped VT, CloseWatcher, LoAF, interest invokers), or use `@types/w3c-web-hid` for WebHID.
- **Server tree.** The server shares the root tsconfig (Node runtime, `module: commonjs`). Raising `lib` there assumes the Node version in use supports those builtins. Node support was not checked here.

### Gaps
- Not checked: the client-side webpack/ts-loader or Babel config, and whether a separate client tsconfig or browserslist governs the browser build. Only the root/src tsconfig was inspected.
- The Microsoft announcement post for TypeScript 6.0 was not fetched. TS 6 lib details come from the local install, plus one secondary blog.
