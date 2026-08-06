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
