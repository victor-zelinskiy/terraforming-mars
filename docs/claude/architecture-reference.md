<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

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

**Before adding a translation key, `grep` for the EXACT key across ALL files in `src/locales/<lang>/` to make sure it doesn't already exist.** The static-json build tool (`src/tools/make_static_json.ts:85`) aggregates every JSON file under a language directory into a single dictionary and **throws on duplicate keys** with `ru: Repeated translation for [...]`. The duplicate can be in `ui.json`, `UI_cards.json`, `game_end.json`, `log_messages.json`, `help_iconography.json`, etc. — same key in two files crashes the build. Run e.g. `grep -nE '^\s*"card":' src/locales/ru/*.json` for every key you intend to add. If a match exists and its translation already fits your use, reuse it (don't add a duplicate). If the existing translation doesn't fit, pick a different more-specific English key for your context.

### Centering UI under a `<Card>`

`.card-container` carries a legacy **asymmetric** margin from `src/styles/cards.less:90`: `margin: 15px 30px 10px 0px`. This was originally for inter-card spacing in grid layouts (OtherPlayer played-cards row, SortableCards hand, etc.).

The 30-px right margin makes a wrapping element's bounding box **30 px wider than the visible card**. The card silhouette sits flush-left within that box; the right 30 px is empty space. **Any centered UI placed under the card (in a flex column / grid column whose width is driven by the card)** will land ~15 px right of the card's visual centre because the parent centers the wider bounding box, not the visible card.

**Rule:** when you mount custom UI (buttons, badges, status chips) below a `<Card>` in a flex column / grid column and expect it to read as centered on the card silhouette, **zero out `.card-container`'s margin in your wrapper's scope**:

```less
.your-slot-wrapper > .card-container {
    margin: 0;
}
```

Don't try to compensate by shifting the UI manually (e.g. `margin-left: -15px`) — `.card-container`'s margin changes with zoom (the media-query ladder in `card_selection.less` scales `.card-container` between 1.0 and 0.68) and the offset would drift across breakpoints.

The reference implementation is `.card-selection__card-clickable > .card-container { margin: 0; }` in `src/styles/card_selection.less`. Mirror that pattern for any new flow that stacks UI under a Card (e.g. future hand-card "РАЗЫГРАТЬ" button, opponent-tableau action buttons).

Inter-card horizontal spacing in your grid should be owned by the parent container (`gap`, `grid-column-gap`, etc.) — independent of `.card-container`'s own margin, which only matters for legacy non-flex layouts.

### Logging

Game actions are logged via `game.log()` and `player.log()` which accept template strings with `${player}`, `${card}`, `${amount}` style placeholders and corresponding `LogMessageData` entries. Log statements appear in the game's action log visible to players.

## Style Guide

- Follow the style of the code around the file. If this is a new file, follow the style of the code in the directory.
- ESLint uses flat config (`eslint.config.mjs`). Run `npm run lint:fix` for autofix.
