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

---

## E. Upstream 2026-09-01 → 2026-09-25 (`81ca5a9915..9f68b8e204`, 72 commits)

**Taken (server rules / priorities / fixes):** Pioneer4 pointed at the wrong milestone
(`1071167794`); New Partner discards the prelude it does not play (`3b3206043c`);
`MAYBE_BLOCK_ATTACK` — choosing to block an attack resolves first (`3490c4b75c`, plus the
removal of the unused `LOSE_AS_MUCH_AS_POSSIBLE`); the Neptunian Power Consultants chain —
affordability evaluated at resolve time, `BEFORE_OPPONENT_TRIGGER` for Flooding's attack,
owner-vs-opponent priority, Polaris income first (`55ef86d537`, `9ea0132db2`,
`162ad68291`, `3dc079b4e1`); Underworld temperature bonuses vs asteroid-like attacks
(`509415838b`); Martian Nature Wonders' cubes no longer block Research Outpost
(`16d2bb8152`); Chimera / Odyssey handling in Agronomist, Planetologist and Curator
(`4652713c9a`, `bb39927cc3`); `bespokePlayBefore` + Solar Storm (`818f1fa169`); Reds
compatibility for spend-to-raise actions (`2b0c4a5580`); escape-velocity sanitizing on
load (`0e91ad3fe7`); SelectPaymentDeferred tests (`1c74218341`); small typing/cleanup
commits (`c5728d32c1`, `1717517bf3`, `fd8f1ddf73`); non-RU locale realignments
(`d0d9c43fa7`, `caded0f08c`).

**Adapted by hand (the upstream form sits on the declined route refactors):** Discord
missing-code → 400 (`6c71f61180`); periodic deletion of expired sessions on every backend
+ the in-memory test double + a GameLoader counter, minus MetricsDelegate (`aa7eed2e68`);
escape-velocity sanitizing on CREATE placed in `newGameConfigToOptions` so campaign
creation shares it (`33008e2922`).

**Merge notes worth remembering.** Flooding, Neptunian and Solar Storm are fork-reworked:
the resolutions keep our premium prompt shapes (flat leaf options with metadata, the
choice-context marker, `isProtectedFrom` / `losesHalfFrom` asked about the PERPETRATOR)
and apply upstream's ordering/lazy-evaluation on top. The Executor's new per-unit spend
loop keeps Floodgate steel in `available` and reserves only on-board steel for the
Reds-tax check. Three imported upstream specs drove upstream's nested
`SelectPlayer`/`SelectPayment` shapes and were adapted, not the code
(`upstream-spec-encodes-upstream-rules`).

**Declined:** `9960c15601` (removes `Deck.shuffle(cardsOnTop)` — that IS our dev
«Guaranteed cards» mechanism and what the e2e deals rely on); **`64641f602a`** (refuses a
custom corporation / prelude / CEO list smaller than players × starting cards — it is
upstream's COMPANION to `9960c15601`: only once the list IS the pool can a short one deal
short. Here the list rides the top of the deck and never restricts the deal, so a one-card
list is the normal shape of the dev guarantee. Taken by mistake in this window and reverted
after it refused every launch with guaranteed cards on; a spec now pins the fork semantics); `c604f60dcf` (drops an
old-save migration — we keep saves loadable); `f27d37ad2a` and `942080257e` (dead-key
removal / «gain»→«add» prompt titles — locale-wide conflicts for no functional gain, and
RU would orphan); `9e120cc0a6` (helper move conflicting inside two hooked cards);
`5cfa3f9382` (a required `ViewModel.color` for the deleted desktop client); the Turmoil
policy wording cleanups (`d0058fb825`, `ce8670f339`, `6dbb55db00` — English KEY changes on
a frontier module, RU would orphan); every desktop/info-panel/log-panel/mobile commit.

### Needs its own iteration

- **`8d3eecab04` — custom corporation / prelude / CEO lists become THE deck** (today they are
  stacked on top of the full deck, so Merger / Board of Directors draw outside the list).
  A real rule fix, but it changes what our testMode deal sizes and the e2e
  «custom corporations = cards on top» assumption see; must be re-validated against
  `devGuaranteedCards`, the fixture generator and `console-prompt-admission`.
- **Request-body hardening chain** — `385ce97500` (413 on oversized bodies),
  `d8f76c3ff0` (stop reading past the limit), `70b3f7cab2` (settle when the body never
  arrives), `7104d48dbd` (MockRequest buffers), `4e44770214`. Genuine hardening, but it is
  built on `readBody.ts` + `RouteError` (§D2/§D4) — port together with the route refactor.
- **`79ffa23390` — vestigial tiles replaced by cubes** (`SpaceCube`, `BoardSpaceCube.vue`,
  30 files, server + board client). Touches the board rendering we reworked; the server
  half (`SpaceModel.cube`, `Game.ts`) is separable.
- **Mocha 12 (`61498afa85`) + parallel `test:server` (`ec88393cac`)** — our runner goes
  through `run-tests.mjs` with collected-count floors and the bundle-shared module-state
  rules; parallelism needs its own verification. `npm audit` today: jsdiff DoS via mocha's
  `diff`, `serialize-javascript` ≤7.0.4 — a dependency pass, likely cleared by the same bump.
- `LocalStorageStore` / `SafeLocalStorage` (`a557945ce3`, `f9962ba4ad`, …) — a namespaced,
  typed, TTL'd localStorage wrapper; worth adopting if console persistence grows beyond the
  create-game settings.

**Baseline reds, triaged and fixed after this audit (2026-09-26):** of the 9 failures the full
suite showed, 8 were red at `da771a6b0c` before any of this. Real defects fixed in code: the
`coloniesExtension` gate in `ColoniesHandler.coloniesOf` zeroed every colony count in specs
that seat a tile without the flag (ColonialRepresentation, SoilStudies ×3, VenusAllies);
`space.stackHeight = undefined` created an own key that a reload omits, so a live board and
the same board reloaded differed in shape (Cloner). Outdated specs updated: CentralPowerGrid
now derives the counted terms from `RESOLUTION_COUNT_IDS` (it was three terms behind);
the RX15 «levy nets alone» expectation was superseded by RX25's «no net that restates one
part» (spec + docblock). `effectForecastParity` only times out under machine load.
Full suite after the fixes: 13041 passing, 0 failing.

---

## F. The 2026-10 window (137 upstream commits, `9f68b8e204..369c76aded`, audited 2026-10-09)

**Taken as cherry-picks (`-x`):** NewGameConfig interface→type + readonly lists (`4940d4ad8c`,
`90dd3686c0` — the fork's own list fields made readonly too); the Timer hours wrap + simplify
(`9445342bea`, `41a1b005de`, `686c037ec6`); Robotic Workforce ×3 cards + the tightened all-cards
test (`6e1ac5431c`, `d05ae06e94`); Mars U priority tests (`9c1cd4308f` carrying `fe418ee9b0`);
the Playwrights cluster (`08a61b680a`, `8fbac33b2d`, `26d9ebc28f`, `6b2d903fca`, `fb5954ee79`);
Reds solo bonuses once (`d89fd670b7` — resolved in the fork's `getScore` shape); test refreshes
(`97c9e7037d`, `3464dc3955`); payment cleanups (`92eda37dd0`, `05bef27d3c`); the Unity discount
callback (`9c7222e9d3` — the fork keeps its itemized `discounts` row, the amount comes from the
policy); `no-sequences` (`1c44e7d06e` — the fork code was already clean); TODO/test resolutions
(`a065c6af5e` minus the Geologist list: the fork's `getCandidates({hasVolcanicSpaces})` reads the
real board); logging TODOs (`7780b5070e` + RU keys); Hostile Takeover warning (`3cdf3d4e5c` + the
console `cardWarnings` row); the 3 M€ → 4 M€ temperature bonus (`43fe40634f` + the fork-only readers:
`placementCostInfo`, `BoardInformationEngine`, the creator's board miniature; the two upstream cube
tests that rode along belong to the deferred `79ffa23390` and were dropped); Spacefarer → T. Spacefarer
(`630a975b69` + the fork exclusion group; RU keeps «Космонавт» — the «T.» is a key marker, like
T. Collector); Warmonger wording (`369c76aded` — the fork's RU translation re-keyed, not rewritten);
`310baaec8c`.

**Adapted by hand:** **X87 Shipment to Earth** (`b7848f3663`) — see the card file's header: the loss
runs in `bespokePlayBefore` so printed = executed order, `minus()` instead of upstream's negative
amounts, co-located `unplayableReason` / `cardPlayPreview`, authored information blocks, RU, lore, art;
the deep premium pass (`docs/claude/prompts/promo-x87-shipment-to-earth.md`) is DONE 2026-10-09: the
reading rules pinned one by one in `tests/cards/promo/ShipmentToEarth.spec.ts` (floodgate steel never
counts, no insurance on one's own loss, the Reds tax on the shared path, wild / Earth Embassy tags,
Playwrights through `canPlay`, the journal in the printed order, the zero M€ chip with its basis),
`playPreview({extrasFirst})` so the loss reads first (Moss too), and the console's SHIPMENT BEAT — the
price a play takes off the rail leaves into the standing card before it lifts (PL-107,
`consolePlayedHero.ts`; e2e `console-x87-shipment-to-earth.spec.ts`, fixture `shipment-to-earth`).
Negative Escape Velocity refused (`5a8e1ad3a3` — route half only). Turmoil's new government waits
for the global event (`55516ec8fc` + `ffd215fd83` + the `09944e5906` sanity test) on the fork's
end-of-generation with the Parliament branch untouched. Ares AVAILABILITY asks the commit path's
predicate (`2815fd6882` + `02c902577a` + `139f69b9c6`): oceans on land and Athena no longer hide
cells for a production cost the placement never charges. The input route's 400 body through
`responses.badInputRequest` (`d31d1d1b1e`). Event-loop utilization gauge in `GameServer.ts`
(`cbea00e6db`). Induced Tremor's optional discard on the fork's premium prompts (`e469b12244`).

**Declined:** `93b146c7d3` + `d7886c307a` (negative render amounts / `amount: undefined` instead of
`-1` — 168 card files, and the premium face reads the `-1` sentinel; X87 is written with `minus()`
instead — revisit only as its own iteration); `a4b4bc44cd` (`PRODUCTION_MINIMUMS` — the fork already
has `productionFloor()` with the MarsBot branch); `93623db6c4` (RemoveResourcesFromCard log default
flip — the fork's removal path logs through the recorder); `36795d0d58`, `cb9e00ed6f`, `793c86cd10`,
`774235a8ec`, `97bb3d102a`, `f91e1e2574` (Turmoil/Moon refactors of Game.ts the Parliament branch
has restructured — no behaviour); `bb27482c25`, `7038162340`, `c2e02e9937` (TODO cleanups on deleted
desktop files); `3c611406b7` + `60f5a67ed4` (create-game validation — encodes «custom list = the whole
pool», the semantics of `9960c15601` declined in §E; the fork's list is cards-on-top); `43fb2c9fd3`
(client getColony rename churn); `ce33b82852` (a dead `undefined` check the type already rules out);
every desktop/Vue refactor, help-page, draft-polling, create-form and style commit of the window
(`29bbc4b00d`, `52aca06707`, `8f27b180bf`, `c5fba77cf5`, `facec50787`, `5bc1af9a38`, `3c16024ff0`,
`27df5ea506`, `cbbcaf228d`, `7833081055`, `d92487b7af`, `ed39bd1349`, `65661a2534`, `4d37552429`,
`70bc60e1eb`, `3a7919c394`, `a742454c28`, `939cbbc788`, `1ea8202661`, `6f996c531f`, `9ebb27c81a`,
`bbfeecb11f`, `d69e20e7e5`, `4d5664dc8e`, `613e4b9775`, `ac87706a0c`, `ccd14be7fc`, `63c17ea5f1`,
`e237c75f50`, `a3d8219a60`, `d68ffa0e15`, `ae2d0c162d`, `48a075fc9e`, `41a20cc48a`, `160331844b`,
`6e8f01c30d`, `b669327fdb`, `998e70b80e`, `583bdade6a`, `798ba6313f`, `fc916cec06`, `46d8eda598`,
`e505754e61`, `c84f104f65`, `c7a24fb210`, `e3f0e1e665`, `115b292807`, `9fa3791da2`, `430da290af`,
`97d285e147`, `3878d01d75`, `78e42d07ea`, `6d04a0cddb`, `3350ba3eb2`, `696e2eb03a`, `72d6ea73c7`,
`797fce4755`, `51f0eeca96`, `a652f38794`, `8beae85352`, `611f9ff109`, `eb14484508`, `6a1aed8ff1` —
the last one retires PUT /game, which the fork's load-game form still calls).

**Deferred — worth their own iteration (highlighted, not taken):**
- **Ares severe hazards: 2 steps from ONE production** (`7f94c96ac9` + `1903a73197`) — a rules fix for an
  in-scope expansion. Server: `AdjacencyCost.production` becomes `{mild, severe}`, `AresHandler.canPayProduction`
  (pairs arithmetic), `SelectProductionToLose.pairs` + validation, the deferred action's `warning`.
  Fork cost: the console surface `ConsoleProductionLoss.vue` / `consoleProductionLoss.ts` must SHOW the
  pair rule and refuse a split before submit; `MarsBoard.placementCostInfo.production` (a number today)
  feeds the board information layer; the MarsBot bypass (`player.isMarsBot`) stays. Medium-large.
- **Aquifer Turbines pays itself** (`945516b34c` + `47b8801c34`; `ICard.gainsFromTilePlacement`,
  `MarsBoard.megacreditsFromOceanPlacement`) — prelude in scope; the ocean leaves `behavior` for a
  filtered `PlaceOceanTile`, so the fork needs the `placementPreview` hook + a staged reasoner (Boom Town
  is the model). Upstream calls it a trial.
- `0b3efb7d95` `Game.drainQueue` — a 250-line reindent of `Player.takeAction`; no behaviour. Take when
  the Parliament's end-of-generation is next touched.
- `a24f78b198` MIN_RESPONSE_INTERVAL_MS — off by default; if ever enabled the console's
  `submitBatch` (sequential inputs in one press) must be exempt. Carries a response-interval histogram.
- `66d49fb387` (stylelint bump + lock) and the dependabot bumps (webpack 5.111.1 — check against the
  5.110 codegen bug memory; vue-tsc 3.3.11; mocha 12.0.2 — see §E's Mocha 12 note; globals, undici,
  fast-uri, brace-expansion) — a deps pass of its own.
- Console-backlog ideas from declined desktop commits: the tag-substitution marker on Earth/Science tags
  (`aaa9095a1e`), the conditional hand-discount marker (`747567d4b1`), the prelude-drawing warning for
  the creator (`2979458aad` / `preludeDrawingCards.ts`).
