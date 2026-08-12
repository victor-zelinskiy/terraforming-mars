# THE CONSOLE WORKSPACE STACK — one model of depth

*(Started 2026-08-07. Module: `src/client/console/consoleWorkspaceStack.ts`, spec
`tests/client/components/console/consoleWorkspaceStack.spec.ts` (44 tests). **Status: stages A
and B are DONE — the shell runs on the stack, `consoleWorkspaceStage.ts` and
`consoleWorkspaceEmbed.ts` are deleted.** Read this before touching workspace navigation,
`consoleState.section`, or any of the `consoleWorkspace*` modules.)*

## Why this exists

The console's north star is «a workspace is ONE FLOW, not a set of screens». That idea was
implemented as a set of mutually-guarding latches rather than as a model, and the two bugs the
player reported are one hole, not two.

### Symptom 1 — a soft-lock that costs a turn

Play `TradingColony` (C47, `behavior.colonies.buildColony`) from hand. The hand is a workspace,
the card play is a stage inside it, and the card's `SelectColony` follow-up teleports the
colonies section **into that stage's zone** (`colonyEmbedLatch === 'hand'`,
`colonyEmbedTarget = workspaceStageTarget('hand')`).

Press B. `ConsoleShell.vue:6563-6570`:

```js
if (action === 'back') {
  this.deferShellTask();                 // CONDITIONAL: only if shellTask !== undefined
  this.consoleState.section = 'board';   // UNCONDITIONAL
  return true;
}
```

`deferShellTask()` (`:8818-8824`) no-ops when `shellTask` is `undefined`, and `shellTask()`
(`:2313`) returns `undefined` whenever `!this.admits('section')` — a live reveal, a played-hero
beat, a gated interruptive prompt. The section leaves for the board either way.

Then the `'consoleState.section'` watcher (`:5385-5402`) deliberately does **not** close the
stage while `colonyEmbedLatch === 'hand' && colonyFollowUpLive` (`:5399`) — a guard added for
the sponsor chain. Result:

| fact | value |
|---|---|
| `workspaceStageOpen('hand')` | **true** — ownership alive |
| `ConsoleHandSection` mounted | **no** — its zone is gone |
| `workspaceStageTarget('hand')` | `undefined` |
| `coloniesHeldForWorkspace` (`:3764`) | **true** → the colonies render NOWHERE |
| `colonyPromptStranded` (`:3774`) | **false** (`colonyEmbedHostKind` is still `'hand'`) → the self-heal at `:5224` never fires |
| `task.deferred` | **false** → no `.con-mandatory` restore card |

`consoleLeakDetector` prints `STRANDED PROMPT: waitingFor "colony" … has NO serving surface`.

**And the restore is itself a trap.** Even when the defer lands, `restoreDeferredTask()`
(`:8829`) clears `task.deferred` **first**, which instantly re-arms `colonyEmbedHostKind ===
'hand'`; the embedded early-return in `openShellTaskSurface` (`:8591-8597`) then only moves the
cursor and returns. The way back consumes the only way out.

**Root cause, one sentence:** *ownership* (`workspaceStageOpen`) and *presence* (is the host
mounted) are two independent truths nobody reconciles, and the guard that keeps ownership alive
across a section change is exactly what makes the missing presence permanent. Embed rule 4's
«render nowhere for one frame» becomes a terminal state.

**The verb was already written 900 lines away.** The sponsor branch (`:7476-7480`) writes
`task.deferred = true` **directly**, and its own comment names this hazard verbatim. The colony
branch is a re-authored copy that lost the protection. The bug class was paid for once and came
back because **B is authored afresh at every branch**.

### Symptom 2 — nothing survives a session

No workspace module persists anything. `docs/claude/console/workspace-embed.md` rule 6 admits
this and patches it per case — exactly three compensations exist (`ConsoleShell.vue:2398`,
`:3142`, `:5136`), all keyed on `game.phase === PRELUDES`. The hand, the action centre and the
colonies have none.

Two facts that shape the design:

1. **Leaving to the menu is a hard `window.location.assign('/')`** (`loadingScreenState.ts:92-105`,
   from `GamepadLayer.vue:454`), and there is **no** `beforeunload`/`pagehide` anywhere in
   `src/client`. Persistence must be **write-through on mutation**, never save-on-exit.
2. **With a live server cache the server returns the SAME live `PlayerInput`**
   (`GameLoader.ts:182-193`). After a restart the nested input is gone and `Game.deserialize`
   (`Game.ts:2266-2314`) re-derives a top-level prompt from the phase. One truncation rule must
   cover both.

### The shape of the problem

Depth was never expressed. FIVE parallel models answered «where am I»: `consoleState.section`,
`consoleState.sheet`, `workspaceStageState`, `workspaceOutcomeState`, `workspaceEmbedState` —
plus ~a dozen shell latches. `handleSectionBack` (`:7438-7541`) is a twelve-branch chain that
re-derives depth from different subsets each time, and the branch for colonies-inside-hand was
simply never written. The guard «the chain is not over yet» exists in **five hand-copies**
(`:3162`, `:5326`, `:5399`, `:5498`, `:5616`).

---

## The model

One ordered stack of frames. Two invariants; everything else follows.

### Invariant 1 — PRESENCE IS DERIVED FROM THE STACK

> A surface mounts because a frame of its kind is in the stack, and for no other reason.

Today that is six different `v-if` formulas (`ConsoleShell.vue:163, 197, 229, 263, 581, 1017`).
Line 197 is the literal carrier of the bug:
`(section === 'colonies' && !coloniesHeldForWorkspace) || colonyEmbedActive`.

Once presence derives from the stack, «own a zone whose host is unmounted» stops being
expressible: the frame's existence IS what mounts the host, so the zone is always on its way.
Embed rule 4's gap goes back to being genuinely one frame.

### Invariant 2 — A FRAME LIVES ONLY WHILE ITS ANCHOR HOLDS

> One reconciler truncates the stack at the first frame whose anchor no longer checks out
> against server truth. Outwards, and truncating — because a frame's meaning depends on its
> ancestors, so an inner frame cannot outlive an outer one.

The anchor is serializable and STRUCTURAL — never a title (CLAUDE.md cross-cutting invariant 1),
and deliberately **not** `promptIdentityKey`, which interpolates the *translated* title
(`turnIntents.ts:51`) and would truncate a live stack the first time somebody switches language.

This one rule replaces `colonyPromptStranded` + its heal watcher, `startSceneMounted`'s reload
fallback, `colonyFollowUpLive`, and the `CLAIM_SAFETY_MS` / `BEAT_SAFETY_MS` / `ARRIVAL_SAFETY_MS`
backstops — **and** it is what makes a reload honest: the same walk that heals a dead claim
in-session decides how much of a persisted stack may come back.

### The frame

```ts
interface WorkspaceFrame {
  readonly kind: WorkspaceFrameKind;   // registry key
  subject: string;                     // CardName / ColonyName — the crumb's anchor
  stage: string;                       // i18n key of this frame's step (crumb tail)
  phase: WorkspacePhase;               // from consoleWorkspaceFlow.ts — B's verb + input gate
  serves: ReadonlyArray<TaskKind>;     // which prompts this frame may serve
  anchor: FrameAnchor;                 // proof of life, re-checked by the reconciler
  slot: string;                        // RUNTIME — never serialized
}
```

**Persisted vs runtime is load-bearing.** `serializeWorkspaceStack()` lists fields explicitly
(not a spread) so a new runtime field cannot silently start travelling — that is how a restored
workspace ends up waiting on a beat nobody will play. A spec fences it.

### The registry — adding a workspace is ONE ROW

`WORKSPACE_KINDS` holds, per workspace: the crumb root (an existing i18n key), the DOM root
(the leak detector's presence probe), the projection onto `section`/`sheet`, and the default
`serves`. Nine rows today: `card-actions`, `hand`, `colonies`, `hydro`, `start`,
`standard-projects`, `milestones`, `awards`, `hydro-pick`.

Three things are deliberately **not** in the registry because they are genuinely not constant
per kind: `serves` at runtime (a frame earns and loses prompts — an action only serves a card
pick once its preview promised cards), `slot` (one host publishes DIFFERENT zones to different
children — the start scene has one for a hosted hand and another for hosted colonies), and the
anchor (it depends on the carried object).

### The navigation verbs

`consoleState.section = X` was the whole vocabulary, and it is a LOSSY verb: it cannot tell
«park this, I want to read the board» from «this flow is finished» from «take me to that
screen». All three wrote `'board'`, so every reader re-guessed — and B, whose entire job is to
answer that question, guessed differently from the branch beside it.

| verb | meaning |
|---|---|
| `enterWorkspace(kind)` | the player goes to a screen — the stack becomes exactly `[kind]` |
| `pushWorkspaceFrame(...)` | a FLOW hosts a step on top (start ⊃ hand, played card ⊃ colonies) |
| `descendWorkspaceFrame(...)` | the player picks an object up INSIDE a screen — a phase, not a frame |
| `foldWorkspaceFrame()` | back to that screen's browse layer (B at `configure`) |
| `leaveWorkspace()` | one screen back |
| `goBoardHome()` | the flow is finished — frames are thrown away, nothing to return to |
| `collapseWorkspaceStack()` | PARK the whole stack — hidden, full depth kept, restore card offered |
| `restoreWorkspaceStack()` | un-park at the same depth, same decision, no replayed cinematic |

⚠️ **A lateral move is not a descent.** Walking from the colonies to the hydro track does not
make the colonies the hydro's host. Conflating `enterWorkspace` with `pushWorkspaceFrame`
quietly builds a chain nobody meant.

⚠️ **A descent inside a screen is a PHASE, not a frame.** The browse layer is parked, never
unmounted — which is exactly why its selection, filter and scroll survive for free — and it
keeps `kind` unique in the stack, which is what makes `workspaceFrameMounted` a straight answer.

### The projections

`workspaceStackSection()` / `workspaceStackSheet()` — the DEEPEST projecting frame wins per
axis. That is literally «the player drives the surface they SEE» from `.claude/rules/console-ui.md`,
and it lets `handEmbedded` / `coloniesEmbedded` be deleted from `shellTaskOnSurface`
(`consoleTaskRouter.ts:127-164`): both flags exist ONLY because `section` lied about where the
player stood.

**A parked stack projects to `'board'` with NO sheet — both axes.** A park that left `sheet` set
is the documented «half-collapse»: the restore card keys off `sheet` being clear, so input kept
routing into an invisible workspace.

### Serving and the presence probe

`stackServes(kind)` answers the leak detector, and **a parked stack still serves** — a decision
the player deliberately set aside is not stranded; its way back is the board-home restore card.

`probeWorkspacePresence(seen)` / `workspacePresentDepth(seen)` are the runtime half of invariant
1: compare the frames against the DOM. Callers MUST debounce (a single-frame gap is the
legitimate claim-before-slot window) and then truncate at the shallowest offender. This is the
runtime detector for the whole «ownership without presence» class, and it is what makes a future
regression loud instead of silent.

---

## Target end state

Two modules with non-overlapping duties — not three facades over a fourth.

| module | owns | fate |
|---|---|---|
| `consoleWorkspaceStack.ts` | depth, presence, B, collapse, crumb, serving, anchors, persistence | ✅ landed |
| `consoleWorkspaceOutcome.ts` | ONLY in-flight cinematic gating: `answerIn` / `beatDone` / `arrivalDone` / `expectedCards` + timers | strip |
| `consoleWorkspaceStage.ts` | — | **delete** (it is frame phases) |
| `consoleWorkspaceEmbed.ts` | — | **delete** (it is frames) |
| `consoleWorkspaceFlow.ts` | the pure phase model + `backVerbFor` | keep as-is |
| `consoleWorkspaceHeader.ts` | the segment crumb grammar | keep as-is |

Facades were considered and rejected: keeping three modules as a permanent indirection layer is
the same diffusion in profile, and it would migrate ~183 call sites twice.

---

## Migration map — all 44 navigation sites, classified

| verb | `ConsoleShell.vue` lines |
|---|---|
| `enterWorkspace('colonies')` | 5083, 5097, 5106 *(today under a `!colonyEmbedActive` guard — unnecessary: if a colonies frame exists the entry is a no-op)*, 7028, 8607 |
| `enterWorkspace('hand')` | 6924, 7803, 8623, 8641 |
| `enterWorkspace('hydro')` | 7036 |
| `enterWorkspace(dynamic)` | 5769 *(hand-pick cancel → origin screen)*, 9901 *(hand-reveal director hook)* |
| `goBoardHome()` | 238, 5170, 5209, 5316, 5336, 5364, 5465, 5640, 5939, 6622, 6996, 7104, 8303, 8317, 8553, 8602, 8643, 8653, 8857, 8955, 9817, 9828 |
| `collapseWorkspaceStack()` | **6568 ← THE BUG**, 7127, 7165, 7478, 7497, 7867 |
| `leaveWorkspace()` | 7191, 7508 |

Plus one outside the shell: `infoModeState.ts:82` (`restoreConsoleSnapshot`).

**The finding that proves the architecture** — `ConsoleShell.vue:7186-7192`:

```js
// B: back to the board. The hydro card pick returns to the HYDRO
// screen (its plan is still being composed there), never to the board.
const stayInSection = this.consoleState.sheet === 'hydroPick';
this.consoleState.sheet = undefined;
if (!stayInSection) { this.consoleState.section = 'board'; }
```

That is a hand-written special case for exactly what the stack does by construction:
`leaveWorkspace()` pops the `hydro-pick` frame and leaves `hydro` beneath it. `stayInSection`
**disappears**. The shell has dozens of this shape — they are the copy-paste to remove.

---

## Staging

**A. ✅ DONE.** The module + 36 specs (`build:test` and `eslint --no-cache` clean). Additive —
nothing imports it, so game behaviour is unchanged. Includes the registry, the verbs, the
projections, the anchors, serialization, the presence probe, and two class guards: *no mutator
can orphan a frame* (deterministic sweep of every exported mutator in triples) and the DOM probe.

**B. Invert the shell** (next). Sub-steps, cheapest first, each verifiable:
1. Replace the 44 assignments with the verbs (each site DECLARES its intent).
2. `section` / `sheet` become projections. Shrink the `:5385` watcher to presentation resets
   only; do **not** port its `closeWorkspaceStage()` arm or the `colonyEmbedLatch &&
   colonyFollowUpLive` guard — the write they protected no longer happens.
3. A grep guard spec modelled on `tests/gamepad/glyphLiteralGuard.spec.ts`: a direct write to
   `consoleState.section|sheet|task.deferred` outside the stack module fails the suite.
4. Presence from the stack — the six `v-if`s → `workspaceFrameMounted`, teleports →
   `workspaceFrameTarget`. **The soft-lock dies here.**
5. Delete the latches: `colonyEmbedLatch`, `colonyOpenedByPrompt`, `colonyEmbedHostKind`,
   `colonyEmbedTarget`, `coloniesHeldForWorkspace`, `colonyPromptStranded` + watcher `:5224`,
   the five `colonyFollowUpLive` copies, the mirror watcher `:5241`, the
   `openShellTaskSurface` early-return `:8591-8597`. ≈120 shell lines.
6. Delete `consoleWorkspaceEmbed.ts` and `consoleWorkspaceStage.ts`.

**C. Anchor reconciler + leak detector.** One truncation watcher; the detector asks
`stackServes(kind)` and runs `probeWorkspacePresence`; delete `setConsoleTaskDeferred` and its
mirror (`stackParked()` is plain TS and importable — no round trip, no drift).

**D. Persistence.** Key `tm_con_ws:v1:<playerView.id>` — `GameModel` has no `gameId`, but
`PlayerId` is unique per game AND per seat. Write-through on mutation. Hydrate in `setup()` of
`ConsoleShell.vue` (**not** `mounted()`: the template's `v-if`s read the derived section one
render earlier, `mounted()` also fires on a console↔desktop toggle, and it must run before the
first `ensureStartWizard()` — `consoleStartState.ts:139` calls `resetWorkspaceEmbed`). Cold
restore: transient phases re-seated at `committed`, gates open, no cinematic replay.

**E. Strip `consoleWorkspaceOutcome.ts`** to run-state.

---

## The acceptance test

`docs/../.claude/plans/e2e-baseline-2026-08-07.md` holds the pre-refactor e2e baseline:
**71 passed / 52 failed of 123**, triaged into 8 clusters.

Clusters **C (16 tests) and D (8 tests) are a GENUINE regression, not stale specs** — measured
with paint-aware predicates (`checkVisibility`, `.isVisible()`, `:not([style*="display: none"])`):

- `board home never became live — still showing [".con-start",".con-hand"]` after the driver's
  full 70-round boot budget;
- `<span>Начать партию</span>` resolves but stays **hidden** across 10 polls;
- `.con-start__status-inner--held` **never releases**;
- `offeredCards()` returns `[]` in four independent specs;
- `console-project-deck`: UI **0** vs server `deckSize` **185**.

`.con-start` + `.con-hand` co-visible IS the embedded hand-step chain (`start ⊃ hand ⊃
colonies`) — the same chain `.claude/rules/console-ui.md` records as broken on 2026-08-06, and
the same one whose colony branch produces the soft-lock.

> **⚠️ CORRECTION (2026-08-07, after the cluster A/B repair — read this before trusting the
> paragraph above).** The `[".con-start",".con-hand"]` signature is **at least partly a DRIVER
> defect, not an app stall**, and the confident framing above was written before that was known.
>
> Two of the five bullets have been explained away by fixing the e2e driver alone, with zero
> `src/` changes:
> - `console-score-header · compact-720` produced exactly that message, and its screenshot showed
>   a perfectly HEALTHY embedded hand step (`СТАРТ ПАРТИИ › ЭПАТАЖНЫЙ СПОНСОР › КАРТЫ В РУКЕ`)
>   whose focused card was legitimately unplayable («Требуется температура −16 °C»). The driver
>   pressed A on whatever the cursor sat on, so A was correctly refused forever. Teaching it to
>   walk to a `con-hand__slot--playable` slot first makes it pass.
> - `waitForBoardHome`'s start branch keyed on `.con-start` **count** — the same MOUNTED != VISIBLE
>   bug as the original — so during a tile-placing prelude it beat the placement branch and
>   hammered an invisible workspace.
> - The `raised pack is not at full size — Expected 1, Received 0.7` reading also did NOT
>   reproduce once the boot was correct; the hand dock's compact pose is fine.
>
> **So: RE-MEASURE cluster C against the repaired driver before treating it as this refactor's
> acceptance test.** What survives that re-measurement is the real signal; what does not was
> always a measurement artifact. The soft-lock in symptom 1 is independently reproducible by hand
> (play `TradingColony`, press B) and does NOT depend on any of this — that one still stands on
> its own, with the code path traced above.
>
> The original intent stays right: do not patch a C/D spec to make it pass. But do not assume the
> whole cluster is an app defect either — that assumption was made too early here.

---

## STAGE B — LANDED (2026-08-07)

The shell no longer has a navigation vocabulary of its own. What actually shipped, against
the plan above:

### The five parallel models are two

`consoleWorkspaceStage.ts` (213 lines) and `consoleWorkspaceEmbed.ts` (149 lines) are
**deleted**, not facaded. Their two ideas turned out to be the same idea one level apart and
both are now properties of a frame:

| was | is |
|---|---|
| `workspaceStageState.{host,subject,stage,phase}` | the HAND frame's `subject` / `stage` / `phase` — a descent is a PHASE of a frame, never a second frame |
| `workspaceStageState.slot` + `workspaceEmbedState.slot` | ONE `frame.slot`: the zone a frame publishes for whatever stands inside it |
| `workspaceEmbedState.{host,surface}` | `workspaceFrameHost(kind)` — the frame directly below |
| `workspaceEmbedState.source` | the host frame's `subject` |
| `workspaceEmbedState.committing` | the host frame's phase past the commit boundary |
| `colonyEmbedLatch` + `colonyEmbedHostKind` + `colonyOpenedByPrompt` | the colonies FRAME and its `anchor` |
| `handPickReturn` | the frame UNDER the pick's overlay hand — it was never anywhere else |

`consoleState.section` / `.sheet` are **getter-only projections** of the stack. That is the
guard the plan wanted from a grep spec (B.3), enforced by the compiler instead: an assignment
is `TS2540: Cannot assign to 'section' because it is a read-only property`, so the migration
work-list was *produced by the compiler* rather than by reading 10 000 lines.

### The verbs

All 44 assignments are gone. `section = 'board'` split into `goBoardHome()` (17 sites),
`leaveWorkspace()`, `collapseWorkspace()` and `enterWorkspace(kind)`; `sheet = X` became
`openSheet(kind)` / `closeWorkspaceSheet()`; `sheet = undefined` became `leaveWorkspace()`.
`infoModeState`'s snapshot dropped both fields — Info Mode renders OVER the stack and never
moved it, so there was never anything to restore.

**`stayInSection` disappeared exactly as predicted** — the hydro pick is a frame pushed on the
hydro track, so B uncovers the track by construction.

### The five guard copies are one

`workspaceFrameHasNested(kind)` — «is anything standing inside me». `ConsoleShell.vue:3162,
5326, 5399, 5498, 5616` are gone: `:5399` (the `section` watcher's `closeWorkspaceStage()` arm
plus its `colonyEmbedLatch && colonyFollowUpLive` guard) was deleted outright, because the
write it protected no longer happens.

### Two rules that had to be added, and why

1. **`goBoardHome()` keeps a PHASE-anchored root.** A placement mid-deployment, a scale
   ceremony, a hand-select submit — all of them wrote `section = 'board'`, which never touched
   the full-bleed start scene. Unwinding it would have read as «the start screen is gone» with
   the deployment still owed. Same rule makes `enterWorkspace` (a lateral move) stand OVER the
   opening instead of ending it.
2. **`overlay: true` frames.** The client pick bridge (a composer asking the real hand for a
   card) is a frame relationship — both projections come out exactly as the old two-axis
   juggling produced them — but it has no zone to wait for, so it must not be held off screen
   by the ownership≠readiness rule.

### The reload, and the one derivation that had to stay

`console-start-sponsor`'s «the step survives a reload» is the contract that forbids a purely
event-driven stack in stage B: a reload wipes the module-level lifetime hold, so `startFrameLive`
keeps the old server-truth fallback (`game.phase === PRELUDES` + a live play-from-hand ⇒ the
start workspace is the host). It is now ONE branch in one computed instead of a term inside a
40-line claim. Stage D's persistence is what finally removes it.

### Measured

| | before | after |
|---|---|---|
| `ConsoleShell.vue` | 9 979 | 9 907 |
| `consoleWorkspaceStage.ts` + `consoleWorkspaceEmbed.ts` | 362 | **0** |
| `consoleWorkspaceStack.ts` | 872 | 1 100 |
| stack spec | 36 tests | 45 tests |
| `src/` overall | — | **−179 lines** |

The shell's *net* −72 understates the change badly: ~140 lines of what remains are the new
verb methods and the rationale for each, while what left is latches, mirror watchers, branch
chains and two whole second copies of a screen's input grammar.

**e2e:** full suite **107 / 123** (baseline 71 / 123). The 36-file must-stay-green list runs
**51 / 51**. Every remaining red is either a pre-existing one from the baseline or the
separately-tracked `console-blue-action-purchase · tv4k`; two placement-source specs flake
under 3–4 workers and pass in isolation.

### Also removed on the way

`shellTaskOnSurface`'s `handEmbedded` / `coloniesEmbedded` flags (`consoleTaskRouter.ts`) —
they existed only because `section` lied while a screen was hosted; the projection tells the
truth, so both are gone with their spec rows. The leak detector's `KIND_SURFACES` is now
derived from the registry (`workspaceSurfacesFor`), so a new workspace can no longer be missed
by a list the compiler cannot see.

### What stage B deliberately did NOT do

The anchor reconciler (C), persistence (D) and stripping `consoleWorkspaceOutcome` (E) are
untouched. `consoleState.task.deferred` is still its own field: a parked STACK and a minimized
PROMPT are genuinely orthogonal (the player can walk into the colonies while a host task waits),
so merging them would have been the same mistake in the other direction. `collapseWorkspace()`
sets both atomically, and `mandatoryDeferredActive` now also answers yes for a parked stack —
which is what makes the reported soft-lock's way back unconditional.

---

## POST-B FIELD REPORT (2026-08-08) — three bugs, one root and one old one

Played by hand: «Эпатажный спонсор» → the play-from-hand step → B (свернуть) →
board → colonies → back → A.

### 1. A detour destroyed the parked flow — «свернуть» had become «закрыть»

A rendered the START WORKSPACE's deployment (with a bogus «ожидаем других
игроков») instead of the player's own unfinished card play.

Root: the park was a FLAG on the live stack, so `enterWorkspace('colonies')` →
`goBoardHome()` wiped the parked frames on the way past. But **parking is what
the player does IN ORDER to go somewhere else** — the one thing the flag could
not survive was its own purpose.

Fixed by making the park a **separate stack** (`workspaceStackState.parked`):
`collapseWorkspaceStack` MOVES the frames aside, the live stack is then free for
wherever the player goes, and only `restoreWorkspaceStack` (they came back) or
`discardWorkspacePark` (the server moved to a different prompt) empties it.
`goBoardHome` / `enterWorkspace` / `popWorkspaceFrame` never touch it, and
`stackServes` / `frameServing` consult it, so a set-aside decision is still
never stranded. `workspaceFrameKnown` is what stops the start workspace being
stood up a second time beside its own parked copy.

Fenced by `tests/e2e/console-start-sponsor.spec.ts` («a detour destroyed the
parked step») and two module specs.

### 2. «Карты в руке» opened empty while parked

Same root: the parked chain still occupied the stack, so the hand had nowhere to
stand. It falls out of the fix — the live stack is empty while parked, so the
hand opens as an ordinary screen with the player's real cards. Pressing A on one
now names the reason instead of starting a second action (below).

### 3. Every «почему нельзя» was individually true and collectively a lie

The LT wheel read «Сейчас недоступно» · «Недостаточно растений» · «Недостаточно
тепла» · «Доступно после первого действия в этом ходу» while the only real
answer was «сначала завершите текущее действие».

Not a stack bug — an OLDER one the stack merely made reachable. Two causes:
`myTurn` is `hasTurn(view)`, and a top-level `SelectProjectCardToPlay` makes
`findPlayProjectCardAction` match, so `myTurn` was TRUE and the shared
`offTurnReason` never got a chance to speak; and each surface then fell through
to its own arithmetic.

Fixed with ONE shell source — `actionBlockedReason` ('' = a new action may be
started, else the honest key) — threaded into the pure models as
`blockedReason`, where it OUTRANKS every per-item reason. Audited and applied
across every board-home surface: LT wheel · Standard-Projects rows (patent sale
included) · Milestones/Awards items · the action centre's activations · the
hand's play press · the colony trade · the MA / sheet / std-project row
activations. Already correct and left alone: the colonies' trade reason and the
hydro screen's `turnState` (both key on the viewer's own pending input); the
journal, which is a VIEW and is deliberately blocked only by a live placement.

## RESUME ≠ FRESH-OPEN (2026-08-12) — the suspended instance and its two doors

Played by hand: «Действия карт» → «Летающая платформа» → «Выбрать колонию» →
Плутон → торговля → the mandatory discard → B (свернуть) → A on the prompt
card. Expected: the exact suspended phase back. Got: the blue-actions BROWSE
body under the parked flow's breadcrumb — «ДЕЙСТВИЯ КАРТ › ПЛУТОН › ПЛУТОН ·
СБРОС КАРТЫ» — with everything blocked. One presentation from one workspace,
one navigation context from another.

### The three roots

1. **The mount-time re-seat adopted a FOREIGN claim.** ConsoleCardActions'
   `mounted()` keyed its «returning from a collapse» branch on the bare
   `workspaceOutcomeClaimed()`. During a colony resolution the live claim is
   the COLONIES' (`host: 'colonies'`, `sourceCard: 'Pluto'` — a colony, not a
   card), so the composer was seated on `cardName: 'Плутон'`: the crumb read
   the ghost subject, `composerEntry` was undefined so nothing rendered, and
   no descend episode ran so the browse grid stayed visible underneath
   (`--parked` only cuts pointer events; visibility belongs to the episode).
   Worse, closing that ghost via `closeComposer` released the colonies' claim
   — a fresh look MUTATED the suspended flow's state.
2. **The runtime descent did not survive the park.** The composer draft (card
   + variant) is component state; the park unmounts every surface. The frames
   kept the navigation (`card-actions ⊃ colonies ⊃ hand`) but nothing could
   rebuild the presentation, and the colonies step's teleport zone is
   published by the composer — no composer, no zone, so the whole chain below
   rendered nowhere while the stack (and the crumb) said otherwise.
3. **`openSheet` conflated the two intents.** Its first line routed a parked
   kind into the FULL restore, so the wheel's «посмотреть» and the prompt
   card's «продолжить» were one code path — and both landed in the broken
   half-restore.

### The model now

- **A suspended instance = the parked frames (navigation) + a module-level
  DESCENT DRAFT (presentation) + server truth (authoritative state).**
  `consoleCardActionsUi.draft {cardName, nodeIndex}` is written at the
  descend, survives any unmount whose frame is still `workspaceFrameKnown`
  (that unmount IS the park), and dies on a genuine fold/close. The entry
  lock (`colonyTradeEntryState`) already lived by the same rule.
- **The mount-time decision is pure and HOST-SCOPED** —
  `actionWorkspaceRestorePlan` (consoleCardActions.ts, unit-tested):
  `seat-step` (hosted colonies + draft + live entry) · `seat-outcome` (ONLY
  `claimHost === 'card-actions'`) · `fold-step` (hosted step, descent not
  rebuildable → fold the whole workspace; the mandatory gate re-announces —
  a mixed surface is the forbidden outcome) · `none`. `collapsed` (a park
  exists) always answers `none`: a hand-open beside a park adopts NOTHING.
- **A host must republish its step zone from `mounted()`** when the step was
  hosted before the host existed — a change-watcher cannot fire true→true
  (ConsoleActionComposer.mounted → `setWorkspaceFrameSlot('card-actions', …)`).
- **RESUME has exactly two doors** — the board-home restore card (A and B)
  and the notification CTA, both `restoreDeferredTask` — plus the
  PROMPT-routed doors (`restoreParkedWorkspace` inside `openHandWorkspace` /
  `openColoniesForPrompt`), because a server demand's home is the parked
  chain. **`openSheet` never restores**: a wheel open is a FRESH instance
  beside the park — clean browse, `actionBlockedReason` makes it read-only,
  closing it touches nothing, and it never un-defers while a park is owed
  (`parked non-empty ⇒ deferred` holds).
- `closeComposer` releases only a claim whose `host` is this workspace's own.

Fenced by the `actionWorkspaceRestorePlan` matrix in
`tests/client/components/console/consoleCardActions.spec.ts`. The fleet-dock
half of the same field report (vertical chips in the hosted entry) is a
separate root — the berth lived in the crumb-tail's absolute cell instead of
the header's trailing zone — recorded in `docs/COLONY_TRADE_FLOW.md` § THE
SECOND DOOR.
