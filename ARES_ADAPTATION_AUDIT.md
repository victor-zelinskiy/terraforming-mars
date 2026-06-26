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
| **Special-tile adjacency bonuses** (placer gain + tile-owner income) | BoardInformation hover + active-placement preview; recipient clarity (me vs owner); journal | `BoardInformationEngine.aresAdjacencyFacts()` (stub → populate); categories `ares-adjacency-bonus` / `tile-owner-benefit` already declared | ⬜ |
| **Hazard tiles** (dust storm / erosion, mild/severe) hover + placement penalty/cleanup preview | BoardInformation `hazard-penalty` / `hazard-cleanup` facts; diegetic RU labels | hazard COST already flows via `computeAdditionalCosts`; add facts + cell status lore | ⬜ |
| **Scale threshold "planetary events"** (ocean 3 → erosions; temp −4 → severe erosion; oxy 5 → severe dust storm; ocean 6 → remove dust storms +1 TR) | Arc-scale markers via `ArcScaleMarkerChip` (`planetary-event` / `hazard-event`); tooltips; reached-highlight; journal | `oceanThresholdMarkers.ts` (placeholders exist, HIDDEN behind `?oceanMarkers`); markers for temp/oxy scales to add; gate to Ares games | ⛔ decision: enable now |
| **Hazard cleanup TR attribution** | new TR bucket, diegetic label «Очистка опасных зон»; VP-overlay segment | `Player.increaseTerraformRating(..., {trAttribution})` + `TRSourceType`; `victoryPointsModel.trScale` | ✅ (`ares-hazard` bucket → `TerraformRatingBreakdown.hazards` → own `tr.hazards` segment; cleanup-by-build + ocean-6 removal attributed; no-leak guarded) |
| **Journal / eventlog** for every Ares board event (place/strengthen/remove/cleanup/penalty/adjacency-bonus) | root events w/ `correlationId` + new `JournalActionCategory` (e.g. `planetary-event`, `hazard-cleanup`) | `events.beginAction(...)` + `endScope()` (milestone/award recipe) | ⬜ |
| **Notifications** for planetary events / hazard cleanup / adjacency income | variant + mapper | `notificationModel.rootVariant` | ⬜ |
| **Random hazard placement** (initial + threshold) — NO player picker, server-driven, logged + board-highlighted | confirm logged + presented honestly (random, not "player chose") | `AresHazards.randomlyPlaceHazard` (exists); add journal + client highlight | ⬜ |
| **Endgame stats** (optional, honest) — TR from cleanup; tiles-adjacent-to-hazards | endgame facts/insights | `endgameFacts.ts` (opt-in) | ⬜ (low priority) |

---

## 3. Localization gap (≈10% done)

- ✅ exist: `Ares`→Арес, hazard UI bits (`ui.json`), `board_info.json` hazard cost,
  awards/milestones hazard lines, "Massive Dust Storm" (turmoil).
- ⬜ **26 Ares card names + descriptions** → `ru/cards.json` (or new `ru/ares_cards.json`).
- ⬜ **4 hazard tile type names** (Mild/Severe Dust Storm, Mild/Severe Erosion).
- ⬜ board-info hazard/adjacency facts, planetary-event tooltips, cleanup/penalty
  prompts, hazard-cleanup TR label.
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
- **Phase 3 — Scale planetary-event markers** ⛔ (decision: enable for Ares games).
- **Phase 4 — Hazard board mechanics journal/notification coverage** ⬜.
- **Phase 5 — BoardInformation: `aresAdjacencyFacts` + hazard facts + placement preview** ⬜.
- **Phase 6 — Cards: replacement parity audit + Desperate Measures/Solar Farm board UX** ⬜.
- **Phase 7 — Journal/eventlog** ⬜.
- **Phase 8 — Endgame stats** ⬜ (low priority).
- **Phase 9 — Localization** ⬜.
- **Phase 10 — Tests / QA / build / eslint** ⬜.

## 6. Open product decisions

1. **Scale planetary-event markers** (brief §13) — enable for Ares games now (recommended,
   the framework + placeholders exist) vs. defer.
2. **Cadence** — reviewable vertical slices (recommended, per "quality over speed") vs.
   straight-through.

## 7. Changelog

- **2026-06-26** — Phase 2: hazard-clearing TR attribution. New `ares-hazard` `TRSourceType`
  → `TerraformRatingBreakdown.hazards` (split out of `cards`) → own diegetic VP segment
  «Очистка опасных зон» (`tr.hazards`, ochre accent). Cleanup-by-build
  (`grantBonusForRemovingHazard`) + the ocean-6 dust-storm-removal event attributed;
  `tests/ares/AresHazardTr.spec.ts` (3 tests incl. no-leak). build:server + make:json green.
- **2026-06-26** — Phase 1: widened all 5 SCOPE sets to `ares`; cleared the play/action
  guard worklist (Bioengineering Enclosure reason hook; ACCEPTED_DYNAMIC for the 5
  placement cards + Desperate Measures; BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT for Great
  Dam:ares + Butterfly Effect); added 2 RU reason keys. Guards + `make:json` green.
