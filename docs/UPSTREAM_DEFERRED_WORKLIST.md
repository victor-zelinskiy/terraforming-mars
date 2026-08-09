# Deferred upstream work — reviewed, not taken (with the exact reason and plan)

Two upstream clusters were audited in depth and deliberately **not** taken. They are not
"behind" — the decision, the blockers and the port plan are recorded here so the next
attempt starts from the analysis instead of redoing it.

Retrieve any commit with `git show <sha>` (remote `upstream`).

---

## A. Action-card → declarative `behavior` conversions

Upstream is converting bespoke `action()` implementations to
`action: {or: {autoSelect: true, behaviors: [...]}}`. **Architecturally this is what we
want** (CLAUDE.md: declarative cards are auto-covered by the preview / card-information /
reason subsystems), and our `ActionCard` + `deriveDeclarativeBranches` already support it.

| sha | cards | scope |
| --- | --- | --- |
| `df5f9c57ea` | RedSpotObservatory, TitanAirScrapping, BioPrintingFacility, CometAiming, ExtractorBalloons, JetStreamMicroscrappers | **all 6 in premium scope** |
| `cf8795f18b` (card half) | JovianLanterns, KuiperCooperative, ForcedPrecipitation (+ DarksideIncubationPlant, Anthozoa, RobinHaulings, PalladinShipping — frontier) | 3 in scope |
| `5b8e6d68af` | AquiferPumping, WaterImportFromEuropa, DirectedImpactors, IcyImpactors, RotatorImpacts | **all 5 in premium scope** |

*(The infra halves of `cf8795f18b` (`OrBehavior.title`) and `c067fe52ff` (per-option
warnings) are already taken, as is `c1bbeb46b8` (UtopiaInvest).)*

### Why it is not a cherry-pick

**Every in-scope card carries co-located fork hooks, and the hook WINS.**
`actionPreview.ts` returns `card.actionPreview(player)` before it ever looks at
`actionBehavior`. Left in place after a conversion the hook becomes
authoritative-but-stale — e.g. `RedSpotObservatory` comments *"Branch order MUST match
action()"* against an `action()` that no longer exists. So each conversion must also
delete `actionPreview` + `actionUnavailableReason` and their now-unused
`actionReasons` / `actionPreviews` imports.

`actionPromptCoverage.spec.ts` is the safety net: it walks every in-scope action card and
submits `{type:'or', index}` positionally, so a stale hook fails loudly.

### Hard blockers to clear FIRST (do not start the conversions before these)

1. **Payment flags are not threaded through the declarative preview.**
   `actionPreview.ts` builds `paymentStep(player, megacredits, {title, cause})` with no
   `canUseSteel` / `canUseTitanium`, while the converted executor defers
   `SelectPaymentDeferred(..., {canUseSteel, canUseTitanium})`. Convert any of
   `5b8e6d68af`'s five cards without threading those flags and the pre-collected payment
   model diverges from the live prompt — exactly the class `LEFTOVER_PAYMENT_WORKLIST`
   exists to keep empty.
2. **`5b8e6d68af` deletes `TITLES.action`**, which `WaterImportFromEuropa` still uses in
   two places. Converting it changes the payment prompt title
   (`Select how to pay for action` → `Select how to pay for ${0} action`); the old key is
   live in `src/locales/ru/ui.json`.
3. **i18n.** The or-titles are new keys. Verified missing from `src/locales/ru/`:
   `Remove 1 floater here to draw a card`, `Remove 2 floaters here to increase your TR 1 step`,
   `Spend 1 titanium to add 2 floaters here`, `Remove 2 floaters here to raise Venus 1 step`,
   `Spend 1 titanium to add 2 floaters to this card`, `Add 1 floater to this card.`
   `ru/ui.json`, `de/ui.json` and `ua/ui.json` are all fork-diverged → those locale hunks
   conflict and need hand-merging. Grep every key across ALL `src/locales/<lang>/*.json`
   first: `make:json` throws on duplicates.

### Order once unblocked

One card at a time; per card: convert → delete both hooks + unused imports → re-run
`actionPromptCoverage` + `actionPreviewPayment` + `make:cards` (0 needsCuration /
0 seededRunOn / 0 missingTranslations) → add the RU key.

### `dfe11d3f51` — DECLINED as written

Its new `AddResourcesToAnyCardExecutor.execute()` re-implements our `Executor` path and
silently drops three fork invariants:

- `autoSelect: false` — the fork-wide **NO AUTO-SELECT** rule. Upstream's version lets a
  single-candidate "add to ANY card" resolve behind the board.
- `cause: cardSource(card)` — the prompt-source contract; the picker loses which card asked.
- the `hasPlacement → Priority.PLAY_CARD_RESOURCE_CHOICE` elevation, which is what keeps
  the Bio-Fertilizer / Maxwell Base pick-before-tile ordering correct.

It also removes `Options.min` from `AddResourcesToCard`, which our `Executor` still passes.
Port it by hand carrying all four, or leave it. `BioengineeringEnclosure` (ares, in scope)
additionally has an `actionPreview` hook that hand-builds a step titled
`'Select card to add 1 animal'`, while the declarative path emits `AddResourcesToCard`'s
own title — the pre-collected step would answer a differently-titled prompt.

---

## B. Global events → declarative DSL (10 commits, 120 files)

`3e7462bc41`, `16671b2946`, `9fa6926318`, `372f2f3ee8`, `0d6d193844`, `bebc6065b6`,
`aff9fa628c`, `b704071565`, `647f6a1512`, `dcf0a60f2a`.

**Declined as a cluster.** Turmoil is outside the premium subsystem scope, so the DSL's
headline benefit (auto-coverage by the preview / card-information / reason subsystems)
buys nothing for global events today — and it never reaches the client anyway:
`ClientGlobalEventManifest` reads `genfiles/events.json`, which carries no `behavior`.

### The blocking defect — `GLOBAL_EVENT_PROXY` crashes our client

`9fa6926318` substitutes a `ProxyCard(CardName.GLOBAL_EVENT_PROXY)` for the global event
when running behaviors. Our Executor's premium instrumentation then reads `card.name` off
that proxy:

- ocean branch → `new PlaceOceanTile(player, {sourceCard: card.name})` → reached by
  AquiferReleasedByPublicCouncil via `once: {ocean: {}}` (`b704071565`).
- draw branch → `revealSource = {type:'card', cardName: card.name}` → reached by
  CorrosiveRain, SnowCover, SponsoredProjects.

`GLOBAL_EVENT_PROXY` is registered in **no manifest** (unlike `SPECIAL_DESIGN_PROXY`), so
`marsSelectSpaceHelper` → `placementContext.source` → `ConsoleSourceDock` → `Card.vue`
`getCardOrThrow` **throws `card not found Global Event Proxy` during render**. The draw
path likewise advertises L3 «Источник» and opens `CardZoomCard` on a nonexistent card.

**Latent fork bug worth fixing independently of upstream:** `promptSource.ts` /
`CardFace.vue` / `CardZoomCard.vue` should degrade gracefully on an unknown `CardName`
instead of throwing during render.

### Other costs

- All 48 global-event files carry one mechanical fork change (the `RENDER_DATA` hoist out
  of the constructor). Cherry-picking conflicts on every one; a port must re-apply it.
- Log-order churn in a journal we actually render: `stock.adjust` emits
  megacredits→steel→titanium→plants, flipping e.g. AquiferReleased's plants/steel order;
  `RedInfluence` flips DSL-vs-bespoke order; `b704071565` moves `bespokeResolve` before the
  per-player loop.
- Attribution is threaded only into stock/production paths, so
  AquiferReleasedByPublicCouncil's ocean prompt title regresses from
  `'Select space for ocean tile for Global Event'` to the generic default.
- `647f6a1512` touches `MediaArchives` (**base = premium scope**), where we carry a
  co-located `cardPlayPreview`. Manual merge; verify the declarative preview covers
  `eventsPlayed`/`all` before deleting the hook. It also drops `MICROGRAVITY_NUTRITION`
  from `AmazonisEngineer.BESPOKE_PRODUCTION_CARDS` — re-run those specs.
- `3e7462bc41` (title auto-fit) is console-visible, but needs `@/client/utils/textFit`
  which we don't have (upstream `340af2fb42`), conflicts with our fully reindented
  `turmoil.less`, and replaces two working `language_hacks.less` rules.

### Independently portable parts (if we ever want them)

- `372f2f3ee8` — `Countable.eventsPlayed` + `Countable.turmoil.{partyLeaders, max, influence}`.
  Verified **purely additive**; the one rewritten line in `Counter.ts` is semantically
  identical for both pre-existing contexts. Needs 3 `CardName` enum lines from `9fa6926318`.
- The `Behavior.lose` half of `bebc6065b6` — new optional top-level field, additive.

These would let us convert premium-scope cards like `MediaArchives` to the DSL. Deferred
because they are dead weight until such a conversion actually happens.

### Plan when Turmoil enters premium scope

Land the ProxyCard adaptation in our Executor **first** (emit `sourceCard` /
`revealSource` / `cause` / `promptSource` only when the source is a real card, or add a
`globalEvent` variant to `ChoiceContextSource` + `CardDrawRevealSource`), then port the
conversion as one squashed change, re-applying the `RENDER_DATA` hoist mechanically.
