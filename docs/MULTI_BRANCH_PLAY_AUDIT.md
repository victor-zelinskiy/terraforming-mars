# Multi-branch on-play choices — "no hidden auto-select" audit

**Problem class.** A project card offers the player MULTIPLE alternative outcome
branches on play — e.g. *Imported Hydrogen*: "gain 3 plants **OR** add 3 microbes
to a card **OR** add 2 animals to a card". When some branches were unavailable
(the player has no card that can hold animals/microbes), the card's
`bespokePlay`/`play` silently OMITTED those options and auto-resolved the remaining
one. The premium play modal then showed only the default branch — hiding the
alternatives and never explaining *why* they were unavailable. (Screenshot report:
playing Imported Hydrogen with no animal/microbe cards showed only the payment.)

**Fix principle.** If a card has alternative outcome branches, the play modal shows
EVERY branch. Impossible branches are shown DISABLED with a clear reason + their
result. The chosen available branch (and its target pick) is pre-collected in the
modal before the single submit — never a silent fallback, never a post-confirm
surprise.

## Reusable mechanism (so this never regresses per-card)

| Piece | Where | What it does |
| --- | --- | --- |
| `gainOrAddResource.ts` | `src/server/cards/` | ONE drift-free builder: `gainOrAddResourceChoice` (live `OrOptions`) + `gainOrAddResourceBranches` (the matching `orBranches` preview). Both from one spec, so the live choice and the modal preview can't disagree. Resource→title/label/reason maps live here. |
| `Priority.PLAY_CARD_RESOURCE_CHOICE` | `src/server/deferredActions/Priority.ts` | New priority just BEFORE `PLACE_OCEAN_TILE`. Cards that ALSO place a tile (`behavior.ocean`) defer the choice + its `AddResourcesToCard` target pick here, so they resolve AHEAD of the ocean and the modal can batch-collect them (the ocean then rides PlacementBanner). Independent effects → identical outcome, only the prompt order (choice → tile) changes. |
| Persistent branch list | `HandCardPaymentContent.vue` | `showBranchList` now shows for ANY multi-branch preview and STAYS visible after a pick (every alternative — incl. disabled-with-reason — stays on screen). The sole AVAILABLE branch auto-selects so its result shows immediately while the alternatives stay visible; with 2+ available branches the player chooses (no hidden auto-select). |
| Disabled-branch render | `HandCardPaymentContent.vue` (pre-existing) | A `!available` branch renders dimmed + dashed with `unavailableReason`; its result chip still shows. |

The play modal already rendered `orBranches` previews (CrashSiteCleanup was the
2-branch reference) and per-branch target-pick STEPS (inline `ActionTargetCard` /
board pick-mode / impact preview). This change makes the branch list PERSISTENT and
routes the three flagship cards through the shared builder; no new modal input type
was needed.

## Worklist — every in-scope card audited

In-scope modules: `base`, `corpera`, `promo`, `venus`, `colonies`, `prelude`.

| Card | Module | Shape | Had the bug? | Fix |
| --- | --- | --- | --- | --- |
| **Imported Hydrogen** | base | gain 3 plants / add 3 microbes / add 2 animals (+ ocean) | **YES** — auto-gained plants, hid microbe+animal | **FIXED** — `gainOrAddResource`; choice deferred ahead of the ocean; all 3 branches shown |
| **Large Convoy** | base | gain 5 plants / add 4 animals (+ draw 2 + ocean) | **YES** — auto-gained plants, hid animal | **FIXED** — same; draw 2 shown on each branch |
| **Local Heat Trapping** | base | −5 heat → gain 4 plants / add 2 animals | **YES** — auto-gained plants, hid animal | **FIXED** — `orBranches` via the shared builder; −5 heat shown on each branch (no ocean → no reorder) |
| CrashSiteCleanup | promo | gain 1 titanium / gain 2 steel | No — both always available | (reference correct pattern) |
| EcologyResearch | colonies | add 1 animal AND add 2 microbes (both, not OR) | No — both surface (with their pickers) | already correct |
| VenusianPlants | venus | add 1 microbe/animal to a Venus card | No — ONE `SelectCard`; the chosen card's type decides the resource (not competing branches) | already correct |
| FreyjaBiodomes | venus | add 2 microbes/animals to a Venus card | No — same single-`SelectCard` shape as VenusianPlants | already correct |
| AirScrappingExpedition | venus | add 3 floaters to a Venus card | No — single target pick, no alternative | already correct |
| Atmoscoop | venus | raise temperature 2 / Venus 2 (+ 2 floaters) | No — both shown; a maxed parameter shows as a fixed chip via the existing hook | already correct |
| Sabotage / AirRaid / StealResources / Hackers / … (attacks) | various | choose a target / a resource | No — disabled TARGETS shown via `setDisabledOptions` / `disabled` metadata | already correct |

**Conclusion:** exactly three cards matched the bug class; all three are fixed
through the shared, reusable `gainOrAddResource` mechanism. The other multi-outcome
cards either already show all options (CrashSiteCleanup, Atmoscoop, the attacks) or
are single-pick cards whose "or" is the destination card's type, not a competing
branch (VenusianPlants, FreyjaBiodomes, AirScrappingExpedition, EcologyResearch).

## To add a new gain-or-add card

1. Define `GAIN` (the always-available fallback) + `ADDS` (the card-resource
   alternatives) as `GainSpec` / `AddSpec`.
2. `bespokePlay`: if `!hasAddTarget(player, ADDS)` gain the fallback directly; else
   `player.defer(gainOrAddResourceChoice(player, GAIN, ADDS), Priority.PLAY_CARD_RESOURCE_CHOICE)`
   when the card also places a tile (otherwise return / spendHeat-wrap it).
3. `cardPlayPreview`: `return gainOrAddResourceBranches(player, this, GAIN, ADDS, {prefixEffects})`.
4. If a new card-resource is involved, add its title/label/reason to the maps in
   `gainOrAddResource.ts` (and the ru keys in `play_prompts.json`).

## Tests

- `tests/cards/base/ImportedHydrogen.spec.ts`, `LargeConvoy.spec.ts`,
  `LocalHeatTrapping.spec.ts` — live flow (each branch + always-ask target picker).
- `tests/models/cardPlayPreview.spec.ts` → "gain-or-add-to-card multi-branch" —
  the preview branches (disabled-with-reason, indices, target steps) + the critical
  end-to-end test that the choice + target resolve BEFORE the ocean.
- `tests/models/cardPlayPreviewCoverage.spec.ts` — the three cards have hooks, so
  coverage stays green.
