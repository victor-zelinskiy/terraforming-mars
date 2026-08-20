---
description: MarsBot corporations (Rule Book B) — the registry contract and the add-a-corporation procedure.
paths:
  - "src/server/automa/corps/**"
  - "src/common/automa/MarsBotCorpData.ts"
  - "src/client/components/marsbot/marsBotCorpPremiumVm.ts"
  - "src/client/components/marsbot/marsBotCorpRules.ts"
  - "tests/automa/MarsBot*.spec.ts"
---

# MarsBot corporation rules

**ADDING A CORPORATION IS A CHECKLIST, and it is `docs/claude/marsbot-corporation-checklist.md`** — read it before writing anything here. The subsystem contract is `docs/claude/marsbot-corporations.md`; official rule data is `docs/AUTOMA_DATA_AUDIT.md` §10.

## The five invariants

1. **A MarsBot corporation is its OWN entity.** The `original: CardName` link gives exactly four things — name/logo, art, lore, the selection-collision key (RB-B Setup 1). No human rule (starting M€, first action, human tags, discounts) ever leaks through it, and the guard specs assert that.
2. **The printed card is the source of rules** — the scan of `Automa - C## - <Name>.png`, then RB-B (draft-priority special cases, special cubes, FAQ). An ambiguity is resolved by the sources and pinned by a comment + a test, never invented.
3. **Adding corporation N+1 is FOUR touch points**: the id (`MarsBotCorpId` in `AutomaTypes.ts`, value = the printed card number) · the data entry (`CORP_INFO`) · the co-located behavior file (`MarsBotCorp` hooks) · one line in `AutomaCorporations.REGISTRY`. Plus `renderDataOf` in `marsBotCorpPremiumVm.ts` — its switch is exhaustive, so the compiler asks for it. **A `switch` on the corporation anywhere else is the defect this framework exists to prevent.**
4. **Only the boxes the card prints exist.** No fake Setup/Effect/Draft-Priority sections for symmetry (RB-B: "Not all corporations use all fields").
5. **The bot never receives a prompt.** Every fork resolves deterministically or through the seeded `game.rng`; physics goes through the shared primitives (`AutomaTilePlacer`, `AutomaTerraformer`, `AutomaCardDraw.drawAndResolveProjectCard`, `AutomaResolver.advanceTrack`) so TR, placement bonuses, human triggers, Failed Actions and the journal all behave identically.

## Presentation + state

- Effect INSIDE a bot turn: `events.beginEffect(bot, {kind:'corporation', card: info.original, owner}, 'automa-corporation')` + `AutomaTurnLog.setCause({kind:'corporation'})` with the previous cause restored (`getCause`). Action OUTSIDE a turn (selection, a Before-Action-Phase move): `beginAction(..., {category: 'corporation-action'})`.
- Every meaningful step bumps a counter (`bumpCorpStat`) whose key is documented in `MarsBotCorpStats`; the endgame insight reads STRUCTURED stats, never display text.
- New serialized state is optional and degrades on old saves; a legacy corpless save stays corpless forever (`generation === 1` guard).

## Existing primitives — reuse before inventing

Draft priorities (`mostExpensive` · `mostTags` · `tags` chain · `leastAdvancedTrack`) · **a per-advance effect** (`onTrackAdvance` + the shared `MarsBotTrackPayout` — every successful step, cascades pay per step, a maxed track pays nothing; the trigger is the TRACK, so any tag riding it pays) · **tracker reminders** (`whiteMarkerTracks` + `markerLegend`, presentation only, declared as a PAIR) · **track cubes** (`trackCubes` addressed by the track's TAG, spent-once via `corpCubesTriggered`, dispatched by `AutomaCorporations.onTrackAdvanced`; `'replaces-action'` only where the card says «instead of») · **corp-owned bonus cards** (`corpBonusCards` + `resolveBonusCard`; recurring ones ride `recurringBonusCards`, never the discard — a one-shot one is simply shuffled into `bonusDeck` and lives in the ordinary rotation, C12/B31) · **destroying a bonus-deck card at setup** (C05: clear it from `bonusDeck`/`bonusDiscard`/the generation-1 `actionDeck` slot, which the successor then takes) · **watching BOTH seats** (`onTagResolved` from `AutomaResolver.resolveTag` + `onHumanCardPlayed` from `Player.onCardPlayed` + `onTilePlaced` from `Game.addTile`; each side keeps its printed granularity — a card for the human, a tag for the bot) · **seeding project cards into the BONUS deck** (`bonusDeckSeed`; the deck is typed `Array<AutomaActionCard>` and every draw site branches on `entry.kind`) · **a M€ bank on the card** (`mcBank` + `onMegacreditsGained`, dispatched from the ONE choke point `Stock.add`; drain in a LOOP and expect re-entrancy) · **a printed ladder shared with another card** (`AutomaNearBonusPush` — B06/B15/B25 keep ONE implementation, each card owns only its fate and its fallback) · **a partially resolved card** (`resolveProjectCard(..., {tagLimit})` — C11: only the first printed tag advances a track, the card is still fully played) · **a resource on the corp card** (`resource` + the ordinary `.pcard__res` capsule) · **a printed PRICE the card charges** (an ordinary `stock.deduct`; the WORDING is the rule — «up to X» is partial, «X, if able» is all-or-nothing, and neither is a Failed Action; two printed sentences are INDEPENDENT and resolve in printed order, so the action may fund its own price — C15/B28).

## Tests + verification

A corporation is done when: its own `tests/automa/MarsBot<Name>.spec.ts` covers every printed effect (positive AND negative), the interaction with the shared rules (maxed → Failed Action, regression markers), serialization + an OLD save without the new field, and the identity/no-human-leak assertions; the client face spec has its branch; RU keys exist (grep for duplicates first, then `make:json`); and `build:server`, `build:test`, `lint:client`, `eslint`, `test:server`, `test:client` are all green. A new VISIBLE element additionally needs an e2e probe whose config forces `customCorporationsList` without that corporation's original (`seed` is ignored, so the collision rule can legitimately hand the bot a different corp).
