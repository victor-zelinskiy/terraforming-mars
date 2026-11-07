# The liveness arbiter — the player can always act

Introduced 2026-10-31 after the owner's second freeze report of the day: the Unity free trade with an owned Redux
Venus (the step, the floaters, the drawn card, its discard) left the screen frozen until a reload, with the F12 export
showing only `board-beat-park` and `scale-step-rating` degrading at 30 s with `watchable: false`. The owner's demand:
«сделай нормальный аудит по всем поверхностям и исправь проблемы dead локов КОМПЛЕКСНО И АРХИТЕКТУРНО».

Code: `src/client/console/consoleLiveness.ts` (the pure rule + the ladder registry) · `ConsoleShell.checkLiveness` /
`registerLivenessRungs` (the 1 Hz sampler + the shell's own rungs) · each owning module's `registerLivenessRelease`.
Guards: `tests/console/consoleLiveness.spec.ts` (the rule), `tests/console/presentationLedgerDegrade.spec.ts`,
`tests/client/console/livenessLadder.spec.ts` (the ladder's composition), the e2e harness fixture `livenessGuard`
(every spec is red on `[liveness] stall`).

## 1. Why a single arbiter

Every freeze reported in October 2026 had one shape — two presentation debts waiting on each other, or one debt
waiting on a condition the player's own surface held:

| freeze | the cycle |
| --- | --- |
| the Floodgates fold (2026-10-28) | a fold flag leaked into the session; every later commit skipped its resolution |
| the Parliament's parked submit (2026-10-29) | a submit dropped while the funnel was busy with the previous answer's gates |
| R&D Funding's claimed verdict (2026-10-31) | a deck-check claimed into the draw-only pending stage — no stage could show it |
| the Venus trade's board story (2026-10-31) | the park + the step-rating waited for the board; the board was covered by the trade's own surfaces |

And every NET of the codebase looked away by its own contract: the leak detector counts a workspace's root as
served; the foreground watchdog acts only on the board home; a claim's backstop is refused while the claim serves;
the ledger's stories degrade at 30 s; the owed conclusion arms only once the flow reported finished; the beat stall
guard judges transient phases only. Each is right about its scope and blind to the cycle.

The arbiter does not know the cycle and does not need to. It judges the PLAYER's side and PROGRESS, which every cycle
fails together.

## 2. The invariant

> While the server asks the player something (or while they press), either a surface serves the question and
> accepts input, or something is provably in flight. Otherwise the screen is a stall, whatever its cause.

Sampled once a second by the shell (`checkLiveness`), judged by the pure `observeLiveness`:

- **promptLive** — `waitingFor` stands and is not `optional`.
- **accepting** — no transient beat on the deepest live frame (`judgedTransientBeat`, the beat stall guard's
  witness), the leak detector's stranded verdict is empty, no awaiting handoff.
- **inFlight** (named) — a request on the wire, or an answered one whose gates are younger than
  `LIVENESS_TRANSPORT_GRACE_MS`; a blocking animation hold younger than `ANIMATION_STALL_GRACE_MS`; the awaiting
  handoff within its safety; an owed commit fold; a resource flight; a ledger story younger than
  `LIVENESS_STORY_GRACE_MS`.
- **presses** — A / B presses from ANY device (`inputEcho.verbPresses`, counted in `dispatchConsoleIntent`, which the key
  bridge and the gamepad layer both go through). Only the two verbs every live surface must answer: X on a panel with
  nothing to inspect, or an arrow against a ring's wall, is an honest no-op — counting every key read the pass-confirm
  panel's three X presses in `console-workspace-band` as a stall (2026-10-31), and the keyboard-only echo never saw a pad. While the screen ACCEPTS, only the A / B NO handler took count (`verbDropped` —
  the deaf screen that claims to accept); a press a surface took and answered quietly (A on a disabled tile) is no
  evidence. While it does not accept (an absorbed pad), every A / B counts.
- **signature** — the observable state: the prompt's identity, the stack, the section/sheet, the surfaces' counts, the
  command bar's text, the focused element, the funnel's state. A press that changes nothing leaves it equal.

Two ways to stall: `unserved` (asked, nothing accepting, nothing in flight for `LIVENESS_GRACE_MS` = 10 s) and
`presses-no-effect` (`LIVENESS_PRESSES_NO_EFFECT` = 3 presses with the signature unchanged and nothing in flight for
`LIVENESS_PRESSED_GRACE_MS` = 5 s — a question is not even required: a player pressing into a dead screen is a stall).

## 3. The ladder

The cure is ordered by how much truth a rung restores and how little it destroys. One rung per
`LIVENESS_RUNG_GAP_MS` (2 s), re-judged between rungs, so the gentlest cure that works is the one that runs. Each
module registers its own release (`registerLivenessRelease({rank, name, release})`); the release returns what it did.

| rank | rung | what it does |
| --- | --- | --- |
| 0 | `presentation-ledger` | every owed story degrades NOW through its owner's own release (the park snaps its values, the step-rating ticks its cell) — truth before story |
| 10 | `foreground` | the foreground watchdog's cure, scope-free: animation holds expire (with their owners' `expire`), foreground holds and admission claims lift |
| 15 | `start-director` (shell) | a standing START SHADOW disagreement is cured through the scene's own doors (`startDirectorCure`: heal / yield — `docs/claude/console/start-director.md` § Phase 1) |
| 20 | `workspace-outcome` · `colony-trade` · `card-discard` | a claim released with force (its artifact falls to the standalone presenter — still seen), a trade concluded to committed truth, a disposal aborted |
| 22 | `transport` | a funnel whose answer ARRIVED but whose gates never let go is released and the view re-fetched; a request still on the wire is left to the network |
| 25 | `workspace-beat` (shell) | a stalled transient beat torn down through `forceRecoverStuckWorkspace` |
| 30 | `stack-home` (shell) | the stack goes home; the mandatory plate re-announces whatever the server still asks |

Every rung names itself: `[liveness] stall (<reason>): Ns without progress, N presses; asked: …; beat: …; stranded: …;
last in flight: …; claim: …; holds: … — rung k: <what each release did>`. The player gets one notice per stall.

## 4. What it does not replace

The arbiter is the net under the nets. A stall it cures is a defect upstream of it — the harness turns the marker red
on every spec, and a field report with `[liveness]` in its export names the owning module in the rung's own words.
The structural fixes stay where they were: the claim/stage law (`claimRepeatOutcome`), the one-batch intake, the
release funnel, the board-beat park's own gates.

## 5a. The audit of 2026-10-31 (the Hydronetwork finish — the second freeze of the day)

The owner's report: the marker moved onto the 5 VP finish as the turn's SECOND action, the move passed to another
seat, and after the ceremony the screen froze; it un-froze only on «свернуть», with the «Экран завис» notice (the
board-home watchdog). The field table (game gce2206994265, history 00363 → the fixture `field-hydro-terminal`: blue's
first action — the free delegate — replayed through the engine; the finish passes the move to MarsBot, whose turn
arrives behind the ceremony with a tile beside blue's and blue's own M€ reaction) REPRODUCED it on the box: the hydro
frame stood `executing` with EMPTY holds for 13 s; the morning's beat stall guard tore it down at 14 s
(`[workspace-stall] beat «hydro:executing» … last in flight: transport, hydro-marker`), and only then did
`tile-placement-remote` fly.

**The cycle** (the agent's map, confirmed by the probe):

1. the bot's tile beside blue's pays blue — `consoleRemotePlacement.claimIncome` seeds the viewer's income on the
   PANEL (`beginPanelRewardHold`) at staging, to be released chip by chip when the landing flies;
2. the landing parks for a watchable board (`flyRemote` → `boardCovered()` reads `workspaceStackActive()` — the hydro
   frame covers it); the parked hold is deliberately NOT blocking;
3. the hydro resolution's busy read the GLOBAL `panelRewardHold.active` as «my reward is held» → `executing`, the
   pad absorbed, the frame standing → the board covered → back to 2. Nothing in flight; every net blind by contract
   (`hydro-flow-stuck` heals a missed edge, never a true-stuck term; the watchdog acts on the board home).

**The fixes** (two laws, each its own side of the cycle):

- **A flow's busy reads its OWN work.** `hydroMarkerState.rewardHoldOwed` / `wavesActive` (reactive — invariant 17)
  are what the hydro marker seeded and flies; `ConsoleShell.hydroResolutionBusy` reads `hydroRewardHoldOwed()` /
  `hydroRewardWaveActive()`, never the panel's or the transfer layer's global facts. A new flow's busy term that reads
  a GLOBAL presentation fact is this cycle again.
- **A foreign landing parked for a covered board gives the viewer their truth NOW.** `tickViewerHoldsNow(ev)` releases
  the event's income and card-payout holds at the park (`holdsTicked`), the counters tick, the chips name the cause,
  and the beat that eventually flies flies nothing for them. Nothing is lost — only the token's flight into a board
  nobody could see.

Guards: `consoleHydroMarker.spec` § the reward hold the flow owns; e2e `console-hydro-terminal-field` (the field
table + a two-human table — the ceremony plays, the workspace leaves by itself within 14 s, the harness red on any
stall marker).

## 5b. The transport ceiling (2026-10-31, the owner: «only when the server REALLY does not answer»)

The funnel (`isServerSideRequestInProgress`) had no ceiling: a request the network lost — no headers, no error —
held it for the rest of the session, every later press silently dropped, the arbiter reading «in flight» forever.
`console/transport/submitCeiling.ts` arms an `AbortController` per submit for `SUBMIT_NO_RESPONSE_MS` (60 s) and
fires ONLY when not a single response header has arrived in that time (`transportState.responseArrived` stands it
down — a slow server that HAS answered is never cut). On a fire the transactions roll back
(`abortAllConsoleTransactions`), the player sees the explicit «Сервер не отвечает» alert, and the view is re-fetched
(`waitForUpdate(true)`). A plain network error keeps the old alert. Guard: `tests/console/submitCeiling.spec.ts`.

## 5. The audit of 2026-10-31 (the Venus trade)

The field table was replayed exactly (fixture `field-venus-unity-trade` — the owner's save with Fringe Colony
replayed through the engine, then the Unity trade driven on the real UI; the probe `zz-field-venus-unity-bonus`)
and in two reduced forms (`venus-trade-unity-bonus`, `-2p`). On the box the flow completes whenever the player presses
A (take → the discard's door → discard → home). The two stories the field log named degrade at 30 s in every run —
they are the HONEST multiplayer wait: the park holds the Venus value while the trade's surfaces cover the board, and
releases without the show. The field's freeze itself did not reproduce on the box; its cure is the arbiter, and its
next occurrence will carry a `[liveness]` line naming the rung that freed the screen.

## The deaf screen that TAKES every press (2026-11-07, ledger HA)

The field lock of 2026-11-07 01:20 (game `p593bded`):
1. A card closed the chairman quest, and the Parliament stood `committed` for its beats.
2. A beat never landed. Its hold hit the 20 s ceiling, and the ceiling dropped the count while the director's run stayed
   «in a beat».
3. From then on the section's handler TOOK every B («a beat absorbs it») and every A («дожать» with nothing left to
   drive). Nothing was in flight, and the server asked the next action menu.

The arbiter read `accepting: true` for the screen's whole life, because on an accepting screen it counted only the
presses NO handler took.

Three changes, each general:
- **A taken B on a frame past its commit is evidence.** B collapses such a frame by contract (`backVerbFor('committed')`),
  so a taken B that moved nothing is a handler swallowing the verb over a wedged flow.
  - Counted from `inputEcho.backTaken` while `LivenessSample.backJudged` (`ConsoleShell.backOwedOnStandingFrame`).
  - That needs the deepest live frame `committed`, no park / yield / placement, a question asked, and no surface of its
    own over the frame (reveal · plate · viewer · journal · system menu · task host).
  - A player who is merely reading is never judged: nothing happens until they press and nothing answers.
- **`phase-root-park` (rank 31).** `stack-home` keeps a phase root by definition, so a deaf sitting / draft / opening
  survived every rung. The last rung PARKS it: the plate re-announces it, and the restore mounts the section fresh.
- **The ceiling ends the wedge, ratcheted.** The quest's hold declares `expire` (`settleChairmanQuestBeats`). Every
  other hold declares `expire` or `hold-expire: none — <reason>`. The 44 that predate the rule are the worklist of
  `tests/console/holdExpireRatchet.spec.ts`.

**Evidence.** The field recorder posts a standing screen's ring once per quiet episode (`FIELD_QUIET_POST_S`), and the
console export prints that ring under its errors (`buildScreenDigest`). The 01:06 freeze of the same evening left no
line and no reload, so nothing named it; the next one will be named either way.

## Silent, and automatic over the free turn (2026-11-07)

The owner: «чтобы для пользователя выглядело как будто зависания нет». Two changes:
- **The heal shows nothing.** The «Экран завис» notice is gone, both the arbiter's and the foreground watchdog's. The
  warn line stays: the field log and every e2e spec read it.
- **A finished frame over the free turn leaves by itself** (`ConsoleShell.reapStaleFreeTurnFrame`), with no press
  needed. It fires when the server asks the action menu and the deepest live frame meets all of these:
  - it stands `committed`;
  - it is not phase-anchored (phases are the anchor rule's);
  - it does not serve the turn;
  - nothing is in flight, and the picture has been still for `STALE_FREE_TURN_MS` (8 s).

  Then it is concluded through the ONE guarded conclusion. That conclusion still holds for every named reason — cards
  to take, a verdict, a nested or owed step, an owned prompt, a park — so a frame genuinely waiting for the player stays.
  A conclusion is `[workspace-stale] concluded`, red in every e2e spec, because a flow that did not end itself is a
  defect upstream. A hold is named once, as evidence.

