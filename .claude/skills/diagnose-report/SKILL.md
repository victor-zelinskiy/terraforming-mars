---
name: diagnose-report
description: Triage a player's problem report (a code like TM-K7QW3D), a Sentry issue, a FREEZE / stall of the console, or «what broke on the box» for this Terraforming Mars fork — fetch the evidence with `npm run diag`, read it in the right order, find the cause in the code, and say what to fix. Use when the user gives a report code, asks what failed on the box / in Sentry, asks about freezes («зависания», «стало меньше?»), or asks to pull diagnostics from the Steam Machine.
---

# Diagnose a report or a freeze — Terraforming Mars (vize1215 fork)

The game records every error and every stall of the screen in its own journal, sends what failed to Sentry (EU), and
lets a player send a REPORT — a package of everything needed to understand and reproduce a problem — that ends in a
code like `TM-K7QW3D`. This skill is how an agent turns that into a cause. Contract of the subsystem:
`docs/claude/diagnostics.md` (read § 2–4 once: the record, the cause class, the kinds, the package). The program the
freeze half belongs to: `docs/claude/console/freeze-zero/PLAN.md`.

Everything is ONE tool: `npm run diag -- <command>` (`scripts/diag.mjs`; it uses the authorised `sentry` CLI of this
laptop, or `SENTRY_AUTH_TOKEN`). In the Bash tool first: `export PATH="$APPDATA/fnm/node-versions/v24.20.0/installation:$PATH"`.

## 1. Get the evidence

| the user said | run | you get |
| --- | --- | --- |
| «разбери отчёт TM-XXXXXX» | `npm run diag -- report TM-XXXXXX` | `.diagnostics/reports/TM-XXXXXX/` — every file of the package + `SUMMARY.md` (printed) |
| «разбери последний отчёт» | `npm run diag -- report latest` | the same, for the newest report |
| «что упало на боксе за сегодня» | `npm run diag -- issues --env box --since 24h` | the issues, newest first; then `npm run diag -- issue <shortId>` for each that matters |
| «что падает у игроков» | `npm run diag -- issues --env production --since 7d` (add `--kind error` / `--kind stall` / `--family liveness`) | the same |
| **«что зависает» / «какие зависания были»** | `npm run diag -- classes --env box --since 14d` | ONE ROW PER CAUSE CLASS: events, runs affected, outcomes, first / last seen, the trend by release |
| **«разбери зависание» / a class / an issue of kind `stall`** | `npm run diag -- class <cause class>` (or `issue <shortId>`) | `.diagnostics/classes/<class>/` — the last cases, each laid out IN READING ORDER, + a README: the cases' table and where the class is reproduced in the repo |
| **«зависаний стало меньше?»** | `npm run diag -- trend --env box` | by release: stalls per hour of play and per session, outcome shares, time-to-cure, top classes, the fires of every net |
| «что вернулось после исправления» | `npm run diag -- issues --regressed` | issues that came back after being resolved |
| «вытащи диагностику с бокса» | `npm run diag -- box pull --since 24h` | `.diagnostics/box/<stamp>/` — logs, report folders, field log, console exports, hang traces — with a digest |
| «проверка связи дошла?» | `npm run diag -- selftest` | per runtime: arrived? stack resolved to sources? |
| an event names `seat_ref p#…` and you need the save | `npm run diag -- box resolve p#…` | the seat id and the save file on the box (only for games the box hosts) |
| a stall's event has a `save` context | `npm run diag -- save <g#…> <saveId>` (or `save <shortId>`) | the game's save AS IT STOOD when the episode began → `.diagnostics/saves/` (+ how to make it an e2e fixture) |
| an owner in the evidence (`frame:hand#3`, a hold's label, a wait's id) | `npm run diag -- where <word>` | the file and line that DECLARES it |

`.diagnostics/` is git-ignored. A report package may hold the players' names and the game's save — treat it as
private: never paste a save or a name into anything that leaves the laptop.

## 2. A report: read it in THIS order (stop when you have the cause)

1. **`SUMMARY.md`** — the category the player chose, their words, the record the report was opened from, the journal's
   digest. The player's words say what they SAW; the journal says what the game KNEW.
2. **`journal.json`** — every record with its full text. Kinds: `error` (an exception — read its `stack`; frames are
   resolved to `src/…:line` for release builds), `stall` (the screen stood — § 3 below reads one), `integrity` (the
   picture disagreed with the truth), `perf`, `note`. Each record's `screen` is what the screen was doing at that
   moment; a stall's `cause` is its class and its `evidence` is what stood.
   - An `error` shortly BEFORE a stall is usually its cause (an exception in an async beat leaves its flow half-way).
3. **`field_record.json`** — the heartbeat ring: the screen second by second before the press (`prompt`, `accepting`,
   `inFlight`, `frames`, `quietS`, `block`, `flow` — the kernel's tree once the picture stood 2 s). A scope whose age is
   out of proportion to its name IS the finding (`docs/claude/console/architecture-v2/REVIEW.md` § 6).
4. **`console_export.txt`** — opens with three digests: ERRORS, STALLS (each with its time-to-cure), SCREEN. Read the
   digests, then search the body around the timestamps the journal gave you.
5. **`screen.jpg`** — the frame BEFORE the menu covered the game: what the player was looking at.
6. **`save.json`** (only when the reporting device hosted the game) — the game's state. To reproduce: load it through
   the dev loader (`POST /api/dev/load-game`, the road `bootFixture` uses — `.claude/rules/tests.md` § STATE IS
   DECLARED) and drive the same prompt. `report.json` has `saveGameId` and the seat's id.
7. **`log_*.txt`**, **`hang_trace.json`** — the main process and the game server (a `server-error` record's stack is in
   the journal already); the trace opens in ui.perfetto.dev and matters only for a `renderer-hang`.

## 3. A FREEZE: read the class, then one case

A stall is filed under its **CAUSE CLASS** — WHAT HELD, never how the line is worded. One class = one Sentry issue =
one defect to fix. `npm run diag -- class <class>` lays each case out in the order below.

1. **The class itself is the first clue.** `liveness/stall/<reason>/<task>/<top>/<holder>` reads: the arbiter found the
   screen still (`unserved` — the server asked and nothing accepted; `presses-no-effect` — the player pressed and
   nothing changed), the router's task was `<task>`, the deepest frame on stage was `<top>` (`kind:phase`, or `board`),
   and `<holder>` is who held the question:

   | holder | means | look at |
   | --- | --- | --- |
   | `stranded` (`+claim:<host>:<stage>`) | no surface serves the question at all; an orphaned claim beside it is what suppresses the question's own surface | the claim's host and release (`consoleWorkspaceOutcome.ts`), who should have served (`screenDirector.ts` `expectedScreenOwners`) |
   | `dead-frame:<kind>` | a frame of a phase that is over still stands | the phase's lifecycle owner (`closePhaseRoot`), `deadPhaseAnchors` |
   | `beat` | a transient beat (`executing` / `completing`) stands on `<top>` with nothing in flight | what the beat waits for — the flow tree's line for that frame |
   | `awaiting:<from>` | a surface hand-over never came | `surfaceMotionState.awaiting`, the surface it is awaited from |
   | `block:<name>` | an admission block holds the question's surface | `consolePromptAdmission.ts` — who raises `<name>` and what lowers it |
   | `claim:<host>:<stage>` | a claim stands and nothing else explains the stall | the claim machine's state and its gates (the arbiter's line prints them) |
   | `hold:<label>` | a blocking animation hold outlived its motion | `npm run diag -- where <label>` → the hold's owner and its `expire` |
   | `deaf` | the screen accepts, the presses change nothing | the pad router for `<top>` — a handler that takes the verb over a wedged flow |

   Every other class is `<family>/<shape>/<structural words>` — `wait-graph/ceiling/<wait id>` (a wait that ended on
   its ceiling: a hidden mutual wait or a lost signal — `where <wait id>`), `wait-graph/<finding>/<members>` (a cycle,
   a dead end, a dangling wait), `flow/bound-wait/<scope>/<what>` (a kernel wait cut by its bound), `workspace-stale/
   concluded/<kind>` (a flow that did not end itself), `renderer-hang/unresponsive/<section>/<top>` (the page did not
   run at all — § 3.4). The shape table with every row: `src/common/diagnostics/shapes.ts`.
2. **`00-summary.md`** — the dimensions (the source card, the outcome, who cured it, how long it stood), the QUESTION
   (what was asked, who may serve it, who did), the HOLDERS with their ages (the first is the one the class names),
   and the episode: the arbiter's steps in order, who cured it, and **what changed by the cure** — the scopes that
   ended, the holders that let go. «What changed» usually names the culprit by itself: the thing whose forced release
   freed the screen is the thing that should have ended on its own.
3. **`02-flow-tree.txt`** — the kernel's tree at the START: every scope that stood, its age, its state, what it waited
   for. Read ages against names: a `claim` 14 s old `awaiting`, a `step:commit-fold-owed` 40 s old, a `scene:hold`
   older than any scene. Then **`03-waits.txt`** (every standing wait, oldest first — who waits for whom) and
   **`04-wait-graph.txt`** (the legacy graph's nodes and findings). **`05-flow-trace.txt`** is the kernel's last
   records — which scope opened or ended last, the machines' last transitions: the last thing that happened before
   nothing did.
4. **A renderer's stop** (`renderer-hang/…`): no net of the page ran, so there is no flow evidence. Read
   `hang_trace.json` (ui.perfetto.dev: the main thread and the compositor / GPU threads for those seconds), the class's
   `<section>/<top>` (the last screen), and the session's long frames for that screen (`npm run diag -- trend` — where
   the time goes: script / forced layout / style + layout / render).
5. **Is it one cause or several under one class?** The README's table: if the cases differ in `holder`, `source` or
   `cure`, read one of each. If one fix closes some and not others, the class needs a structural word more — add the
   capture to its row in `shapes.ts` (never split by hand in Sentry).

## 4. From evidence to cause to closed

- Resolve the frame / the owner to the file (`where`) and READ the code there before forming a theory. `head` (a tag)
  is the commit of the build — `git show <head>:<path>` when the line no longer matches.
- **Reproduce cheaply first**: the README of a class lists the specs and the monkey walks that named the same class
  (the e2e harness files the same key per test — `test-results/cause-classes/`). No hit → a unit / integration spec
  at the failing function; then the save (`npm run diag -- save …` → a fixture) driven on the Steam Machine
  (`npm run e2e:remote`), never a local browser.
- **Fix the class, not the case** (`docs/claude/console/freeze-zero/PLAN.md` § 4): the wait gets an owner and a bound
  on the kernel, the fix carries a guard and a replay — never a new net, rung, door, flag or timer
  (`.claude/rules/console-flow.md`). A net that cured the stall is evidence of the defect upstream of it, not the fix.
- **Close it — AFTER the fix is committed**: `npm run diag -- resolve <class>` (resolved in THIS checkout's version,
  the release that carries the fix; `--in <version>` names another. Not `--next`: «the next release» is the
  collector's notion and one stray release with a greater number makes the class never regress). After that release reaches
  the box: `npm run diag -- classes --since 7d` no longer lists it, `issues --regressed` is empty, and `trend` shows
  the class's count per release falling to zero. A class that comes back is a regression of THAT fix — read the new
  case against the old ones.

## 5. Answer the user

Lead with the cause in one or two sentences, then: the evidence that proves it (the record, the frame, the holder and
what changed by the cure — quote the few lines that matter), where it is in the code (`file:line`), what the fix is
and what guards it, and what you could NOT establish. If the evidence does not reach a cause, say exactly which piece
is missing (no save because the game was hosted elsewhere; an unresolved stack because the build was local; no flow
evidence because the page did not run) and how to get it.
