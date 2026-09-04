# SCENE TRANSITION — the readiness-gated lifecycle of every screen boundary

Module: `src/client/console/loadingScreenState.ts` (the DIRECTOR) ·
Surface: `src/client/components/console/ConsoleLoadingScreen.vue` (`.con-load`) ·
Specs: `tests/console/sceneTransition.spec.ts`, `tests/client/components/ArcScaleMarkerChip.spec.ts`,
e2e `tests/e2e/console-scene-transition.spec.ts`.

## The model

The GAME BOUNDARY stays a **deliberate full reload** — five board baseline modules
(`accentBaseline`, `tileBaseline`, cube/marker baselines, `arcFillBaseline`), the
notification ledgers and dozens of module states rely on a fresh page for per-game
cleanliness (see the hydration audit below). The director makes that boundary a
directed scene:

```
idle → covering → revealing → idle        (+ the error/retry state)
```

- `navigateWithCurtain(url, stage, context?)` paints the curtain (double-rAF),
  hands `{stage, context, t0}` to the next page via sessionStorage
  (`tm_boot_curtain`, now JSON), then navigates. `t0` is the ORIGINAL press
  timestamp — the text policy spans the reload.
- **The curtain never drops on «data arrived».** `App.watch.screen` only calls
  `noteScreenResolved(screen)`. A screen in `READINESS_AWARE_SCREENS`
  (`player-home`, `main-menu`, `campaign`) reveals only after its destination
  component **arms** (`armSceneDestination()`) with every registered **hold**
  (`deferSceneReveal(name, maxMs)`) released, followed by a SETTLE (two probe
  ticks, conditions re-verified after them — a hold registered mid-settle
  postpones honestly). Legacy screens reveal on resolution (they have no boot
  work).
- **Everything is bounded**: each hold has a max (force-release + warn), an
  aware screen that never arms reveals at `ARM_WATCHDOG_MS`, a boot whose route
  never resolves becomes the error state at `BOOT_STALL_MS`. Stale releases and
  stale async completions are epoch-guarded; a repeat navigation while one is
  departing is ignored (`navPending`).

## Registered holds (per destination)

| Destination | Hold | Released when |
| --- | --- | --- |
| ConsoleShell | `fonts` | `document.fonts.ready` |
| ConsoleShell | `start-scene` (only when `startFrameLive`) | the start scene actually renders — a new game reveals INTO its opening composition |
| ConsoleBoardSection | `board-fit` | the self-calibration CONVERGES (the `!sizeDrift && !offsetDrift` branch) — the board is never revealed mid-convergence; released at once when the stage is hidden |
| GameAtmosphere | `atmosphere` | `stars.jpg` fetched AND decoded |
| ConsoleMainMenu | `menu-bg`, `fonts` | menu backdrop decoded / fonts ready |
| ConsoleCampaignMap | `campaign-model` | `openCampaign(id)` resolved + one tick |

A new destination screen: register holds FIRST, then `armSceneDestination()`.
A new mid-boot surface that must be standing at the reveal: `deferSceneReveal`
in its `mounted()` gated on `loadingScreenState.phase === 'covering'`.

## Text policy (the anti-flash rule)

The status block (`.con-load__foot`) exists only past `TEXT_APPEAR_MS` (900 ms)
of covering — a fast load shows the ambient scene only, never a text flash.
Once shown, the reveal may not start under `TEXT_MIN_DWELL_MS` (1150 ms).
`LONG_WAIT_MS` swaps the phrasing. The error state and the fullscreen-restore
prompt are actionable and bypass the appear delay. No fake progress, no
technical stage names — the composition carries the CONTEXT
(`TransitionContext`: new game / resume / campaign mission N of M / campaign
map / main menu), all through i18n.

## The reveal

One atomic visual commit: `phase = 'revealing'` fires the one-shot
`onSceneRevealed` callbacks (the campaign map's creation cinematic starts THERE,
never under the curtain), the curtain plays `.con-load-fade-leave-active`
(620 ms — mirrors `REVEAL_MS`), then `endLoading()`. The curtain's ENTER is
deliberately instant (it must be opaque on the frame it is raised — the
double-rAF navigation counts on that).

## Live-hardware fixes (Steam Machine, 2026-09-04)

Three defects only a real couch run exposed, all fixed at the source:

1. **The phantom «Восстановить полноэкранный режим» plate.**
   `requestConsoleFullscreen()` used to enter **DOM** fullscreen even inside
   the Electron shell (on top of native window fullscreen). DOM fullscreen
   dies at every navigation BY SPEC → the boot flags read «fullscreen lost»
   → the curtain showed the restore plate → its retry re-entered DOM
   fullscreen → every transition repeated the loop. Now: the native shell
   (`supportsNativeFullscreen()`) is a strict no-op there, and BOTH sides of
   the FS handoff (`navigateWithCurtain` writer, `consumeBootFlags` reader)
   are browser-only. The restore prompt can no longer exist in the shell.
2. **The curtain re-composing small → big at boot.** Under gamescope the
   fresh window's dimensions are TRANSIENT for the first beats; an immediate
   heuristic recompute painted scale 1, and the settled recompute visibly
   re-scaled the curtain. `consoleLayoutProfile` now persists the last
   SETTLED `{profile, uiScale}` (`tm_console_profile_seed`), paints the
   first frame from it synchronously, holds ordinary recomputes for the
   settle window (`seedGuardUntil`, 1.4 s) and confirms with one forced
   recompute at 1.5 s. A user override keeps its profile but still seeds its
   SCALE (a forced tv pick had the same jump). Display genuinely changed
   between sessions → corrected once, usually under the curtain.
3. **The phantom «Контроллер отключён» toast at game entry.** A Chromium /
   Steam-Input DEVICE SWAP (focus change, the reload settling) arrives as
   disconnect+connect on the same slot within milliseconds. The toast is
   debounced (`PAD_LOSS_TOAST_MS` = 1.5 s): it speaks only if the pad count
   has not recovered — a real unplug still toasts, a swap never does.

## Input

`sceneTransitionInputLocked()` is consulted centrally in
`consoleRouter.dispatchConsoleIntent` — while the curtain owns the frame every
gameplay intent is consumed (observers still run: falling edges that STOP
things must never be swallowed). The curtain's retry / fullscreen buttons ride
the DOM focus engine (scope `loadingScreen`), which the gate exempts
(`fullscreenLost`) or unlocks (error state).

## The ONE exit funnel

`ConsoleShell.syncGameExitTarget()` registers at mount where «выйти из партии»
leads — `/campaign?id=…` (+ mission context) for a campaign mission, `/` for an
ordinary game — and BOTH exit doors (`GamepadLayer` system-menu confirm,
`GameExitButton`) call `exitGameToMenu()`. Never a raw `location.assign` from a
game, and never a hand-picked destination at a door.

## Hydration is not a game event (the audit's verdict)

The 2026-09 audit of every state-diff animation system found exactly ONE
unguarded first-apply ignition: `ArcScaleMarkerChip` consumed the module claim
ledger from `mounted()` — inverted since the no-remount rework (every
already-claimed scale bonus IGNITED on entering an existing game, while a live
claim never animated). The contract now mirrors the tile/cube/marker baselines:
**`mounted()` seeds the ledger silently (adoption); the `claimIdentity` watcher
is the only igniting path (a witnessed transition).**
`resetScaleBonusClaimsSeen()` joined the in-session new-game boundary reset in
`NotificationLayer.handleGenerationAndPass`.

Everything else was already guarded (arm gates opened only by commit paths and
explicitly skipped when `prevView === undefined`; `seeded` flags; first-sighting
snaps). ⚠️ That safety is largely GUARANTEED BY THE RELOAD BOUNDARY — an
in-app game switch would break the five baselines wholesale (`App.vue`'s arm
decision would read game A's spaces against game B's). Keep the boundary a
reload, or do the full `resetGameSessionState()` audit first.
