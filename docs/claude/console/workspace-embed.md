# EMBEDDED STEP SURFACES — the workspace composition contract

*(2026-08-06. Not auto-loaded; read when a workspace needs to host a full
existing screen as one of its steps, or when a screen must become hostable.
Module: `src/client/console/consoleWorkspaceEmbed.ts`. First client: the Game
Start Workspace hosting «Карты в руке» for the play-from-hand preludes —
Eccentric Sponsor / Ecology Experts, both via the same server
`PlayProjectCard` deferral.)*

The advantage the workspace architecture promises: **tomorrow's case — the
card play opening the colonies rail, the colonies rail opening a target pick —
sits down with no new machinery**. That is guaranteed by six rules, not by
per-case wiring. A new host or a new hostable surface is a row in two closed
unions plus compliance with the rules; nothing else.

*(2026-08-06: the promise was cashed — surface `'colonies'` joined the union
with hosts `'start'` (a prelude's Build Colony, zone
`.con-start__colonystep`), `'hand'` (a played card's SelectColony follow-up —
the section lands in the freed `hand-play` STAGE zone, the crumb reads
`КАРТЫ В РУКЕ › <карта> › КОЛОНИИ` via `markWorkspaceStageFollowUp`) and
`'card-actions'` (an activation's colony pick, zone
`[data-embed-slot="action-colonies"]` in the composer's outcome column). The
shell's `colonyEmbedLatch` records WHICH live flow the SelectColony arrived
inside of on the prompt's rising edge and holds through the whole follow-up
— prompt → fleet flight → rewards → cube landing → Pluto reveal
(`colonyFollowUpLive`); the falling edge runs the host's deferred fold. B on
the embedded step = MINIMIZE (defer); restore degrades to the standalone
section when the host has meanwhile finished — honest, never a soft-lock.

Iteration 2 hardened the latch into a CONTINUATION rule: **the latch picks the
NEAREST unfinished step, depth-first** — an open hand stage (`workspaceStageOpen('hand')`)
beats the card-actions sheet beats the start scene. That is what makes the
sponsor chain work: Start ⊃ hand (sponsor's play step) ⊃ card play ⊃
SelectColony lands `latch = 'hand'`, the colonies teleport into the hand's
freed stage zone — THREE deep, still just the teleport chain — and the START
never resurfaces early because `startSponsorEmbed` itself holds on
`latch === 'hand' && colonyFollowUpLive` (the sponsor step is not "done" while
the card it played still owes a colony). The finalize unwinds inside-out:
close the colony focus, close the hand stage, and only then the sponsor step
completes on its own signal. Never route the latch to a fixed root — that was
the double-nesting bug this rule replaces.

**Three teardown paths had to learn the same thing** — a chain is only as deep
as its shallowest holder, and each of these silently cut it:

1. **`playedHeroState.active` falling is only HALF of «the step is over».** It
   says the card LANDED, not that its effects resolved. Releasing the claim
   there while the played card still owed a colony pulled the start's zone
   out, the hand lost its host, its stage zone unmounted, and the colonies
   teleported nowhere (the screen sat on the deployment queue with a live
   `SelectColony` and no surface). The release now waits for the follow-up's
   falling edge — and when it finally runs it CLEARS and then RE-ASSERTS from
   truth (`setWorkspaceEmbed('start', undefined)`, then re-set if
   `startSponsorEmbed` is still true), because the mirror watcher only fires
   on a CHANGE of the computed: a brand-new play-from-hand step would
   otherwise be left with no mirror at all.
2. **The `consoleState.section` watcher closes the hand's stage on any leave**
   — correct, except while that stage is the ZONE the deeper step lives in.
3. **Surface-identity consumers must know the embedded case.**
   `shellTaskOnSurface` knew only `section === 'colonies'`, so the central ask
   banner painted «ВЫБЕРИТЕ КОЛОНИЮ» across the host's breadcrumb tail (fixed
   with `coloniesEmbedded`, the exact parallel of `handEmbedded`), and the
   command-bar branches keyed on `section === 'hand'` outranked the colony
   branch, advertising «A Разыграть» over a colony grid. **A host that keeps
   its own `section` while hosting must gate every section-keyed branch on
   the embed flag** — the player drives the surface they SEE.)*

## The six rules

1. **A step surface is HOST-AGNOSTIC.** It renders content only; shell chrome
   — the frame plate, the `ConsoleWsHead`, the `con-ws` rail marker — belongs
   to the host. One `embedded` prop strips the shell
   (`ConsoleHandSection`, `ConsolePlayCardConfirm`, `ConsoleTaskHost`,
   `ConsoleRevealOverlay` all speak it); logic, module state, captures and the
   input path are untouched by embedding. Never a per-flavour prop.
2. **ONE instance, teleported.** The shell mounts each surface once and
   `<Teleport>`s it into the host's zone. A second copy forks input and loses
   captures — the reveal/task-host/composer teleports are the precedent.
3. **SLOTS COMPOSE — nesting is free.** Every surface that can host a deeper
   step publishes its OWN `[data-embed-slot]` even while itself embedded: the
   hand publishes `hand-play` for the composer whether it stands alone or
   inside the start; the composer's outcome zone works one level deeper.
   Arbitrary depth is the teleport chain, not a feature anyone implements.
   This is why the sponsor flow needed NO changes to the composer or to
   `consoleWorkspaceStage` — the descent landed in the hand's zone, which
   happened to live inside the start.
4. **OWNERSHIP ≠ READINESS.** The host publishes its zone selector from a
   `flush: 'post'` watcher, retracts it in `beforeUnmount` (never from the flow
   side — a stale selector teleports into a detached node), **also publishes
   from `mounted()`**, and the claimant **renders NOWHERE while the slot is
   missing** (`handHeldForWorkspace`, mirroring `playHeldForWorkspace`).
   Two traps, both paid for:
   - *A `<Teleport>` whose target is absent AT MOUNT keeps its content in
     place, and the target's later arrival does not reliably relocate an
     already-mounted subtree.* After minimize→restore the workspace re-mounted
     (zone present) while the hand had already mounted into `.con-main` — and
     it STAYED there: grid trapped under the workspace plate, status rail and
     footer escaping by z. The player saw «КАРТЫ 10/13» over an empty screen.
     Hence the mount hold: the teleport resolves at mount, always.
   - *A restore re-creates the host while the claim value never changes*, so
     an `immediate` watcher has nothing to fire on and the zone stands
     unannounced. Hence publishing from `mounted()` too.
5. **The CRUMB is the host's; browse chrome hides past the descent.** Root and
   subject come from the outermost workspace; the embedded surface hands its
   stage name UP (`setWorkspaceStageName` / `setWorkspaceOutcomePhase`) and
   never draws its own header. Browse-layer chrome (filters, counters,
   toolbars) hides when a deeper stage opens — in every host: the shared
   header does it by construction (its browse layer yields to the deep crumb);
   an embedded surface's own toolbar must do it explicitly
   (`.con-hand__toolbar--held` — held by opacity/visibility, height reserved,
   state untouched).
6. **The claim is STRUCTURAL, survives the commit AND a reload.** Derived from
   server truth (which prompt + which workspace serves) — never a card name or
   title match. `committing` holds it across the round trip: between the
   submit and the result landing, `waitingFor` names nothing, and a lapsed
   claim would tear the surface out from under a card still in the air;
   release on the result's own completion signal (the played hero settling),
   never a timer. **A workspace's lifetime hold is module state that a RELOAD
   wipes** — so the claim must have a server-truth fallback, or the same
   prompt re-opens the standalone screen and the player is thrown out of a
   flow they never left. For the start it is `game.phase === PRELUDES` (the
   deployment IS that phase, and a play-from-hand raised in it can only be a
   prelude's effect); the host must then be mountable from the claim too
   (`startSceneMounted` ORs it in). The crumb SUBJECT degrades honestly — the
   source card is a client capture, so after a reload the crumb reads the
   generic «ПРОЛОГИ» rather than lying.

## The sponsor flow, as the reference implementation

- Claim: `startSponsorEmbed` (shell computed — «start serves ∧ prompt is
  play-from-hand») mirrored via `setWorkspaceEmbed('start','hand')`.
- Zone: `.con-start__handstep` — a full-size flex host published
  `flush:'post'`; while the step lives, the deployment (queue, journey rails,
  compact «Разыграно», status rail) is `v-if`'d away — its state is module-
  level and returns untouched. **`position: relative` on the zone is
  load-bearing**: the hand's browse layer is `absolute; inset:0` and measures
  its containing block — under a `static` zone it escapes to the frame and the
  virtualized grid renders zero rows.
- Entrance: `openHandWithReveal({keepTask:true})` — the SAME dock→grid
  choreography as every hand opening (the cards unfold from the dock they lie
  in; never a re-deal). `keepTask` exists because this opening is CAUSED by a
  live prompt — the normal path defers the task as «navigated away».
- Crumb: `sponsorCrumb` — `СТАРТ ПАРТИИ › <источник> › КАРТЫ В РУКЕ`,
  deepening to `РОЗЫГРЫШ`/`РАЗЫГРАНО` from the composer's own
  `setWorkspaceStageName`. The source is captured by the scene as it plays the
  card (`noteWorkspaceEmbedSource` in `armStartHero`) — the prompt carries no
  attribution; a missed capture degrades to a generic crumb, never a broken
  flow.
- B = MINIMIZE the whole workspace (`handleSectionBack`'s embed branch → the
  deferred card offers the way back; `restoreDeferredTask` re-opens the hand
  INTO the workspace). ⚠️ The naive «close the hand section» here was a
  soft-lock: the claim held, the zone stood empty, nothing was deferred.
- The ask BANNER is surface-aware (`shellTaskOnSurface`, unit-guarded): on the
  hand — or inside a workspace hosting the hand — the ask is already stated by
  the workspace's own header, so no banner; anywhere else the banner is the
  pointer back.

## E2E driving

The shared driver (`tests/e2e/consoleStart.ts`) knows the step: inside the
start workspace an open hand is PENDING START WORK — `waitForBoardHome` plays
through it (A picks, A commits) instead of pressing B. Specs:
`console-start-sponsor.spec.ts` (structure, discount playability, toolbar
hiding, dock pose, full play-through with conditional continuation).
