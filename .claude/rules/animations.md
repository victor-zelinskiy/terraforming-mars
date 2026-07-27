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
- Wrappers: `holdAnimationWhile(label, promise)`, `holdForGsapAnimation(label, tl)` (releases on completion AND on kill via a chained `onInterrupt`).
- **The release IS the flow's own completion signal (GSAP `onComplete` → the reactive flag drops) — NEVER a `setTimeout`.** A 35 s ceiling force-releases a leaked hold with a warn.
- Scope `'blocking'` by default; `'notification-only'` only for a cinematic that runs INSIDE a mandatory surface (a blocking hold would unmount its own stage — self-deadlock).
- **A new hold that hides the console task host while the server waits must add its DOM root to the leak detector's `SERVING_SURFACES`.**
- Never write a local `setTimeout` gate or an ad-hoc OR-chain in a shell computed.

## One foreground item at a time
`presentation/presentationFlow.ts` sequences client-side delivery: blocking surfaces acquire/release a **lease** around their EFFECTIVE visibility (release fns idempotent, watchers keep them in lockstep); notifications are serial FIFO and re-queue when the foreground gets blocked. A new flow-holding item sets `holdsFlow` on its `NotificationModel`. `presentationPolicy.ts` holds the pure vocabulary and is unit-tested.

Bot turns are notification-first with staged visual commits (`marsBotPresentation.ts`); read the archive, never re-derive scripts.

## Test gotcha
Module state is bundle-shared in mochapack: a spec that leaves a flow's `active`/`current` set keeps its animation hold live and blocks notification delivery in every later spec. Reset in `after()` (the `maCeremonyState.spec` reset is the reference).

## Deep reference
`docs/claude/presentation-flow.md`, `docs/claude/energy-heat-conversion.md`, `docs/claude/terraforming-progress-hud.md`, `docs/CONSOLE_SURFACE_MOTION.md`, `docs/REMOUNT_ANIMATION_REWORK_DESIGN.md`.
