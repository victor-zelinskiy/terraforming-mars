# The transport rework — `WaitingFor.vue` retired, WebSocket confirmed primary

**Date:** 2026-08-22 · **Status:** DONE, verified · **Context:** the last item of the desktop-removal load-bearing list (`DESKTOP_REMOVAL_WAVE_3.md` §6).

## 1. What changed

`WaitingFor.vue` — the last load-bearing legacy file (1 533 lines, upstream name, headless since wave 2) — is **deleted**. Its responsibilities moved verbatim into a module + a thin component:

- **`src/client/console/transport/gameTransport.ts`** (@console-shared) — THE game transport:
  - the `/api/waitingfor` **poll chain** (GO/REFRESH/WAIT, the viewer-mid-prompt guard incl. the optional-draft exception, END-phase stop, visibility/focus wakes, the realtime wake, the post-submit immediate re-ask);
  - the **submit funnel** — `submitInput` / `submitBatch` / `cancelPlacement` → POST `/player/input(-batch)`, then the console cinematic-gate pipeline (played-hero / patent-sale / std-project / discard / tile-hero / trade-fleet / colony-trade / bot staging / WGT–tile–cathedral–cube previews / hazard cleanup / conversion / hydro / colony-build — order preserved comment-for-comment) with the full refusal/network **unwind battery**;
  - the **view apply** (structural sharing + the `playerkey` reset epoch + the card-pick preserve guards);
  - **turn presentation** (title / favicon / the ◑◒◐◓ spinner / the your-turn notification);
  - holds are the reactive **`transportHolds`** record (was: 13 component data flags); `transportHolding()` is the exported disjunction.
  - The module drives a narrow **`TransportRoot`** contract (the App root satisfies it structurally; tests pass a fake) — injected at `startGameTransport`, never imported.
- **`src/client/components/console/ConsoleBoardBinder.vue`** — the transport's lifecycle owner and the mount point of the one legacy remnant: the `SelectSpace` **board cell-binder** (its `mounted()`/`saveData()` are the console's one tile-submit path). Renders nothing else; the binder is suppressed during `transportHolding()` and the console placement-admission hold, exactly as before.
- **ConsoleShell**: the three `$refs.waitingFor.*` calls became direct module imports — the `$refs` indirection is gone. Every submission in the app is now `gameTransport.submitInput()`.

## 2. The WebSocket verdict (the architect pass)

The fork **already ships a complete WS realtime system** (the phased migration, Phase 12 = default-ON):
- **Server**: `server/realtime/RealtimeServer.ts` + `RealtimeHub` on the `/ws` upgrade path of the same HTTP server — default ON (`REALTIME_ENABLED=0` restores byte-identical legacy polling). Emission points already sit at the central mutation sites (GameServer / GameLoader / bot scheduler / rollback / rematch).
- **Client**: `realtimeService` (hello / heartbeat / rooms / `INVALIDATED` with the gameAge+undoCount cursor / `RESUME` on reconnect) → `realtimeSync` (burst coalescing + storm cap) → **the same guarded refresh path the poll uses** (`waitForUpdate(true)`). Default ON; `?realtime=0` is the kill-switch.
- **Poll policy**: while the socket is strictly healthy the fallback poll stretches to **20 s** (`LONG_POLL_MS`); any WS degradation wakes an immediate re-arm at the safe 1 s interval.

**Decision: keep this exact shape — push-NOTIFY + guarded HTTP fetch — and do not move game state onto the socket.** The wake path preserves every guard (mid-prompt, preserve overlays, animation holds, the reset epoch) by construction; a state-over-WS channel would duplicate the model pipeline for no material latency win on the primary platform (host-as-server / LAN, ~1 ms RTT). Deliberately NOT done, recorded as future options: enriching `INVALIDATED` with the `waitingFor` colors (saves one probe round-trip per update — protocol bump for a negligible LAN gain), and a lobby room for the menu's join-games/LAN polling (a new protocol surface).

## 3. Verification

- webpack **0 errors** · vue-tsc clean · eslint clean on the new files · `build:test` clean.
- `test:client` **4 330 / 0** (the binder spec ported: binder for `space`, nothing otherwise, admission hold blanks it; + module reset hygiene).
- e2e on the rebuilt bundle: `console-wheel-commit-geometry` (real standard-project submits through the new funnel incl. the gold-sweep hold) + `console-workspace-band` + `console-repeat-pick` — **10 / 10**; longgame perf probe (real rival ingest cycles through the poll/WS loop) — **PASS 2 / 0**.

## 4. Notes for future work

- The transport module guards a rootless/viewless start (a unit-test mount, a boot race) by idling — the binder re-starts it when a real view exists.
- `SelectSpace.vue` + `GoToMap.vue` are now the ONLY legacy files the console stands on (the cell-binder). Replacing them = a native board-input module owning `.board-space--available` + per-cell onclick; a separate wave.
- `transportState.playersWaitingFor` mirrors the root field; new consumers should read the module, not the root.
