# Delayed-target audit — pre-collecting on-play target choices in the play modal

## UPDATE (auto-select-single): `decreaseAnyProduction` (+ the asteroid cards) NEVER auto-target

**Reported bug — Cloud Seeding (Засев облаков).** The player has NO heat production, one
opponent has it. The play modal showed the M€/plant result but NOT the heat-production
attack: no target, no `current → resulting`. Confirming silently reduced the lone
opponent's heat production. That's a HIDDEN OPPONENT TARGET via the auto-select-single
anti-pattern the fork forbids.

**Root cause — why prior audits missed it.** The earlier audit (table below) recorded
`decreaseAnyProduction` as "already pre-collected via `previewSelectPlayer` — a step only
when a CHOICE exists; **auto-target when single**." That parenthetical WAS the bug:
`DecreaseAnyProduction.execute()` and `previewSelectPlayer()` both had
`if (targets.length > 1 || targets[0] === self) { show picker } else { auto-attack }`.
A single non-self opponent → silent auto-attack + the preview returned `undefined` (no
step). The audit treated "one target = no choice = auto" as acceptable; the fork's rule
is NEVER auto-select — ALWAYS show the target + its `current → resulting`.

**Fix.** `DecreaseAnyProduction.execute()` + `previewSelectPlayer()` now ALWAYS present
the `SelectPlayer` for ≥1 target (single opponent included). `SelectPlayer` never
auto-resolves, so the pre-collected pick replays byte-for-byte. Solo (no opponent) still
shows nothing. **Guard:** `cardPlayPreviewCoverage.spec.ts` — "every in-scope declarative
`decreaseAnyProduction` card pre-collects the target (even a single opponent)" FAILS if
any production-attack card regresses to the silent auto-attack. ~14 card specs updated
(they relied on the single-target auto-attack).

**Same anti-pattern, also fixed — the asteroid cards (promo): Comet Aiming, Asteroid
Rights, Directed Impactors.** Each "add an asteroid to ANY card" bespoke action
AUTO-ADDED to the card ITSELF when it was the only candidate
(`if (asteroidCards.length === 1) addToSelf()`), so the modal showed "+1 asteroid" but
never WHICH card / its `current → resulting`. Now they ALWAYS build the `SelectCard`
(even one candidate); Comet Aiming / Asteroid Rights also pre-collect it
(`pickTarget = length >= 1`). `SelectCard` never auto-resolves.

**Out-of-scope, same pattern, DOCUMENTED (not fixed — those modules aren't in the premium
scope; fix when they enter it):** `FloaterUrbanism` / `CassiniStation` (pathfinders),
`DarksideObservatory` (moon) auto-add a card resource to a single candidate.

**NOT the bug (kept):** `OrOptions.reduce()` auto-resolving the only available OR BRANCH
is a different concept (no hidden target — the single branch's effect is what the player
sees); `AddResourcesToCard`'s `autoSelect` is already forced `false` fork-wide.

## UPDATE (follow-up fix): the "attack + placement" cards now PRE-COLLECT the plant target

The original audit (below) left **Comet / Giant Ice Asteroid / Deimos Down promo** as
documented exceptions: they place a tile/ocean AND remove plants, and the placement
defers at a HIGHER priority than the attack, so the strictly-positional batch couldn't
pre-collect the plant pick. **That exception is now CLOSED.** The plant removal is
INDEPENDENT of where the tile lands, so there is no reason to defer it:

- **`Priority.PLAY_CARD_PLANT_REMOVAL`** (a new value just before `PLACE_OCEAN_TILE`) —
  `Executor.execute` defers `removeAnyPlants` at this elevated priority **only when the
  SAME card also queues a placement** (`ocean`/`city`/`greenery`/`tile`/`buildColony`/
  `moon`/`underworld`); otherwise it stays at `ATTACK_OPPONENT`. So the plant OrOptions
  prompts FIRST, the batch pre-collects it, and the tile/ocean rides the post-confirm
  `PlacementBanner`. This mirrors the existing `PLAY_CARD_RESOURCE_CHOICE` precedent
  (an on-play resource choice elevated above an ocean — Imported Hydrogen / Large Convoy).
- **`RemoveAnyPlants`** takes an optional `priority` arg (default `ATTACK_OPPONENT`).
- **`actionPreview.ts` (`stepsForBehavior`)** — the `!hasFollowUpPlacement` guard was
  REMOVED; the `removeAnyPlants` `or` step is now emitted for EVERY plant-attack card
  (still BEFORE the placement note, matching the elevated live order).
- The change is **rules-neutral** (the effects are independent — only the prompt order
  changes) and **generic** — it also covers the out-of-scope `MetallicAsteroid` /
  `Deimos Down ares` (ares) and `Deepnuking` (underworld) for free.

**Cards now pre-collecting the plant target even with a placement:** Comet, Giant Ice
Asteroid, Deimos Down promo (+ Metallic Asteroid, Deimos Down ares, Deepnuking).

**Tests updated for the new order** (plant pick first, placement second): `Comet.spec`,
`GiantIceAsteroid.spec`, `DeimosDownPromo.spec`, `DeimosDownAres.spec`,
`MetallicAsteroid.spec`, `Deepnuking.spec`, plus `cardPlayPreview.spec` (Comet now
emits the `or` step before the placement note + a live-replay test) and the
`cardPlayPreviewCoverage` guard (now requires EVERY declarative `removeAnyPlants` card —
with or without a placement — to pre-collect).

**Still a CORRECT follow-up (NOT a gap): `Flooding`.** Its M€ steal targets the OWNER
OF A TILE ADJACENT TO THE OCEAN it places — the eligible targets are only known AFTER
the ocean is placed, so the choice is genuinely placement-DEPENDENT and cannot be
pre-collected. This is the user's allowed deferred case ("the target only becomes known
after another action"), unlike the placement-INDEPENDENT plant attacks above.

**Empty classes in scope (audited):** no in-scope card has an on-play
`addResourcesToAnyCard` or `decreaseAnyProduction` behind a placement PROMPT
(MaxwellBase / Stratopolis place a FIXED-space city — no `SelectSpace` — and their
`addResourcesToAnyCard` is a repeatable ACTION, handled by the action-confirm modal). If
a future expansion adds such a card, apply the SAME elevation pattern.

---

## The reported bug

Playing **«Рудная экспедиция» (Mining Expedition)** showed only the card + payment +
result chips in the premium play modal; after pressing **РАЗЫГРАТЬ КАРТУ** a SEPARATE
delayed modal appeared — *«Выберите игрока, у которого удалить до 2 растений»*. The
target choice (which player loses plants, the projected delta, the self-harm warning,
the disabled targets, the optional skip) was hidden until AFTER the player committed.

This is the exact anti-pattern the play-card-preview rework was built to eliminate: a
precomputable target must be chosen INSIDE the play modal, before confirm.

## Root cause — why prior audits missed it

1. **Mining Expedition is purely DECLARATIVE.** Its whole effect is a `behavior`
   (`{stock:{steel:2}, global:{oxygen:1}, removeAnyPlants:2}`) — it does NOT override
   `bespokePlay()` or `play()`. The coverage guard (`tests/models/cardPlayPreviewCoverage.spec.ts`)
   only inspects cards that `customizesPlay()` (bespokePlay **or** play()). A declarative
   card is `!customizesPlay`, so the guard never looked at it — declarative cards were
   assumed "auto-covered by the walker".

2. **The walker DELIBERATELY skipped `removeAnyPlants`.** The shared on-play step walker
   `stepsForBehavior` (`src/server/models/actionPreview.ts`) pre-collected
   `addResourcesToAnyCard` and `decreaseAnyProduction`, but a code comment explicitly
   read: *"removeAnyPlants is an OrOptions with no clean controlled capture yet, so it is
   NOT pre-collected — it rides the post-batch follow-up routing."* So the assumption
   "declarative ⇒ covered" was false for this one key.

   Combined, (1)+(2) are the gap: a declarative card whose only deferred prompt was
   `removeAnyPlants` slipped past BOTH the guard (it's declarative) and the walker (the
   key was skipped). No test asserted that declarative attack cards pre-collect their
   target.

3. **The "no clean controlled capture" reason was already obsolete.** The infrastructure
   to host an OrOptions as a pre-collected step had already shipped for bespoke cards:
   `actionPreviews.orOptionsStep()` + the client's `ModernOptionPicker` (controlled mode)
   in `HandCardPaymentContent.vue`, used by **Air Raid** (a side-effect-free
   `StealResources.previewOptions()`). `removeAnyPlants` simply hadn't been given the same
   side-effect-free builder.

## Single card or a class? — A CLASS.

`removeAnyPlants` is a shared `behavior` key. The fix is architectural (one builder + one
walker branch), not per-card.

## Code patterns audited

A programmatic sweep enumerated EVERY in-scope project card (`base`, `corpera`, `promo`,
`venus`, `colonies`, `prelude`) with a declarative `behavior` and classified every
deferred-choice key:

| behavior key | what it defers | in-scope count | status |
| --- | --- | --- | --- |
| `removeAnyPlants` | OrOptions: which player loses plants | 9 | **the bug — now fixed (6) + documented follow-up (3)** |
| `decreaseAnyProduction` | SelectPlayer: whose production drops | 9 | already pre-collected via `previewSelectPlayer` (a step only when a CHOICE exists; auto-target when single) |
| `addResourcesToAnyCard` | SelectCard: which card gets the resource | 15 | already pre-collected (+ the no-eligible-card warning) |
| `drawCard` (keep/pay) | draw-then-choose | 2 | **legitimate post-reveal exception** (cards unknown until drawn) |
| `standardResource` | SelectResource: which resource to gain | 0 | none in scope |
| `spend.*` | payment / discard / card-resource | 0 (on-play) | none in scope (only blue-card actions, out of scope) |

Bespoke cards (`customizesPlay`) are already enforced by the existing coverage guard:
every in-scope bespoke-play card has a `cardPlayPreview` hook, a `behavior`, or an explicit
`ACCEPTED_DYNAMIC`/`BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT` entry. The bespoke attack/steal
cards (Air Raid, Hackers, Virus, Sabotage/HiredRaiders/CometForVenus, Flooding, the Venus
resource-target cards) were already hooked or documented before this change.

## The fix (architectural, server-only)

1. **`src/server/deferredActions/RemoveAnyPlants.ts`** — refactored to the
   `StealResources` shape: a SIDE-EFFECT-FREE `buildOptions()` (each option's attack lives
   in its `andThen`, so building mutates nothing) + a read-only `previewOptions()`.
   `execute()` now delegates to `buildOptions()`. The option ORDER (opponents → skip →
   self-with-warning) and the disabled-target list are preserved EXACTLY, so the index the
   play modal captures replays byte-identically against the live OrOptions. Behaviour is
   unchanged (verified by 226 passing consumer tests, incl. the dedicated
   `RemoveAnyPlants.spec.ts`, Mons Insurance solo, Botanical Experience halving).

2. **`src/server/models/actionPreview.ts`** (`stepsForBehavior`) — emits the
   `removeAnyPlants` step (an `or` input hosting `previewOptions().toModel()`) between
   `decreaseAnyProduction` and the board-placement notes (the Executor defer order). The
   client already hosts `or` steps via `ModernOptionPicker` (controlled), so NO client
   code and NO new i18n were needed — the SAME OrOptions that used to render as a delayed
   modal now renders inside the play modal: per-target `current → resulting`, the
   self-removal warning, the «Skip» option, and disabled opponents with reasons. The
   single РАЗЫГРАТЬ gates on the choice being made.

3. **`tests/models/cardPlayPreviewCoverage.spec.ts`** — a NEW guard: every in-scope
   declarative `removeAnyPlants` card (without a co-placement) MUST emit the `or`
   pre-collect step, else the test fails with the card list. This catches the whole class
   and prevents regressions. `tests/models/cardPlayPreview.spec.ts` gained explicit
   Mining Expedition tests (OrOptions structure + a live-replay protocol test) and the
   Asteroid/Comet cases were updated to the new behaviour.

## Cards fixed (plant target now pre-collected in the play modal)

Asteroid, Big Asteroid, Deimos Down, Impactor Swarm, **Mining Expedition**, Small Asteroid.

## Legitimate exceptions (documented, NOT silent gaps)

- **Comet, Giant Ice Asteroid, Deimos Down (promo)** — these ALSO place a tile/ocean. A
  board placement defers at a HIGHER priority than the attack (`ATTACK_OPPONENT`) and
  prompts FIRST; the batch endpoint (`PlayerInputBatch`) is strictly positional and stops
  at the first response that doesn't match the live `waitingFor`, so the plant pick can't
  be pre-collected ahead of the placement. These are inherently FOLLOW-UP cards: the
  placement is post-confirm via `PlacementBanner` (unavoidable), and the plant attack rides
  the same follow-up — consistent with **`Flooding`** (ocean + M€ steal), the established
  "attack + placement" decision. Reordering the game so the attack resolves first was
  deliberately NOT done: it would change the prompt order across base/ares/underworld cards
  (and break their order-asserting tests) for no rules reason (the effects are independent —
  only the prompt order would change). Several existing tests (`Comet.spec`,
  `GiantIceAsteroid.spec`) assert the ocean-first order.

- **Business Contacts, Invention Contest** (`drawCard` keep) — a draw-then-choose: the
  cards aren't known until drawn, so the choice is genuinely post-reveal and rides the
  existing premium card-selection surface.

- **`decreaseAnyProduction` single-target** — when only one opponent can be reduced the
  server auto-attacks (no choice), so no step and no delayed modal. A multi-target case
  pre-collects a `SelectPlayer` step.

## Second gap found in review — a card can't target ITSELF on play

**Symptom (Jovian Lanterns / «Огни Юпитера»):** by the rules, an on-play *"add 2
floaters to ANY card"* may target the card just played (Jovian Lanterns holds floaters
and scores 1 VP per 2 floaters *here* — self-targeting is usually optimal). The play
modal did NOT offer the card itself.

**Root cause — preview timing.** The preview runs while the card is still in HAND.
`AddResourcesToCard.getCards()` derives candidates from `player.getResourceCards()`,
which reads the LIVE tableau — and the card isn't on the tableau yet. So the
card-being-played was excluded from its OWN target list. Consequences: (a) with other
floater cards in play, the picker offered those but not the card itself; (b) with NO
other floater card, the preview showed the false *"No eligible card — this resource is
not added"* warning, even though the card itself becomes a valid target the instant it's
played.

**Scope — a CLASS, programmatically enumerated.** In-scope cards whose on-play
`addResourcesToAnyCard` can target themselves (they HOLD the added resource and satisfy
any tag restriction with their own tags): **Atmo Collectors, Jovian Lanterns, Titan
Floating Launch-pad** (all `colonies`, all FLOATER, all declarative). Floater Prototypes
is correctly EXCLUDED — *"add to ANOTHER card"*, an EVENT with no `resourceType`.

**Fix.** `AddResourcesToCard.Options` gained a preview-only `cardBeingPlayed?: ICard`;
`getCards()` prepends it when it holds the matching resource (mirroring
`getResourceCards`'s exact-type/WARE rule) and passes the same tag/min/filter pipeline.
The declarative walker (`actionPreview.ts`: `addAnyCardCandidates` + the
`AddResourcesToCard` in `stepsForBehavior`) threads the card being played. The LIVE path
never sets it (the card is on the tableau by the time the deferred runs, and a
`!cards.includes` guard prevents a duplicate), so live behaviour is byte-for-byte
unchanged. The captured self-pick replays cleanly: after play the card IS on the tableau,
so the live `SelectCard` lists it and the batched `{type:'card', cards:[<self>]}` matches.

**Guard.** A new test in `cardPlayPreviewCoverage.spec.ts` enumerates every in-scope
card that can self-target an on-play resource add and asserts the preview offers the card
itself — FAILS if a self-holding card stops offering itself. Plus explicit
`cardPlayPreview.spec.ts` tests (Jovian Lanterns offers itself with no other floater card
+ the live replay; Titan Floating Launch-pad's Jovian-restricted self-target).

## Follow-up audit — SOURCE / DESTINATION card selection (not just target players)

A later review asked whether the pre-collection contract also covers "pick one of YOUR
cards as the source/destination" (e.g. **Stratospheric Birds** / «Птицы в стратосфере»:
*spend 1 floater from any of your cards* on play) — a class the earlier target-player
audit might have missed.

**Finding: the source/destination class IS covered.** Every in-scope card whose ON-PLAY
effect picks a SOURCE card (spend a card resource from one of your cards) or a
DESTINATION card (add a resource to one of your cards) pre-collects it:

| On-play card pick | mechanism | covered by |
| --- | --- | --- |
| **Stratospheric Birds** — spend 1 floater from a card | `RemoveResourcesFromCard(source:'self', autoselect:false)` | co-located `cardPlayPreview` hook → `previewSelectCard()` |
| **Air Raid** — spend 1 floater from a card | same | `cardPlayPreview` hook |
| **Venus Soils / Eos Chasma / Imported Nitrogen / … (~15)** — add a card resource to ANY card | declarative `addResourcesToAnyCard` | the `stepsForBehavior` walker (+ the `cardBeingPlayed` self-target fix above) |
| **Ecology Research** — add a microbe AND an animal to cards | bespoke | `cardPlayPreview` hook (two pickers) |
| **Virus** — remove animals / plants | bespoke | `cardPlayPreview` hook (tabbed picker) |
| Blue-card ACTIONS that spend/add from a card (Ants, Predators, Titan Shuttles, Titan Floating Launch-pad, Jupiter Floating Station) | — | the ACTION-confirm modal (`actionPreview`), a separate already-covered surface |

**Stratospheric Birds verified end-to-end.** Its `cardPlayPreview` hook builds the
floater-source `SelectCard` via `RemoveResourcesFromCard.previewSelectCard()` (with
`autoselect:false`, so the picker shows EVEN for one candidate). The client routes a
card pick by `cardPickSurface`: ≤3 own-tableau candidates render inline as
`ActionTargetCard` tiles in the modal; >3 route to the РАЗЫГРАНО board pick-mode — both
PRE-CONFIRM. A new guard in `cardPlayPreview.spec.ts` ("StratosphericBirds: the spend-a-
floater-from-a-card SOURCE pick is pre-collected") asserts the preview emits the source
step with every floater card as a candidate AND that the live `RemoveResourcesFromCard`
prompt enumerates the SAME candidates, so the pre-collected pick replays byte-for-byte.

**No declarative `spend.resourceFromAnyCard` gap in scope.** A programmatic sweep found
ZERO in-scope declarative cards whose `behavior.spend` defers a card/hand pick — so there
is no "pure-declarative spend-from-card slips past the coverage spec" analog of the
removeAnyPlants gap. (If a future expansion adds one, `stepsForBehavior` must emit a
`spend.resourceFromAnyCard` step the same way it does for `addResourcesToAnyCard`.)

**Root cause of the report (why it can still APPEAR delayed).** The server hook +
client routing pre-collect correctly in the CURRENT code — a guard test proves it. The
ONE degradation path: `HandCardPaymentContent.fetchPreview` falls back to a synthetic
no-step `dynamic` branch IF the `/api/card-play-preview` fetch FAILS (by design — a
failed preview must not BLOCK the play). With no steps, the floater-source pick then
rides the live post-confirm `RemoveResourcesFromCard`. So a stale client bundle (the
hook + the `cardPickSurface` routing predate the running build) or a transient preview
fetch failure reproduces the reported symptom even though the committed code is correct.
Possible hardening (not done — no evidence of a live fetch failure): retry the preview
fetch once before falling back. Surfaced for follow-up.

## Journal / notifications

Unchanged. The fix alters NO game logic — `RemoveAnyPlants` still calls
`target.attack(player, PLANTS, qty, {log:true})` exactly as before; the play modal merely
submits the SAME response the delayed modal would have. So the victim still gets the
hostile/negative notification, the journal still groups the removal under the card-play
root event, and a self-target is still NOT classified as an attack on the viewer (the
attacker is the viewer, so `diffNegativeNotifications` skips it).

## Verification

- `npm run build:server` — clean.
- `tests/models/cardPlayPreview.spec.ts` + `cardPlayPreviewCoverage.spec.ts` — pass
  (incl. the new Mining Expedition structure + replay tests and the new class guard).
- All 9 `removeAnyPlants` card specs + `RemoveAnyPlants.spec.ts` + Mons Insurance +
  Botanical Experience + the out-of-scope consumers (Metallic Asteroid, Deepnuking, Aerial
  Lenses) + Warmonger + Virus + Sabotage — 226 passing (the refactor is behaviour-identical).
- `tests/models/**` + `tests/behavior/**` — 197 passing.
- ESLint clean on all changed files.
- Self-target fix: `JovianLanterns`/`AtmoCollectors`/`TitanFloatingLaunchPad` specs +
  `AddResourcesToCard.spec.ts` + the new `cardPlayPreview` self-target tests + the new
  coverage guard — pass; `tests/deferredActions/**` + `tests/behavior/**` 154 passing
  (the `cardBeingPlayed` option is additive — no live caller sets it).

## Manual scenarios to confirm in-game

1. Mining Expedition with opponents having plants → the target picker is IN the play modal;
   no delayed modal after confirm; projected plant delta + self-warning + skip visible.
2. An opponent with 0 plants → shown disabled with a reason; the player with plants → a
   self-removal option with a warning; «Не удалять растения» available pre-confirm.
3. No opponent has plants → no picker, no follow-up (consistent with the live rules).
4. Comet / Giant Ice Asteroid → the plant attack + the tile placement both ride the
   post-confirm follow-up (PlacementBanner + the OrOptions), as documented.
