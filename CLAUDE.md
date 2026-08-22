# CLAUDE.md

Guidance for Claude Code working in this repository — the `vize1215` private fork of the open-source `terraforming-mars` project.

**How instructions are organised (read this first).** This file holds only what applies in *every* session. Subsystem contracts live in `.claude/rules/*.md` (path-scoped — they load when you touch matching files). Full write-ups, architecture detail and history live in `docs/claude/**` and are **not** auto-loaded — open one on demand. The pre-split original is preserved verbatim at `CLAUDE.md.backup.md`. **Never @-import the big docs back into this file.**

---

## ⭐ North star — console native IS the product

The console-native shell (`?console=1` → `ConsoleShell.vue`) is **THE product of this fork and the DEFAULT experience** (couch + gamepad on a 4K TV). All new UI work ships there. **A feature is "done" when it works in console native — a desktop counterpart is NEVER required and must not block "done".**

The **desktop UI is BEING DELETED in waves** (policy change 2026-08-22; frozen since 2026-07-15). The future desktop UI will be built *from* the console one — the frozen code is dead weight (boot parse/eval, memory, tests, sync friction), not a fallback. **Waves 1–2 are done**: wave 1 made the console shell UNCONDITIONAL (`consoleModeState.enabled` always true; `?console=0`, stored opt-outs, the settings shell switch and the hold-Menu toggle are gone) and cut `PlayerHome` + the desktop overlays out of App.vue; wave 2 made `WaitingFor.vue` **HEADLESS** (poll chain + submit funnel + cinematic holds + the `SelectSpace` board binder — zero prompt rendering), deleted the whole radio/modal input stack (`PlayerInputFactory`, the leaf renderers, `MandatoryInputModal`, `ModalInputHost`, `PlayerHome`, the spectator feature), moved standard projects/actions onto the premium face, and gave the degenerate `projectCard` prompt a native console fallback in `ConsoleTaskHost` (pick → pay). Remaining files go by import graph in later waves. ⚠️ **Two legacy pieces stay LOAD-BEARING**: the headless `WaitingFor.vue` transport (every submission still routes through `$refs.waitingFor.onsave()`) and legacy `Card.vue` (CEO faces only, until their premium pass) — plus the entire SHARED layer below. A desktop-only bug: skip it — that code is scheduled for deletion.

**The SHARED layer is NOT deprecated** and keeps full quality bars, tests and guards: server markers/endpoints, `src/common/` models, pure view-models (`victoryPointsModel`, `effectSummary`, `insightEngine`, `endgameFacts`, `journalView`, …), module reactive state (`journalState`, `notificationState`, `presentationFlow`, …), the premium card face (`.pcard`), `motionTokens`. Console stands on it.

## ⭐ A WORKSPACE IS ONE FLOW — not a set of screens

**The reference is «Действия карт»: список действий → `› <карта> › НАСТРОЙКА` → `› <карта> › ПОКУПКА / ДОБОР КАРТ` → возврат.** Every stage the player reaches from inside a workspace must satisfy ALL FOUR, or it is not done:

1. **EMBEDDED, not a new surface.** The stage renders INSIDE the workspace (claim + `<Teleport>` of the SAME instance — never a second copy). A standalone band is only for what the player did NOT open: a board event, another player's turn, a result with no natural parent.
2. **The breadcrumb is CONTINUOUS.** One line, one place: `ДЕЙСТВИЯ КАРТ › <Имя карты> › <ЭТАП>` (stable context BEFORE the mutable stage — the tail is the only thing that advances). The workspace name and the card name NEVER disappear or restart. **An embedded surface must not title itself**: it hands its stage name UP (`setWorkspaceOutcomePhase`) instead of drawing its own kicker. A surface that announces itself inside someone else's frame reads as a modal that arrived.
3. **The transition is the SAME PHRASE, one level deeper.** COMMIT → RELEASE (the old content lets go ON THE SPOT) → UNFOLD (the new zone opens from the rect the old one occupied) → REVEAL (its content surfaces from inside). A `v-if` swap is a BLINK and is never acceptable. Frame, band, rail and the carried card do not move — one surface advances, a screen does not replace another.
4. **Back is one logical level**, and the carried object (the card) survives it.

### The COMMIT BOUNDARY (`consoleWorkspaceFlow.ts` — phases are typed, B is derived)
`browse` · `configure` are **reversible**. `executing` is a **transient beat, never a navigation destination** — a back stack that records it lets the player walk into a state whose only content is "wait", describing work that already finished. `committed` · `completing` are **past the boundary**: the move cannot be unmade.
- **B is four verbs, never one branch guessing**: `close` (browse) · `back` (configure) · **`collapse`** (committed — hide to read the board, the decision stays live) · `none` (a beat in flight, which also absorbs input so a double submit is impossible by construction). Label follows verb from the same function.
- **Collapse ≠ close.** The workspace hides (`v-show`) and keeps its state: same revealed card, same picks, no replayed cinematic, no second trip to the server. It rides the existing deferred-prompt flag, so «свернуть» stays ONE concept.
- **A FINISHED flow does not fold back to browse — it LEAVES** (`workspaceConclusionFor` → `ConsoleShell.concludeWorkspaceFlow`). A reversible cancel folds back (there is somewhere to go back TO, and the player asked); a completed operation has nothing to go back to — the browse grid would just show the action it just performed, greyed «Активирована», one more B from the board. Every ending of one workspace routes through **ONE** guarded conclusion, so the result's FLAVOUR can never decide where the player lands («Поиск жизни» shipped ending in the list while a plain reward ended on the board). It dismisses only when nothing inside is still owed, and each hold is a NAMED reason: `nested-step` · **`owed-step`** · `live-outcome` · `owned-prompt` · `parked`. On a hold the stage does nothing — the step that holds it is teleported into that very stage's zone.
- **ONE PRESS, SEVERAL EFFECTS — the surfaces go IN TURN.** One response routinely carries a finished effect AND the prompt for the next one («Научная колония»: draw 2 + build a colony). A prompt-routed DOOR therefore asks its own admission family (`followUp` — the whole arrival chain; for a draw «processed» means every card TAKEN), while the PRESENCE families deliberately wait for less (tearing a live section down mid-cinematic is worse than opening early). While that door waits the flow OWES a step: it may not conclude (`owed-step`), may not fold its descent, and its crumb already names the coming stage (`FOLLOW_UP_STEP_STAGES`) — the tail only ever moves forward. And a step's zone is a LAYER STACK, never a flex row: a departing surface paints through its whole leave, so «they never coexist» is true of the decision, not of the DOM (`.con-hand__stage` — the colony grid was laid out into 521px of a 1621px band and re-fitted when the composer left).

### The HEADER grammar (`consoleWorkspaceHeader.ts`)
**Stable context BEFORE mutable stage:** `ДЕЙСТВИЯ КАРТ › СОЮЗ ИЗОБРЕТАТЕЛЕЙ › ПОКУПКА`. The crumb only ever *gains a tail*; root and subject are the same vnodes all flow long, so **only the stage segment animates** (crossfade in a shared grid cell — `mode="out-in"` empties the slot and blinks). Putting the stage in the middle re-flows the line every phase and reads as arriving somewhere else. **Hierarchy is typographic, never positional:** the parent title keeps ONE style in browse and in flow (calm weight/solid colour — it behaves like the source card: never re-styled, never re-scaled, never re-animated); the CARD NAME is the line's brightest, heaviest voice; the stage is a compact tracked-caps accent (cyan pre-commit → amber past the commit boundary) that must survive desaturation by weight, not colour alone. Stage names are one word where possible («НАСТРОЙКА», not «НАСТРОЙКА ДЕЙСТВИЯ» — never echo the root's noun).

### Source inspection grammar (console-wide)
**X inspects the CURRENT object; L3 inspects the SOURCE that produced it.** Pre-commit the source IS the current object (X = source, no L3). Past the commit X belongs to the result, so every post-commit stage — deck-check verdict, drawn batch, embedded purchase — offers `L3 Источник` (the workspace claim's `sourceCard` is what knows it). The verb lives in the ONE command bar ONLY — a local label under the hero card once shipped and shifted the source between phases; the hero column's children must be identical in every phase (any future inspectability marker is `position: absolute`, zero layout). The fullscreen viewer opens over the stage without unmounting it — selection, cost and focus survive.

### Workspace identity symbol
A major workspace may carry ONE identity symbol in its parent anchor (`[символ] ДЕЙСТВИЯ КАРТ` — for card actions, the lightning shared with the action wheel's tile). It is part of the PARENT, not of any stage: constant box, size, position and gap through browse → setup → commit → result → restore; never re-animated by a stage change. The only motion that may touch it is the one-shot wheel-handoff echo, and that tween must be strand-proof (`onInterrupt` restores props — a killed echo once left the emblem invisible for the workspace's whole life).

### Physical causality
A card **always leaves from its real on-screen source** — an action that took the top card deals from `.con-deckstack__pile`, never from a synthetic dealer. A result **outlives the surface that produced it**: it detaches into an app-level layer, the workspace collapses, and only then does it fly to the *measured* destination (hand dock / discard). Every animation answers: where did this come from, why is it moving, where is it going.

**Every card action has ONE universal ACTION COMMIT** between «A Подтвердить» and the result (`consoleActionCommit*.ts`): button press → the source card mechanically fixes → an impulse runs the SELECTED variant's printed graphic and lands on its result icon → the category handoff (draw = the deck answers and the existing pull starts; resources = the reward wave materializes FROM the card's own icons into the rail, counters ticking on touchdown; tile/global = the existing flows). The commit never depicts the result; a fast server never cuts its minimum beat (the dismiss gates on the motion's settle); a rejected submit rolls it back cleanly. Anchors resolve from the real graphic (`data-graphic-node` + sprite URLs) — never a per-card coordinate table.

### Embedded step surfaces COMPOSE (the architecture's whole advantage)
A workspace may host a FULL existing screen as a step (the start workspace hosts «Карты в руке» for a play-from-hand prelude), and hosts NEST for free — because every hostable surface is **host-agnostic** (one `embedded` prop strips its shell; content/input/state untouched) and every host publishes its own `[data-embed-slot]` even while itself embedded, so depth is just the teleport chain. Guaranteed by the six-rule contract in `consoleWorkspaceEmbed.ts` + `.claude/rules/console-ui.md` § EMBEDDED STEP SURFACES — never by per-case wiring.

Mechanism + gotchas: `docs/claude/console/workspace-band.md` § EMBEDDED OUTCOMES / WORKSPACE DESCEND. Reference: `docs/CONSOLE_BLUE_ACTION_PARITY.md`; the same migration applied to a MENU-shaped surface (steps + pay-on-commit targets + a terminal commit beat): `docs/claude/console/standard-projects-workspace.md`.

Before UI work read `docs/CONSOLE_MODE_CONCEPT.md`; to decide whether a file is frozen or live, read `docs/DESKTOP_DEPRECATION_AUDIT.md`.

## Project goals — weigh decisions against these

1. **Single-screen, no-scroll play.** Active game state fits on screen. Content that doesn't fit becomes an overlay or a panel, never a scroll target.
2. **Steam-version visual feel.** Large central board, compact peripheral chrome (Asmodee Digital release as the density reference).
3. **Ark Nova (BGA) animation feel.** Short easings, subtle scale/glow, no hard pop-ins. Default to calm; don't add flashy motion just because something changed.
4. **Active visual refresh.** Prefer improving the look over matching upstream pixel-for-pixel: sci-fi typography for panels, subtle gradient/clip-path borders on grouped blocks, consistent dark glassmorphic floating panels. When in doubt pick the most polished option that still respects 1–3.

When a change trades these off against closeness to upstream, code volume or edge cases, favour the goals unless the user says otherwise.

---

## Cross-cutting invariants (violating one of these is a bug, not a style choice)

1. **Never detect a prompt by its title text.** i18n mutates `Message.message` **in place** on render, so an English-text match silently stops matching after the first render. Use a server marker (`startGamePrompt`, `choiceContext`, `placementContext`, `awardFundingPrompt`, `reveal`, option metadata) or another structural signal. (The single surviving title check — the action menu — is safe only because that title isn't mutated.) **This covers prompt IDENTITY too** ("is this still the same prompt?"): a raw-title key flips mid-prompt and froze the console outright — use `promptIdentityKey(wf)`, never a hand-rolled `type|title`.
2. **Availability is server-authoritative.** A dedicated action button mirrors the matching option's PRESENCE in the `waitingFor` `OrOptions` tree, and submits via `WaitingFor.onsave()` with the nested `OrOptionsResponse` — byte-identical to the legacy radio UI, no server change. Never re-derive availability client-side. Show blocked actions **disabled with a reason**, never hidden.
3. **No auto-select, no hidden target.** Every targetable choice is SHOWN even with a single candidate; the player must see who/which card is hit and its `current → resulting` before confirming. Exempt: a fixed self-target and `OrOptions.reduce()` picking the only OR branch.
4. **No silent loss.** A skipped effect must name itself (which effect, and its magnitude when honest) — never a bare "no valid target", never a suppressed chip with no explanation.
5. **The native `title` attribute is banned in new UI.** Use `.premium-tooltip()` + `data-hint`, hosted on a **non-disabled wrapper** (a disabled button never fires `:hover`). Every disabled control carries a reason.
6. **One motion system.** JS durations through `motionMs()`, CSS through `calc(<base>ms * var(--motion-scale, 1))`, easing from `MOTION_EASE`. Honour `prefers-reduced-motion`. A critical animation registers an **animation hold** whose release is the flow's own completion signal — never a `setTimeout`.
7. **Read-only stays read-only.** Explainability engines, preview builders and aggregate/fact modules never mutate game state and never re-implement rules — they reuse the real rule sources (purity is test-guarded).
8. **Per-card hooks are CO-LOCATED in the card file**, never in a fork-only central table — when upstream changes a card, the hook must be in the same diff/conflict or it silently rots.
9. **English text IS the i18n key.** Grep the exact key across all of `src/locales/<lang>/*.json` before adding one — the build **throws** on a duplicate. Never rewrite the RU translation of a key you didn't introduce; coin a new, more specific English key instead. Canonical: TR → **РТ**, VP → **ПО**, tag → **метка**.
10. **Don't put rendering back into `WaitingFor.vue`.** Since wave 2 it is the HEADLESS transport: poll chain, submit funnel (`onsave` / `onsaveBatch` / `onPlacementCancel`), cinematic holds and the `SelectSpace` board binder — nothing else. Every prompt renders through the console surfaces; the radio/modal input stack is deleted.
11. **Guard tests are the worklist.** Coverage specs enumerate the in-scope card set and fail with the exact list of cards needing attention. Widening expansion scope starts by widening their `SCOPE` sets — see `docs/claude/expansion-adaptation-checklist.md`.
12. **A controller button has a NAME only inside `glyphSets.ts`.** Everything else speaks semantics (`confirm` / `triggerL` / …) and renders through **`GamepadGlyph.vue`**; copy that must name a button interpolates the label (`translateTextWithParams` + `activeGlyphSet()`); a badge painted on DOM we don't own reads `content: var(--gp-label-<control>)` from the **glyph CSS bridge** (`glyphCssBridge.ts`). A literal `LT` / `RB` / `Y` — in markup, in a **translation value**, or in `content:` — freezes that one spot to Xbox and lies to every PlayStation/Steam player. Guard: `tests/gamepad/glyphLiteralGuard.spec.ts`.

---

## Build & Development Commands

```bash
npm run build                # Full build: CSS + JSON static files, server (tsc), client (webpack)
npm run build:server         # TypeScript compile server only: tsc --build src/tsconfig.json
npm run build:client         # Webpack production bundle (runs make:cards first) — does NOT compile LESS
npm run build:test           # Compile tests: tsc --build tests/tsconfig.json
npm run make:css             # Compile LESS (required before any visual verification)
npm run make:cards           # Regenerate card metadata.information + genfiles/cardInfoAudit.json
npm run make:json            # Aggregate locales (throws on duplicate keys)
npm run lint                 # All lints: eslint + i18n audit + vue-tsc
npm run lint:client          # Vue type checking: vue-tsc --noEmit
npm run lint:server          # ESLint on src and tests
npm run lint:fix             # ESLint autofix
```

### Running tests

```bash
npm run test                 # All tests (server + client)
npm run test:server          # Mocha server tests
npm run test:client          # Mochapack client component tests

# Single server test file
npx mocha --import=tsx --require tests/testing/setup.ts "tests/cards/base/Algae.spec.ts"

# Single client test file. BOTH extra flags are required when invoking mochapack
# directly: webpack.test.config.js builds ONE chunk (webpack.config.js's fixed-name
# `vendors` split silently makes the runner collect ZERO tests and exit 0), and
# bundleSetup.ts auto-unmounts wrappers so specs stay order-independent.
npx mochapack --webpack-config webpack.test.config.js --require tests/client/components/setup.ts \
  --include ./tests/client/components/bundleSetup.ts "tests/client/components/Board.spec.ts"
```

Both `npm run test:server` and `npm run test:client` run through `scripts/run-tests.mjs`, which **fails the run when fewer tests were collected than the declared floor** — a suite that quietly stops collecting can no longer report success.

`npm run build:test` is **mandatory** whenever you touch `tests/` — it is the only thing that typechecks the test tree and the thing that catches case-sensitive import paths that break CI.

### Pushing

**Always `npm run push`, never a bare `git push`.** Two clones share `main`; the wrapper fetches, rebases, re-derives the release version against the remote and retries. The release version may **never** be derived from the local base — a `pre-push` guard refuses a push that claims an already-released version or force-pushes `main`. Rationale and the failure it prevents: `docs/SHARED_MAIN_WORKFLOW.md`.

### Dev servers

```bash
npm run dev:server           # Server with hot reload (tsx watch)
npm run dev:client           # Webpack watch mode
npm run watch:less           # CSS rebuild on change
```

---

## Architecture

### Three layers
- **`src/server/`** — game engine, card logic, routes, database (Node.js).
- **`src/client/`** — Vue 3 frontend (Options API, `defineComponent`), bundled with Webpack; Less styles in `src/styles/`.
- **`src/common/`** — types, enums and models shared by both. No runtime logic bound to either side.

`@/` maps to `./src/` (tsconfig paths + webpack).

### Card system
Cards are the core domain object (~1000 across 15 modules). Adding one touches five places: the **card class** (`src/server/cards/<module>/`, extending `Card` — or **`ActionCard`** for an ACTIVE card with a repeatable action), the **`CardName` enum** (`src/common/cards/CardName.ts`), the **module manifest** (aggregated in `AllManifests.ts`), **`metadata.renderData`** via the `CardRenderer.builder()` DSL, and a **spec** under `tests/cards/<module>/`.

Card types: `EVENT`, `ACTIVE`, `AUTOMATED`, `PRELUDE`, `CORPORATION`, `CEO`, `STANDARD_PROJECT`, `STANDARD_ACTION`.

**Prefer the declarative `behavior` DSL over imperative `bespokePlay()`** — declarative cards are auto-covered by the preview / card-information / reason subsystems; bespoke ones need co-located hooks.

### Effects and choices
- `Behavior` (`src/server/behavior/Behavior.ts`) declares production changes, resource gains/losses, tile placement, TR, global parameters, draws; `Executor` interprets it.
- Multi-step effects queue as `DeferredAction`s via `game.defer(action)` with a `Priority`, chained with `.andThen()`. **Emission order matters** — a preview's pre-collected steps must match the executor's defer order.
- Player choices are `PlayerInput`s (`SelectSpace`, `SelectCard`, `OrOptions`, …) in `src/server/inputs/`.

### Expansions
Each has a directory under `src/server/cards/` plus a manifest: `base`, `corporation`, `promo`, `venusNext`, `colonies`, `prelude`, `prelude2`, `turmoil`, `community`, `ares`, `moon`, `pathfinders`, `ceos`, `starwars`, `underworld`, `delta`. Test dirs mostly mirror these (note `tests/cards/ceo` vs `src/server/cards/ceos`). ⚠️ The `GameModule` **key** ≠ the source dir for two: key `ceo` ↔ dir `ceos`, key `deltaProject` ↔ dir `delta`.

Premium-subsystem scope today: `base`, `corpera`, `promo`, `venus`, `colonies`, `prelude`, `ares`. Everything else is the frontier — widening it is the `docs/claude/expansion-adaptation-checklist.md` procedure.

### MarsBot corporations
The bot's corporations (Rule Book B) are their OWN entities — the human card behind one gives only identity, art, lore and the selection-collision key. **Adding the next corporation is a checklist, and skipping a step is how one silently ships broken: `docs/claude/marsbot-corporation-checklist.md`** (contract: `docs/claude/marsbot-corporations.md`, official data: `docs/AUTOMA_DATA_AUDIT.md` §10). The short form loads itself as `.claude/rules/marsbot-corps.md` when you touch `src/server/automa/corps/**`.

### Database
Pluggable backends in `src/server/database/` (SQLite / PostgreSQL / LocalFilesystem) via `SerializedGame` / `SerializedPlayer`; `GameLoader` handles caching. New serialized fields must degrade gracefully on old saves.

### Logging
`game.log()` / `player.log()` take a template with `${player}` / `${card}` / `${amount}` placeholders plus typed `LogMessageData` tokens (never pre-rendered HTML) — the premium journal renders tokens as chips, and the event stream feeds notifications, stats and endgame facts. A direct field mutation bypasses the event recorder: go through `stock.add` / `production.add` / the recorder helpers.

### Testing essentials
`testGame(n, options?)` → `[game, ...players]`; `TestPlayer.popWaitingFor()`; `tests/TestingUtils.ts` (`runAllActions(game)` after anything that defers, `cast`, `setTemperature`, `addOcean`, `fakeCard`, …). Mocha + Chai (`expect`); client via mochapack + `@vue/test-utils`. Prefer a cheap unit/integration spec; e2e only when a bug can't be reproduced otherwise.

---

## Style guide

- Follow the style of the code around the file; for a new file, the style of its directory.
- ESLint uses flat config (`eslint.config.mjs`); `npm run lint:fix` autofixes. `eqeqeq` has **no** null exception here — `== null` fails lint.

---

## Where the rest lives

**`.claude/rules/`** — path-scoped contracts, loaded when you touch matching files:

| Rule | Applies to |
| --- | --- |
| `console-ui.md` | `src/client/console/**`, `src/client/components/console/**`, `src/styles/console*.less`, console + e2e tests |
| `client-ui.md` | `src/client/**`, `src/styles/**` |
| `premium-card.md` | premium/legacy card face, card styles |
| `animations.md` | motion, presentation, feedback, surface-motion, ceremony, marsbot |
| `game-logic.md` | `src/server/cards/**`, behavior, deferred actions, `src/common/cards/**`, `tests/cards/**` |
| `marsbot-corps.md` | `src/server/automa/corps/**`, `MarsBotCorpData.ts`, the corp face/rules view-models, `tests/automa/MarsBot*.spec.ts` |
| `server.md` | `src/server/**`, `src/common/**`, route/event/model tests |
| `board.md` | board engine, board facts, board components |
| `localization.md` | `src/locales/**` |
| `tests.md` | `tests/**` |

**`docs/claude/`** — full reference, never auto-loaded. Start at `docs/claude/README.md` for the index (expansion checklist, architecture reference, board information, journal, notifications, presentation flow, the desktop overlays, the card subsystems, the console contracts). Long-standing sibling docs stay where they are: `docs/CONSOLE_MODE_CONCEPT.md`, `docs/CONSOLE_FOUNDATION.md`, `docs/CONSOLE_SURFACE_MOTION.md`, `docs/DESKTOP_UI_PHILOSOPHY.md`, `docs/MODAL_INPUTS.md`, `docs/EVENT_STAT_FOUNDATION.md`, `docs/ENDGAME_STORYTELLING.md`, plus the audit files (`DELAYED_TARGET_AUDIT`, `CHOICE_CONTEXT_AUDIT`, `PENDING_ACTION_CANCEL_AUDIT`, `SPECIAL_TILE_AUDIT`, `DESKTOP_DEPRECATION_AUDIT`).

**Keep this file small.** New status notes, per-feature write-ups and completed-work history belong in `docs/claude/` (or `docs/claude/archive/`), not here.
