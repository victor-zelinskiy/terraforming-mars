# Deferred upstream work — reviewed, not taken (with the exact reason and plan)

Upstream work audited in depth and deliberately **not** taken. It is not "behind" — the
decision, the blockers and the port plan are recorded here so the next attempt starts
from the analysis instead of redoing it.

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

---

## C. Type-check `tests/client` with vue-tsc (`e4da733898`)

Upstream widened `tsconfig.vue-tsc.json` to `tests/client/**/*.ts` (plus
`"types": ["node", "mocha", "chai"]`, without which every spec reports
"Cannot find name 'describe'"). `build:test` already typechecks our specs with plain
`tsc`, but only **vue-tsc** understands `.vue` SFC types, so this is a genuine gap:
438 client specs, most of them console-native, currently mount components with no
SFC-level type checking.

**Measured, not guessed:** turning it on today yields **117 errors across 40 spec
files** — 28 of those files are shared with upstream, 12 are fork-only.

Upstream cleared its own 28 with a prep chain, of which **we already took three**:
`a7df9b53e5` (delete the dead `utils/VueUtils.ts`, itself one of the 117),
`b9d111b305` (stale/incorrect literal values in fixtures — `"m1"` not a `SpaceId`,
`"megaCredits"` vs `"megacredits"`), `e68df8222d` (typed `findComponent` helper).

**Not taken: `17af7c1fb3`** (`asComplete()` cast helper for partial fixtures). It
conflicts in `SelectPayment.spec.ts` and `SelectProjectCardToPlay.spec.ts`, both heavily
reworked by our premium payment work, and its only value is satisfying the check we are
deferring — so the conflict risk buys nothing today.

**To finish later:** take `17af7c1fb3` (hand-merging the two payment specs), fix the
remaining fork-only spec files (mostly `console/composerRender.spec.ts` passing raw
strings where `CardName` is required), then flip the `tsconfig.vue-tsc.json` include and
the `types` block. Re-measure first — the number moves as specs churn.

---

## D. Upstream 2026-08-12 → 2026-09-01 — the items that need their own iteration

Taken in that window (easy/medium, already landed): Preservation Program action-phase fix
(`a3a8e2fe69`), ApiWaitingFor null id (`ea27ac2ccc`), Biobatteries wild tags
(`e9e5692595`), IPTracker types (`8559110ae7`), final-greenery log notice (adapted from
`dedea572d8`), Boom Town + its card-information adaptation (`be35960fc2`).

**N/A — the bug is not ours:** `d5268f09c4` (FloaterUrbanism `source: 'all'` → `'self'`)
fixes upstream's declarative form; our card is still bespoke and already reads only the
player's own cards. `8115672eb7` (brace-expansion ReDoS) — we are already on 5.0.9 and
`npm audit` reports 0 vulnerabilities.

### D1. `9a5c278cc9` — `removeResourcesFromAnyCard` in the behavior DSL

Adds the declarative counterpart to `addResourcesToAnyCard` and converts FloaterUrbanism,
FloatingRefinery, Hospitals and others onto it. **Wanted eventually** — declarative cards
are auto-covered by our preview / information / reason subsystems. **But it lands straight
on the NO-AUTO-SELECT contract**: our `AddResource` type carries an explicit "there is
deliberately no `autoSelect` here" note and our `Executor` defers `AddResourcesToCard` with
`autoSelect: false`; the removal counterpart needs the same treatment plus
`RemoveResourcesFromCard`'s own `autoselect: false`, and each converted card must lose its
co-located hooks (same rule as §A). Do it as one focused iteration together with §A, not
piecemeal.

### D2. `a54b0ca56d` — centralize URL parameter parsing + route error handling

41 files, 27 under `src/server`. Touches essentially every route, and our route layer is
one of the most fork-diverged areas (premium endpoints, the 204 `noPreview` family, the
Electron CORS allowlist). Genuinely good hygiene, but it is a route-layer refactor that
must be re-validated against `previewNoPreview.spec.ts` and the CORS allowlist contract.

### D3. `3226fd14e1` — split end-game logs into its own endpoint

Server half is small; the client half is `GameEnd.vue` (frozen desktop). Adding it means
the full new-endpoint checklist (path constant, requestProcessor, **Electron CORS
allowlist**, route spec). Low payoff for us unless the console endgame surface starts
fetching the full log.

### D4. `81ca5a9915` — share `readBody` between post and put

Pure DRY refactor. **Attempted: conflicts in all three route files**
(`ApiCreateGame.ts`, `LoadGame.ts`, `PlayerInput.ts`) — our most-diverged routes, including
the submit path. No functional benefit; not worth hand-merging those three.

### D5. `f3b26d527c` — simplify Reds

`RedsBonus01 extends Bonus` → `implements IBonus`. Style-only, in a file we have diverged.
No rule change. Declined.

### D6. Type-tightening cluster — `ed7d1f1122`, `f0b866d0b7`, `90a972e115`, `4702eaa12a`, `1b26fe6989`, `30b7c539ad`, `55fb2657d4`

Makes `ViewModel.id`, `participantId`, `GameModel.spectatorId`, `ClaimedMilestone.claimable`
non-optional and removes several enums. These ripple into every client surface that reads
those models — and our console shell reads all of them. Cheap upstream, wide for us:
take as one pass with a full `vue-tsc` + client-suite run, not commit by commit.

### D7. Build/toolchain — `1e8c466b51` (bundler module resolution), `2c24d7071d` (es2021 → es2023), `7c6f6b066d` (mochapack → Vitest), `73cf9b65fd` (Orderings)

Each is its own project. The Vitest migration in particular collides with a lot of
fork-specific test infrastructure (`webpack.test.config.js` and its single-chunk
requirement, `bundleSetup.ts` auto-unmount, the `run-tests.mjs` collected-count floors,
the bundle-shared module-state rules in `.claude/rules/tests.md`). Do not start it
casually.

### D8. ⚠️ `871f3fd17e` — webpack 5.108.3 → 5.110.1 — DO NOT take blind

We are pinned at **5.109.2 on purpose**: webpack 5.110 silently miscompiles the embedded
bundle (namespace/new-codegen), and the symptom is a 500 only when serving to another
host — invisible in a local run. 5.110.1 may or may not be the fix. Verify against the
embedded-server path (`docs/EMBEDDED_SERVER.md`) on a second machine before bumping.
Other bumps in that window (webpack-cli, markdown-it 15.0.1, uuid, css-loader,
browserslist) are ordinary and can ride a normal dependency pass.
