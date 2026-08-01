# Contextual Choice Modal — audit & status

This documents the systemic rework that replaces context-less "Выберите вариант"
(`Select one option`) modals with the premium **ContextualChoiceContent** modal
(source card + trigger + rich per-option result chips).

## What was built (infrastructure)

| Layer | File |
| --- | --- |
| Model marker `ChoiceContext` (`source` + `trigger` + `mode`) on `BaseInputModel`; `OptionMetadata.effects/tradeoff/description` | `src/common/models/PlayerInputModel.ts` |
| `PlayerInput.choiceContext` + `markChoiceContext()` chainable | `src/server/PlayerInput.ts` |
| Central serialization (next to `startGamePrompt` / `awardFundingPrompt`) | `src/server/models/ServerModel.ts` (`Server.getWaitingFor`) |
| Co-located builders `cardEffect` / `attackEffect` / `effectChoice` / `systemChoice` / `namedCardEffect` | `src/server/inputs/choiceContext.ts` |
| Per-option chip builders `chip` / `trChip` / `optionResult` | `src/server/inputs/optionMetadata.ts` |
| Premium modal (2-column: source card + trigger, wraps the header-suppressed ModernOptionPicker) | `src/client/components/modalInputs/ContextualChoiceContent.vue` |
| `ModernOptionPicker` renders `effects`/`tradeoff`/`description`; `hideHeader` prop | `src/client/components/modalInputs/ModernOptionPicker.vue` |
| Routing (`or` + `choiceContext` → ContextualChoiceContent) | `src/client/components/modalInputs/ModalInputHost.vue` |
| Styles | `src/styles/contextual_choice.less`, `src/styles/modal_inputs.less` |
| Dev playground scenarios + `contextual` tag | `src/client/components/modalInputs/ModalInputPlayground.vue` (`?modalPlayground`) |
| i18n | `src/locales/ru/ui.json` |

**Routing rule:** a TOP-LEVEL `OrOptions` that carries `choiceContext` → `ContextualChoiceContent`.
A plain `OrOptions` (no context) still renders via `ModernOptionPicker` (unchanged).
Everything is backward-compatible — nothing breaks without the marker.

## Scope

In-scope modules (the fork's standing scope): `base`, `corpera`, `promo`, `venus`, `colonies`, `prelude`.

The gap this rework targets is the **context-less generic modal** — an `OrOptions`
of text `SelectOption`s that appears as a TOP-LEVEL prompt with no source/trigger.
That happens for **triggered effects**, **on-play bespoke choices not pre-collected
elsewhere**, and **deferred actions**. Two large categories are ALREADY premium and
do NOT hit the generic modal (see "Already premium" below).

## Status — enriched (DONE)

| Card | Trigger | File |
| --- | --- | --- |
| **Pharmacy Union** (×2: face-down / do-nothing AND order-of-resolution) | science tag, no diseases | `src/server/cards/promo/PharmacyUnion.ts` |
| **St. Joseph of Cupertino Mission** | a Cathedral built in your city → buy a card | `src/server/cards/promo/StJosephOfCupertinoMission.ts` |
| **Olympus Conference** | science tag → add/remove science | `src/server/cards/base/OlympusConference.ts` |
| **Splice** | microbe tag → microbe/M€ | `src/server/cards/promo/Splice.ts` |
| **Recyclon** | building tag → microbe / plant prod | `src/server/cards/promo/Recyclon.ts` |
| **Viral Enhancers** | plant/microbe/animal tag → resource/plant | `src/server/cards/base/ViralEnhancers.ts` |
| **Mars University** | science tag → discard to draw / nothing | `src/server/cards/base/MarsUniversity.ts` |
| **Neptunian Power Consultants** | ocean placed → pay / decline | `src/server/cards/promo/NeptunianPowerConsultants.ts` |

Each shows: source card preview, a translated trigger line, per-option result chips
(`+3 TR`, `+1 card`, `−2 microbes`, …), and — where relevant — the **tradeoff/price**
(Pharmacy Union's "card turned face down"). The "do nothing" option is a calm skip.

### A PAID branch is a LEAF option, never a nested `SelectPayment`

An option whose price is a FIXED amount (St. Joseph's «pay 2 M€ to draw a card») is
built as a `SelectOption` + `optionResult({effects: […]})`, and its callback defers a
`SelectPaymentDeferred`. Three reasons, all of them user-visible:

1. **One press decides.** A nested `SelectPayment` sitting in the `OrOptions` makes the
   row a WIZARD STEP (the console draws a `›`, the desktop expands a sub-panel) — the
   player opens a payment screen with nothing to dial and confirms twice.
2. **The chips can exist at all.** `metadata` lives on `SelectOption`; a `SelectPayment`
   model carries none, so the paid branch rendered as bare text next to its own
   metadata-rich siblings.
3. **The payment still happens correctly.** `SelectPaymentDeferred` auto-pays when M€
   is the only way and prompts ONLY when the player genuinely has a choice (Helion
   heat, Luna Trade Federation titanium) — the dial appears exactly when it means
   something.

Build the offer LAZILY (`player.defer(() => …)`) when the numbers describe ANOTHER
player: the affordability gate and the `current → resulting` wallet chip must be
PROMPT-TIME truth, not "whatever was true inside the acting player's resolution".

## Already premium — NOT a generic-modal gap (no change needed)

- **Blue-card / corporation `action()` choices** (AsteroidRights, Astrodrill,
  BioPrintingFacility, CometAiming, DirectedImpactors, EnergyMarket, Factorum,
  IcyImpactors, ExtremeColdFungus, JupiterFloatingStation, RedSpotObservatory,
  TitanAirScrapping, TitanFloatingLaunchPad, TitanShuttles, RobinsonIndustries,
  SelfReplicatingRobots, ExtractorBalloons, ForcedPrecipitation,
  JetStreamMicroscrappers, RotatorImpacts, SulphurEatingBacteria): the branch pick
  is hosted **inside `CardActionConfirmContent`** (the ДЕЙСТВИЯ overlay's premium
  action-confirm modal — source card + `/api/action-preview` result chips). These
  never surface as a bare top-level `OrOptions` in the modern flow.
- **On-play bespoke choices with a `cardPlayPreview` hook** (Atmoscoop, CometForVenus,
  Flooding, Sabotage, HiredRaiders, Virus, Air Raid, Sponsored Academies, …): the
  choice is **pre-collected in the play modal** (`HandCardPaymentContent`), shown
  with the source card + rich result chips. (See CLAUDE.md "Cards-in-hand overlay".)
- **Vitor** free award funding → routed to the modern **AwardsOverlay**
  (`markAwardFundingPrompt`).

## Documented remaining gaps (phase 2 — explained, not blind)

> **Superseded / tracked**: the phase-2 list below is now maintained (widened to
> EVERY prompt shape, not just `OrOptions`, and to the console-native surfaces)
> in [PROMPT_SOURCE_AUDIT.md](PROMPT_SOURCE_AUDIT.md). Start there.


- **Shared deferred-action prompts** — `StealResources`, `RemoveAnyPlants`,
  `RemoveResourcesFromCard`, `SelectResourceTypeDeferred`, `IncreaseColonyTrack`,
  `GainAnyResourceButScienceDeferred`. These ALREADY render richly via
  `ModernOptionPicker`: per-target player chips + `current → resulting` previews
  (`removeResourceFromPlayer`/`stealResourceFromPlayer`) AND disabled targets with
  reasons (`setDisabledOptions`). They are **not blind** — they only lack the
  *source-card preview*. Adding it requires threading the source `ICard` from each
  caller (incl. the declarative `behavior` Executor), a larger cross-cutting change;
  deferred to phase 2. Most attack cards (Asteroid family, Sabotage, Air Raid) ALSO
  pre-collect these in the play modal, so the deferred top-level appearance is a
  fallback path.
- **On-play bespoke without a hook** (ImportedHydrogen, LargeConvoy, CrashSiteCleanup):
  played from hand → handled by the play modal flow / its follow-ups.
- **Out of scope** (not in the fork's current scope): Turmoil deferreds
  (`ChoosePoliticalAgenda`, `ChoosePolicyBonus`, `ChooseAlliedParty`), Underworld,
  Pathfinders, etc. — adapt alongside their expansion (see CLAUDE.md checklist).

## Verification

- Server: `npm run build:server` ✓ · card specs (`PharmacyUnion`, `StJosephOfCupertinoMission`,
  `OlympusConference`, `Splice`, `Recyclon`, `ViralEnhancers`, `MarsUniversity`,
  `NeptunianPowerConsultants`) ✓ · `tests/models/choiceContext.spec.ts` ✓
- Client: `npm run lint:client` ✓ · `tests/client/components/modalInputs/ContextualChoiceContent.spec.ts`,
  `ModalInputHost.spec.ts`, `ModernOptionPicker.spec.ts` ✓
- i18n: `npm run make:json` (no duplicate keys) ✓
- Eyeball: open `?modalPlayground` → the two **Contextual** scenarios (Pharmacy Union,
  Olympus) tagged `contextual`; in-game play Pharmacy Union and trigger its science-tag
  effect with no diseases on the card.
