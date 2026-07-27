<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Modern modal inputs (card-play sub-prompts)

**Component-level detail moved to `docs/MODAL_INPUTS.md`** (the `ModalInputHost` router + the premium `Modern*` components, the Contextual-choice modal, Free-award-funding→AwardsOverlay, and the Option-UI-metadata "rich choice cards" prose). Every `Modern*` component submits BYTE-IDENTICAL payloads to its legacy `Select*.vue` twin (the radio stack stays for the inline path — don't refactor it). The load-bearing ROUTING + marker contracts stay here (the per-card metadata contract is the **CHECKLIST below**):

- **Routing — `WaitingFor.shouldRouteToModal()`.** The per-turn ACTION MENU (`or` titled `Take your first/next action`) stays INLINE (dedicated buttons drive it); every OTHER top-level `or` routes to `MandatoryInputModal`. `MODAL_INPUT_TYPES` = `payment/option/player/amount/resource/resources/productionToLose/and/projectCard` always route. Handled OUTSIDE the modal by dedicated surfaces: `card`→Draft / hand-select overlay, `space`→PlacementBanner, `colony`→ColoniesOverlay, `initialCards`→InitialDraft, a FREE award OrOptions→AwardsOverlay. **To add a premium input for a new type:** build the component (mirror an existing one's submit shape), add it to `PREMIUM_COMPONENTS` in `ModalInputHost.vue`, add the type to `MODAL_INPUT_TYPES` (or the title to `MODAL_OR_TITLES`).
- **Contextual choice (see `docs/CHOICE_CONTEXT_AUDIT.md`).** A TRIGGERED-effect / on-play / deferred `OrOptions` shown as a top-level prompt gets `.markChoiceContext(cardEffect(this, '<trigger key>', '<mode>'))` + per-option `.withMetadata(optionResult({effects, tradeoff}))` (server marker `choiceContext`, serialized centrally) → renders via `ContextualChoiceContent` (source card + trigger summary + one-click / inline-confirm-for-RISKY options). Declarative/behavior OrOptions + ones already hosted by the play/action modal need NOTHING.
- **Free award funding** uses the server marker `awardFundingPrompt:{free}` (NOT title text) → routes to the AwardsOverlay free-sponsorship mode, suppressing the generic modal (mirrors the hand-select / standard-project pattern; mandatory ⇒ minimize to the shared pill, never dismiss).
- **⚠️ NEVER detect a prompt by its (translatable) title** — use a server marker or structural signal (i18n mutates `Message.message` IN PLACE on render). The one surviving title check (the action menu) is safe only because that title isn't mutated.
- Styles `src/styles/modal_inputs.less`; the `?modalPlayground` playground is the quality gate. Per-card METADATA contract → the CHECKLIST below.

### Metadata contract — CHECKLIST for adapting / adding cards

**This is the single source of truth for what UI metadata a card's prompts must carry.** Whenever you adapt a blue-card action, an expansion card, or a card pulled from upstream `master`, run its prompts through this checklist so the premium modals render rich instead of falling back to bare text. **Everything here is OPTIONAL + backward-compatible** — a prompt with no metadata still works, it just looks plain. **When you EXTEND the framework (new field, helper, icon family, or disabled support for a new input type), update THIS checklist, the `OptionMetadata` type / model, and add a `?modalPlayground` scenario — in the same change.**

Identify what prompt the card produces, then attach the matching metadata:

| Prompt the card builds | What to attach | Helper (`src/server/inputs/optionMetadata.ts`) / API | Reference card |
| --- | --- | --- | --- |
| `OrOptions` of `SelectOption`s, each removing/stealing from a chosen player | `.withMetadata(...)` on every option **+ explicit verb `buttonLabel`** (NOT default `'Confirm'`) **+ `.withMetadata(skip())` on the do-nothing option** | `removeResourceFromPlayer(target, resource, amount, current)` / `stealResourceFromPlayer(...)` | RemoveAnyPlants, Sabotage, HiredRaiders |
| `SelectPlayer` where the effect is constant across candidates | 4th arg `options: {icon, amount, scope}` (`scope: 'production'` for production decrease, `'stock'` for stock removal) | `SelectPlayer(players, title, buttonLabel, {icon, amount, scope})` | DecreaseAnyProduction, Flooding, CometForVenus, LawSuit |
| `OrOptions` raising a global parameter | `.withMetadata(globalParameter(icon, steps, current, resulting, unit))` (`icon` ∈ `temperature`/`venus`/`oxygen`/`ocean`; `unit` `'°C'`/`'%'`) | `globalParameter(...)` | Atmoscoop |
| `SelectAmount` spending/converting N of a resource | 6th arg `options: {icon, unit?}` | `new SelectAmount(title, label, min, max, maxByDefault, {icon})` | Insulation |
| `SelectOption` adding/removing a **card** resource | `.withMetadata(addResourceToCard(cardResource))` / `removeResourceFromCard(cardResource)` | `addResourceToCard(...)` / `removeResourceFromCard(...)` | OlympusConference |
| `SelectOption` gaining a standard resource | `.withMetadata(gainResource(resource, amount))` | `gainResource(...)` | (factory ready, wire as needed) |
| Any "do nothing / skip / cancel" `SelectOption` | `.withMetadata(skip())` | `skip()` | every skip option above |

**Always also surface UNAVAILABLE targets (don't let the server silently drop them):**
- `OrOptions` attack/steal: build the excluded opponents and `.setDisabledOptions([disabledPlayerTarget(target, icon, reason), …])` on the `OrOptions`.
- `SelectPlayer`: pass `disabled: [{player, reason}]` in the 4th-arg options.
- `SelectCard` (card targets): pass `disabled: [{card, reason}]` in the config. Keep `cards` the SELECTABLE set — disabled cards ride the separate `disabledCards` model channel (server rejects them for free, the picker shows them behind the Available/All/Unavailable filter). Scope is **case-specific** (what's semantically relevant to THIS choice), not a count heuristic; only include cards the player can see (own/played/public — never hidden hands, deck, or other private zones).
- `SelectColony` (colony targets): set the input's `disabledColonies = [{colony, reason}]` (and `purpose`). Use `purpose: 'selectExistingColony'` (default) to make the client show ALL in-play colonies disabling the unpickable ones; `purpose: 'addNewColonyToGame'` for add-a-tile effects (only the offered not-in-play tiles show — never the existing colonies). Only send the reasons the client can't derive (TR affordability); the client already derives full / already-owned / visitor / no-fleet.
- The `reason` is an **English i18n key** describing the rule failure (the client can't always know the rule) — e.g. `'No plants to remove'`, `'Production already at minimum'`, `'Resources are protected'`, `'No Venus tag'`, `'No resources on this card'`, `'Cannot afford the TR increase to build here'`. Add the ru value to `ru/ui.json` — and reuse the project's CANONICAL term for any game concept (TR → **РТ**, VP → **ПО**, etc.; grep `ru/*.json` first, never coin a new abbreviation like "ПТ").

**Icon keys** are resolved in one place — `src/client/components/modalInputs/optionIcons.ts` `iconClassFor`. Three families, pick the right one for `icon`/metadata:
- standard resources: `megacredits` / `steel` / `titanium` / `plants` / `energy` / `heat` (the `Resource` enum values double as these keys).
- global parameters: `temperature` / `venus` / `oxygen` / `ocean`.
- card resources: the `card-resource-<key>` suffix (lowercase, spaces→hyphens — `addResourceToCard`/`removeResourceFromCard` derive it from the `CardResource` value).
- A genuinely new icon family → add it to the right set in `optionIcons.ts`; never hand-build the class string at the call site.

**Do NOT put in metadata what the client already derives** (avoid duplication / drift): per-player `current → resulting` values (computed from the public player models), corporation name, and the self-target flag are all client-side. The server only sends the *hint* (`icon` / `amount` / `scope`) and the *rule-based reason*.

**Localization rule (build crashes on dupes):** every new English key (verb buttonLabels, reasons, labels) goes in `ru/ui.json` (or `ru/play_prompts.json` for card-prompt titles) — but `grep` the EXACT key across ALL `src/locales/<lang>/*.json` first; `make_static_json` throws on a duplicate key in two files. If the existing translation of a shared key doesn't fit your context, introduce a NEW more-specific English key instead of reusing it.

**Quality gate:** open `?modalPlayground` (`ModalInputPlayground.vue`) and add/check a scenario for the new pattern. The per-scenario tags (`metadata: complete` / `rich target (production|stock)` / `disabled: N` / `fallback (text only)`) make a still-on-fallback prompt obvious. Dev tags live ONLY in the playground — never let `metadata complete`, `plain target`, English titles, or other technical strings leak into the real game UI.

**Current coverage / next frontier:** metadata + disabled candidates are done for player-target prompts (`SelectPlayer` + the OrOptions attack/steal deferreds), global-parameter, `SelectAmount`, card-resource options, **`SelectCard` (`RemoveResourcesFromCard`) with the Available/All/Unavailable filter**, and **`SelectColony` (`BuildColony` build-existing + Aridor add-tile + the trade flow)**. Not yet enriched (same model shape applies when you do): maxed global parameters, and the deliberately-skipped blue-card `action()` / production-phase prompts.

