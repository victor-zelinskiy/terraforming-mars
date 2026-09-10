# Flow-close gates — the wedge class and its audit (2026-09-09)

**The reported defect.** On the Hydronetwork screen the finale of a terminal
landing («Вклад в гидросеть» / «Архитектор гидросети») would freeze: the
screen stuck — B dead, no self-close — for ~20–30 s, then "passed by itself".
Reproduction correlated with notifications arriving in parallel.

**The class.** A committed console flow closes through a *gate*: a busy
conjunction whose FALLING EDGE advances the phase, plus owed beats (a
culmination, a read hold) released by their own completion signals. Every one
of those releases was an **edge**: a Vue change-watcher, a one-shot module
fact, a `window.setTimeout`. Edges get missed — a true→true transition fires
nothing, an 800 ms one-shot fact expires under a slow frame, a component's
watchers die with it, a cleared timer is never re-armed — and several gate
terms were **any-source** (they counted artifacts that belonged to *other*
presenters). A missed edge or a foreign artifact wedged the flow until some
*unrelated* 20–35 s safety happened to shake the state. That accidental
recovery is exactly the reported «висит, потом проходит».

The notification correlation is causal for the any-source half: an
out-of-band delivery (another player's / the bot's effect drawing FOR the
viewer, a board-born reward parked behind the covered board) arrives WITH its
notification, stands as an unconsumed batch, and the flow's close gate counted
it as its own follow-up — while that batch's own presentation waited for the
workspace to leave. A deadlock, broken only by whichever foreign safety fired
first.

## The mechanism (all three are the codebase's existing idioms)

1. **Ownership over presence** (the source law, restated at the close gate):
   `hydroFollowUpLive`'s batch term asks `hydroOwnsRevealBatch` — the claim
   (`workspaceOutcomeState.host === 'hydro' && workspaceClaimsRevealSource`)
   plus the standing plan's own declared steps
   (`hydroPlanDeclaresSource`, consoleHydroMarker). A foreign batch no longer
   holds the flow **or** the traversal resume (`hydroTraversalResumeReady`
   reads the same computed). The `deckPickActive` release door likewise
   dropped its raw `rawDrawnRevealPending + cardDrawReveals.length` pair for
   the funnel's own ownership-scoped probe (`workspaceOutcomeServingNow`).

2. **A durable arrival fact for the culmination.** `maybeStartCeremony` used
   to read arrival off `markerSettled` — the settle GLOW's 800 ms one-shot —
   so a slow frame silently *skipped* the finale, and a re-mount had no edge
   left at all. It now falls through to the server's own position (the marker
   renders ON the finish stop from it the moment the glide yields), starts on
   the mount edge too (`mounted()` asks once; the section registers its ask as
   `registerHydroCeremonyStarter`), and refuses on a hidden stage
   (`hydroFlowSetAside` — a parked flow keeps owing the finale instead of
   consuming it under `display:none`).

3. **Truth witnesses in the presentation ledger** (`installHydroFlowWitnesses`,
   registered by the shell beside the serving probe — never at import, so unit
   bundles keep no permanent heartbeat):
   - `hydro-ceremony-owed` — «the finale is owed, startable, and nothing is
     starting it» (false through every legitimate wait: glide, standing plan,
     park, a *fresh* running choreography; a run older than 12 s is the
     killed-timeline case). Heal converges in one step: the registered starter
     (durable-arrival ask) or the honest skip.
   - `hydro-flow-stuck` — the three missed edges: `moving` with the marker
     idle and no plan (advance if the server confirms the destination, else
     roll back — a lost submit), `resolving` with the busy conjunction false
     (re-ask `settleHydroResolution`), `result` with the read-hold timer dead
     (re-arm it). The shell registers the facts only it has
     (`registerHydroFlowProbe`).
   Grace 3 s: far above any same-flush transition, far below the old
   accidental 20–35 s recoveries — and every heal **names itself** in the
   console (the ledger's warn), so a wedge is a diagnosable event instead of
   an unexplained wait.

## The audit table

| Gate / flow | Release mechanism | Bound (before → after) |
| --- | --- | --- |
| Hydro `ceremonyOwed` | section change-edges (settle / phase / planCursor) | **none** (forever-wedge or silent skip) → durable arrival + mount edge + witness (≈3 s) |
| Hydro busy falling edge → `result` | 3 shell edges (busy watcher, stack restore, deferred restore) | **none** when all missed → witness → `settleHydroResolution` |
| Hydro `result` read hold | `hydroResultTimer` | **none** if the timer died → witness re-arms |
| Hydro `moving` past marker nets (lost submit) | marker watcher + position watcher | flow stayed sealed → witness advances (server-confirmed) / rolls back |
| Hydro `followUpInteractive` batch term | batch consumed | any-source deadlock ≤ foreign safety → **ownership-scoped** |
| Hydro traversal resume | same computed | same deadlock → same fix |
| `deckPickActive` claim release | raw any-source echo | 20 s claim safety → ownership-scoped probe |
| Hydro marker glide/lock/release | director + arm safeties (`consoleHydroMarker`, `hydroMarkerDirector`) | ✔ already bounded |
| Colony resolution | evidence + bounded entry + release funnel + owed retry | ✔ (2026-09-04/06 reworks) |
| Std-projects conclusion | `stdpConclusionSignal` re-ask | ✔ |
| Play-card conclusion | `owedConclusion` + guarded retry | ✔ |
| Board-beat park | 30 s safety + ledger story + redrive | ✔ |
| Transport gates (fleet / hero / build / nomad / sale / conversion / discard / tile) | per-controller arm + scene safeties | ✔ bounded (swept 2026-09-09) |
| Resource transfers / arrivals / claims | wave budget + `BEAT/ARRIVAL/CLAIM` safeties | ✔ bounded |

**Known same-class residue (documented, deliberately not changed here):**

- `startExcursionQuietNow` (`ConsoleShell`) feeds `revealBusy` with an
  any-source `currentRevealEvent()` — the start flow's completion barrier
  would hold on a foreign viewer batch mid-excursion. Exposure is narrow (the
  start flow claims viewer batches during deployment; opponents are in setup
  too) and the start scene is an actively-reworked zone — fix belongs to that
  rework, with the same ownership predicate.
- `ConsoleColonyFocusStage.workingAreaYielded` reads the same raw fact but is
  a paint pose, not a close gate — no action.
- `boardCovered` (consoleRemotePlacement) reads it inside a wait that is
  already bounded by `BOARD_WAIT_MAX_MS` — no action.

## Iteration 2 (2026-09-10 — the field wedge recurred after the ceremony)

The report: a multi-step advance onto the 5 VP slot played its ceremony and
the screen wedged AFTER it, un-sticking «through some time». Three additions:

1. **The ceremony's completion got a wall-clock net** (`runHydroCeremony`):
   `finish` was carried ONLY by a GSAP `tl.call` — a timeline that dies
   mid-run (external kill, stalled ticker) never fires it, and `ceremonyOwed`
   then wedged until the witness ceiling. The net is the director-lock /
   `DEAL_START_SAFETY` idiom: a `setTimeout` at the choreography's total +
   1.5 s, idempotent through `doneFired`, cleared by the real finish. The
   witness ceiling (`CEREMONY_RUN_MAX_MS`) dropped 12 s → 8 s as the second
   layer over it.
2. **The FLOW TRAIL** — a bounded always-on ring of the module's own
   transitions (commit / phase / ceremony start-played / rollbacks / every
   witness heal with its branch), exposed as `__conHydroDiag().trail`. A
   field wedge now names its last edges instead of demanding a reproduction.
3. **The e2e repro** — `tests/e2e/console-hydro-terminal-landing.spec.ts`
   over the new `hydro-terminal` fixture (track position 5, the four
   remaining row tags as REAL cards, energy in stock): «К дальнему» → one
   press → 5→11 → the ceremony seat → **the workspace must LEAVE ITSELF
   within 14 s** (honest chain ≈ 8 s; the wedge hides behind 20–30 s
   accidental safeties). A failure dumps the trail + the ledger snapshot.

Deliberately NOT added: a force-degrading witness over the any-source
bounded-cinematic busy terms (`intakeFlying`'s deckDraw/boardBonus/flights,
`transfersFlying`) — each carries its own 2–30 s net, and forcing a foreign
cinematic from the hydro flow risks cutting a legitimate scene. If the trail
shows one of THOSE as the field's stuck term, the fix is scoping that term by
ownership (the `hydroOwnsRevealBatch` precedent), not a force.

## Iteration 3 (2026-09-10 evening — the field named itself)

The user's console export + screenshot identified the wedge exactly: a
Delta-Surge traversal 3→9 finished every segment, the animals landed on the
presented stage-9 card, and the track stood on «Маркер движется по треку» —
`[animation-hold] "hydro-marker" held for over 35000ms`, preceded by
`"tile-placement-remote"` at 35 s and two `board-beat-park` degrades.

1. **THE ROOT: the last leg's exit-wait deadlock.** `runTraversalLockedLeg`
   awaited the presented card's EXIT after every presenting leg — and the
   exit is triggered by the cursor moving to the NEXT segment. Past the
   FINAL leg the presentation falls back to the destination (the same cell),
   so the card legitimately stays as the landing's own result face; its
   leave only comes with the flow's result stage, which is gated on the very
   finalize that was waiting. The last leg now finalizes BEFORE the wait
   (the mid-path contract is untouched). Guard: `consoleHydroMarker.spec` §
   «the LAST leg never awaits its presented card's exit» + the e2e FIELD
   SHAPE journey (`hydro-terminal-surge` fixture: Surge, position 7, energy
   2 ⇒ «К дальнему» = 9 deterministically).
2. **THE CLASS: the hold ceiling now RECOVERS, not just masks.**
   `AnimationHoldOptions.expire` — the owner's own abort, run when the 35 s
   ceiling (or the foreground watchdog's expiry) fires. Masking alone left
   the owning module's state wedged behind a "released" hold — every input
   gate and close gate reading that state directly stayed frozen (both field
   holds did exactly this). Wired: `hydro-marker` → `abortHydroMarker`,
   `tile-placement-remote` → `abortRemotePlacements`, `trade-fleet` →
   `abortTradeFleet`, `resource-transfer` → `abortResourceTransfers`; the
   first two also carry `diagnose` snapshots so the next ceiling warn names
   the stuck shape. Guard: `animationHold.spec` § the owner recovery.
3. **The single-glide claim net.** `armHydroMarker`'s 10 s safety dies at
   `detectHydroMarker`, and from there a single glide had NO whole-
   transaction bound (a transport chain that never reaches `endHydroMarker`
   left `active` true forever). `CLAIM_PROGRESS_MAX_MS` (15 s) now spans
   claim → handoff; `endHydroMarker` hands over to the finalize/plan nets.
   Probe: `hydroMarkerNetsArmed()`. Guard: `consoleHydroMarker.spec` § the
   claim window.

Left as documented residue: the remote-placement scene's INTERNAL stall that
made its hold reach the ceiling (its `waitingForBoard` window is excluded
from the hold by design; the 35 s instance means the flight/queue half
stalled) — the new `diagnose` names the shape on the next occurrence, and
`expire` now ends it honestly; the notification correlation 90 s release and
the ResizeObserver loop warnings are their own bounded/benign classes.

## Guards

`tests/client/components/console/consoleHydroFlow.spec.ts` § the flow-close
witnesses (lying/heal semantics, install/uninstall), `consoleHydroMarker.spec`
§ `hydroPlanDeclaresSource` / the last-leg exit / the claim window,
`animationHold.spec` § the owner recovery, `consoleHydroTerminalStage.spec` —
the three iteration-2 regressions, and the three e2e journeys in
`console-hydro-terminal-landing.spec.ts` (plain multi-step 5→11 · the FIELD
SHAPE Surge→9 · vs-MarsBot 0→11).
