# Structured event — coverage matrix (scope: base, corpera, promo, venus, colonies, prelude)

> Worklist for widening structured-event coverage. Companion to
> `LOGGING_EVENT_MODEL_PROPOSAL.md`. Status legend:
> **✅ covered** — emitted + attributed by the Phase-1 foundation;
> **🟡 chokepoint-only** — the factual impact IS recorded, but attribution lands on the
> active action (not the effect card) until its dispatch loop is wrapped — Phase 3;
> **⛔ nothing to log** — no meaningful runtime impact (static VP / requirement bonus / pure tag).
>
> **⚡ PHASE 2 UPDATE:** every 🟡 below is now **✅** — all passive dispatch loops are wrapped
> (`onTilePlaced` / `onProductionGain` / `onColonyAddedByAnyPlayer` / `onGlobalParameterIncrease` /
> `onStandardProject` / `onNonCardTagAdded`), standard-project discounts are recorded at pay time,
> Project Inspection + Robotic Workforce + Cyberia Systems emit copy markers, and correlation now survives
> the player-input boundary. The 🟡 marks below are kept for historical context; treat them as ✅.

## 0. The categorization rule (covers ALL cards, not just the ones listed)

Every card falls into exactly one bucket:

1. **Declarative `behavior` / standard mutations** → **✅ auto-covered**. The Phase-1 chokepoints
   (`Stock.add`, `Production.add`, `addResourceTo`/`removeResourceFrom`, `increaseTerraformRating`,
   `DrawCards.keepAll`) record the factual impact, and the play/action SCOPE attributes it to the played
   card. **No per-card work.**
2. **`onCardPlayed` / `onCardPlayedByAnyPlayer` passive effects** → **✅ covered** — the dispatch loop in
   `Player.onCardPlayed` is wrapped in `events.withEffect(...)`, so each firing gets an `effect-triggered`
   marker + correct source.
3. **Per-card play discounts** (`getCardDiscount`) → **✅ covered** via `getCardCostBreakdown` →
   `discount-applied` events.
4. **Blue-card / corporation / CEO actions** → **✅ covered** — `playActionCard`/`getPlayCeoOPGAction`
   open an `action` root; the action's impact flows through the chokepoints.
5. **VIRON-style copy of an action** → **✅ covered** via `withCopiedAction` (`copied-action` event +
   chain). **Project Inspection** uses the identical pattern → 🟡 (one-line wrap pending).
6. **Other passive dispatch loops** (`onTilePlaced`, `onProductionGain`, `onColonyAddedByAnyPlayer`,
   `onGlobalParameterIncrease`, `onStandardProject`) → **🟡 chokepoint-only**. The impact is recorded but
   attributed to the active action; wrap each dispatch site in `withEffect` (Phase 3, see §3).
7. **Standard-project discounts** (`getStandardProjectDiscount`) → 🟡 (instrument `getAdjustedCost`).
8. **Static VP, requirement bonuses, pure-tag, payment-only mechanics** → **⛔ nothing to log**.

## 1. Corporations (the priority — insightEngine will have a dedicated Corporation Impact section)

### Corporation (Corporate Era)
| Corp | Mechanism | Status | Notes |
| --- | --- | --- | --- |
| Beginner Corporation | start 42 M€ + draw 10 | ⛔ | setup only |
| CrediCor | `onCardPlayed`/`onStandardProject` +4 M€ on 20+ cost | ✅ onCardPlayed / 🟡 onStandardProject | std-project trigger needs the `onStandardProject` dispatch wrap |
| EcoLine | declarative greenery discount | ⛔ (greeneryDiscount) | a plant-cost reduction, not a M€ discount; surfaces when the greenery is built (chokepoint) |
| Helion | heat-as-M€ payment modifier | ⛔ | payment-only; saving is "spent heat instead of M€", not a discount delta |
| Interplanetary Cinematics | `onCardPlayed` +2 M€ per event | ✅ | |
| Inventrix | global-param requirement bonus | ⛔ | requirement tolerance, no runtime impact |
| Mining Guild | `onTilePlaced` +1 steel prod | 🟡 | wrap `onTilePlaced` dispatch |
| PhoboLog | declarative titanium value +1 | ⛔ | a value modifier; the gain surfaces when titanium is spent |
| Saturn Systems | `onCardPlayedByAnyPlayer` +1 M€ prod per Jovian | ✅ | |
| Teractor | Earth tags −3 M€ (`cardDiscount`) | ✅ | discount-applied |
| Tharsis Republic | `onTilePlaced` (+3 M€ / +M€ prod on city) | 🟡 | wrap `onTilePlaced` |
| Thorgate | power cards −3 M€ + power-plant std-project −3 | ✅ card discount / 🟡 std-project discount | |
| United Nations Mars Initiative | action: pay 3 → +1 TR | ✅ | action root + TR chokepoint |

### Promo
| Corp | Mechanism | Status | Notes |
| --- | --- | --- | --- |
| Arcadian Communities | action: place community | ✅ action root | tile placement note rides the action |
| Astrodrill | action: asteroid resource ops | ✅ | action root + card-resource/stock chokepoints |
| Factorum | action: energy prod / draw building | ✅ | |
| Kuiper Cooperative | action: +asteroids; asteroid-as-M€ | ✅ action / ⛔ payment-modifier | |
| Mons Insurance | payment/insurance mechanic | 🟡 | cross-player M€ moves recorded via stock chokepoint; dedicated insurance event optional |
| Pharmacy Union | `onCardPlayedByAnyPlayer`/`onNonCardTagAdded` disease+TR | ✅ onCardPlayedByAny / 🟡 onNonCardTagAdded | wrap the non-card-tag dispatch |
| Philares | `onTilePlaced` standard resource on new adjacency | 🟡 | wrap `onTilePlaced` |
| PolderTech (Dutch) | `onTilePlaced` energy/plant | 🟡 | wrap `onTilePlaced` |
| Recyclon | `onCardPlayed` microbe / convert | ✅ | |
| Splice | `onCardPlayedByAnyPlayer` microbe/M€ | ✅ | |
| Tycho Magnetics | action: energy→draw | ✅ | |

### Venus Next
| Corp | Mechanism | Status | Notes |
| --- | --- | --- | --- |
| Aphrodite | +2 M€ when Venus terraformed | 🟡 | Venus bonus flows via stock chokepoint inside `increaseVenusScaleLevel`; attribute precisely when global-param dispatch is wrapped |
| Manutech | `onProductionGain` gains the resource | 🟡 | wrap `Production.add` `onProductionGain` loop |
| Morning Star Inc | Venus requirement bonus + draw | ⛔ requirement / ✅ initial draw | |
| **VIRON** | **action: copy an already-used blue-card action** | **✅** | `copied-action` chain — the reference copy/repeat implementation |

### Colonies
| Corp | Mechanism | Status | Notes |
| --- | --- | --- | --- |
| Aridor | `onCardPlayed`/`onNonCardTagAdded` +M€ prod on new tag | ✅ onCardPlayed / 🟡 onNonCardTagAdded | |
| Arklight | `onCardPlayed`/`onNonCardTagAdded` +animal | ✅ onCardPlayed / 🟡 onNonCardTagAdded | |
| Polyphemos | card buy cost +5 (`cardCost`) | ⛔ | a buy-price modifier, not an analytics discount |
| Poseidon | `onColonyAddedByAnyPlayer` +1 M€ prod | 🟡 | wrap the colony-added dispatch in `Colony.ts` |

### Prelude
| Corp | Mechanism | Status | Notes |
| --- | --- | --- | --- |
| Cheung Shing MARS | building tags −2 M€ | ✅ | discount-applied |
| Point Luna | `onCardPlayed` draw per Earth tag | ✅ | cards-drawn under the trigger |
| Robinson Industries | action: pay 4 → +1 lowest prod | ✅ | |
| Valley Trust | science tags −2 M€ | ✅ | discount-applied |
| Vitor | `onCardPlayed` +3 M€ on VP card | ✅ | |

**Corp summary:** 37 corps. Fully covered now: all 16 `onCardPlayed(ByAnyPlayer)` corps + all action corps
+ all per-card-discount corps + VIRON. Pending Phase-3 (dispatch wraps): the `onTilePlaced` (Mining Guild,
Tharsis, Philares, PolderTech), `onProductionGain` (Manutech), `onColonyAddedByAnyPlayer` (Poseidon),
`onNonCardTagAdded` (Aridor, Arklight, Pharmacy Union), `onStandardProject` (CrediCor, Thorgate) corps —
their impact is already recorded, only the source attribution + trigger marker await the wrap.

## 2. Representative project cards / effects (the same buckets apply to ALL ~200 in-scope cards)

| Card | Type | Status | Event(s) |
| --- | --- | --- | --- |
| Earth Catapult / Research Outpost / Space Station | play discount | ✅ | discount-applied |
| Media Group | `onCardPlayed` +3 M€ on event | ✅ | effect-triggered + resource-changed |
| Decomposers / Ecological Zone / Viral Enhancers | `onCardPlayed` card-resource | ✅ | effect-triggered + card-resource-changed |
| Pets / Immigrant City / Arctic Algae | `onTilePlaced` | 🟡 | wrap `onTilePlaced` |
| Robotic Workforce / Cyberia Systems | copy production on play | 🟡 | impact recorded (attributed to the workforce card); add a `copied-action` marker for "copied from X" |
| Project Inspection | copy a used action | 🟡 | one-line `withCopiedAction` wrap (mirror VIRON) |
| Mars University | `onCardPlayed` discard→draw | ✅ | cards-drawn under the trigger |
| Search For Life / Fish / Tardigrades | accumulate card resource (own action) | ✅ | card-resource-changed under action root |
| any pure-VP card (e.g. Lichen-less scorers) | static `victoryPoints` | ⛔ | endgame scoring only |

## 3. Phase-3 worklist — explicit dispatch wraps (each is a `withEffect` around one loop)

The foundation already records the IMPACT; these wraps fix SOURCE attribution + emit the `effect-triggered`
marker for the remaining passive trigger families. Pattern (already proven for `onCardPlayed`):

```ts
// before
for (const card of player.tableau) card.onTilePlaced?.(p, activePlayer, space, boardType);
// after
for (const card of player.tableau) {
  if (card.onTilePlaced === undefined) continue;
  game.events.withEffect(p, card, 'tile-placed', () => card.onTilePlaced!(p, activePlayer, space, boardType));
}
```

Sites to wrap (one each):
- `Game.triggerForAllCards` callers for `onTilePlaced` (trigger `'tile-placed'`).
- `Production.add` `onProductionGain` loop (trigger `'production-gain'`).
- `Colony.addColony` `onColonyAddedByAnyPlayer` loop (trigger `'colony-added'`).
- `Game.increase{Temperature,Oxygen,VenusScaleLevel}`/`addOcean` `onGlobalParameterIncrease` loops (trigger `'global-parameter'`).
- `StandardProjectCard.onStandardProject` loop (trigger `'standard-project'`).
- `Player.triggerOnNonCardTagAdded` loop (trigger `'card-played'` / a new `'tag-added'`).
- `StandardProjectCard.getAdjustedCost` → emit `discount-applied` per `getStandardProjectDiscount`.
- `ProjectInspection.bespokePlay` + `RoboticWorkforceBase.selectBuildingCard` → `withCopiedAction`.

## 4. Skipped / no-op meaningful events (Phase-3, optional)

Per the proposal §12, record a meaningful SKIP only where analytics cares (no silent noise). Candidates:
- `addResourcesToAnyCard` with no eligible card (the server already detects this — see CLAUDE.md "NO
  SILENT-LOSS"): emit a `card-resource-changed` with `amount: 0` + a `tags:['card-impact']` skip marker.
- A discount source present but inapplicable to the played card: not recorded (no saving) — intentionally
  silent (the absence of a `discount-applied` IS the signal).
- An optional effect the player declined: emit only if the decline is a real choice the analytics should
  count; otherwise skip.
