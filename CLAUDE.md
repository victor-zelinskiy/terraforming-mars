# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goals (vize1215 fork)

This is `vize1215`'s personal fork — a private/self-hosted build of the open-source `terraforming-mars` project. The active UI work is driven by these goals; weigh decisions against them when proposing or making changes:

1. **Single-screen, no-scroll play.** The active game state (board, current player's resources/tags, hand, played-cards filter, etc.) should fit on screen at typical desktop resolutions. Long pages with vertical scroll are the thing we are getting rid of — content that doesn't fit becomes an overlay or a panel, not a scroll target. The top/bottom bar-button overlays (`bar-overlay--*`) are the canonical mechanism for "secondary" content (Log, Played cards, Milestones, Awards, Standard Projects, Colonies, Cards).
2. **Steam-version visual feel.** The reference for layout density and proportion is the Asmodee Digital Steam release of *Terraforming Mars*: large central board, compact peripheral chrome, board scaled up to dominate the screen as more vertical space is freed.
3. **Ark Nova (BoardGameArena) animation feel.** When choosing animations / transitions / hover effects, lean toward the smoothness of BGA's Ark Nova implementation — short easings, subtle scale/glow on interactive elements, no hard pop-ins. Don't introduce flashy motion just because something is being changed; default to calm.
4. **Active visual refresh.** This fork explicitly wants the game to *feel* more modern than upstream. When touching UI, take the visual freedom to refresh things: sci-fi typography for panels/labels (Prototype, Orbitron-style families that ship with the repo) where the upstream choice is generic; subtle gradient/clip-path borders on grouped blocks (resource clusters, tag clusters) to give a control-panel vibe; consistent dark glassmorphic backgrounds for floating panels. The user will push back if a specific change misses, but the default is "try to improve the look" rather than "match upstream pixel-for-pixel". When in doubt, prefer the most polished option that still respects goals 1–3.

When a change has trade-offs between these goals and any other consideration (closeness to upstream, code volume, edge cases), favor the goals above unless the user says otherwise.

## Action UI Rework (in progress)

This fork is migrating the per-action UI away from upstream's generic `wf-action` + `btn-submit` radio-button form and toward **dedicated styled buttons** on each game element (milestones first, awards / standard projects / convert-plants / colonies to follow). The radio UI still exists and works — once every action type is migrated it will be hidden, not removed.

When you add a new dedicated action button, follow this contract:

1. **Tie the button to the server's action-availability logic, not to the radio render.** Walk the `playerView.waitingFor` tree (recursively, since the prompt can be nested) to find the `OrOptions` whose `title` matches the action prompt (e.g. `'Claim a milestone'`, `'Convert 8 plants into greenery'`). The server has already filtered options by every rule (cost, prerequisites, phase, opponents-have-passed, etc.) — **the option's presence in that tree IS the source of truth for "available right now."** Do not re-derive availability from raw player state on the client.
2. **Submit through `WaitingFor.onsave()`** with the nested `OrOptionsResponse` payload (`{type:'or', index:I, response:{...}}` wrapping recursively, with a `{type:'option'}` innermost). Bypasses the radio UI but is byte-for-byte identical to what `OrOptions.vue` would have sent — no server changes needed. The reference implementation lives in `PlayerHome.vue` → `findMilestoneOptionPath` + `claimMilestone`.
3. **Show the button as disabled, not hidden, when the player meets the conceptual prerequisite (e.g. score threshold) but can't act right now.** Use a `:title` tooltip with the blocker reason translated via i18n. Reasons we distinguish for milestones: insufficient M€ (`Not enough M€`), and not-your-turn / mid-sub-action (`Not your turn to take any actions`). Hiding the button is worse UX — the user is left guessing why an action they're entitled to disappeared.
4. **Don't refactor the existing radio-button stack** (`WaitingFor.vue`, `OrOptions.vue`, `SelectOption.vue`, server prompt code). They have to keep working unchanged while migration is in progress, and the eventual hide is a stylesheet flip — not a deletion.

The Milestones overlay (`MilestonesOverlay.vue` + `PlayerHome.vue` claim handlers) is the canonical example; mirror its detection + submission pattern when you wire up new action buttons.

## Build & Development Commands

```bash
npm run build                # Full build: CSS + JSON static files, server (tsc), client (webpack)
npm run build:server         # TypeScript compile server only: tsc --build src/tsconfig.json
npm run build:client         # Webpack production bundle (runs make:cards first)
npm run build:test           # Compile tests: tsc --build tests/tsconfig.json
npm run lint                 # All lints: eslint + i18n audit + vue-tsc
npm run lint:client          # Vue type checking: vue-tsc --noEmit
npm run lint:server          # ESLint on src and tests
npm run lint:fix             # ESLint autofix
```

### Running Tests

```bash
npm run test                 # All tests (server + client)
npm run test:server          # Mocha server tests (~6700 tests)
npm run test:client          # Mochapack client component tests

# Single server test file
npx mocha --import=tsx --require tests/testing/setup.ts "tests/cards/base/Algae.spec.ts"

# Single client test file
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "tests/client/components/Board.spec.ts"
```

### Dev Servers

```bash
npm run dev:server           # Server with hot reload (tsx watch)
npm run dev:client           # Webpack watch mode
npm run watch:less           # CSS rebuild on change
```

## Architecture

### Three-Layer Structure

- **`src/server/`** - Game engine, card logic, routes, database. Runs on Node.js.
- **`src/client/`** - Vue 3 frontend (Options API, `defineComponent`). Bundled with Webpack.
- **`src/common/`** - Shared types, enums, and models used by both client and server. No runtime logic that depends on either side.

The `@/` import alias maps to `./src/` (configured in tsconfig paths and webpack).

### Card System

Cards are the core domain object (~1000 cards across 15 modules). Each card involves:

1. **Card class** (`src/server/cards/<module>/CardName.ts`) - Extends `Card` (or `ActionCard` for cards with repeatable actions). Defines cost, tags, requirements, behavior, and metadata. Simple cards are purely declarative via the `behavior` property. Complex cards override `bespokePlay()`, `bespokeCanPlay()`, `bespokeCanAct()`, `bespokeAction()`.
2. **CardName enum entry** (`src/common/cards/CardName.ts`) - Every card needs an enum value here.
3. **Module manifest** (`src/server/cards/<module>/<Module>CardManifest.ts`) - Registers the card's factory in a `ModuleManifest`. Base cards use `StandardCardManifests.ts`. All manifests aggregate in `AllManifests.ts`.
4. **Card renderer** - Defined inline in the card's `metadata.renderData` using the `CardRenderer.builder()` DSL.
5. **Test** (`tests/cards/<module>/CardName.spec.ts`) - Uses `testGame()` and `TestPlayer` helpers.

Card types: `EVENT`, `ACTIVE` (has action), `AUTOMATED`, `PRELUDE`, `CORPORATION`, `CEO`, `STANDARD_PROJECT`, `STANDARD_ACTION`.

**Card vs ActionCard**: Extend `Card` for automated/event cards. Extend `ActionCard` for ACTIVE cards with a repeatable action — `ActionCard` enforces that an `action` behavior is defined and provides `canAct()`/`action()` wiring automatically.

### Behavior System

The `Behavior` type (`src/server/behavior/Behavior.ts`) is a declarative DSL for card effects: production changes, resource gains/losses, tile placement, TR changes, global parameter increases, drawing cards, etc. Cards set `behavior` (on play) and/or `action` (repeatable) properties. The `BehaviorExecutor` (`src/server/behavior/Executor.ts`) interprets these at runtime. Prefer declarative `behavior` over imperative `bespokePlay()` overrides when possible.

### Deferred Actions

Player choices and multi-step effects use `DeferredAction` (`src/server/deferredActions/`). Actions are queued via `game.defer(action)` with a `Priority` and resolved in order. The `.andThen()` callback chains follow-up logic after a deferred action resolves.

### Player Inputs

When a player needs to make a choice, the server returns a `PlayerInput` (e.g., `SelectSpace`, `SelectCard`, `OrOptions`). These live in `src/server/inputs/`. The client renders the appropriate UI based on the input type.

### Game Modules (Expansions)

Each expansion has its own directory under `src/server/cards/` and a manifest. Source directories: `base`, `corporation` (Corporate Era), `promo`, `venusNext`, `colonies`, `prelude`, `prelude2`, `turmoil`, `community`, `ares`, `moon`, `pathfinders`, `ceos`, `starwars`, `underworld`, `delta`. Test directories under `tests/cards/` mostly mirror these (note `tests/cards/ceo` vs `src/server/cards/ceos`). Cross-expansion card compatibility is declared via `compatibility` in `CardFactorySpec`.

### Client Components

Vue 3 with Options API. Components are in `src/client/components/`. The root `App.ts` routes between screens. `PlayerHome.vue` is the main game view. Card rendering components are in `src/client/components/card/`. Styles use Less (`src/styles/`).

### Database

Pluggable backends in `src/server/database/`: `SQLite`, `PostgreSQL`, `LocalFilesystem`. Games are serialized/deserialized through `SerializedGame`/`SerializedPlayer` types. `GameLoader` handles caching and retrieval.

### Testing Patterns

- **`testGame(n, options?)`** (`tests/TestGame.ts`) - Creates a game with n players, returns `[game, ...players]` as a tuple. Skips initial card selection and disables Ares hazards by default.
- **`TestPlayer`** (`tests/TestPlayer.ts`) - Extends `Player` with test utilities like `popWaitingFor()`.
- **Test utilities** (`tests/TestingUtils.ts`) - Key helpers: `runAllActions(game)` (process deferred action queue), `cast(value, class)` (type-safe cast for PlayerInputs), `setOxygenLevel()`, `setTemperature()`, `addOcean()`, `addGreenery()`, `addCity()`, `fakeCard()`.
- Server card tests: instantiate the card, call `canPlay()`/`play()`/`action()`, assert state changes. Call `runAllActions(game)` after actions that queue deferred actions.
- Client tests: use `@vue/test-utils` mount/shallowMount with JSDOM setup from `tests/client/components/setup.ts`.
- Test framework: Mocha + Chai (expect style). Client tests use mochapack.

### Internationalization

Custom i18n via `src/client/directives/i18n.ts` with `v-i18n` directive. Translation files in `src/locales/`. Strings are matched by exact text content.

**Russian (ru) translations — terminology consistency.** Before inventing a new Russian translation for a term, check two sources, in order:

1. **The project itself.** Grep `src/locales/ru/` for the term (or close variants — singular/plural, case-different) and reuse the existing wording. Examples already established: `Building → Здание`, `Space → Космос`, `Science → Наука`, `Power → Энергия`, `Earth → Земля`, `Venus → Венера`, `Plant → Растение`, `Microbe → Бактерия`, `Animal → Животное`, `Event → Событие`, `Wild → Любая`, `VP → ПО`, `researching → исследование`, `passed → спасовал`. Iconography terms live in `help_iconography.json`; UI labels in `ui.json`; log templates in `log_messages.json`; game-end strings in `game_end.json`.
2. **The official Russian edition of the *Terraforming Mars* board game** (Crowd Games / «Покорение Марса»). Game-specific terms — tag names, milestone/award names, standard project labels, resource names — should match the printed Russian cards. If a project translation contradicts the board-game canon, surface the discrepancy to the user rather than silently picking one.

Never translate proper nouns that look like player names or English card names already in the player log unless they appear in a translation file.

**NEVER modify the Russian translation of an English key you didn't introduce yourself.** The same English string can appear in many places — log messages, card descriptions, tooltips, UI labels — each with its own context. Changing `"Convert" → "Превратить"` to make your new button read nicely will silently rewrite "Convert" everywhere else in the game (action logs, card flavor text, etc.) and break the meaning. Instead, **introduce a new English key** for your UI element (e.g. `"Spend"` or `"Convert plants action button"`) and add its translation. If you really must reuse an existing key, first `grep` every usage of that English string in `src/client/`, `src/server/` and the other `src/locales/<lang>/` files, confirm the new wording fits ALL of them, and call it out in your summary.

### Logging

Game actions are logged via `game.log()` and `player.log()` which accept template strings with `${player}`, `${card}`, `${amount}` style placeholders and corresponding `LogMessageData` entries. Log statements appear in the game's action log visible to players.

## Style Guide

- Follow the style of the code around the file. If this is a new file, follow the style of the code in the directory.
- ESLint uses flat config (`eslint.config.mjs`). Run `npm run lint:fix` for autofix.
