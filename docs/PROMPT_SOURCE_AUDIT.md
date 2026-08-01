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
| `cause` — the SOURCE half every SHARED deferred helper now takes (`cardSource` / `namedCardSource` / `colonySource`) | `src/server/inputs/choiceContext.ts` |
| ONE normalizer of all four server shapes → `PromptSourceView` | `src/client/console/promptSource.ts` |
| ONE copy source for the console (`kickerKey` / `ask` / **`sourceCard`**) — feeds the deferred band, the command bar and the task-host kicker; reads the normalizer | `src/client/console/consoleTaskSummary.ts` |
| **THE source dock** — one component, two sizes, card-or-plate | `ConsoleSourceDock.vue` (`.con-src`, `src/styles/console_source.less`), registered GLOBALLY as `console-source-dock` in `main.ts` |
| Source chip (`◈ ИСТОЧНИК · <карта>` + L3) / full source card | `ConsoleRevealOverlay.vue` (`.con-reveal__source-chip`, `.con-reveal__source`) |
| Source line on the pending band | `ConsoleMandatoryAnnounce.vue` (`.con-mandatory__src`) |

**Why the dock is a GLOBAL component, not an import.** It renders the real card
face, and a static import of that chain drags `CardHelp.vue`'s
`import('markdown-it')` into the importing component's webpack graph — which
mochapack cannot emit, so any component spec that mounts such a surface silently
reports "0 passing" and stops guarding anything (this is exactly what happened to
`ConsoleProductionLossView.spec.ts` on the first attempt). Same trick, same
reason as `action-target-card` / `premium-card-face`. A surface adopting the dock
stubs `'console-source-dock'` in its spec.

**Inspection grammar** (console-wide, CLAUDE.md): *X inspects the CURRENT
object; L3 inspects the SOURCE that produced it.* A `choice` keeps **X** — there
the card IS what is being decided about. Every other kind (a dial, a list, a
distribution) gets **L3**: the card merely produced the prompt.

---

## DONE (2026-08-01)

### Wave 1 — Philares, and the console's source verbs

| # | Fix | Files |
| --- | --- | --- |
| 1 | **Philares** — its `SelectResources` now carries `choiceContext` (`cardEffect(this, …, 'reward')`) with a trigger naming *which* placement fired it, in two gender-neutral phrasings (own tile / an opponent's tile). | `cards/promo/Philares.ts`, `locales/ru/play_prompts.json` |
| 2 | **Console task host** — `standaloneSourceCard` / `sourceHint`: the dock renders **compact** and `L3 ИСТОЧНИК` is published for `distribute` · `resource` · `amount` · `player` · `payment` · `cardSelect`; the fullscreen viewer names its role (`statusLabel: 'Source'`). No local badge under the card — the verb lives in the ONE command bar. | `ConsoleTaskHost.vue` |
| 3 | **`sourceCardOf` read `discardPrompt.source`** — the hand screen's own header already did; the chip / bar / kicker did not, so a *deferred* Mars University discard sat on the board home as an anonymous «Сброс карты». | `consoleTaskSummary.ts` |
| 4 | **Dead `L3 Источник` on the mandatory hand pick** — `contextualSourceCard` was hard-scoped to `handPickActive` (the client bridge), while the footer branch that advertised the verb required `handSelectTaskActive`. The two flags are mutually exclusive, so the hint could never resolve a card. | `ConsoleShell.vue` |

### Wave 2 — ONE premium language

| # | Fix | Files |
| --- | --- | --- |
| 5 | **The shared SOURCE DOCK.** Four visual answers to one question (a full card at 0.9 / at 0.78 / at 0.92, and a bare ◈-and-a-name text chip that could not be inspected) collapse into ONE component with two sizes: `full` when the card IS the subject, `compact` when it merely produced the prompt. A NON-card source (a colony bonus, an Ares hazard, a game rule) keeps the dock's shape and swaps the card for a named plate — never an empty column, never silence. | `ConsoleSourceDock.vue`, `console_source.less`, `promptSource.ts`, `main.ts` |
| 6 | **`ConsoleProductionLoss` adopts it** — a card attack now renders the real premium card face + `L3 ИСТОЧНИК`; an Ares hazard renders the plate + its rule in the board's own hazard accent, and the bar honestly offers NO source verb (there is nothing to open). The old chip named a card and gave no way to read it. | `ConsoleProductionLoss.vue`, `console_production_loss.less` |
| 7 | **`ConsoleTaskHost` + `ConsoleEffectDecision` adopt it** — their per-surface source rule sets are deleted, so there is no copy left to drift. | both `.vue`s, `console.less`, `console_effect_decision.less` |
| 8 | **`ChoiceContextSource.name`** — a non-card source can finally say WHICH colony / project, instead of the bare kind. | `PlayerInputModel.ts` |

### Wave 3 — the shared deferred helpers (server)

Every one of these is reused by dozens of cards and could only learn its cause
from the caller. Each now takes **`cause?: ChoiceContextSource`** (deliberately
not `source` — `RemoveResourcesFromCard` already uses that for "take from
whom"), and marks **every** prompt shape it can return, including the `OrOptions`
wrappers: the client reads the marker off the TOP-LEVEL prompt, so marking one
branch and not the others leaves the prompt anonymous anyway.

| Helper | Now marks |
| --- | --- |
| `AddResourcesToCard` | the card picker (`reward`) |
| `AddResourcesToCards` | the distribution — **and got a title at all**; it shipped with a blank header over a column of bare card names |
| `RemoveResourcesFromCard` | the picker + both `OrOptions` wrappers (`attack`, or `effect-choice` for a self-cost) |
| `GainAnyResourceButScienceDeferred` | the bare «Выберите вариант» — the most context-free prompt in the codebase |
| `SelectPaymentDeferred` | the payment (its only previous channel was a **translatable** title, which the client is forbidden to parse) |
| `StealResources` · `RemoveAnyPlants` · `DecreaseAnyProduction` | the target pickers (`attack`) |

Threaded from **`Executor`** (which had `card` in scope at every branch and passed
none of it): `addResourcesToAnyCard`, `decreaseAnyProduction`, `removeAnyPlants`,
`spend.megacredits`, `behavior.or`, and both `standardResource` shapes — the
declarative twin of the Philares payout. Plus the in-scope direct callers: Ants,
Predators, Virus (its composed two-tab prompt), Air Raid, Stratospheric Birds,
Ecology Research, Jupiter Floating Station, Titan Floating Launch Pad, Titan
Shuttles, Survey Card, `gainOrAddResource`, and `Colony.ts` — where the colony
was already known one call up (the event source) and dropped, so a colony bonus
now names itself («КОЛОНИЯ · Ганимед») instead of handing over an unexplained
picker.

**Guards.** `tests/cards/promo/Philares.spec.ts` (both trigger phrasings + the
marker) · `tests/deferredActions/promptCause.spec.ts` (every shared helper, incl.
the colony source and the backward-compatible unmarked case) ·
`tests/client/components/console/promptSource.spec.ts` (all four server shapes →
one view) · `consoleTaskSummary.spec.ts` (distribute + discard rows) ·
`ConsoleProductionLossView.spec.ts` (card vs hazard vs no source, and the verb
that follows) · `tests/e2e/console-prompt-source.spec.ts` (both surfaces over the
real DOM: dock, trigger line, `L3` → fullscreen → the prompt survives, the
deferred band).

Verified: `npm run test:server` 8380 passing · `build:test` clean · `lint` clean ·
e2e `console-prompt-source` + `console-effect-decision` + `console-card-discard` +
`console-hazard-placement` all green.

---

### Wave 4 — the last prompts with no console-native surface, and the board

| # | Fix | Files |
| --- | --- | --- |
| 9 | **`budgetLanes.ts`** — ONE stepper engine for "spread a fixed budget across lanes". Two prompts that look nothing alike are the same machine: the Venus bonus places EXACTLY N over six resources; Stormcraft COVERS N heat with heat (1 each) and floaters (2 each). The no-overspend rule is stated once, over lanes — it reproduces both of the server's hardcoded "you cannot overspend heat / floaters" checks and would cover a third payment lane for free. | `budgetLanes.ts` |
| 10 | **`ConsoleVenusBonus`** — the reward, as ONE FLOW: the 30 % step asks where its WILD resource goes, then opens the same lanes, with the breadcrumb tail advancing and B stepping one level back. The wild's destination stays visible through the placement; a branch with no eligible card is shown with its reason, never dropped (losing a reward silently is the worst possible outcome). | `ConsoleVenusBonus.vue` |
| 11 | **`ConsoleSpendHeat`** — framed as what it IS, a payment: one bill, live coverage, and a confirm that only lights when the bill is covered without waste. Names Stormcraft through the shared dock (the card is now marked server-side). | `ConsoleSpendHeat.vue`, `StormCraftIncorporated.ts` |
| 12 | **`ConsoleAresGlobals`** — the planetary-event thresholds, diegetic: the expansion's name never appears, each row states its CONSEQUENCE beside the number, °C moves two per step, a threshold that already fired is absent rather than greyed, and «без изменений» is presented as the real answer it is. | `ConsoleAresGlobals.vue` |
| 13 | **The placement panel names who is placing.** `placementContext.source` has been on the wire since the marker existed and nothing read it. The panel is ~17rem wide with a variable-height consequences preview, so the source costs ONE LINE — the shared dock in a new `chip` layout, reusing the plate rather than inventing a fifth vocabulary. | `ConsoleContextPanel.vue`, `ConsoleSourceDock.vue`, `ConsoleShell.vue` |

**The button split, and why it is X.** Every other surface gives L3 to the
source because L3 is idle there. During a placement L3 is `handleNextJump` —
the cell-to-cell navigation verb — and taking it would be a regression. X was
the one inert button (every `inspect` branch requires `!placementActive`), and
it is also the RIGHT button by the console's own grammar: nothing has committed
yet, so the card placing this tile IS the current object («pre-commit the source
IS the current object: X = source, no L3»).

Guards: `tests/client/components/console/compositePrompts.spec.ts` (the engine's
exact/cover rules, incl. the two overspend cases, plus response BYTE-PARITY for
all three shapes) · `consoleTaskRouter.spec.ts` (the marker outranks the type;
the red list shrank to `composite` + `unknown`) · `consoleTaskSummary.spec.ts` ·
`tests/e2e/console-composite-surfaces.spec.ts` and
`tests/e2e/console-placement-source.spec.ts` (all four over the real DOM: the
workspace band, the ONE command bar, the desktop modal gone, the chip's cost in
pixels, X → fullscreen → the placement survives).

---

## WHAT REMAINS — server

Scope note: the fork's premium scope is `base`, `corpera`, `promo`, `venus`,
`colonies`, `prelude`, `ares`.

| Rank | Module | Where | Prompt |
| --- | --- | --- | --- |
| 1 | ares | `DesperateMeasures.ts:42` | a bare `new SelectSpace(...)` bypassing `createMarsSelectSpace` → **neither** `placementContext` **nor** `sourceCard`. Every other placement in the game gets at least the committed-default fallback. |
| 2 | colonies | `MarketManipulation.ts:87,95` (`SelectColony` ×2) | self-played, so the context is implicit — lowest priority. |
| 3 | shared | `SelectResourceTypeDeferred.ts:19`, `IncreaseColonyTrack.ts:30` | same shape as the wave-3 helpers; exercised today only by colony/turmoil trade bonuses, and `IncreaseColonyTrack` at least names the colony in its title. |
| 4 | frontier | `community/Eris.ts:102`, `moon/HostileTakeover.ts:71,80` (mirrors of #1); `RemoveOceanTile.ts:21` bakes the source into the *title string* — readable, but not translation-safe and not client-routable. | adapt with their expansion |

Everything else the audit found is done — see waves 1–3 above.

## WHAT REMAINS — console

| # | Surface | State |
| --- | --- | --- |
| C3 | **`ConsoleMandatoryAnnounce`** | names the source as text (correct for a band) but offers no inspect. Acceptable as-is: **A** opens the decision, where the dock lives. |
| C4 | **Colony pick** | no source concept at all; `consoleTaskSummary`'s `colony` case carries `sourceCard` and nothing reads it. |
| C5 | **`ConsoleRevealOverlay`'s two source shapes** | deliberately NOT folded into `.con-src`: the drawn-mode chip is header metadata (not a dock) and the result-mode card is a motion ANCHOR (`data-motion-anchor` / `data-zoom-slot`) that the composer FLIPs into. Same vocabulary, different job — revisit only if a third shape appears. |
| C6 | **The Venus bonus has no source of its own** | it is a TRACK reward, not a card's, and the surface's own identity («БОНУС ВЕНЕРЫ») answers "why". A plate reading «ПРАВИЛО ИГРЫ · Шкала Венеры» would be noise; revisit only if the scale step itself becomes inspectable. |

## WHAT REMAINS — prompts with NO console-native surface

`consoleTaskRouter`'s own red list (`tests/client/components/console/consoleTaskRouter.spec.ts`)
— what still falls through to the **desktop** modal inside the console shell:

| Kind | What lands there | Scope |
| --- | --- | --- |
| `composite` | an UNMARKED `and`. The two that mattered (Stormcraft's spend-heat, the Venus alt-track bonus) are marked and now native — this is the honest carve-out for a shape nobody has described yet. | — |
| `unknown` | `delegate` / `party` / `globalEvent` / `claimedUndergroundToken` | frontier (turmoil, underworld) |

`aresGlobal` left this list in wave 4.

---

## Suggested order (what's left)

1. Server #1 — **Desperate Measures** builds a bare `SelectSpace` outside
   `createMarsSelectSpace`, so it is the ONE placement with no marker at all;
   the panel now shows a source for every other one.
2. Server #2/#3 (Market Manipulation, the two remaining shared helpers).
3. **C4** — the colony pick reads the `sourceCard` it is already handed.
4. The frontier `unknown` kinds, with their expansions.

## Adding a new prompt — the checklist

1. Server: attach a marker at construction. A card-specific prompt →
   `.markChoiceContext(cardEffect(this, <trigger>, <mode>))`. A SHARED helper →
   take `cause?: ChoiceContextSource` and mark **every** prompt shape it can
   return (the `OrOptions` wrappers included — the client reads the top-level
   prompt only).
2. Never a title sniff: `Message.message` is rewritten in place by i18n.
3. Client: nothing, if the marker is one of the four `promptSource.ts` already
   reads. A NEW marker shape goes in there — one place, and the dock / the chip /
   the command bar / the deferred band all pick it up.
4. A surface that renders the dock stubs `'console-source-dock'` in its spec.
