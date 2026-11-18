# Audit of the non-defect tiers — 2026-11-18

**Question (the owner):** does anything we file as `planned` / `info` (or as kind `perf` / `note`) hide a real
defect that needs a fix — something that never reaches Sentry while the player saw a freeze? Contract of the tiers:
`docs/claude/diagnostics.md` § 2.4, law 15 of `.claude/rules/diagnostics.md` («the tier is a decision, not a mute
button»). Every row of `src/common/diagnostics/shapes.ts` that is not a defect, every `planned` declaration
(`CeilingWaitSpec.planned`, `heldForPlayer`, the frame witness `starved()`), and the `perf` / `note` families of
`classify.ts` were read at their print sites.

**The systemic finding:** a `planned` verdict is decided from a SNAPSHOT at the ceiling (or declared unconditionally),
never from what held for the whole wait. «The board was covered», «the page painted nothing», «the hold waits for
the player» are each true by coincidence often enough to swallow real freezes. The rule to write: **planned only on
PROOF over the wait's whole span, and the line names the term that held** — otherwise a defect.

## Status

- **Row 1 — CLOSED in its tier (2026-11-18).** The park's degrade names WHO covered the board (`coveredBy` — the
  false terms of `boardBeatsWatchable`, `placementController.boardCoverReasons`) and whether the board was watchable
  at ANY look of the window (`watchableSeen`); the five other board stories report `coveredBy` too. `story-due` is
  planned only when the board was never watchable AND every cover is the player's own (`section` · `sheet` ·
  `workspace` · `placement` — `shapes.ts` `storyCoveredByPlayer`); `sitting-rise` · `planet-focus` · a board seen and
  not told → a DEFECT that names the term. The root cause of the box's two occurrences is still OPEN: the next one
  reaches Sentry with its `coveredBy` (no frame stood and the player was on the board, so it is one of the game's
  own covers — most likely a `sitting-rise` that did not end after the sitting).
- **Rows 7 · 8 · 9 (the discard pile) — CLOSED.** `[reaction-identity] foreign face` and `[discard-count] released
  under its count` are integrity families with shape rows; the seven swallowed exceptions are
  `reportDiagnosticError(pageErrorLine('caught by …', e), e)` — errors, grouped by their stack.
- Still open: rows 2–6, the deck pick and the pad line of row 9, row 10.

## Worklist — WRONG / RISKY (fix in this order)

| # | Row / site | Verdict | What hides | Fix |
|---|---|---|---|---|
| 1 | `presentation-ledger/story-due` + `"watchable":false` → planned (`shapes.ts` row; 7 stories) | **WRONG** — the field case (box, 2026-11-18, ×2) was a defect | `watchable` is read once at the degrade; it is false whenever ANY frame stands in the stack, and a stale START frame over the action menu leaves `section=board` (the player on the board) with `watchable:false` — the scales' story never played, counted planned | `boardBeatsWatchable` honours the start-yield fact (`registerBoardShownDespiteStack`, `wiringController.ts`); planned only if the cover lasted the whole due window; the diagnose names the false term |
| 2 | `liveness/still-hold` (info) + `animation-hold/ceiling` planned via `heldForPlayer` of `parliament-reward-owed` | **RISKY** — the pair stood ×1 each on the box at 14:10 | a `waitsFor: 'player'` hold gets a `player` target the wait graph deems «can come» while accepting / in flight — both true by construction while the hold stands, so no dead end; `seatAsked` is true for ANY prompt; ≈ 35 s of a still Parliament end as info + planned | the graph's `player` target reads «a surface SERVES the question»; `heldForPlayer` only when the walk's next stop IS the asked prompt and it was accepting; a still-hold standing ≥ 20 s with the question held only by holds → defect |
| 3 | `wait-graph/ceiling/remote-placement:watchable-board` (`consoleRemotePlacement.ts`), `nomad-move:watchable-board` (`consoleNomadMove.ts`), `rulingChangeDraw.ts` impulse wait | **RISKY** (box ×4 — not judgeable: the line does not say what held) | `planned` declared unconditionally, but «busy» includes covers the player never chose (a transfer, the hand delivery, the played card's scene, the deck dealing); a transfer that never ends hides the foreign tile and holds the `remote-landing` block — no placement grid, nothing sent | decide at the ceiling: planned only when the cover for the whole wait was a workspace / a reveal waiting for the player's take; else a defect naming the term (put it in `detail`) |
| 4 | `animation-hold/ceiling` planned via the frame witness `starved()`; `notifications/starvation-page` | **RISKY** | «painted < 75 % of wall time» over a 35 s hold: one alt-tab of ~9 s flips a real leak to planned; the notification witness reads a ~1 s look (one ≥ 500 ms frame = «starved»), never `document.hidden`; `starvationWarned` re-arms only at the endgame — after one planned starvation every later leak in that game prints NOTHING | planned only if painted motion < what the motion needs AND starved at the ceiling; judge from `queueBlockedSince`; re-arm the warn when the queue flows |
| 5 | `workspace-stale/held` (info) | **RISKY** | the reaper runs only over the FREE TURN, where `owedStep` / `ownsPrompt` / `unknown` holds cannot be genuine — the frame stands committed over the action menu till B, said once | defect for `unknown` · `owedStep` · `ownsPrompt`, or a frame held ≥ 2 quiet spans |
| 6 | `workspace/beat-rollback` planned on `(refused: #stale-prompt)` | **RISKY** | a client bug that makes every submit stale reads as an endless honest refusal | planned only if the refetched view shows the game moved; a repeat for one question → defect |
| 7 | `[reaction] foreign face` — kind `note` (`reactionIdentity.ts`) | **WRONG** | the wrong card rising on screen (an owner's field defect; red in every e2e) is never sent | `integrity` + a shape row |
| 8 | caught exceptions under NOTE tags — `[resource-transfer] wave threw`, `[card-receive] a host move threw`, `[hand-intake] a touchdown listener threw`, `[terraformed-scene] the phrase threw`, `[banner-stage] the phrase threw`, `[card-discard] scene failed`, `[start-seat] a seat flight failed` | **WRONG** (law 3) | an exception swallowed as a breadcrumb | `reportDiagnosticError(line, err)` at each site |
| 9 | `[discard-pile] released under its count` (note); `[deck-pick] the deal outlived its ceiling` (note, a bare `after` — 8 s of a shut pad, under the arbiter's 10 s); `[pad] «X» owns the pad and is not mounted` (note) | **RISKY** | a lost touchdown / a shut pad / a press to nobody, never sent | integrity; the deck pick on `beginCeilingWait`; the pad line a defect row |
| 10 | the poll's `xhr.onerror` / `ontimeout` (`gameTransport.ts`) | gap | a server unreachable for minutes with no submit is filed nowhere (only the alert) | a tagged defect line once the outage passes a bound |
| — | `transfer/no-visible-end` (planned) | low | printed only in non-production builds | planned only for a band / fullscreen cover |
| — | echoes printed by a rung BEFORE the stall line (`story-degraded-by`, `beat-arbiter`, the shadows' `cure` by liveness) | low | nothing hidden (the defect line follows in the same tick), but the echo's diagnose stands alone and never rides the event | fold forward: a lone echo joins the next matching defect within `DIAG_ECHO_MS` |

## CORRECT (checked, cannot hide a defect)

`liveness/recovered` · `workspace-anchor/dropped` · `ws-stack/verb-trace` (opt-in) · `screen-shadow/cure-plan` ·
`mandatory-gate/door` · `teleport/target-absent-waits` (a 5 s `[teleport] stranded` defect stands behind it) ·
`wait-graph/cure*` (printed after their finding) · `notifications/correlation-player` · `session-rebuild/refused-off`
(`?rebuild=0` only) · `view/fetch-failed` (its untagged `console.error` is an error and is sent) ·
`transport/refused-busy` (a wedged funnel ends `server-silent` / `abandoned` — defects) · `transport/reload` ·
`renderer-hang/restart · recovered · trace-written · trace-failed` (only inside the `unresponsive` episode) ·
`vp-shares` `heldForPlayer` (notification-only) · the ~35 «outlived its ceiling — ended» notes inside hold `expire`
callbacks (echoes of a ceiling / a dead end) · `perf` (`long-frame`, `bot-turn`).

## Field occurrences of the box session (1.2.3327, 2026-11-18)

| class | n | verdict |
|---|---|---|
| `presentation-ledger/story-due/board-beat-park` (planned) | 2 | **a defect** (row 1) |
| `wait-graph/ceiling/remote-placement:watchable-board` (planned) | 4 | not judgeable until the line names its term (row 3) |
| `animation-hold/ceiling/parliament-reward-owed` (planned) + `liveness/still-hold` (info) | 1 + 1 | likely an unreported ≈ 35 s Parliament freeze (row 2) — same close as the sent `wait-graph cycle (announce:parliament:genn · question:parliamentphase · surface:parliament)` |
