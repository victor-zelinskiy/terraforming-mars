# Console architecture v2 — the brief (for the architect agent)

> Written 2026-11-10 for a fresh agent session (Fable 5.2) by the session that built the current freeze defences.
> This is a PROBLEM brief and a mandate, deliberately NOT a design. How to solve it is yours to decide.

## 0. The mandate

Management has made a decision: **production is postponed until the console client stops freezing.** We cannot ship a
game that sometimes stops answering the controller, and after weeks of fixes the freezes keep coming in new shapes. The
approved path is a **rewrite of the console client's architecture** — its flows, their lifecycles, their waits, and
`ConsoleShell.vue` itself — onto a proper architectural and framework footing. You were chosen because this is exactly
the kind of problem a strong architect should solve at the root rather than patch.

You have full freedom of method. You may adopt any framework, library, runtime feature, pattern or tooling (we run the
latest Electron/Chromium; the client is Vue 3 + TypeScript + Webpack; dependencies can be added). Ideas that came up so
far — statecharts (XState), structured concurrency (Effect-TS), explicit resource management (`using` /
`DisposableStack`), the actor model, model-based / property-based testing (fast-check, statechart path generation),
Chromium tracing for native stalls — are **examples, not a shortlist**. If you know something stronger, use it. Push the
chosen tools as far as they genuinely help; do not stop at a timid half-adoption.

## 1. What must NOT change — the product

The console-native shell (`?console=1`, `ConsoleShell.vue`) IS the product: couch + gamepad on a 4K TV / Steam Machine
/ Steam Deck. Its behaviour is specified, and the rewrite keeps it:

- Read `CLAUDE.md` (root) first — the north star, «a workspace is one flow», the commit boundary, the header grammar,
  source inspection, physical causality, the action commit, embedded step surfaces, and the **cross-cutting invariants
  1–17**. Those are product requirements, not implementation details. An invariant may be re-expressed by the new
  architecture with an equal or stronger guarantee; it may never just disappear.
- `.claude/rules/*.md` — subsystem contracts (console-ui, animations, client-ui, tests, …).
- `docs/CONSOLE_MODE_CONCEPT.md`, `docs/CONSOLE_FOUNDATION.md`, `docs/CONSOLE_SURFACE_MOTION.md`.
- The **server stays server-authoritative** and the wire stays byte-identical unless a server change is truly needed.
  The SHARED layer (`src/common/`, pure view-models, the premium card face, motion tokens) is not deprecated.
- Upstream merges still happen: per-card hooks stay co-located in card files (invariant 8).
- Performance budget: a 4K TV on a Steam Machine. No new per-frame or per-tick cost that the old code did not pay.

## 2. The problem — freezes

The player presses A or B and nothing happens; or a screen stands with the server's question asked of nobody; or a
plate reads «Этот запрос пока недоступен в консольном режиме» until a reload; or a scene waits forever for a story that
never plays. A reload almost always heals it (the game is the server's) — which proves the state that froze is purely
the client's own flow state.

Field cases from the last days (each was fixed — and each was a new shape):

- **Hi-Tech Lab (2026-11-09).** «Действия карт» claimed the action's «keep 1» pick for its stage, the workspace left,
  the claim outlived its host and suppressed the pick's own surface. The fix (release a claim whose host is gone)
  itself regressed: the host was not gone, it stood «aside for its board step» — a third place nobody had listed — and
  the Hydronetwork's copied Mars Nomads lost its claim 1.5 s into the player's pick.
- **The chairman quest (2026-11-07).** A conclusion waited for the plate, the plate for the frame to leave, the frame
  for the conclusion: a mutual wait across three modules.
- **Flooding (2026-11-08).** An event's pay-back waited for a staged lift that waited for the pay-back.
- **Holds that outlive their motion.** A blocking animation hold claims «a story is playing»; when the story's tween
  was killed or deferred, the hold stood with nothing moving and the screen was dead ~30 s.
- **Liveness latches.** A plain `let` read inside a cached `computed` / hold predicate latched the `remote-landing`
  admission block: no placement grid for the rest of the game.
- **The transport silently drops a second submit** while a request is in flight.
- **Prompt identity by title** — i18n mutates titles in place (invariant 1), so «is this still the same prompt?» was
  unanswerable for a while.
- **Native rendering stalls** (a separate class): CI run 42626840874 — 15 minutes with the renderer's main thread
  outside JS after closing the hand album (SwiftShader); on the box an 11 s stop with VizCompositor at 99 %. Nothing in
  page JS can see these. A main-process watch exists now (`electron/rendererHangWatch.ts`); the cause is not addressed.

`git log --since=2026-10-20 -i --grep='freeze\|stall\|wedge\|stranded\|liveness\|deadlock\|hang'` → **~296 commits in
three weeks.** Iterations do not converge.

## 3. Why — the spaghetti

**Lifecycles are implicit.** A flow «is» a set of booleans, phases and arrays spread over several modules, moved by
watchers, `nextTick`s, timers, GSAP callbacks and server polls. Its END is not owned by anyone: it is whatever moment
all those flags happen to fall. When one falls late, early, twice or never — an early `return`, an exception in an
async beat, a reload mid-way, a second prompt with the same identity, one press that produces several effects — the
flow is left half-way and something waits for it forever.

**Waits are implicit.** Who waits on whom is nowhere in the code. A surface waits for a hold, the hold for a flight, the
flight for a board that is covered by the surface. Each wait was added locally and made sense locally.

**The defences grew instead of the design.** Every freeze class got its own net, built after the field found it:

- the liveness arbiter (`consoleLiveness.ts`, a ladder of 12 release rungs registered by owners),
- the wait graph (`waitGraph/*` — cycle / dead-end / dangling / overdue findings with recovery «doors»),
- the motion witness (a hold standing with nothing moving on the page),
- the screen director and the start director (screen hand-over, start stranding),
- the leak detector + the «stranded prompt» plate, the foreground watchdog, the beat-stall guard,
- the stale free-turn reaper, the workspace release funnel, the orphaned-claim release,
- the reactivity witness (invariant 17), the hold-expire ratchet, the ceiling-wait primitive (54 ceiling waits),
- 121 named `console.warn` safety lines in the client.

They work — each heals its class — but they heal AFTER the fact, they interact with each other, and a new class keeps
appearing in the gaps between them. Docs: `docs/claude/console/wait-graph.md`, `wait-graph-inventory.md` (the open
worklist rows), `liveness-arbiter.md`, `screen-director.md`, `start-director.md`, `beat-stall-guard.md`,
`state-delivery-and-handoff.md`, `workspace-band.md`, `workspace-embed.md`.

**`ConsoleShell.vue` is the knot.** 27,801 lines; 452 imports; ~106 `data` fields, ~559 computed, ~145 watchers,
~318 methods; 145 commits since 2026-10-20 (several parallel sessions edit it every day). It is the router, the admission
logic, the workspace orchestration, the conclusion logic, the liveness sampler, the wait-graph source, the recovery
doors, the presentation glue and the test seams — all in one Options-API component, with module-level mutable state
beside it. Nearby: `ConsoleStartScene.vue` 11,602 lines, `ConsoleParliamentSection.vue` 4,163; the console has 534 `.ts`
modules and 271 `.vue` components, most of their state in module-level reactive objects read across module boundaries.

**Testing cannot keep up.** Most of the risky logic lives inside the shell and reactive glue, so it is provable only
end-to-end. A full e2e run is hours; the «monkey» (random walks over ~600 tables) costs ~2 minutes per table; races
show up only under load. Unit tests cover the pure pieces only.

## 4. Scope

**Mandatory in this iteration:**

1. **The four shared lifecycles** every screen stands on:
   - the **workspace outcome claim** (`consoleWorkspaceOutcome.ts` — awaiting → presenting → released, owned by a host
     frame that may be live, parked or aside);
   - the **workspace frame** (`consoleWorkspaceStack.ts`, `consoleWorkspaceFlow.ts` — browse / configure / executing /
     committed / completing, plus park, collapse, aside-for-board, nested steps, conclusion holds);
   - the **mandatory announce plate and «set aside»** (the gate, the plate, the restore card, the deferred prompt);
   - the **submit transport** (`transport/gameTransport.ts` — send → response → cinematic gates → view apply; the poll
     / WebSocket chain).
2. **`ConsoleShell.vue` moved onto a proper architecture** — not a thinner monolith, a real structure whose parts own
   their lifecycles and whose composition is explicit.
3. Whatever else the new architecture needs to make the freeze classes above impossible by construction — the big
   directors (start of game, the Parliament's sitting / chairman quest / agenda walk / rally, the generation scene and
   the draft hand-over, the finale), the workspace screens (card-actions, hand, colonies, hydro, standard projects,
   milestones / awards, repeat-pick), the board stories and animation holds — in the order your plan decides.

**Native rendering stalls:** at minimum make them diagnosable from the field (where did the frame go: style, layout,
paint, raster, compositor, GPU) and reduce what you can find; the main-process hang watch is the starting point.

## 5. What «done» means

- The freeze classes in §2 cannot be expressed in the new code — not «are detected and healed». Every lifecycle has a
  declared owner and a guaranteed end; every wait has an owner, a bound and a way out; «who waits on whom» is a property
  of the structure, not a reconstruction. Show it with tests that would fail if a state had no exit or a wait no bound.
- The pile of after-the-fact nets shrinks to what is genuinely still needed (ideally one supervisory layer), each
  retired net retired with a reason. Field diagnosis does not get worse: the field recorder, the console export and the
  hang watch keep telling us what stood where.
- `ConsoleShell.vue` is no longer the knot: a reader can find where any behaviour lives, and two sessions editing
  different features rarely touch the same file.
- All existing guards stay green or are replaced by stronger ones in the same diff (`npm run lint` incl. `vue-tsc`,
  `npm run build:test`, `npm run test`, the console guard specs — glow restraint, glyph literals, e2e liveness, hold
  ratchet, reactivity witness, wait-graph law, …).
- **The full e2e suite on CI is green at the end** — it is green today, and that is the bar.

## 6. How to work

1. **Study, then plan.** Read the docs above and the code. Write a DETAILED plan into the repo
   (`docs/claude/console/architecture-v2/PLAN.md` or similar): the target architecture and why, the chosen frameworks and
   why, how today's modules map onto it, the slice order, how each slice keeps the app working, which nets retire when,
   the risks. Keep it updated as you go — it is also the hand-over if a session ends.
2. **Implement in slices.** Each slice compiles, lints (`npm run lint:client` is the only thing that type-checks `.vue`
   templates), passes unit tests and `npm run build:test`, and is committed and pushed. Avoid a long-lived broken state on
   `main`; avoid two lifecycle systems fighting at a seam longer than a slice needs.
3. **e2e during implementation:** do NOT run the box suite routinely — the owner runs the full e2e on CI after the final
   slice, and that run is the regression verdict. When a single spec is needed to check one behaviour, the owner allows
   POINTWISE runs on the laptop for this task (`TM_E2E_LAPTOP_OVERRIDE=1`, one spec, never a full run); the Steam Machine
   (`npm run e2e:remote -- <task> <spec>`, see `.claude/rules/tests.md`) stays available for the same pointwise use.
   Prefer cheap unit / model-based tests for logic.
4. **e2e hooks are product contracts** (invariant 14): a `data-*` attribute, class or RU copy an e2e spec waits for is
   kept, or the spec is changed in the same diff; `tests/console/e2eLiveness.spec.ts` checks it. Since the full run comes
   only at the end, keep a running list in the plan of specs whose hooks or timing you touched.
5. **`main` is shared.** Other sessions commit in parallel (campaign / tenders work is active and touches
   `ConsoleShell.vue` and the start scene). Commit only your own paths (`git commit -- <paths>`), rebase carefully, push
   with `npm run push` or a bare `git push origin main` (the pre-push guard stays on; never `--no-verify`, never
   `--force`). Expect conflicts in the shell while it is being dismantled; small slices keep them cheap.
6. **Docs.** Keep `CLAUDE.md` small; update `.claude/rules/*` and `docs/claude/**` as contracts change; write new
   architecture docs under `docs/claude/console/`.
7. **At the end** report: what the architecture is now, which nets retired and why, what is still open, and the specs
   most likely to need attention in the CI run.
