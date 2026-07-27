<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Console native mode — the leak-detector contract (read before adding a console surface)

The console-first shell (`ConsoleShell.vue`, `?console=1`; full design in `docs/CONSOLE_MODE_CONCEPT.md`) has a **leak detector** (`src/client/console/consoleLeakDetector.ts`, a 1 s tick while the shell lives) whose job is to make a mixed/broken input state VISIBLE instead of silent: if the server is waiting on a prompt, the console does NOT serve that `TaskKind` via a shell-own surface (`SHELL_NATIVE_KINDS` = only `actionMenu`/`space`), and **NO serving-surface DOM node is actually rendered**, it sets `leakDetectorState.stranded` → `ConsoleStrandedPrompt.vue` draws the honest amber guard panel ("Этот запрос пока недоступен в консольном режиме").

**THE GOTCHA — a brand-new console surface that renders its OWN root class (not `.con-task-host`) is invisible to the detector, so it gets MASKED by the stranded guard even though it renders correctly underneath.** This bit the Government Support (WGT) briefing panel: `ConsoleGovernmentSupport.vue` renders `.con-govsupport` for the `choice/wgt` task, but `SERVING_SURFACES` only listed `.con-task-host`, so the detector saw "no surface" and drew the guard on top.

**When you add a new console-native surface (a dedicated component that replaces the generic `ConsoleTaskHost` for some `TaskKind`/flavor), you MUST register its root selector so the detector counts it as served:**
- A GENERAL surface (serves regardless of task kind) → add its root class to `SERVING_SURFACES`.
- A KIND-SPECIFIC section (only serves its own kind, must not mask an unrelated stranded prompt) → add it to `KIND_SURFACES[<kind>]` (e.g. `projectCard` → `.con-hand`/`.con-sheet`, `colony` → `.con-colonies`).
The root node must have layout (`getClientRects().length > 0`) — a `position: fixed; inset: 0` overlay always qualifies. No leak-detector spec enumerates the list, so a missing entry won't fail a test — it fails at runtime as the stranded guard. Reference: `ConsoleGovernmentSupport` (`.con-govsupport`, added to `SERVING_SURFACES` next to `.con-task-host`).

