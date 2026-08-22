# Desktop removal — wave 2: the input stack dies, the transport goes headless

**Date:** 2026-08-22 · **Status:** DONE, verified · **Predecessor:** `DESKTOP_REMOVAL_WAVE_1.md` (policy + the entry-point cut) · **Commits:** `1c635a154d` (core), `e382e88a68`+`d5f93d6c9b` (spectator), `f4a4f8ca2c` (REFRESH), `885f7f4532`+`b55f9a1d12` (SP faces), plus the verification-fix commit that carries this report.

Wave 1 cut the desktop entry points but left two load-bearing legacy structures standing: `WaitingFor.vue` still *rendered* prompts (the radio stack + the modal-input router), and the degenerate `projectCard` prompt still fell back to `MandatoryInputModal`. Wave 2 (run as one pass over the user's four-item scope) removed both dependencies and then deleted the whole subtree.

## 1. What shipped

### 1.1 `WaitingFor.vue` is now HEADLESS (the transport, nothing else)
The component keeps exactly four responsibilities and renders exactly one thing:

- **Poll chain** — `/api/waitingfor` GO/REFRESH/WAIT loop, unchanged timing. The REFRESH arm always refetches the player view now (`root.updatePlayer()`); the spectator branch died with the feature (`f4a4f8ca2c`).
- **Submit funnel** — `onsave` / `onsaveBatch` / `onPlacementCancel`, reached via `$refs.waitingFor` from ConsoleShell and every console surface. Byte-identical payloads; no server change.
- **Console cinematic gates** — the 13 `holdingFor*` flags (grouped in the `transportHolding` computed) that keep a server response from painting before its own cause.
- **The `SelectSpace` board binder** — the ONE rendered child. `SelectSpace.vue` is not a prompt UI: it attaches `tile.onclick` to `.board-space-selectable` cells and arms `armTilePlacement` when the console is enabled. It survives because board clicks are how placements submit.

Deleted from it: the modal routing (`MODAL_INPUT_TYPES` / `shouldRouteToModal` / `useModalForCurrentInput`), the `modalSuppressed` prop, the suspend feature, the WGT/prompt title plumbing that fed desktop pills, and 12 orphan imports. **Rule going forward (CLAUDE.md invariant 10): don't put rendering back into it.**

### 1.2 The radio/modal input stack is DELETED
64 src files, 43 spec files (list at the bottom): `PlayerInputFactory` + all 20 leaf input renderers (`SelectCard`, `OrOptions`, `SelectPayment(V2)`, `SelectInitialCards`, …), `MandatoryInputModal`, `ModalInputHost` + every `Modern*` modal content, `WorldGovernmentModalContent`, `PlacementBanner`, `PlayerHome`, `Sidebar`, `KeyboardShortcuts`, `PlayerSetupView`, both draft overlays, the desktop playgrounds, `handPlayState`/`standardProjectPlayState`, and 7 LESS files with their `common.less` imports.

**Deliberately KEPT:** `SelectSpace` + `GoToMap` (+ specs) — console-load-bearing; the pure-TS `modalInputs/` view-models (`optionIcons`, `playerResourceFields`, `targetImpactRows`, `venusBonusResponses`) — consumed by console surfaces; the V2 payment family (`StandardProjectPaymentContent` is imported by ConsoleShell); the shared layer untouched.

### 1.3 The degenerate `projectCard` prompt is CONSOLE-NATIVE
`consoleTaskRouter` now splits `projectCard` three ways **structurally** (never by title): `playFromHand` (candidates ⊆ hand ∪ SRR), `standardProject` (every candidate's manifest type is STANDARD_PROJECT), and `generic` (foreign/empty candidate lists — the shape `MandatoryInputModal` used to catch). The generic mode is served by `ConsoleTaskHost` as a two-stage flow: **pick** (the `.con-cards` card-browser chassis, zoom via the shared viewer) → **pay** (`ConsolePaymentPanel` over the standard payment view-model), one `{type:'projectCard', card, payment}` submit. `SECTION_SERVED_KINDS` is now **exhaustive** — a kind missing from it strands its prompt instead of leaking a desktop modal, because there is no desktop modal left to leak.

### 1.4 Standard projects + standard actions joined the premium face
One class, both or neither: `isPremiumFaceType` admits `STANDARD_PROJECT` + `STANDARD_ACTION`; they render the neutral `standard` theme (graphite/cyan-steel, procedural face — no SP/SA art exists by design). Cost badge **by type**: STANDARD_PROJECT prints its real cost (Sell Patents' «0» included); STANDARD_ACTION's manifest `cost: 0` is a base-class artifact and prints nothing (the `PROJECT_TYPES` cost gate became `COSTED_TYPES`). Legacy `Card.vue` prose is narrowed to CEOs-only across `CardFace` / `ConsoleCardFaceLite` / `PlayedCardLite` / the rules. Visual check: `?premiumCardsPlayground` renders all 9 standard faces correctly (verified by screenshot on the merged build).

### 1.5 The spectator feature is fully deleted
Client (`SpectatorHome`, `PlayersOverview`), model (`SpectatorModel`), server route (`ApiSpectator`), ~25 App.vue touchpoints, paths/requestProcessor/CORS/ServerModel/ApiWaitingFor cleanup. **`spectatorId` stays everywhere** (game creation, serialization, DB) — the id is game data; only the UI/route that consumed it is gone. Old saves keep loading.

## 2. Numbers

| Metric | Before wave 1 | After wave 1 | After wave 2 | Δ wave 2 |
| --- | --- | --- | --- | --- |
| `main.js` (minified) | 2 173 770 B | 1 953 901 B | **1 870 606 B** | **−83 295 B (−4.3 %)** |
| Cumulative vs pre-wave-1 | — | −10.1 % | **−13.9 %** | |
| Client specs collected | 4 736 | 4 735 | **4 522** | −213 (deleted desktop specs) |
| Files deleted (cumulative, wave 2) | — | 0 | **107** (64 src + 43 tests) | |

Most of wave 2's deleted graph was already *unreferenced* after wave 1 (PlayerHome's subtree left `main.js` then); the −83 KB is the part that was still live through `WaitingFor`'s modal routing and `main.ts` globals. `client:components-root` attribution is now 859 KB unminified; the remaining `client:components/desktop` subtree is 98 KB (future waves).

## 3. Verification battery (all on the merged main, `b55f9a1d12` + fixes)

- `npm run build:client` — **0 webpack errors** (the authority for deleted-`.vue` imports; see § 4).
- `npm run build:server`, `npm run build:test`, `npm run make:json`, `npm run make:css` — clean.
- `npm run test:server` — **9 570 / 0**.
- `npm run test:client` — **4 522 / 0** (floor 4 000).
- `npm run lint:client` (vue-tsc) — clean. `lint:i18n` — clean. `lint:server` — fails on the **pre-existing red baseline only** (built artifacts `embedded-server.js`/`main.js`/`vendors.js` + repo scripts; zero wave-2 files).
- e2e: `console-wheel-commit-geometry` + `console-workspace-band` — **9 / 9** across fhd/tv4k/deck profiles.
- Longgame perf probe smoke (`LONGGAME_PERF=1`, deck-docked-tv, fresh seed) — **PASS 2 / FAIL 0** on the wave-2 bundle.
- Visual: SP premium faces screenshot (playground) — correct theme, correct cost-badge policy.

## 4. Traps this wave paid for (they generalize to every future wave)

1. **`tsc`/`vue-tsc` cannot see a deleted `.vue` import** — the `declare module '*.vue'` wildcard shim makes ANY `.vue` path typecheck. The authorities are a strict import-grep over the deleted basenames + `npm run build:client` (webpack fails honestly) + an honest `test:client` run.
2. **`| tail` masks a failing exit code** (the pipeline exits with tail's 0). The first post-sweep `test:client` run "passed" while collecting **0 tests** — six orphan specs of deleted components broke the mochapack bundle build. Run suites bare and read the runner's own `[test-count]` line.
3. **Orphan specs survive the sweep** — deleting a component's spec by name-pairing misses specs that IMPORT the component without being named after it (`AppNoRemount.spec` imported `PlayerHome`; `WaitingForCorpSuppression.spec`, `awardFundingRouting.spec`). Sweep by import-graph over `tests/` too, not by filename.
4. **A grep by deleted basename false-positives on prefixes** (`PaymentForm` matched `PaymentFormV2`) — match import PATHS, not name substrings, before condemning a file.
5. **Worktree merges collide on the version-bump files only** (`package.json`/`package-lock.json` — the bump hook runs per-commit on both sides). Resolve with `--ours`; the hook re-bumps on the merge commit.
6. **A direct `npx webpack --mode production` is NOT the canonical build** (`build:client` = `cross-env NODE_ENV=production webpack`; the config branches on NODE_ENV, not only on `--mode`). A stats run (`--json=bundle-stats.json`) overwrites `build/` with a near-identical-but-different bundle — re-run `build:client` after it, and never quote its sizes.
7. **`build/src/genfiles/settings.json` goes stale if `make:json` runs after `tsc`** — the server then prints an old commit in its «Starting …» line and looks like a stale build. `npm run build`'s order (json before server) is load-bearing.

## 5. What remains (future waves)

- **Two load-bearing legacy pieces**: the headless `WaitingFor.vue` transport (extract into a module when convenient — now a small, honest file) and legacy `Card.vue` (CEO faces only; delete after the CEO premium pass, together with `ConsoleCardFaceLite`'s legacy branch + the legacy icon CSS).
- The still-on-disk wave-1 leftovers reachable by nothing (desktop overlays: `JournalPanel`, `RevealedCardsModal`, `RevealResultOverlay`, `StartGameFlowOverlay`, …, `client:components/desktop` 98 KB) — delete by import graph.
- Desktop-only LESS that lost its consumers; locale keys orphaned by deleted markup (the i18n audit is clean today because keys are shared; re-audit per wave).
- Upstream-sync policy for all deleted files: **keep deleted** (`docs/SHARED_MAIN_WORKFLOW.md` + the wave-1 record).

## Appendix — deleted in wave 2 (107 files)

64 `src/` files: the 32 root input/desktop components (`AndOptions`, `DraftFlowOverlay`, `KeyboardShortcuts`, `MandatoryInputModal`, `OrOptions`, `PaymentForm`, `PaymentUnit`, `PlacementBanner`, `PlayerHome`, `PlayerInputFactory`, `PlayerSetupView`, `SelectAmount`, `SelectCard`, `SelectClaimedUndergroundToken`, `SelectColony`, `SelectDelegate`, `SelectGlobalEvent`, `SelectInitialCards`, `SelectOption`, `SelectParty`, `SelectPayment`, `SelectPaymentV2`, `SelectPlayer`, `SelectPlayerRow`, `SelectProductionToLose`, `SelectProjectCardToPlay`, `SelectResource`, `SelectResources`, `ShiftAresGlobalParameters`, `Sidebar`, `SpectatorHome`, `WorldGovernmentModalContent`), `actions/ActionsPlayground`, `actions/CardActionConfirmContent`, `delta/DeltaProjectInput`, `effects/EffectsPlayground`, `handCards/HandCardPaymentContent`, `handCards/handPlayState`, `handCards/standardProjectPlayState`, `initialDraft/InitialDraftFlowOverlay`, 13 `modalInputs/` renderers (`ContextualChoiceContent`, `ModalInputHost`, `ModalInputPlayground`, `ModernAmountSelector`, `ModernConfirm`, `ModernOptionPicker`, `ModernPlayerPicker`, `ModernProductionToLose`, `ModernResourcePicker`, `ModernResourcesPicker`, `ModernShiftAresGlobalParameters`, `SpendHeatContent`, `VenusBonusContent`), `overview/PlayersOverview`, `utils/useBoardAutoScale`, `common/models/SpectatorModel`, `server/routes/ApiSpectator`, and 7 LESS files (`contextual_choice`, `mandatory_input_modal`, `modal_inputs`, `payments`, `placement_banner`, `venus_bonus`, `waiting_for`).

43 `tests/` files: the paired component specs plus the import-graph orphans (`KeyboardShortcuts.spec`, `PaymentUnit.spec`, `PlayerHome.spec`, `PlayerSetupView.spec`, `Sidebar.spec`, `delta/DeltaProjectInput.spec`, `WaitingForCorpSuppression.spec`, `awardFundingRouting.spec`, `ApiSpectator.spec`, `handPlayState.spec`, `standardProjectPlayState.spec`, …). `AppNoRemount.spec` was trimmed to its three live App-level contracts; `WaitingFor.spec` was rewritten to the binder contract (3 tests).
