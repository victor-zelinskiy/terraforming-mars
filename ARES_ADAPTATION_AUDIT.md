# ARES EXPANSION — PREMIUM ADAPTATION AUDIT & WORKLIST

Living tracking doc for adapting **Ares** into the premium fork (mirrors
`CHOICE_CONTEXT_AUDIT.md` / `EVENT_STAT_FOUNDATION.md` / `CORPORATION_IMPACT_AUDIT.md`).
The `ares` `GameModule` is now in scope for the premium guard tests (see "Scope" below).

Legend: ✅ done · 🟡 in progress · ⬜ pending · ⛔ blocked/decision-needed · ➖ n/a

---

## 0. Source of truth

- **Rules reference:** the *working* legacy Ares engine (`src/server/ares/*`,
  `src/server/cards/ares/*`) + `TM - Ares Expansion v1-1.pdf`. The rules logic is
  ALREADY implemented and correct; this project is the **premium UI/UX + explainability
  + journal/TR/localization layer** on top — NOT a rules rewrite.
- **Gating:** `GameOptions.aresExtension` (cards + adjacency/hazard costs),
  `aresHazards` (default true — initial dust storms + threshold events),
  `aresExtremeVariant` (default false). `AresHandler.ifAres(game, cb)` is the single
  no-leak guard. Engine hooks already wired: `AresHandler.onOceanPlaced` /
  `onTemperatureChange` / `onOxygenChange` (Game.ts addOcean/increaseTemperature/
  increaseOxygenLevel), `earnAdjacencyBonuses`, `assertCanPay` (hazard+adjacency cost),
  `grantBonusForRemovingHazard` (cleanup TR).

## Scope (premium guard tests — `ares` ADDED, all 5 in sync)

| Location | Purpose | State |
| --- | --- | --- |
| `tests/models/cardPlayPreviewCoverage.spec.ts` | play-modal preview coverage | ✅ green |
| `tests/models/actionReasonCoverage.spec.ts` | blue-action unavailable-reason | ✅ green |
| `tests/models/actionPreviewCoverage.spec.ts` | action-preview validity | ✅ green |
| `src/client/components/effects/effectExtraction.ts` (`SCOPE_MODULES`) | effects overlay | ✅ green (generic scan covers all Ares effects, 0 flagged) |
| `src/client/components/actions/actionExtraction.ts` (`SCOPE_MODULES`) | actions overlay | ✅ green (generic scan covers all Ares actions, 0 flagged) |

---

## 1. Card inventory (26 cards) — premium PLAY/ACTION-modal coverage

13 NEW + 13 REPLACEMENT. Effects/actions overlays auto-covered (clean render nodes,
0 overrides needed). Play-modal preview coverage status:

| # | Card | New/Repl | Base | Coverage decision | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Bioengineering Enclosure | new | — | `actionUnavailableReason` hook (no animals here / no other card) | ✅ |
| 2 | Biofertilizer Facility | new | — | declarative `behavior` (prod + add-resource + tile w/ adjacency) | ✅ auto |
| 3 | Butterfly Effect | new | — | `BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT` (+1 TR shown; hazard-threshold shift = follow-up) | ✅ |
| 4 | Capital:ares | repl | Capital | declarative (adjacency MEGACREDITS×2) | ✅ auto |
| 5 | Commercial District:ares | repl | Commercial District | declarative | ✅ auto |
| 6 | Deimos Down:ares | repl | Deimos Down promo | declarative | ✅ auto |
| 7 | Desperate Measures | new | — | `ACCEPTED_DYNAMIC` follow-up (SelectSpace among hazards → PlacementBanner) | ✅ |
| 8 | Ecological Survey | new | — (SurveyCard) | declarative + tile-place hook | ✅ auto |
| 9 | Ecological Zone:ares | repl | Ecological Zone | `ACCEPTED_DYNAMIC` follow-up (tile placement) | ✅ |
| 10 | Geological Survey | new | — (SurveyCard) | declarative | ✅ auto |
| 11 | Great Dam:ares | repl | Great Dam promo | `BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT` (+2 energy prod; tile = follow-up) | ✅ |
| 12 | Industrial Center:ares | repl | Industrial Center | `ACCEPTED_DYNAMIC` follow-up (tile placement) | ✅ |
| 13 | Lava Flows:ares | repl | Lava Flows | declarative | ✅ auto |
| 14 | Magnetic Field Generators:ares | repl | MFG promo | declarative | ✅ auto |
| 15 | Marketing Experts | new | — | declarative (M€ prod) | ✅ auto |
| 16 | Metallic Asteroid | new | — | declarative (stock + global + removeAnyPlants + tile) | ✅ auto |
| 17 | Mining Area:ares | repl | Mining Area | `ACCEPTED_DYNAMIC` follow-up | ✅ |
| 18 | Mining Rights:ares | repl | Mining Rights | `ACCEPTED_DYNAMIC` follow-up | ✅ |
| 19 | Mohole Area:ares | repl | Mohole Area | declarative | ✅ auto |
| 20 | Natural Preserve:ares | repl | Natural Preserve | declarative | ✅ auto |
| 21 | Nuclear Zone:ares | repl | Nuclear Zone | declarative (adjacency cost 2) | ✅ auto |
| 22 | Ocean City | new | — | declarative (tile on upgradeable-ocean) | ✅ auto |
| 23 | Ocean Farm | new | — | declarative | ✅ auto |
| 24 | Ocean Sanctuary | new | — | declarative (add-resource + tile) | ✅ auto |
| 25 | Restricted Area:ares | repl | Restricted Area | declarative (adjacency DRAW_CARD) | ✅ auto |
| 26 | Solar Farm | new | — | `ACCEPTED_DYNAMIC` follow-up (tile; energy prod placement-driven) | ✅ |

**→ All 26 cards clear the play/action premium-modal guards.** The premium *board*
explainability for the placement/hazard cards (the deeper layer the brief asks for)
is tracked in §2–§5, not the play modal.

---

## 2. Mechanics — premium framework integration (the bulk of the brief)

These have **NO auto-guard** — tracked manually here.

| Mechanic | Premium target | Extension point | Status |
| --- | --- | --- | --- |
| **Special-tile adjacency bonuses** (placer gain + tile-owner income) | BoardInformation hover + active-placement preview; recipient clarity (me vs owner); journal | `BoardInformationEngine.aresAdjacencyFacts()` (stub → populate); categories `ares-adjacency-bonus` / `tile-owner-benefit` already declared | ✅ engine facts (placer gain + owner M€, Marketing-Experts-aware, recipient-grouped) in the placement preview; journal of the grant is Phase 4 |
| **Hazard tiles** (dust storm / erosion, mild/severe) hover + placement penalty/cleanup preview | BoardInformation `hazard-penalty` / `hazard-cleanup` facts; diegetic RU labels | hazard COST already flows via `computeAdditionalCosts`; add facts + cell status lore | ✅ hover (severity-aware header + identity + cleanup +TR/cost + adjacency penalty) + placement-cleanup-reward fact; popover hazard section; diegetic RU («Опасная зона») |
| **Scale threshold "planetary events"** (ocean 3 → erosions; temp −4 → severe erosion; oxy 5 → severe dust storm; ocean 6 → remove dust storms +1 TR) | Arc-scale markers via `ArcScaleMarkerChip` (`planetary-event` / `hazard-event`); tooltips; reached-highlight; journal | `aresThresholdMarkers.ts` (live thresholds from `aresData.hazardData`); `ScaleEventMarker.vue` (generalized from OceanEventMarker, per-scale surface); `OceanArcScale` + `Board.vue` mount on ocean/temp/oxy; legacy `global-ares-*` PNG markers removed | ✅ (markers + tooltips + reached state; gated to Ares games; extreme-variant safe; journal of the events is Phase 4) |
| **Hazard cleanup TR attribution** | new TR bucket, diegetic label «Очистка опасных зон»; VP-overlay segment | `Player.increaseTerraformRating(..., {trAttribution})` + `TRSourceType`; `victoryPointsModel.trScale` | ✅ (`ares-hazard` bucket → `TerraformRatingBreakdown.hazards` → own `tr.hazards` segment; cleanup-by-build + ocean-6 removal attributed; no-leak guarded) |
| **Journal / eventlog** for every Ares board event (place/strengthen/remove/cleanup/penalty/adjacency-bonus) | root events w/ `correlationId` + new `JournalActionCategory` | `events.beginAction(...)` + `endScope()` (milestone/award recipe) | ✅ planetary events (appear / intensify / recede) are `planetary-event` roots (player threaded through `onTemperatureChange`/`onOxygenChange`); removal +TR grouped under it; cleanup-by-build TR already attributed (Phase 2); adjacency M€/energy now via `stock.add` (was direct mutation → invisible). Empty-threshold = no journal noise |
| **Notifications** for planetary events / hazard cleanup / adjacency income | variant + mapper | `notificationModel.rootVariant` | ✅ `planetary-event` variant (kind `important`, ochre accent ◬) shown even with journal open |
| **Random hazard placement** (initial + threshold) — NO player picker, server-driven, logged + board-highlighted | confirm logged + presented honestly (random, not "player chose") | `AresHazards.randomlyPlaceHazard` (exists); add journal + client highlight | ✅ server-driven (no picker); the threshold placement is a `planetary-event` journal root «появляются эрозии» (never implies the player chose), tiles render via the existing hazard sprites |
| **Endgame stats** (optional, honest) — TR from cleanup; tiles-adjacent-to-hazards | endgame facts/insights | `endgameFacts.ts` (opt-in) | ◑ §20.1 (TR breakdown segment «Очистка опасных зон») DONE in Phase 2; §20.2 narrative insights deliberately DEFERRED (optional + "avoid overclaim") — the hazard-cleanup events are in the stream, an insight analyzer can be added later |

---

## 3. Localization gap (≈10% done)

- ✅ exist: `Ares`→Арес, hazard UI bits (`ui.json`), `board_info.json` hazard cost,
  awards/milestones hazard lines, "Massive Dust Storm" (turmoil).
- ✅ **Card names + descriptions** → new `ru/ares_cards.json`: 12 NEW cards (names + descriptions
  + baked `Action:`/`Effect:` render texts, verified against the generated card render) + the 13
  replacement cards' Ares-specific descriptions/vpText (the `:ares` NAME auto-strips to the base
  via `CardTitle`). Canonical terms reused (volcano names, «участок … бонусом за размещение»). The
  `make:json` audit reports 0 real gaps (only a concat-fragment false positive).
- ✅ board-info hazard/adjacency facts, planetary-event tooltips, cleanup/penalty
  prompts, hazard-cleanup TR label (Phases 2/3/4/5).
- ⬜ (optional) **4 hazard tile type names** (Mild/Severe Dust Storm, Mild/Severe Erosion) — the
  board-info hover already shows «Эрозия»/«Пылевая буря»; the raw `tileTypeToString` names are
  only used in a couple of generic logs.
- Canonical terms (reuse, do NOT coin): TR→**РТ**, VP→**ПО**, production→**производство**,
  tile→**тайл**, adjacency→**соседство**, hazard→**опасная зона**, erosion→**эрозия**,
  dust storm→**пылевая буря**. Severity: mild→**слабая**, severe→**сильная** (TBD vs canon).
- ✅ Added this pass: `No animals on this card to move`, `No other card to receive an animal`.

---

## 4. Render / sprites

✅ Fully present: `ares.less` has every Ares tile sprite incl. hazards
(`board-space-tile--dust-storm-mild/-severe`, `--erosion-mild/-severe`) +
adjacency tile; render DSL has `hazardTile()` / `adjacencyBonus()` / `tile(type, _, isAres)`.
No render gaps.

---

## 5. Phased plan (maps to brief §27)

- **Phase 1 — Audit** ✅ (this doc + scope widening + card-coverage cleared).
- **Phase 2 — Core state verify + TR attribution** ✅ (hazard-cleanup/removal TR bucket
  end-to-end into the VP overlay; no-leak verification test green).
- **Phase 3 — Scale planetary-event markers** ✅ (premium `ArcScaleMarkerChip` markers on
  ocean/temperature/oxygen from live thresholds; legacy PNG markers removed; gated to Ares).
- **Phase 4 — Hazard board mechanics journal/notification coverage** ✅ (planetary events as
  journal roots + notification variant; adjacency M€/energy routed through the event stream).
- **Phase 5 — BoardInformation: `aresAdjacencyFacts` + hazard facts + placement preview** ✅
  (engine facts + hover popover hazard section + recipient-grouped adjacency; read-only-guarded).
- **Phase 6 — Cards: replacement parity + legacy-modal removal** ✅ (guards cleared in Phase 1;
  effects/actions overlays auto-cover every Ares card; Butterfly Effect's `aresGlobalParameters`
  input routed to the premium modal — was buried in the hidden legacy stack; contextual-choice
  triage of the Ares dir = no bespoke `OrOptions` → nothing to mark; Desperate Measures / Solar Farm
  board UX via Phase 5).
- **Phase 7 — Journal/eventlog** ✅ for hazard events (folded into Phase 4); per-card play logs already covered by the generic journal.
- **Phase 8 — Endgame stats** ◑ TR breakdown segment done (Phase 2); narrative insights deferred
  (optional, avoid overclaim — the hazard events are in the event stream for a future analyzer).
- **Phase 9 — Localization** ✅ (card names + descriptions + render texts in `ru/ares_cards.json`;
  hazard/board/scale/journal strings done in their phases). 0 real gaps per the audit script.
- **Phase 10 — Tests / QA / build / eslint** ⬜.

## 6. Open product decisions

1. ~~**Scale planetary-event markers**~~ — RESOLVED: enabled for Ares games (Phase 3).
2. ~~**Cadence**~~ — RESOLVED: autonomous straight-through (commit per phase).

## 7. Changelog

- **2026-06-26** — Phase 6: routed Butterfly Effect's `aresGlobalParameters` input into
  `MODAL_INPUT_TYPES` so it shows in the premium MandatoryInputModal (factory-hosted) instead of
  the hidden legacy `.legacy-ui-overlay`. Contextual-choice triage of `src/server/cards/ares`:
  no bespoke `OrOptions`/`SelectOption` → nothing to `markChoiceContext`. (A bespoke premium
  ShiftAresGlobalParameters widget remains a documented frontier, like ModernAndOptions.)
- **2026-06-26** — Phase 9: localization. New `ru/ares_cards.json` — 12 new Ares card names +
  descriptions + baked `Action:`/`Effect:`/plate render texts (verified against the generated
  `cardRender.json` so no card line silently shows English), plus the 13 replacement cards'
  Ares-specific descriptions / vpText (the `:ares` NAME auto-strips to the base via `CardTitle`).
  Canonical terms reused (volcano names «Купол Фарсида»…, «участок … бонусом за размещение»,
  РТ/ПО/опасная зона/эрозия/пылевая буря). A repeatable audit script confirms 0 real gaps.
- **2026-06-26** — Phase 4/7: journal + notification coverage of planetary events. New
  `JournalActionCategory`/`NotificationVariant` `planetary-event`; each event (erosions appear,
  hazards intensify, dust storms recede) wrapped in `events.beginAction(player, {kind:'system'},
  {category:'planetary-event'})` via a `planetaryEvent` helper (player threaded through
  `onTemperatureChange`/`onOxygenChange` + `ShiftAresGlobalParametersDeferred`); the removal +TR
  groups under it; `makeSevere` returns a count so a consumed-but-empty threshold makes no journal
  noise. Adjacency M€/energy routed through `stock.add` (was `player.megaCredits++` → invisible to
  the journal). Notification variant (important, ochre ◬). 5 RU log keys (+ filled a pre-existing
  untranslated dust-storm TR log). `tests/events/planetaryEventJournal.spec.ts` (4).
  build:server + vue-tsc + make:json + make:css green.
- **2026-06-26** — Phase 5: BoardInformation hazard + adjacency explainability.
  `aresAdjacencyFacts` (was a stub) now emits, in the active-placement preview, the
  `ares-adjacency-bonus` (placer gain, per neighbour `space.adjacency.bonus`, reusing
  `describeSpaceBonus`) + `tile-owner-benefit` (owner +1/+2 M€, Marketing-Experts-aware,
  recipient-grouped) + the `hazard-cleanup` +TR reward when covering a hazard (cost still
  via `placementCostFacts`). Hover on a hazard cell now shows a dedicated section (identity
  erosion/dust storm, severity-aware header «Опасная зона»/«Сильная опасная зона», cleanup
  +TR/−M€, adjacency production penalty) via `hazardHoverFacts` + a `BoardCellInfoPopover`
  hazard section. Gated on `aresExtension` (no leak), read-only (purity-guarded). 15 RU
  board_info keys. `tests/boards/BoardInformationAres.spec.ts` (6). build:server + vue-tsc + make:json green.
- **2026-06-26** — Phase 3: premium scale planetary-event markers. `aresThresholdMarkers.ts`
  builds the 4 markers from the LIVE `aresData.hazardData` thresholds (extreme-variant safe);
  `OceanEventMarker` generalized to `ScaleEventMarker` (per-scale surface/accent); rendered on
  ocean (OceanArcScale `aresMarkers`) + temperature/oxygen (Board.vue, dynamic-config geometry);
  legacy `global-ares-*` template block + globs.less PNG markers REMOVED; 4 RU description keys;
  `tests/client/components/board/aresThresholdMarkers.spec.ts`. vue-tsc + make:json + make:css green.
- **2026-06-26** — Phase 2: hazard-clearing TR attribution. New `ares-hazard` `TRSourceType`
  → `TerraformRatingBreakdown.hazards` (split out of `cards`) → own diegetic VP segment
  «Очистка опасных зон» (`tr.hazards`, ochre accent). Cleanup-by-build
  (`grantBonusForRemovingHazard`) + the ocean-6 dust-storm-removal event attributed;
  `tests/ares/AresHazardTr.spec.ts` (3 tests incl. no-leak). build:server + make:json green.
- **2026-06-26** — Phase 1: widened all 5 SCOPE sets to `ares`; cleared the play/action
  guard worklist (Bioengineering Enclosure reason hook; ACCEPTED_DYNAMIC for the 5
  placement cards + Desperate Measures; BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT for Great
  Dam:ares + Butterfly Effect); added 2 RU reason keys. Guards + `make:json` green.
