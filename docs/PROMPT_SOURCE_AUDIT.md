# Prompt SOURCE audit — «почему этот промт пришёл ко мне?»

The player must always be able to answer two questions about any prompt on
screen: **who asked** (which card / corporation / rule) and **why now**. A
prompt that answers neither is the single worst failure mode of a triggered
effect — worse when it fires on somebody *else's* turn.

This audit is the successor of [CHOICE_CONTEXT_AUDIT.md](CHOICE_CONTEXT_AUDIT.md)
§"Documented remaining gaps (phase 2)": that doc covers `OrOptions` prompts and
the desktop contextual modal; this one covers **every prompt shape** and the
**console-native** surfaces.

---

## The contract (what already exists)

| Layer | Where |
| --- | --- |
| Markers on `BaseInputModel` — `choiceContext.source/trigger`, `placementContext.source`, `discardPrompt.source`; `SelectProductionToLoseModel.source` is a parallel typed field | `src/common/models/PlayerInputModel.ts` |
| `BasePlayerInput.markChoiceContext()` / `markPlacementContext()` / `markDiscardPrompt()` — **type-agnostic**, every input class inherits them | `src/server/PlayerInput.ts` |
| Central serialization (keyed on the field being set, never on `waitingFor.type`) | `src/server/models/ServerModel.ts` (`Server.getWaitingFor`) |
| Co-located builders `cardEffect` / `attackEffect` / `effectChoice` / `systemChoice` / `namedCardEffect` | `src/server/inputs/choiceContext.ts` |
| ONE copy source for the console (`kickerKey` / `ask` / **`sourceCard`**) — feeds the deferred band, the command bar and the task-host kicker | `src/client/console/consoleTaskSummary.ts` |
| Compact source dock + `L3 ИСТОЧНИК` (any kind but `choice`); full dock + `X` for a `choice` | `ConsoleTaskHost.vue` (`.con-task__source`) |
| Full source dock + `X` | `ConsoleEffectDecision.vue` (`.con-decision__source`) |
| Source chip (`◈ ИСТОЧНИК · <карта>` + L3) / full source card | `ConsoleRevealOverlay.vue` (`.con-reveal__source-chip`, `.con-reveal__source`) |
| Source line on the pending band | `ConsoleMandatoryAnnounce.vue` (`.con-mandatory__src`) |

**Inspection grammar** (console-wide, CLAUDE.md): *X inspects the CURRENT
object; L3 inspects the SOURCE that produced it.* A `choice` keeps **X** — there
the card IS what is being decided about. Every other kind (a dial, a list, a
distribution) gets **L3**: the card merely produced the prompt.

---

## DONE (2026-08-01)

| # | Fix | Files |
| --- | --- | --- |
| 1 | **Philares** — its `SelectResources` now carries `choiceContext` (`cardEffect(this, …, 'reward')`) with a trigger naming *which* placement fired it, in two gender-neutral phrasings (own tile / an opponent's tile). | `src/server/cards/promo/Philares.ts`, `src/locales/ru/play_prompts.json` |
| 2 | **Console task host** — `standaloneSourceCard` / `sourceHint`: the source dock renders **compact** and `L3 ИСТОЧНИК` is published for `distribute` · `resource` · `amount` · `player` · `payment` · `cardSelect`; the fullscreen viewer names its role (`statusLabel: 'Source'`). No local badge under the card — the verb lives in the ONE command bar. | `ConsoleTaskHost.vue`, `src/styles/console.less` |
| 3 | **`sourceCardOf` read `discardPrompt.source`** — the hand screen's own header already did; the chip / bar / kicker did not, so a *deferred* Mars University discard sat on the board home as an anonymous «Сброс карты». | `consoleTaskSummary.ts` |
| 4 | **Dead `L3 Источник` on the mandatory hand pick** — `contextualSourceCard` was hard-scoped to `handPickActive` (the client bridge), while the footer branch that advertised the verb required `handSelectTaskActive`. The two flags are mutually exclusive, so the hint could never resolve a card. Now the SERVER's own hand prompt resolves its source through the summary. | `ConsoleShell.vue` |

Guards: `tests/cards/promo/Philares.spec.ts` (both trigger phrasings + the
marker), `tests/client/components/console/consoleTaskSummary.spec.ts`
(distribute + discard rows), `tests/e2e/console-prompt-source.spec.ts` (the
compact dock, the trigger line, `L3` → fullscreen → the prompt survives).

---

## GAP TABLE — server: prompts that name no source

Ranked by how likely a player meets it. Scope note: the fork's premium scope is
`base`, `corpera`, `promo`, `venus`, `colonies`, `prelude`, `ares`.

### A. Shared deferred helpers that already HOLD the card and drop it

The highest-leverage work: one parameter each, plus threading `card` from
`Executor.execute(behavior, player, card)` — which has it in scope at **every**
relevant branch. `DiscardCards.ts` (an explicit `options.source` defaulting to
`{kind:'system'}`) and `SelectProductionToLoseDeferred` (a typed `source`) are
the two models to copy.

| Helper | Callers in scope | Prompt the player sees |
| --- | --- | --- |
| `deferredActions/AddResourcesToCard.ts` | `Executor.ts:497` (`addResourcesToAnyCard` — has `card`), `colonies/EcologyResearch.ts`, `colonies/Colony.ts:348,352` (has the colony), `cards/gainOrAddResource.ts:118`, ~25 more | «Выберите карту, чтобы добавить N …» |
| `deferredActions/RemoveResourcesFromCard.ts` | Ants, Predators, Virus, Air Raid — all pass `this` today | «Выберите карту, чтобы убрать N …» |
| `deferredActions/GainAnyResourceButScienceDeferred.ts` | (underworld today; shared code) | **«Выберите вариант»** — the most context-free title in the codebase |
| `deferredActions/SelectPaymentDeferred.ts` | `Executor.ts:338`, `AresHandler.ts:301`, placement-bonus payments | source only ever as *translatable text* in `options.title` — no structural path at all |
| `deferredActions/AddResourcesToCards.ts` | pathfinders (frontier) | the wrapping `AndOptions` has **no title at all** |

### B. In-scope prompts with no marker

| Rank | Module | Where | Prompt |
| --- | --- | --- | --- |
| 1 | promo | ~~`Philares.ts:82`~~ | ✅ **done** |
| 2 | shared | `StealResources.ts:122`, `RemoveAnyPlants.ts:151`, `DecreaseAnyProduction.ts:72` | attack pickers — rich per-target chips already, only the source card missing |
| 3 | base/colonies/venus | `Executor.ts:327` (`behavior.or`) — 15 in-scope cards | «Выберите вариант» when the batch does not pre-collect it (undo / divergence) |
| 4 | ares | `DesperateMeasures.ts:42` | a bare `new SelectSpace(...)` bypassing `createMarsSelectSpace` → **neither** `placementContext` **nor** `sourceCard` |
| 5 | colonies | `Colony.ts:527` (opponent discard), `Colony.ts:366` (`COPY_TRADE`) | the colony is known one call up (`events.withSource`) and dropped |
| 6 | colonies | `MarketManipulation.ts:87,95` | self-played, so context is implicit — lowest priority |

Frontier mirrors of #4: `community/Eris.ts:102`, `moon/HostileTakeover.ts:71,80`.
`RemoveOceanTile.ts:21` bakes the source into the *title string* (not
translation-safe, not client-routable).

---

## GAP TABLE — console: surfaces that don't show what the server already sends

| # | Surface | State |
| --- | --- | --- |
| C1 | **`ConsoleProductionLoss.vue`** | shows the source as **plain text** (`{{ $t(sourceCard) }}`), no card face, no inspect — `openConsoleCardZoom` isn't even imported. The closest sibling of the fixed Philares case and the obvious next one. |
| C2 | **Tile-placement banner** | `PlacementContext.source` exists and `consoleTaskSummary` reads it, but `ConsoleShell.bannerText()` returns a hardcoded «Выберите место на поле» — the placing card is never named on the board. |
| C3 | **`ConsoleMandatoryAnnounce`** | names the source as text (correct for a band) but offers no inspect. Acceptable as-is: **A** opens the decision, where the dock now lives. |
| C4 | **Colony pick** | no source concept at all; `consoleTaskSummary`'s `colony` case carries `sourceCard` and nothing reads it. |
| C5 | **Three parallel source *visual* languages** | full dock (`0.9`/`0.92` zoom) · compact dock (`0.68` of the dock) · chip-button. Deliberate today (subject vs context vs metadata), but worth one shared mixin before a fourth appears. |
| C6 | **Two parallel source *reads*** | `ConsoleTaskHost.sourceCardName` re-derives `choiceContext.source.card` instead of consuming `consoleTaskSummary(...).sourceCard`. A future marker must be added in both places (this is exactly how `discardPrompt.source` leaked). |

## GAP TABLE — console: prompts with NO premium adaptation at all

`consoleTaskRouter`'s own red list (`tests/client/components/console/consoleTaskRouter.spec.ts`)
— these fall through to the **desktop** modal inside the console shell:

| Kind | What actually lands there | Scope |
| --- | --- | --- |
| `composite` | **Stormcraft Incorporated** spend-heat (`colonies`) and the **Venus alt-track bonus** (`venusNext`, `GrantVenusAltTrackBonusDeferred`) — both marked, both with a premium **desktop** modal (`SpendHeatContent` / `VenusBonusContent`), neither with a console-native one | **IN SCOPE** |
| `aresGlobal` | `ShiftAresGlobalParameters` | in scope (ares) |
| `unknown` | `delegate` / `party` / `globalEvent` / `claimedUndergroundToken` | frontier (turmoil, underworld) |

The two in-scope `composite` prompts are the biggest console-native hole this
audit found that is *not* about attribution.

---

## Suggested order

1. **C1** — production loss gets the compact dock + L3 (same pattern as #2, one surface).
2. **A** — thread `source` through `AddResourcesToCard` / `RemoveResourcesFromCard` /
   `GainAnyResourceButScienceDeferred` + `Executor`. One cross-cutting change,
   closes B#2 and B#3 with it.
3. **`composite`** — console-native Venus bonus + spend heat.
4. **C2** — the placement banner names its card.
5. **B#4/#5/#6**, then **C4**, then the **C5/C6** consolidation.
