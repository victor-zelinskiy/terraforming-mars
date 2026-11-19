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
- **Row 2 — CLOSED (2026-11-19).** «Waits for the player» is believed only while the player CAN ANSWER: the
  arbiter's own `accepting` comes down to the hold registry as a probe (`animationHold.registerPlayerCanAnswerProbe`),
  and a hold that says so over a shut pad — a beat in flight absorbing input, a stranded question, a hand-over owed —
  ends as a DEFECT whose line says both halves («the hold says it waits for the player — … — but nothing on screen
  takes a press»); the feed's `starvation-owned` reads the same probe. Spec `playerOwnedHolds.spec`.
- **Row 3 — CLOSED.** No wait declares «the viewer keeps the board covered» any more: `boardCoverWitness.ts` looks at
  the cover's TERMS at every poll (`workspace` · `reveal` are the player's; `played-hero` · `deck-draw` ·
  `sitting-rise` · `own-placement` · `transfer` · `hand-delivery` the game's). The ceiling is planned when a cover of
  the player's stood at it or until moments before; the game's own scenes alone for `GAME_ONLY_TAIL_MS` (5 s) → a
  defect that names them in the line's detail. `remote-placement:watchable-board`, `nomad-move:watchable-board`.
  Spec `boardCoverWitness.spec`. (The `rulingChangeDraw` impulse wait: not converted — see «open».)
- **Row 4 — CLOSED.** (a) `frameWitness.STARVED_ENOUGH_MS`: a page that gave a motion 20 s of painted time has given
  it its time — one alt-tab over a 35 s hold no longer reads «starved»; (b) the feed's «the page was not painting»
  is a verdict over the WHOLE blocked span (a frame watch from the moment its clock starts), never the supervisor's
  last one-second look; (c) the feed's warn re-arms the moment the queue flows — it was once per game.
- **Row 5 — CLOSED.** `workspace-stale/held` is evidence only for `live-outcome` / `nested-step`; held by
  `owed-step` · `owned-prompt` · `unknown` over the free turn it is a defect (the row's `read`).
- **Row 6 — CLOSED.** `#stale-prompt` is honest ONCE: the second refusal in a row with no answer landed between says
  so after the reason and reads as a defect (`consoleWorkspaceStack.staleRefusalSaid`).
- Still open: the deck pick and the pad line of row 9, row 10, the ruling-change impulse wait of row 3 — and the
  REVERSE direction (what is sent and is not a bug), §«The other direction» below.

## The other direction — what IS sent and is not a bug (2026-11-19)

**Question (the owner):** is everything we send as an error really a bug — and is every expected check an info, with
nothing the other way round? The first half of this file answers «what hides behind planned / info / note»; this
half reads the 34 sites that reach the collector as ERRORS (an untagged `console.error`, an error-kind tag,
`reportDiagnosticError`) and the 101 failure-worded lines that never do. Inventory:
`C:\Projects\Mods\tm-fz-tools\sentry-audit-inventory.md` (not in the repository — a working file).

| What was found | n | Now |
| --- | --- | --- |
| **Sent as an error, and it is the NETWORK's word or the server's own answer** — the view's fetch, the journal's and the log's polls, the boot fetch, a login, a saved game's load, the admin tools, the reveal acknowledgement, a submit answered 5xx | 15 of 34 | ONE DOOR — `client/diagnostics/requestFailure.ts`: `requestFailed` / `requestRefused` print a NOTE of the family `net`; a non-OK status is thrown as `HttpStatusError`. Rule law 20 + the guard «nothing … by a bare console.error» |
| **One `catch` for the network AND for our own throw** — the submit's (`gameTransport`), the view's (`viewFailure`): a presenter that threw was told to the player as «cannot contact the server» and filed under the network's noise | 2 | `requestFailed` reads which it is: the throw is an error with its stack, and the player is told «unexpected response» |
| **A stale page after a redeploy** — the branch tested for webpack's `ChunkLoadError`, which the Vite build never throws: the reload was never offered, and the failed import was a `[vue-error]` | 1 | `isStaleChunkFailure` reads the BROWSER's words; a note, the reload offered, kept out of the error handler |
| **A child process gone that is the DEVICE's** — the GPU process lost to a driver reset, a helper an antivirus would not start | 1 | a note of `[electron]`; our own utility process (`tm-…`) and anything out of memory stay errors |
| **One incident, two events** — the poll's answer that threw was a `[transport]` defect AND an untagged error | 1 | the exception (with its stack) is the event; `transport/poll-answer` is its evidence (info) |
| **«It is a BUG, not a mode» printed as a NOTE** — and in development builds only: a card with nowhere to fly from, a leaked accent lease, a legal press the board section refused, a claim that never reached its hand-over, a save without a space | 10 | ONE DOOR — `invariantBroken(id, what)`: family `invariant` (integrity, a defect, one issue per id), in every build. Law 21 |
| **A caught exception filed as a note or not at all** — the boot warm-up's render, the prompt-receive scene (no line at all), an input absorber's predicate (a double-input guard silently off), the played hero's landing measure, a teleport's invalid selector, the lobby / campaign channels' listeners, a system alert's callback | 12 | `reportDiagnosticError` at each. Law 22 |
| **The main process: host mode silently became remote mode** — the embedded server did not start / had no script / did not respawn: notes of `[embedded]` | 3 | `[main-error]`, with what was thrown; the P-core pin's escaped throw and (packaged only) the update hook likewise |
| **A bare timer whose line is a note** — the deck pick's deal: eight seconds of a shut pad no net reported (row 9) | 1 | a ceiling wait of the graph (`deck-pick:deal`) — the stall family's line, painted-aware |
| **Requests whose `catch` kept a UI string and lost the error** — the campaign's submits, the campaigns list, a game's delete, the deck composition | 9 | `requestFailed` first in each |
| **An invariant that a page nobody looks at «breaks»** (the first night the new doors were walked under the away perturbation, 2026-11-19): the dock accent's leaked lease — a six-second timer on the WALL over a presentation that runs on FRAMES; three classes, one per open of the hand behind another window | 1 | a ceiling wait of the graph (`dock-accent:<label>`) — a defect on a page that painted, the wait's honest end on one that did not. **The rule it leaves:** a bound over a MOTION is never an `invariantBroken` behind a bare timer — it is a ceiling wait, which reads the frames |
| **The wait made audible named its cause the same night** — `deck-pick:deal`: a batch dealt onto a stage that cannot be measured «hands over immediately» and stood on a nine-second safety (nobody calls `notifyPayload` for a payload that is already there) | 1 | handed over in the next task (`consoleBatchArrivalMotion`); replay in the bottle, `batchArrivalUnmeasurable.spec` |

**Left as they are, on purpose** (each read): the 39 «outlived its ceiling — ended» notes inside hold-expiry
callbacks (echoes of a hold's own ceiling line, which is the event); `[selftest]` (the connection check — sent only
when asked); the dev-only layout guards (`console-overflow`, an icon with no mapping) — coverage specs' business.

**Open — not decided by reading, and COUNTED since 2026-11-19** (`netEnded` — the waiting room, rule law 25; the
matrix's reports list them as INFO classes `net-ended/ended/<id>` with the walks): the Parliament's cube that «never
touched down» (`banner-stage:cube-touchdown`), the sitting that «never told its enactment»
(`ruling-change-draw:untold-enactment` — seen in the monkey's walks under a reload) and the colony ledger's payout
that «stalled with nothing owed» (`colony-ledger:payout-stalled`): a lost signal or a designed fallback? each is
decided by the first walks that print it — a ceiling wait of the graph, or a fallback with its reason.
**The first counts (2026-11-19, two CI cells of 606 walks each):** `ruling-change-draw:untold-enactment` — 10 tables
under `hidden`, 4 under `duo`; the cube and the ledger — none. By the code the park waits for the sitting to tell its
enactment, which the PLAYER walks: thirty seconds without their press and the «answer to a change of power» cards
leave the sitting for the ordinary reveal. So it is no lost signal — it is a wait for the player with a wall bound
on it, and whether that bound should stand while the sitting is on screen (a player reading a resolution for half a
minute gets the cards outside the sitting) is the owner's to say: it changes what the player sees. The line now
says where the sitting stood (`stands on screen` / `is not on screen`), so the next cells split the two.
**Still open by reading alone:** the console export's failures (the device's disk or our gather); the pad line of row 9; row 10 (a server
unreachable for minutes — a defect only where the server is OURS, the host's embedded one); and 60 silent catches
around catalogue lookups (`getCard` on an unknown name) that fall back by design and say nothing.

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
