---
description: Motion tokens, animation holds and the single-foreground presentation timeline.
paths:
  - "src/client/components/motion/**"
  - "src/client/components/presentation/**"
  - "src/client/components/feedback/**"
  - "src/client/console/surfaceMotion/**"
  - "src/client/console/ceremony/**"
  - "src/client/components/marsbot/**"
---

# Animation rules

## One motion system — no hand-rolled durations
`src/client/components/motion/motionTokens.ts` is the single source of animation speed. JS timings resolve through **`motionMs(base)`**, CSS animations through **`calc(<base>ms * var(--motion-scale, 1))`**, easing from **`MOTION_EASE`**. Presets `calm|standard|swift` (`?motion=`, `tm_motion_speed`); rAF loops use `createFrameGate` (`?motionFps=`). `prefers-reduced-motion` is a separate overriding axis and must be honoured.

Taste: Ark Nova (BGA) feel — short easings, subtle scale/glow, no hard pop-ins, calm by default. Never introduce flashy motion just because something changed.

## Animation holds — never a timer, never an ad-hoc gate
Every CRITICAL animation is a first-class foreground occupant via `presentation/animationHold.ts`:
- `registerAnimationHoldSupplier(label, predicate)` at module scope for a flow with a reactive "scene owns the foreground" predicate, or `beginAnimationHold(label)` for a component beat (idempotent release from every exit path).
- **⚠️ A SUPPLIER PREDICATE MUST READ VUE-REACTIVE STATE. A plain module `let` KILLS the whole registry.** The live count is a `computed` and the 35 s ceiling is a `watch`, both over predicates the registry does not own — a non-reactive read invalidates neither, so the count sticks at whatever it last was: `foregroundBlockReason()` returns `'animation'` forever with NOTHING holding, the ceiling never arms, and no expiry can cure it (reading the predicate directly correctly says false → "expired nothing", warn `leaked hold: none named`). This shipped as a dead game (`hand-delivery`'s `activeRuns`). Net under it: the console watchdog calls `refreshAnimationHolds()` every 1 s tick, and a count with zero live labels is treated as a provable phantom.
- Wrappers: `holdAnimationWhile(label, promise)`, `holdForGsapAnimation(label, tl)` (releases on completion AND on kill via a chained `onInterrupt`).
- **The release IS the flow's own completion signal (GSAP `onComplete` → the reactive flag drops) — NEVER a `setTimeout`.** A 35 s ceiling force-releases a leaked hold with a warn; a hold the watchdog has to recover TWICE is quarantined for the session.
- **⚠️ Any promise you `await` around a GSAP animation MUST settle on `onInterrupt` too, not just `onComplete`.** A killed tween (unmount, `killTweensOf`, overwrite, teardown) never fires `onComplete`, so the `await` hangs forever, the enclosing `finally` never runs, and its bookkeeping leaks permanently — that is how `handDeliveryDirector`'s `activeRuns` pinned a `'notification-only'` hold true for a whole session and froze the event queue. Copy `holdForGsapAnimation`'s chained-`onInterrupt` pattern (never clobber an existing handler).
- Scope `'blocking'` by default; `'notification-only'` only for a cinematic that runs INSIDE a mandatory surface (a blocking hold would unmount its own stage — self-deadlock).
- **A new hold that hides the console task host while the server waits must add its DOM root to the leak detector's `SERVING_SURFACES`.**
- Never write a local `setTimeout` gate or an ad-hoc OR-chain in a shell computed.

## One foreground item at a time
`presentation/presentationFlow.ts` sequences client-side delivery: blocking surfaces acquire/release a **lease** around their EFFECTIVE visibility (release fns idempotent, watchers keep them in lockstep); notifications are serial FIFO with a MONOTONIC lifecycle (created → prepared → queued → presented; a blocker gates only queued → presented — a PRESENTED card is never re-queued, evicted or semantically upgraded; it leaves only by its own timer or the player’s B — docs/claude/notifications.md § ATOMIC DELIVERY). A new flow-holding item sets `holdsFlow` on its `NotificationModel`. `presentationPolicy.ts` holds the pure vocabulary and is unit-tested.

**A lease is a CLAIM that a surface is VISIBLE — derive it from the same expression as that surface's `v-if`, never a hand-written superset.** Every desync froze the game permanently (the queue can't drain, no mandatory surface can mount, and the leak detector's guard is disarmed while an announce gate holds). Two shipped that way: the reveal lease ignored the overlay's `!playedHeroHolds`, and `taskHeldForWorkspace` is documented "render nowhere" yet still held one. The net is `consoleForegroundWatchdog.ts` (leak-detector check 3): claimed + nothing rendered + something waiting, for 3 passes on the board home → the claims are EXPIRED (masked until they go honestly false — `animationHold`'s semantics), the queue drains and it names what it expired. **Note the admission signals bypass the 35 s animation ceiling entirely** — `admits(...)` reads raw scene predicates, so a leaked flow flag holds every prompt closed until the watchdog masks it.

Bot turns are notification-first with staged visual commits (`marsBotPresentation.ts`); read the archive, never re-derive scripts.

## Landing rects are RESTING rects; source rects are RAW
`cardFlight/landingRect.ts` is the ONE answer to «where will this element rest?». A flight's **LANDING** is measured with `restingRectOf(el)` — it subtracts the element's own inline pure translation (the GSAP case) AND un-maps every live CSS animation/transition on the element or an ancestor toward its END keyframe (an entry → identity; a retargeted transition → its destination, which is what makes a mid-page-turn album slot aim at the final berth). Static positional transforms (translate(-50%) centring, the album's page berth) have no live animation and are never touched. A **SOURCE** is measured RAW (`getBoundingClientRect`) — the proxy must be born over the pixels the player currently sees, never over the rect the card will occupy later. Mixing the two up is a visible defect on BOTH sides: a resting source teleports the proxy at spawn; a raw landing snaps the card at the handoff (measured 26×9 px @1080 / 61×18 px @4K before the fix). The pure un-map math is spec'd in `tests/client/console/landingRect.spec.ts`.
`extractPlayRewards` (`resourceTransfer/resourceTransferModel.ts`) turns a play preview into transfer specs. A card-resource gain reaches it two ways: an `ActionEffect` chip noted `'to a card'`, **and** a bespoke card-target STEP (`actionPreviews.selectCardStep` with a positive `amount`) that carries no chip at all — the whole Freyja Biodomes / Venusian Plants family, whose resources used to land on the target with no flight. The step is authoritative by the same rule `selectCardStep` already trusts to derive `vpBox` from that amount. **The resource is the PICKED card's own `resourceType`** (read off the step's candidate models), because a card that adds "a microbe or an animal, depending on your choice" has no honest icon up front. Excluded: `repeatAction` picks (candidates are actions) and `copyProductionBox` picks (handled as production).

## Test gotcha
Module state is bundle-shared in mochapack: a spec that leaves a flow's `active`/`current` set keeps its animation hold live and blocks notification delivery in every later spec. Reset in `after()` (the `maCeremonyState.spec` reset is the reference).

## Deep reference
`docs/claude/presentation-flow.md`, `docs/claude/energy-heat-conversion.md`, `docs/claude/terraforming-progress-hud.md`, `docs/CONSOLE_SURFACE_MOTION.md`, `docs/REMOUNT_ANIMATION_REWORK_DESIGN.md`.
