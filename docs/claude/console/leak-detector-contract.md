<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Console native mode — the leak-detector contract (read before adding a console surface)

The console-first shell (`ConsoleShell.vue`, `?console=1`; full design in `docs/CONSOLE_MODE_CONCEPT.md`) has a **leak detector** (`src/client/console/consoleLeakDetector.ts`, a 1 s tick while the shell lives) whose job is to make a mixed/broken input state VISIBLE instead of silent: if the server is waiting on a prompt, the console does NOT serve that `TaskKind` via a shell-own surface (`SHELL_NATIVE_KINDS` = only `actionMenu`/`space`), and **NO serving-surface DOM node is actually rendered**, it sets `leakDetectorState.stranded` → `ConsoleStrandedPrompt.vue` draws the honest amber guard panel ("Этот запрос пока недоступен в консольном режиме").

**THE GOTCHA — a brand-new console surface that renders its OWN root class (not `.con-task-host`) is invisible to the detector, so it gets MASKED by the stranded guard even though it renders correctly underneath.** This bit the Government Support (WGT) briefing panel: `ConsoleGovernmentSupport.vue` renders `.con-govsupport` for the `choice/wgt` task, but `SERVING_SURFACES` only listed `.con-task-host`, so the detector saw "no surface" and drew the guard on top.

**When you add a new console-native surface (a dedicated component that replaces the generic `ConsoleTaskHost` for some `TaskKind`/flavor), you MUST register its root selector so the detector counts it as served:**
- A GENERAL surface (serves regardless of task kind) → add its root class to `SERVING_SURFACES`.
- A KIND-SPECIFIC section (only serves its own kind, must not mask an unrelated stranded prompt) → add it to `KIND_SURFACES[<kind>]` (e.g. `projectCard` → `.con-hand`/`.con-sheet`, `colony` → `.con-colonies`).
The root node must have layout (`getClientRects().length > 0`) — a `position: fixed; inset: 0` overlay always qualifies. No leak-detector spec enumerates the list, so a missing entry won't fail a test — it fails at runtime as the stranded guard. Reference: `ConsoleGovernmentSupport` (`.con-govsupport`, added to `SERVING_SURFACES` next to `.con-task-host`).

**THE SECOND GOTCHA — a hand-off to a surface that has NO dedicated selector needs a MIRROR, not a selector.** When the shell hands a live prompt to something that is *always mounted* (the board, the hand carousel), there is no class to register: the always-on root would mask a genuine strand, and its `--live` variant usually also covers free browsing. Those cases get a module-level boolean the shell keeps in sync, checked as an early-return in `runLeakDetection`:

| Mirror | Set by | Why no selector |
| --- | --- | --- |
| `setConsoleTaskDeferred` | `consoleState.task.deferred` watcher | the serving `.con-mandatory` card is hidden off the board home |
| `isConsoleHandPickActive()` | `consoleHandPick` bridge | `.con-hand` also opens freely over an unrelated prompt |
| `isMandatoryGateHeld()` | `consoleMandatoryGate` | announced-not-opened: the card may be mid-animation |
| `isAnimationHoldActive()` | `animationHold` registry | notification-only holds render into the always-on dock |
| `setConsoleTaskSpacePlacement` | `taskSpacePending` watcher | placement mode's `.con-board` is always mounted; `.con-board--live` also covers inspection |

The last one shipped as a **critical bug (2026-07-29)**: the FINAL GREENERY prompt is an `OrOptions` ('Place any final greenery from plants') whose first branch is a nested `SelectSpace`. Picking that branch sets `taskSpacePending`, which unmounts the task host / gov-support / production-loss surfaces (all three carry `taskSpacePending === undefined` in their `v-if`) and hands the answer to board placement — while `waitingFor` stays the `or`, so `taskFor` keeps returning `choice`, **not** the shell-native `space`. Nothing matched, and ~2 s into every final-greenery placement the amber guard covered a perfectly working board. Same shape: the World Government ocean. **A new client-side hand-off that unmounts its task surface while the server prompt stays live MUST add a mirror + a spec row in `tests/client/components/console/consoleLeakDetector.spec.ts`.**


### Check 3 — the STALLED-FOREGROUND self-heal (2026-08-02)

The detector no longer only *reports*. Before check 1's early-returns it runs `runForegroundWatchdog({surfaceRendered, promptLive})` (`consoleForegroundWatchdog.ts`), sharing the SAME querySelector pass via `anyServingSurfaceRendered(task)` so the two checks can never disagree about what is on screen.

**Why it must run first.** Every early-return above disarms the stranded guard by contract — a held announce gate, a deferred task, a live animation hold all count as "served". The freeze this exists for lives exactly there: the console claimed the foreground (a lease, a derived flag, a raw admission signal), *nothing* rendered to justify it, and the player sat on the board home with «СОБЫТИЯ В ОЧЕРЕДИ +N», no prompt and «Сначала завершите текущее действие» on every verb — with no guard, because the gate said "served". Only a page reload cleared it.

Unlike checks 1-2 this one ACTS: after 3 consecutive stalled passes it EXPIRES the stale claims (never force-closes them — see `docs/claude/presentation-flow.md` § the foreground watchdog), drains the queue, warns with the exact claims, and raises one player-facing notice.

**Scope:** only while the shell mirrors `boardHomeIdle` (`setConsoleBoardHomeIdle`) — the board section with nothing the player opened themselves. Off the board home "no serving surface" is a lie, not a symptom, and expiring an honest claim would pop a prompt over whatever they were reading. That mirror is the fourth entry in the mirror table above.
