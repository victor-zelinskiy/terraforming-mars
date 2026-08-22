# Desktop removal — waves 3–4: the unreachable subgraph dies, the last card type goes premium

**Date:** 2026-08-22 · **Status:** DONE, verified · **Predecessors:** `DESKTOP_REMOVAL_WAVE_1.md`, `DESKTOP_REMOVAL_WAVE_2.md` · **Commits:** `83bc45b9f5`+`72e787536c` (wave 3), `b6387f7034`+`75f5eecd78`+`5b3e455bf6` (wave 4), `fa76a2704e`+`fa73d40da9` (the console Playground hub + menu audit that rode this pass).

## 1. Wave 3 — the unreachable desktop subgraph (192 files changed, −44 239 lines)

An import-reachability audit (entries: `main.ts` + `App.vue` incl. every lazy `import()` edge) produced the verdicts; the deletion executed them. **119 src TS/Vue + 18 LESS + 39 test files deleted**; 13 files modified; 2 LESS extracted (`vp_shared.less`, `map_fingerprint.less`).

Deleted clusters: the desktop journal (`JournalPanel` + feed/filter/selector), `RevealedCardsModal`, `RevealResultOverlay` (+slot), `StartGameFlowOverlay`, `DrawCardRevealFlow` (+content), `MaCeremonyOverlay`, `BotTurnReviewOverlay` (+`BonusCardZoomOverlay`), the `HandCardsOverlay` cluster (+`OpponentHandOverlay`, `TabbedRemovalPicker`), the `ActionsOverlay` cluster (8 components + `RepeatActionPicker`), `EffectsOverlay`, ALL 8 `playedCards/` components, `VictoryPointsOverlay` (+lock), `LeftPlayerPanel`/`LeftPlayerCard`/`MarsBotPanel`, the milestone/award/SP overlays + badges + confirm contents, ALL 8 `initialDraft/` .vues, the whole TopBar chain (12 components incl. `PlayerTimer`), `OtherPlayer`+`StackedCards`, `CardSelectionContent`, `DraftWaitingContent`, `DraftedCardsPile`, `SortableCards`, `Milestones`/`Awards`, `ColoniesOverlay`, `MarsBotBoardOverlay`, `MoonGlobalParameterValue`, `UndergroundTokens`.

**Policy cuts in App.vue** (runtime-dead branches since console became unconditional): the desktop `PremiumMainMenu` (+9 mainMenu .vues), the desktop `PremiumCreateGame` (+13 create/premium .vues), the upstream `CreateGameForm` (+6 filter .vues) — **`/new-game` now lands in the console creator** (`applyRoute` alias, URL keeps working). Shared state files those screens used (`identityState`, `profilesState`, `joinGamesState`, `lanState`, `createGameState`, `devGuaranteedCards`, …) are console-imported and stay.

**Kept against the candidate list** (the import chains that forced it — a wrong UNREACHABLE verdict deletes a live file): `revealViewerState` (4 live importers), `playedCardsPickState` (live `cardPickRouting`), `.vp-scale*`/`.vp-private*` (endgame tabs + console rail → extracted), `.effect-group*`/`.effect-item*` (live `EffectBlock` via ConsoleInfoMode), the `global-num-transition-*` keyframes (referenced BY NAME from console.less), `.map-fp*` (live `PremiumMapFingerprint` → extracted). Selector-string hygiene: dead desktop selectors removed from `focusScopes`/`focusEngine`/`consoleLeakDetector` (string literals create no import edge — they fail silently).

## 2. Wave 4 — CEOs join the premium face; the legacy renderer dies

**Part 1** (worktree agent): `[CardType.CEO]: 'ceo'` in the ONE scope gate; all 38 L-cards render premium. The `ceo` theme (cool charcoal + champagne; the corporation parchment stays warm), the procedural identity band `.pcard-ceo-ident` (NO L-card ships art — the band IS the face), the once-per-game marker (`{kind:'opg'}`), `printedLayout` mechanics (authored row order is the CEO canon — the canonical reorder would flip Xavier's effect above its enabler; `playStart` past the end so no «при розыгрыше» rail lies on an OPG row), and the **prose rule zone** (`vm.prose` → `.pcard__prose`, 4-tier ladder `proseTierFor` calibrated on the RU corpus — a CEO's description IS the rule, never flavor; falls back to dropped `plainText` for Xavier). Icon coverage extended (REDS/deactivated-REDS as dim+strike — grayscale `filter` is dead in console, moon rates, planetary track, ADJACENCY_BONUS). **RU locale for CEO texts did not exist** — `src/locales/ru/ceo_cards.json` created (97 keys).

**Part 2** (orchestrator): with every type premium, the legacy branch was dead in all three routers — `CardFace.vue` / `ConsoleCardFaceLite.vue` / `CardZoomCard.vue` are premium-only now, and **legacy `Card.vue` + 11 transitively-orphaned subcomponents** (`CardCost/Tags/Title/Content/Requirement(s)/Expansion/VictoryPoints/ResourceCounter/ExtraContent/Help`) + already-orphaned `PremiumCardWarnings.vue` + `card_help.less` deleted with 15 specs. ⚠️ **The render-DSL family (`CardRenderData` tree: CardRowComponent, CardRenderItemComponent, …) STAYS** — 8 live non-card importers (journal popovers, MarsBot faces, effect chips) — it is shared layer, not legacy. `CardFace.vue` itself stays as the premium-only facade (40 hosts import it; unknown card names must render nothing, not crash).

## 3. The console Playground hub (admin-only) + menu audit

- The «Полигон» main-menu item (visible only to the `admin` identity, beside «Откат партии») opens a hub of visual dev stands: premium cards / player cubes / card lore. Every stand renders inside `ConsolePlaygroundStand` — ONE `ConsoleScrollArea` (a native scrollbar is a console bug), stick/d-pad scroll, LB/RB section jumps, a glyph foot bar, B back. The `?premiumCardsPlayground`-family deep links stay (e2e drives them) and mount the SAME stand `standalone`; **the menu does not mount under a deep-linked stand** (`registerConsoleIntentHandler` is a single slot — mount order is template order, so the menu would own the pad and drive itself invisibly).
- Menu audit verdicts: the two native `title` tooltips (expansion icons in the games list + launch panel) removed — the pad has no hover; everything else was already on console rails (ConsoleDevCardPicker's own `CardZoomModal` instance with `con-zoom` chrome is the documented pre-game pattern; scrolling via ConsoleScrollArea everywhere; zero button literals — the glyph guard covers `components/console/**`).

## 4. Numbers (merged main, `72e787536c`)

| Metric | After wave 2 | After waves 3–4 | Δ |
| --- | --- | --- | --- |
| `main.js` (minified) | 1 870 606 B | **1 834 685 B** | −35 921 B |
| Cumulative vs pre-wave-1 (2 173 770 B) | −13.9 % | **−15.6 %** | |
| Client specs | 4 522 | **4 330** | −192 deleted with their components (+CEO guards added) |
| Files deleted (waves 3–4) | | **≈224** (145 src + 19 LESS + 60 specs/helpers) | |
| Source lines (waves 3–4) | | **−46 300** net | |

Boot effect: the biggest cut is module-graph weight in the lazy chunks (the desktop main menu / create chunks no longer exist at all); `main.js` shrinks less because wave 1 already unhooked most of it.

## 5. Verification battery (merged main)

- `npm run build:client` — **0 webpack errors**; `build:server` / `build:test` / `make:css` / `make:json` / `lint:client` (vue-tsc) — clean.
- `npm run test:client` — **4 330 / 0** (floor 4 000) · `npm run test:server` — **9 570 / 0**.
- e2e smoke: `console-wheel-commit-geometry` + `console-workspace-band` — **9 / 9** (fhd/tv4k/deck).
- Visual on the merged bundle: the playground hub end-to-end under the `admin` identity (216 cards in the stand, CEO section included), absent for non-admin; `/new-game` boots into the console creator.
- Flake note for future runs: mochapack timeouts at 2 000 ms with no assertion error are **CPU starvation** when suites run beside webpack/vue-tsc on this box — both wave agents and the orchestrator saw one each; all green solo and on idle re-runs. Also the harness's background dev server on 8127 died twice mid-check (zombie socket holding the port) — `npx kill-port 8127` + restart; do not diagnose product regressions off a wedged server (both «regressions» this session were exactly that).

## 6. What remains

- **The ONE load-bearing legacy piece:** the headless `WaitingFor.vue` transport. Extraction into a module is deliberately deferred to its own wave — the file is small and honest post-wave-2, and the change touches every submission.
- Frozen-on-disk stragglers reachable by nothing new: `HydroNetworkOverlay.vue` (only its children are imported — DELETED in the 2026-08-23 cleanup, along with its overlay-frame LESS; `HydroActionZone.vue` is thereby orphaned and queued for a later pass), `player_home.less` (needs a per-selector audit), assorted `hand_cards.less`/`journal.less` dead blocks kept beside live ones.
- Upstream-sync policy for all deleted files stays **keep deleted**.
