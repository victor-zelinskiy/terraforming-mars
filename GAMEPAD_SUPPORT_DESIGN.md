# GAMEPAD SUPPORT — Design & Implementation Plan (Premium W3C Gamepad API mode)

> Companion to `GAMEPAD_SUPPORT_BRIEF.md`. Style-sibling of
> `REMOUNT_ANIMATION_REWORK_DESIGN.md` / `ELECTRON_MIGRATION_PLAN.md`:
> phased, opinionated, invariants + risks up front.
>
> **Status: see the STATUS LOG at the bottom. This document is the
> authoritative map of the SHIPPED gamepad subsystem (iteration 1).**
>
> ⚠️ **Direction shift (iteration 2):** the product target moved from
> "drive the existing desktop UI with a pad" to a **dedicated console-first
> TV mode** — see `CONSOLE_MODE_CONCEPT.md`. Iteration 1's input core /
> glyphs / settings survive as infrastructure; its DOM-driving focus engine
> is DEMOTED to a fallback (the §14 matrix in the concept doc is the
> authoritative reuse verdict). Do not extend the focus engine as a UX
> surface — new controller UX work belongs to the console shell.

---

## 0. Mission

A player picks up an Xbox controller: the mouse cursor vanishes, a premium
focus ring + contextual button glyphs appear over the existing modern UI, and
they play a complete game — draft → cards → tiles → payment → awards →
colonies → journal → endgame → rematch — without touching mouse or keyboard.
Gamepad is a **third input mode** that coexists with mouse + keyboard;
switching is instant and automatic in both directions.

## 1. Non-negotiable invariants (from the brief, all honored by this design)

1. **Modern-premium UI only.** No gamepad affordances in legacy components
   (`OrOptions.vue`, `SelectOption.vue`, legacy `SelectCard.vue`,
   `AndOptions.vue`, `.legacy-ui-overlay`, `GameEnd.vue`).
2. **Additive.** Mouse/keyboard players are byte-for-byte unaffected: the
   whole subsystem is inert until a gamepad button is pressed, and every
   visual rides an `html.gp-mode` class that mouse players never get.
3. **Browser + Electron** first-class (both Chromium; §8 Electron notes).
4. **No dead ends** — the coverage matrix (§9) is the quality gate.
5. **Premium visual + motion language** — `cab-*`/dark-glass/cyan styling,
   all durations via `motionMs()` / `calc(...*var(--motion-scale))`,
   `prefers-reduced-motion` honored, native `title` banned.
6. **Survives the architecture** — no-remount + structural sharing +
   reset-epoch + teleports + the `activeOverlay` machine (§5.4 focus
   persistence).
7. **Submit through existing contracts** — the controller *drives the same
   DOM affordances the mouse uses* (synthetic, trusted-path events into the
   existing `@click` handlers → `WaitingFor.onsave()` etc.). There is **no
   parallel submit path anywhere** in this design — that is its central idea.
8. **Performance** — poll loop is DOM-free; geometry reads happen only on
   navigation events; the focus ring is a single transform-animated fixed
   element; no per-frame Vue re-renders (module-level state, non-reactive hot
   path).
9. **i18n** — hint labels are English i18n keys translated via the existing
   pipeline; ru values in `ui.json` (grep-before-add; `make:json` dupe rule).
10. **Testable** — pure models (poll edges/repeat/deadzone, spatial geometry,
    hint derivation, scope priority) unit-tested under the server mocha
    runner; DOM shells are JSDOM-no-op by design (the established fit-engine
    pattern).

---

## 2. Architecture audit — what a controller must drive

### 2.1 The interactive surface catalog (mouse/keyboard affordances today)

| Surface | Mount | Actionable elements (selectors) | Existing keyboard | Close path |
| --- | --- | --- | --- | --- |
| **PlayerHome chrome** | in-tree | `.bottom-bar-btn` (2 top anchors + 2 bottom rails), left panel: pass/end-turn (`.left-panel-card-action-btn--*`), convert wrappers `.resource_item_wrapper--convert-plants/--convert-heat` (role=button, tabindex=0, Enter/Space), player panels | `KeyA`/`KeyD`/`Digit1-9` (HomeMixin, window), `?` help | — |
| **Mars board** | in-tree | `.board-space` cells (`data_space_id`), placement: `.board-space--available` get per-cell `onclick` (SelectSpace mounted()), hover = delegated `mouseover/mouseout` on board root → cell-info / placement popovers | none | placement cancel via banner |
| **PlacementBanner** | Teleport ×2 | pill (role=button tabindex=0 Enter/Space) → details modal: `.placement-details__btn--cancel/--close`, backdrop click | Enter/Space on pill | backdrop / close |
| **Hand overlay** | in-tree (activeOverlay==='cards') | `.hand-board__close`, filter chips, sort dropdown, `HandCardItem` (`@open` fullscreen, `.hand-card-play-btn`, sale/select toggles), sale strip confirm/cancel, select strip confirm | Esc (window) | Esc / ✕ / outside-click |
| **Played overlay** | in-tree | close, view-toggle `.played-board__viewbtn`, filters, `PlayedCardItem` (`@open`, pick `.played-card-item__pick`), pick strip cancel + 3-way filter, table rows | Esc (window) | Esc / ✕ / outside-click |
| **Actions overlay** | in-tree | close, filter chips, `CompactActionCard` rows (click=select, dblclick=quick-activate), `.action-detail__cta` | **Full master-detail nav**: Arrows ±1/±perCol (column-major), Home/End, Enter/Space=CTA, Esc (window) | Esc / ✕ / outside |
| **Effects overlay** | in-tree | close, `EffectBlock` rows (hover preview, click pin), details ⤢ | **Same arrow-nav pattern as Actions** | Esc / ✕ / outside |
| **VP overlay** | in-tree | privacy toggle, close; hover cross-link on segments/legend/rows | Esc (window) | Esc / ✕ / outside |
| **Milestones / Awards / Std-Projects dropdowns** | in-tree `.top-bar-dropdown` | rows + `.milestone-claim-btn` / `.award-fund-btn` / `.std-project-use-btn` (aria-disabled pattern), close btn | **none** (no Esc!) | ✕ / outside-click |
| **Colonies overlay** | Teleport (z 11000) | `ColonyTile` `@view`/`@select` (`.colony-tile__select-btn`), detail view select/close, minimize/cancel/close, pill (tabindex=0 Enter/Space) | none (pill only) | backdrop (dismissable modes) / ✕ |
| **Journal panel** | App-level aside | close, mode toggle `.journal-mode__btn`, generation/filter dropdowns (keyboard-operable), feed scroll, token chips (hover popovers, click zoom/highlight) | Esc inside dropdowns; window keydown (331) | ✕ |
| **MandatoryInputModal** | Teleport ×2 (z 12000 + pill z 107) | minimize `.mandatory-input-modal__minimize-btn`, pill (tabindex=0 Enter/Space), hosted content | pill Enter/Space | never dismissable; minimize only |
| **Modern inputs** (ModalInputHost) | inside modal | option cards `.modal-input__option-card` (select→confirm; risky = inline drawer with Esc-disarm), target cards `.modal-input__target-card`, resource tiles, steppers `.modal-input__step-btn`/`__max-btn` (buttons, **no native inputs**), primary CTA `.modal-input__primary-btn`, back btn | Esc on risky drawer only | — |
| **CardSelectionContent** (draft/buy/research/nested) | in modal | card slots (`@click.capture` fullscreen), per-card `ВЫБРАТЬ` `.card-selection__card-action-btn`, filter row, confirm footer `.card-selection__confirm` | none | — (mandatory) |
| **Play/action confirm modals** | in modal | branch buttons `.play-confirm__branch`, `ActionTargetCard` (`.action-target-card__pick`), payment steppers (`.payment-v2-step--minus/--plus/--max`), pick-bridges to hand/played overlays, cancel/confirm `.cab-action-confirm-cancel/-go` | none | Cancel btn |
| **ColonyTradePaymentModal** | in modal | option cards `.colony-trade-pay__option`, confirm/cancel | none | Cancel |
| **CardZoomModal** | native `<dialog>` (top layer) | nav `.card-zoom-nav` (bounded), `#actions` slot buttons, close | **←/→** (window, animating guard), Esc native | Esc / backdrop |
| **StartGameFlowOverlay** | Teleport ×3 (App-level) | prelude `__play-btn`, corp `__apply-btn`, `__begin-btn`, minimize, zoom | none | minimize |
| **Draft / InitialDraft flows** | App-level, host MandatoryInputModal | CardSelectionContent + step confirms + pill stack | none | minimize |
| **NotificationLayer** | Teleport (z 12650) | card click=expand, `.notification-card__close`, CTAs (`__cta`), cancel CTA | none | auto-TTL / ✕ |
| **Endgame** | App-level (z 3000+) | tabs `.eg-results__tab` (role=tab), minimize/replay/home, rematch controls, show-more, pill | Esc-ish (window 251) | minimize |
| **RematchLayer** | Teleport (z 3300/3260) | accept/decline/join/later `.cab-rematch--*`, pill, toast close | none | pill/dismiss |
| **Drawn-cards reveal** | App-level (z 12600) | card slots (role=button tabindex=0 Enter/Space), `.draw-reveal__take-all`, fullscreen take | Enter/Space on slots | take-all |
| **RevealedCardsModal / RevealResultOverlay** | Teleport | grid slots, close, `reveal-ok` | window keydown (130) | ✕ / OK |

### 2.2 Input / submission infrastructure

- **20 window `keydown` listeners** (audited; zero `keyup`). Pattern: attach
  on `mounted`, detach on `unmounted`; Esc handlers mostly guard on
  `document.querySelector('dialog[open]')`. `HomeMixin.navigatePage` owns
  KeyA/KeyD globally.
- **Submission**: every controller confirm ends in an existing `@click`
  handler → `WaitingFor.onsave()` / `onsaveBatch()` (POST `player-input` /
  `player-input-batch`) or a dedicated-button handler in PlayerHome. Nothing
  new to build — synthetic `click()` events traverse the exact same path,
  including the capture-phase placement-lock guard (a real bubbling
  MouseEvent, so guards work unchanged).
- **Teleports**: 48 instances, all `to="body"`. Focus must be computed from
  the *rendered DOM*, never the Vue tree — this rules out component-tree
  focus libraries.
- **Z-stack** (load-bearing for scope priority): bar overlays ~110 →
  colonies 11000 → mandatory modal 12000 → draw-reveal 12600 →
  notifications 12650 → journal popovers 12700 → native `<dialog>` top-layer.
- **Motion**: `motionMs()`, `MOTION_EASE`, `createFrameGate()`,
  `--motion-scale`; reduced-motion is a separate axis.
- **Preferences**: `PreferencesManager` (localStorage, boolean+lang);
  motion-system pattern for non-boolean knobs (`tm_*` keys + URL params).

### 2.3 Residual-legacy-in-modern-flow findings (+ scope calls)

| Case | Where it appears | Scope call |
| --- | --- | --- |
| **Nested `AndOptions.vue`** (FocusedOrganization / AeronGenomics) | `ModalInputHost` fallback inside the mandatory modal | **Known gap, basic operability.** Both cards are prelude2/underworld — outside the fork's adapted-module scope. The generic focus engine still drives its native buttons/checkboxes (focusable + clickable), so it is *completable*, just not premium. Revisit with the deferred `ModernAndOptions` task. |
| **`PlayerInputFactory` fallback in `ModalInputHost`** (any type without a premium component; legacy `SelectAmount` has a native `<input type=number>`) | mandatory modal | Same call: generic driving = completable-not-premium. All in-scope input types have premium components today, so this fires only for un-adapted expansion content. |
| **`ConfirmDialog.vue`** (placement confirm; spectre `.btn` styling) | modern placement flow when `hide_tile_confirmation` is off (fork default: on) | **In scope via generic engine** — it's a native `<dialog>` with two buttons; dialog scope + A/B work unchanged. No legacy-file edits. |
| **`SelectSpace.vue`** (legacy family, but IS the modern placement path) | placement | **In scope** — driven via board navigation (§5.7); no rendering change (its prompt header is already `display:none`). |
| **Inline action-menu OrOptions** (`Take your first/next action`) | WaitingFor inline | **No gamepad work needed** — the fork's dedicated buttons cover the full `getActions()` list; the radio render is stylesheet-hidden. |

---

## 3. The chosen design — one sentence

**A DOM-driving spatial-focus engine**: a rAF-polled input core turns the pad
into *semantic intents*; a scope resolver picks the topmost interactive layer
straight from the rendered DOM; a geometric navigator moves a single floating
premium focus ring between *the same elements the mouse clicks*; A/B/X/Y
dispatch synthetic (but real-path) DOM events into the existing handlers; a
glyph layer (ring badge + bottom hint bar) tells the player what every button
does right now.

### Why this shape (rationale / alternatives rejected)

- **Virtual cursor** (a controller-moved pointer): rejected — it's the
  archetypal "bolt-on" feel the brief bans; hex-precision with a stick is
  poor; it needs none of our audit knowledge and delivers none of the
  premium snap.
- **Native DOM focus + tabindex retrofitting**: rejected — hundreds of
  templates would need tabindex/focus CSS churn; native focus has side
  effects (scroll-jumps, `:focus` visuals for keyboard users → violates
  invariant 2); spatial order ≠ tab order everywhere.
- **Component-level focus registry (Vue provide/inject)**: rejected — fights
  teleports + structural sharing; every one of ~40 surfaces would need
  wiring; misses dynamically-mounted DOM (board cell handlers are attached
  by `SelectSpace.mounted()`, not templates).
- **The chosen DOM-driving engine** exploits the audit's central finding:
  the modern UI is *already* a rich catalog of real `<button>`s /
  role=button elements with uniform Esc/close/confirm patterns. Driving that
  DOM directly gives correctness (same code paths), zero regression surface,
  and automatic coverage of future surfaces that follow the fork's own
  conventions.

---

## 4. Input core (`src/client/gamepad/`)

### 4.1 `gamepadPollModel.ts` — PURE (unit-tested under the server runner)

- Types: `GamepadSnapshot` (buttons: pressed/value; axes), `SemanticButton`
  union — `'confirm' | 'back' | 'secondary' | 'inspect' | 'bumperL' |
  'bumperR' | 'triggerL' | 'triggerR' | 'view' | 'menu' | 'stickL' |
  'stickR'` — plus `NavDirection = 'up'|'down'|'left'|'right'`.
  **Xbox never appears in the model** — the STANDARD-mapping indices
  (A=0 B=1 X=2 Y=3 LB=4 RB=5 LT=6 RT=7 View=8 Menu=9 L3=10 R3=11
  dpad=12-15, axes 0/1 = left stick, 2/3 = right stick) map to semantics
  here; Xbox/PS/Switch naming lives only in the glyph layer.
- `readSnapshot(gamepad)` → plain snapshot (no live Gamepad object retained).
- `diffSnapshots(prev, next, state, nowMs)` → `GamepadIntent[]`:
  - **Edge detection**: `press`/`release` per semantic button; analog
    triggers digitalized at 0.55/0.45 hysteresis.
  - **Directional repeat**: d-pad OR left stick (radial deadzone, default
    0.28, then per-axis dominance) produce `nav` intents with hold-repeat —
    initial delay 340 ms, interval 130 ms, **fixed, not motion-scaled**
    (input cadence is ergonomics, not choreography).
  - **Right stick** → `scroll {dx, dy}` intents (analog, per-frame while
    outside deadzone).
- Fully deterministic: `(prev, next, repeatState, now)` in → intents +
  new state out. Specs cover deadzone edges, repeat timing, trigger
  hysteresis, multi-button frames.

### 4.2 `gamepadCore.ts` — DOM shell

- `gamepadconnected` / `gamepaddisconnected` listeners registered at App
  bootstrap (cheap, always on — the W3C privacy gate means the connect event
  itself only fires after a button press, which is exactly our mode trigger).
- rAF poll loop **only while ≥1 pad connected AND document visible**
  (`visibilitychange` pauses). Polls `navigator.getGamepads()`, runs the pure
  model, emits intents to subscribers. No DOM reads/writes in the loop.
  **Active pad** = the last pad that produced an intent (multi-gamepad rule);
  disconnect of the active pad → mode drops to pointer + hint toast.
- The loop itself is not frame-gated (input latency), but it does zero work
  when the snapshot is idle-identical (early-out on a cheap dirty check).

### 4.3 `inputModeState.ts` — the mode machine + cursor

- Module-level `reactive({mode: 'pointer' | 'gamepad', padConnected})`
  (survives everything, like `journalState`).
- **Enter gamepad mode**: any gamepad intent.
- **Exit**: trusted (`isTrusted === true` — CRITICAL, our own synthetic
  events must not flap the mode) `pointerdown` / `wheel` / `keydown`, or
  `pointermove` accumulated > 12 px (hysteresis so a nudged desk doesn't
  exit). Listeners: window, capture, passive.
- Drives `document.documentElement.classList.toggle('gp-mode')`:
  `html.gp-mode, html.gp-mode * { cursor: none !important }` + gates every
  gamepad visual (ring, glyphs, hint bar). Mode transitions animate via the
  motion system (ring/hint fade `motionMs(180)`).

### 4.4 Settings (`gamepadSettings.ts`)

- `gamepad_enabled: boolean` (default **true**) added to `Preferences`.
- Non-boolean knobs follow the motion-system pattern: `tm_gp_deadzone`
  (localStorage, default 0.28), URL params `?gp=0` (kill switch) and
  `?gpDebug` (debug overlay: live buttons/axes/intents/scope/focused
  element). The kill switch doubles as the rollback story for every phase.

---

## 5. Focus engine

### 5.1 Scopes — "which layer owns the controller"

`focusScopes.ts` declares an **ordered SCOPE_DEFS list** (highest priority
first); the resolver queries the *rendered DOM* for the first visible match.
DOM-driven ⇒ teleports, structural sharing, and future surfaces are handled
for free; the z-stack audit is encoded once, here:

1. `dialog[open]` (CardZoomModal, ConfirmDialog — the native top layer)
2. `.mandatory-input-modal` (not `--minimized`/`--suppressed`/`--picker-mode`)
3. App-modals (one def each): `.draw-reveal`, `.reveal-viewer`,
   reveal-result, rematch prompt/created, start-game-flow (not collapsed),
   placement-details, colonies overlay, effect/resource detail overlays,
   endgame results
4. **Board picker** (placement pending: `.board-space--available` present)
5. The `activeOverlay` surface (hand/played/actions/effects/vp/dropdowns)
   + journal panel
6. **Base**: PlayerHome chrome (bars, left panel, pills, board hover)

Each def: `{id, root: selector, visible?(el), back: BackAction, hints}`.
The resolver runs on input events only (never per frame) and caches per
event-batch. Adding a future modal = one SCOPE_DEFS entry (doc rule; the
generic `dialog[open]` def is the safety net).

### 5.2 Focusables — "what the ring can land on"

Within the active scope root: a **generic actionable selector** —
`button:not([disabled]), [role="button"]:not([aria-disabled="true"]),
a[href], [tabindex="0"], .board-space--available` — minus `[data-gp-skip]`,
plus scope-specific additions (board cells in base/picker scope), filtered by
real visibility (`getClientRects`, on-screen, not `visibility:hidden`).
The audit shows the premium surfaces are ~95% real buttons already, so this
needs almost no template changes; the few opt-ins ride two additive data
attributes: `data-gp-skip` (exclude) and `data-gp-key` (stable identity).

### 5.3 Directional navigation — `spatialNav.ts` (PURE)

Classic directional scoring, tuned for this UI:
- candidates whose center lies in the direction half-plane (with 0.5·size
  overlap tolerance for hex rows);
- score = primary-axis distance + 2.2 × orthogonal offset − alignment bonus
  when rects overlap on the cross axis;
- works unmodified on the hex grid (a hex's 6 neighbors ARE the nearest
  centers in the 4 directions; NE/NW resolve from `up` + horizontal bias).
Pure function `pickDirectional(from: Rect, candidates: Rect[], dir)` —
unit-tested on fixture grids (rows, columns, hex offsets, wrapped grids).
Rect reads happen **once per nav intent** (≤ every 130 ms held), batched,
scoped to the active root — no layout thrash.

### 5.4 Focus persistence across re-renders (the hard problem)

Focused element = `{el: WeakRef, key: descriptor, lastRect}` where the
descriptor is `data-gp-key || data_space_id || data-test || (scopeId +
normalized class + index)`. On every input event (and a light 400 ms
validity tick — `isConnected` check only, no rects):
- `el.isConnected` → keep;
- else re-query the descriptor within the scope → re-point silently;
- else nearest focusable to `lastRect` → calm ring glide (`motionMs`);
- else scope's first focusable.
Focus is therefore **never lost and never trapped**: a reset-epoch that
closes an overlay changes the scope resolution itself, and the engine
re-seats on the new scope's remembered-or-first element. Per-scope
last-focus memory (`Map<scopeId, descriptor>`) restores position when
returning to a surface (e.g. overlay → zoom → back).

### 5.5 Activation grammar (the global A/B contract)

| Control | Semantics everywhere |
| --- | --- |
| **A** | Activate the focused element = synthetic `el.click()` (real MouseEvent, bubbles, hits capture-phase guards — placement lock included). On `.board-space--available` this IS the existing placement flow. |
| **B** | Back/close for the scope: dispatch a synthetic window `keydown Escape` (drives the 20 audited Esc handlers + native dialogs), and where the surface has no Esc handler (Milestones/Awards/Std-Projects dropdowns, colonies, notifications) fall back to clicking the scope's close/cancel selector. Encoded per scope-def; **never invents a close** for non-dismissable prompts (mandatory modal B = minimize, mirroring its own affordance). |
| **X** | Contextual secondary: `dblclick` where the surface defines one (Actions quick-activate), toggle-select in multi-select grids, view-toggle in Played. |
| **Y** | Inspect: fullscreen-zoom the focused card (clicks the same card body the mouse clicks), or toggle details where a surface has them. |
| **LB / RB** | Cycle the bottom-bar overlay ring (clicks the real `.bottom-bar-btn`s, so the `activeOverlay` machine + minimize semantics stay authoritative); inside CardZoomModal = prev/next card; inside endgame = prev/next tab. |
| **LT / RT** | Fast-adjust (steppers ±5 / MAX), page-scroll long feeds. |
| **Left stick / D-pad** | Spatial focus movement. |
| **Right stick** | Scrolls the focused element's nearest scrollable ancestor (`overflow auto/scroll`, scrollHeight > clientHeight) — journal feed, master grids, VP report. |
| **View** | Toggle journal. **Menu** | Controller help legend (full mapping overlay). |
| **L3** | Snap focus board ↔ chrome (the KeyA/KeyD idea, controller-native). |

### 5.6 Hover parity

Focusing an element dispatches synthetic `mouseover` (bubbling — feeds the
board's delegated cell-inspector and `SelectSpace`'s illegal-reason popover)
+ `mouseenter` (direct — feeds Vue `@mouseenter` hover previews: VP
cross-link, journal chips, awards rows), and adds a `gp-focus` class; blur
mirrors with `mouseout`/`mouseleave`. CSS hover affordances gain one
addition in their own files: `.premium-tooltip`'s `:hover` gate is extended
with `.gp-focus[data-hint]` (one mixin edit) — so "why disabled" tooltips
work on focus. Mode-exit clears any synthetic-hover residue.

### 5.7 Board navigation + placement

- Base scope: d-pad walks **all** board cells (geometric nav on hex centers
  is natural); focused cell fires the hover inspector (§5.6) — the board
  explains itself exactly as on hover.
- Placement (picker scope): navigation is still all-cells (so illegal
  reasons remain inspectable — one unavailability system), but the ring
  renders the **legal/illegal state** (cyan vs dim-red ring tint); A on an
  available cell = the existing per-cell `onclick` (→ preview + confirm
  flow); A on illegal = shake + haptic tick, no-op. B = the banner's cancel
  when `placementContext.cancellable`, else no-op (honest, like the banner).
- First entry into picker scope seeds focus on the available cell nearest
  the board center (predictable landing).

### 5.8 The focus ring (`GamepadFocusRing.vue`)

ONE fixed-position, `pointer-events:none` element teleported to body
(z 12780 — above every blur backdrop, below the hint bar 12790 and glyph
popovers), morphed to the focused element's rect via transform + width/height
with `motionMs(140)` + `MOTION_EASE.standard` (reduced-motion: instant).
Dark-glass premium styling: 1px cyan rim + corner L-ticks (the fork's
signature), soft outer glow; variant tints (`--illegal` red, `--card` wider
radius). A single ring avoids per-component CSS entirely and survives any
re-render (it tracks rects, not elements). It carries the **A-glyph badge**
at its corner (§6) so the primary action is always labeled at the point of
attention.

---

## 6. Glyph layer (Xbox-first, set-extensible)

- `glyphSets.ts`: `GLYPH_SETS = {xbox: {confirm: {label: 'A', tone:
  '#59c135'}, back: {label: 'B', tone: '#e2453e'}, ...}}` — semantic button →
  presentation. Adding PS/Switch later = one more entry + a settings knob;
  nothing else changes (semantics never leak platform names).
- `GamepadGlyph.vue`: SVG-drawn badge (circle/pill + letter/shape, like
  `BarButtonIcon` — **no image assets**), dark-glass chassis + toned letter,
  sizes `s/m`. Bumpers/triggers/d-pad/sticks get shaped pills.
- `GamepadHintBar.vue`: bottom-center, `pointer-events:none`, dark-glass
  capsule listing the *current* scope+focus actions ("Ⓐ Выбрать · Ⓑ Закрыть ·
  LB/RB Панели · Ⓨ Карта"). Hints come from `hintModel.ts` (PURE:
  `(scopeId, focusKind) → HintSpec[]`) — the SAME scope resolution that
  routes input, so the bar can't lie (single source of truth). Labels are
  i18n keys.
- Ring badge (§5.8) shows A (+ Y when the focused element is a card).
- Discoverability: **Menu** opens a full mapping legend overlay (own scope,
  B closes).

## 7. Haptics (premium feedback, phase 5)

`haptics.ts` wrapper over `vibrationActuator.playEffect('dual-rumble', …)`
(feature-detected, setting-gated, reduced-motion-respecting): confirm =
40 ms light; blocked/illegal = 2×25 ms; placement commit / turn start =
80 ms medium. Never on focus moves (noise).

## 8. Electron notes

Same Chromium Gamepad API; `app://` is a secure context; no permission
prompt for gamepads in Chromium (only the user-gesture visibility gate,
which our mode-entry already satisfies). Fullscreen-by-default means the
window keeps focus → rAF keeps running; a backgrounded window pauses rAF and
therefore polling — acceptable (input is meaningless unfocused) and the
`perf.ts` background-throttling switches don't change this for rAF.
`backgroundThrottling:false` keeps timers alive but we deliberately key the
loop off rAF + visibility. No main-process changes required; no IPC.

---

## 9. Coverage matrix (brief §4 → design)

| # | Requirement | Covered by |
| --- | --- | --- |
| 1 | Input-mode detection + cursor hiding | §4.3 mode machine (`html.gp-mode`, isTrusted exit detection, hysteresis) |
| 2 | Focus/spatial model for teleported structural-sharing UI | §5.1–5.4 (DOM-driven scopes, descriptor persistence, geometric nav) |
| 3 | Contextual glyphs on actionables | §6 (ring badge at point of attention + scope hint bar + Menu legend; single-source hint model) |
| 4 | Board nav + placement | §5.7 (all-cells nav, legal/illegal ring, A=existing onclick, B=cancellable-aware) |
| 5 | Card navigation (grids + fullscreen) | §5.2 grids are buttons; CardZoomModal scope maps LB/RB/←→ + A on #actions slot; Y=zoom everywhere |
| 6 | Overlay control + stick scrolling | §5.5 LB/RB ring via real bottom-bar buttons; right-stick scroll §5.5 |
| 7 | Mandatory/modal prompts incl. focus trap | scope 2 confines focus; steppers via A + LT/RT fast-adjust; select→confirm preserved (A=select, A-on-CTA=confirm); minimize = B |
| 8 | Orchestration flows | scope 3 defs for start-game/draft/initial-draft; their buttons are ordinary focusables; pills are tabindex=0 already |
| 9 | Standard turn actions | all are dedicated buttons (audit §2.1) → generic engine; placement-lock guards fire on synthetic clicks unchanged |
| 10 | Confirm/back grammar | §5.5 table; B mirrors Esc/close/minimize/cancel per scope-def, never invents dismissal |
| 11 | Notifications/reveals/endgame/rematch | scope defs + their audited buttons (CTAs, tabs, take-all, reveal-ok) |
| 12 | Connect/disconnect/multi-pad/gesture-gate | §4.2 (active-pad rule, visibility pause, connect-on-press is mode-entry) |
| 13 | Accessibility & settings | reduced-motion honored in ring/hints/haptics; `gamepad_enabled` + deadzone knobs; mouse/keyboard untouched (invariant 2) |
| 14 | Residual legacy cases | §2.3 table (known-gap AndOptions/factory-fallback = completable-not-premium; ConfirmDialog/SelectSpace in scope) |

## 10. Library recommendation: BUILD (zero deps)

| Candidate | Verdict |
| --- | --- |
| `js-spatial-navigation` (luke-chang), WICG `spatial-navigation-polyfill` | Stale (yrs), drive **native DOM focus** (violates invariant 2: keyboard `:focus` visuals + scroll side effects), global-config sections ≠ our z-stack scopes, no teleport awareness. Adapter cost > engine cost. **Reject.** |
| `@noriginmedia/norigin-spatial-navigation` | React-only. **Reject.** |
| CSS spatial navigation (`navigation-*`) | Not shipped in Chromium. **Reject.** |
| `joypad.js` / `gamepad.js` / `gamecontroller.js` | Unmaintained thin wrappers over a ~150-line poll loop; none integrate with our frame-gate/motion/test discipline or semantic-repeat needs. **Reject.** |

The whole subsystem is ~1.2–1.5k LOC of fork-owned code, of which the
genuinely novel parts (scope resolver, descriptor persistence) exist in **no**
library because they encode THIS app's architecture. Console-port patterns
adopted conceptually: bottom hint bar + snap focus ring (Steam TM port, BG3,
Steam Big Picture), bumper surface-cycling; radial menu **rejected**
(discoverability cost, duplicate of the bumper ring, heavy custom UI).

## 11. Phased plan (each shippable, each behind the `?gp=0` kill switch)

| Phase | Scope | Done criteria | Rollback |
| --- | --- | --- | --- |
| **1 — Input core** (load-bearing) | `gamepadPollModel` + `gamepadCore` + `inputModeState` + settings + `?gpDebug` overlay | Pad press → `gp-mode`, cursor hidden; mouse restores instantly; debug overlay shows live intents; pure specs green; builds green | `?gp=0` / pref off — subsystem fully inert |
| **2 — Focus engine** | scopes + spatialNav + focusEngine + ring + A/B/X/Y + hover synthesis + stick scroll | Complete a *simple turn* on controller: open overlays, claim milestone, pass; focus never lost across a server response | same |
| **3 — Glyph layer** | glyphSets + GamepadGlyph + hint bar + ring badge + Menu legend + ru i18n | Hints correct on every scope (hintModel specs); premium look review | same |
| **4 — Surface tuning** | board/placement polish, LB/RB ring, zoom-browser mapping, stepper fast-adjust, per-scope seeds/memory | Coverage matrix rows 4–7 demo-complete; placement + payment + draft on controller | same |
| **5 — Full-coverage pass + haptics** | orchestration/endgame/rematch scope defs verified end-to-end, haptics, legend polish, Electron smoke | **Headline gate: a full game start→rematch on controller alone**; matrix 100% | same |
| **6 — Follow-ups (post-v1)** | PS/Switch glyph sets + setting UI, ModernAndOptions premium replacement, spectator-home | — | — |

## 12. Risks (the honest list)

| Risk | Mitigation |
| --- | --- |
| Focus lost/misplaced across structural-sharing re-renders + reset-epoch | §5.4 descriptor + nearest-rect + scope-first fallback; per-scope memory; validity tick is isConnected-only (cheap) |
| A new modal ships without a scope def | generic `dialog[open]` + mandatory-modal defs catch the big classes; doc rule in CLAUDE.md; `?gpDebug` shows scope live |
| Synthetic events misread by outside-click / guards | they're real targeted MouseEvents through the same capture path — the audit confirms guards key off target+phase, not isTrusted; mode machine ignores untrusted events for its OWN detection |
| Hex nav feel | tunable cone weights; fallback documented: adjacency graph from the board model (spaces carry x/y) if geometry disappoints |
| Poll/ring perf | DOM-free loop, idle early-out, nav-event-only rect reads, single transform ring, module (non-reactive) hot state |
| Mode flapping | 12 px hysteresis + isTrusted + no keyboard-repeat exit |
| Hint bar lying | hints derive from the same resolver that routes input; pure-model specs |
| Gesture gate (pad invisible until press) | first press = mode entry by design; legend explains |
| Steppers tedious | LT/RT fast-adjust + MAX is a focusable; phase-4 d-pad adjust mode if needed |

## 13. Test strategy

- **Pure (server mocha runner)**: `gamepadPollModel.spec.ts` (edges,
  repeat cadence, deadzone, trigger hysteresis), `spatialNav.spec.ts`
  (fixture grids incl. hex offsets), `hintModel.spec.ts` (scope→hints),
  `focusDescriptor.spec.ts` (key derivation/re-resolution logic with fake
  elements).
- **Component (mochapack/JSDOM)**: GamepadGlyph render, hint bar render,
  scope-def visibility predicates on mounted fixtures. Geometry is
  JSDOM-no-op by design (rects are 0) — same documented pattern as the fit
  engines.
- **Manual gates per phase** (`?gpDebug`): scripted click-through lists in
  the phase done-criteria; Electron smoke in phase 5.

## 14. i18n & assets

- No binary assets: glyphs are inline SVG.
- New ru keys in `ui.json` (grep-first; canonical РТ/ПО terms): hint verbs
  (`Select`, `Back`, `Close`, `Panels`, `Zoom card`, `Scroll`, `Cancel
  placement`, `Controller connected/disconnected`, legend strings). Hint
  verbs reuse existing keys where the exact string already exists.

---

## 12′. STATUS LOG (implementation)

- **Phase 1 — DONE.** `src/client/gamepad/gamepadPollModel.ts` (pure; 12
  specs), `gamepadCore.ts` (connect/disconnect, rAF loop w/ idle early-out +
  visibility pause, active-pad election, install/uninstall symmetric),
  `inputModeState.ts` (`html.gp-mode`, isTrusted-only exit, 12px hysteresis),
  `gamepadSettings.ts` (`?gp=0` kill switch, `?gpDebug`, `tm_gp_deadzone`),
  `gamepad_enabled` preference (default true).
- **Phase 2 — DONE.** `spatialNav.ts` (pure; 10 specs incl. hex offsets),
  `focusScopes.ts` (18 scope defs, audited roots + per-scope back specs),
  `focusEngine.ts` (descriptor persistence, hover synthesis, A/B/X/Y,
  right-stick scroll, per-scope memory, 400ms validity tick),
  `GamepadFocusRing.vue` (single fixed ring, L-ticks, illegal/card variants,
  denied shake, A-badge), `gamepad.less` (imported in `common.less`),
  `.premium-tooltip` mixin extended with the `.gp-focus` hover-parity gate.
- **Phase 3 — DONE.** `glyphSets.ts` (Xbox set, semantic-only interface),
  `GamepadGlyph.vue` (CSS-drawn badges, no assets), `GamepadHintBar.vue` +
  `hintModel.ts` (pure; 7 specs), Menu legend overlay + connect toast +
  `?gpDebug` readout in `GamepadLayer.vue` (App-level, next to
  NotificationLayer), 16 new ru keys in `ui.json` (5 reused).
- **Phase 4 — DONE (first pass).** LB/RB overlay ring via `data-gp-overlay`
  attrs on the PlayerHome bar buttons (additive), CardZoomModal d-pad ←/→ →
  synthesized Arrow keys (reuses its audited handler + animating guard),
  View=journal, L3 board↔chrome snap, LT/RT ×5 stepper fast-adjust
  (verified cluster classes), placement seed = available cell nearest board
  center + illegal ring tint, clickable-div coverage (`.bottom-bar-btn`,
  `.compact-action`, `.left-panel-card`, `.colony-tile`, notifications).
  Gates run: 29 pure specs green, ESLint clean, vue-tsc clean, `make:css` +
  `make:json` + `build:client` green.
- **Phase 5 — PENDING.** Haptics (`haptics.ts`), the headline end-to-end
  full-game-on-controller verification (needs a physical pad), Electron
  smoke, spectator-home scope, glyph-set/deadzone settings UI. The `?gp=0`
  kill switch is live for everything shipped above.
