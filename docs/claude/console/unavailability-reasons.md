# Unavailability reasons — never a bare "недоступно"

**The rule (CLAUDE.md invariants 2, 4, 5):** availability is SERVER-authoritative and every disabled
control carries a CONCRETE reason. A reason names ONE blocker; it never makes the player guess
between "X or Y", and it never states something the code did not verify.

## Requirement ATTAINABILITY — «пока не выполнено» vs «уже не выполнить» (2026-08-16)

A card-evaluation surface (the draft pick, the research buy) needs a second axis the play-now
surfaces don't: is an unmet printed requirement still REACHABLE, or provably lost for the rest of
the game? The server answers on the same reason objects:

- **`UnplayableReason.unattainable?: boolean`** — set by `requirementUnattainable` in
  `models/unplayableReasons.ts`, only ever beside `requirement: true`. The verdict is conservative
  by construction: it is `true` ONLY for a **max** bound on a planetary parameter
  (temperature / oxygen / Venus / oceans) when (a) the parameter can never go back down under the
  ACTIVE expansions' real rules — every decrease mechanic in the codebase is Turmoil-gated (Reds
  rp03, Snow Cover, Dry Deserts, Magnetic Field Stimulation Delays), and a scale at its MAX is
  frozen even in Turmoil games (`Game.increase*` early-returns before the negative branches; ocean
  tiles are physically removed and never freeze); (b) no in-play bridging engine can still close
  the gap (Think Tank data for any card, Aeron Genomics for animal-resource cards — their stock can
  grow, so their PRESENCE keeps the door open); and (c) the real `satisfies` already failed with
  every requirement bonus the player currently holds folded in (Adaptation Technology, Inventrix,
  Morning Star, an ARMED Special Design, Scientists sp02, Underworld tokens — all summed by
  `getGlobalParameterRequirementBonus`, read without consuming anything). Future ACQUISITIONS are
  deliberately out of scope: the verdict describes the current state and recomputes as it changes.
  Moon rates, TR, tags, production: never classified — the honest default is the soft voice.
- **`UnplayableReason.current`** for a global parameter is the RAW scale value (the HUD number),
  never the bonus-adjusted score; the player's bonus is reported on the threshold side instead as
  **`effectiveCount`** (the stretched bound, present only when it differs from the printed one).

Guards: the `requirement attainability` block in `tests/models/unplayableReasons.spec.ts`.

### The ONE presentation model — `client/console/cardAvailability.ts`

Every console surface that talks about a card's availability builds a `CardAvailabilityView`
through `buildCardAvailability(input, context)` and renders it with
`ConsoleCardAvailabilityPanel` (`variant="compact"` — the draft workspace's two-row status block;
`variant="panel"` — the fullscreen viewer's «ДОСТУПНОСТЬ» aside ABOVE «ПРАВИЛА»). Contexts:

- **`'draft'`** (evaluation for later): only `requirement: true` reasons speak; `unattainable` →
  the red «Требование уже не выполнить», otherwise the amber «Требование пока не выполнено»;
  informational always — the pick/buy is never blocked, disabled or auto-deselected.
- **`'play'`** (immediate decision): every real blocker is red under «Нельзя разыграть»; the
  turn/phase window is NOT a card defect (`AvailabilityBlocker` semantics) — it stays a separate
  amber note at the END of the list, and becomes the amber headline only when it is the ONLY thing
  in the way. The window flag is the SHELL's (`handTurnWindowClosed`), never re-derived.

The fullscreen viewer receives the context as an EXPLICIT opt-in
(`consoleCardZoom.availability`, set at open time by the draft workspace zones, the task host's
buy/draft picks and the hand's play browse) — a discard pick, the patent sale, a played-table
browse or a resource-target viewer passes nothing and the panel cannot appear there. Parity is
structural: the hand verdict bar renders the first rows of the SAME view the fullscreen panel
shows (`ConsoleHandSection.playAvailability` / `ConsoleShell.zoomAvailabilityView`).

Guards: `tests/client/components/console/cardAvailability.spec.ts`,
`consoleCardAvailabilityPanel.spec.ts`.

### A requirement is printed ONCE (the fullscreen de-duplication)

The same oxygen requirement used to appear three times: as the card's own printed bar, as the
availability reason («Требуется кислород 9% · Сейчас: 0%») and as a rules block («Требуется
уровень кислорода не менее 9%»). The reason strictly dominates the rule — it adds the current
value — so the rules panel hides THAT block. The link is structural:

- `UnplayableReason.requirementKey` is the `CardInfoBlock.id` of the block the reason restates —
  the same `req:<RequirementType>[:<tag|resource>][~<n>]` address
  `buildCardInformation.requirementBlock` produces, rebuilt in `unplayableReasons.requirementBlockId`
  from the same descriptor (per-TYPE ordinal counted over ALL requirements, met ones included).
  **Never a text comparison.**
- It is an **allow-list** (`FULLY_RESTATED_REQUIREMENTS`) and fails CLOSED: a requirement whose
  printed rule says more than the reason — `all` («any player»), `nextTo` (adjacency), a political
  situation, a consolidated block like «city adjacent to an ocean», any Moon/Underworld type with
  no templated reason — carries no key, and its rule stays.
- **A blocked EFFECT is not a duplicated requirement.** «Невозможно уменьшить производство» is
  situational (no `requirement` flag, no key), so «ПРИ РОЗЫГРЫШЕ: уменьшите производство растений
  на 1» keeps its rule. Only the requirement family can ever suppress anything.
- The client side is pure (`components/console/consoleCardRules.ts`): the view collects
  `coveredRequirementIds` from the reasons it ACTUALLY renders (a reason filtered out of the draft
  voice can never silence a rule), `visibleAnnotations` drops those rows and any group left empty
  — no orphan chip, no reserved height, no gap — and `cardHasRules` is asked WITH the suppression,
  so a card whose only block was that requirement mounts no empty panel.

Guards: the `requirementKey` cases in `tests/models/unplayableReasons.spec.ts`,
`tests/client/components/console/consoleCardRulesSuppress.spec.ts`, and the e2e chip/text
assertions.

### The fullscreen RIGHT COLUMN is ONE adaptive stack (`.con-zoom-sidecol`)

Two independently positioned boxes is what pushed «ДОСТУПНОСТЬ» under the command bar on a
rules-heavy card (Домашний скот) while free space sat unused above. The column is now one
container with three properties, all layout — no magic coordinates, no per-card cases, no
`z-index` making content merely *appear* above the footer:

1. **The budget is the modal's own midrow.** `.con-zoom .card-zoom-side` is `align-self: stretch`
   and the column is `height: 100%`, so the band between the page counter and the fixed
   `.card-zoom-actions` bar IS the available height — measured by the layout, tracking any
   profile's chrome for free. The former `76/82/86vh` caps are gone (a vh guess cannot know the
   footer); the inspect dossier rides the same rule.
2. **The stack is CENTRED ON THE CARD, and that needs no JS.** The card is itself centred inside
   this very band, so the band's middle IS the card's middle: `justify-content: center` places
   `desiredTop = cardCenterY − stackHeight / 2` exactly, for the WHOLE group (availability + gap +
   rules) rather than per panel — and the clamp into the safe area is free, because a group that
   would overflow simply fills the band instead. Measured in e2e at both resolutions: «Комета»
   691–1379 vs card centre 1035, «Домашний скот» 169–1901 vs the same 1035.
3. **Priority is expressed in flex, and it is the reverse of the first iteration.** Availability
   leads and never shrinks (`flex: 0 0 auto`; its ceiling is `calc(100% - 7.8rem)` — stated as the
   thing it must leave behind, the rules head plus a line of body, not an arbitrary fraction);
   the rules box is the one that yields (`flex: 0 1 auto; min-height: 0`, `max-height: 100%`) and
   only its BODY scrolls — the `§ ПРАВИЛА` head sits outside that scroll and always stands.
   The panel header itself is ONE compact status line (`✕ НЕЛЬЗЯ РАЗЫГРАТЬ` / «ТРЕБОВАНИЕ ПОКА НЕ
   ВЫПОЛНЕНО» / …): the state names the panel better than a generic «ДОСТУПНОСТЬ» kicker above it,
   and the second level was exactly the vertical space a rules-heavy card lacked. The scroll is the LAST resort: `ConsoleScrollArea` draws its continuation
   rail, and the right stick pages it (`ConsoleCardRulesPanel.scrollBody`, routed from
   `ConsoleShell.handleZoomIntent`, which still swallows the stick when nothing overflows — no new
   binding, no advertised verb for a journey that does not exist).

⚠️ The rules panel can therefore be SHORTER than it is standalone. That is deliberate: the
availability verdict outranks the card's permanent text. `tv-reading-matrix.spec.ts` still passes
(its cards are playable, so no panel joins them) — but a future matrix card that IS blocked will
legitimately scroll its rules.

⚠️ **A fit that misses by single pixels is a PADDING bug, not a «too much text» one.** The dense
card missed by exactly **5 px** and scrolled; the fix was the column gap (`.8rem → .6rem`) and the
TV rules body's asymmetric bottom overhang (`1.35rem → 1.1rem`), never a smaller type size. The
e2e reports `rulesShortfall` for exactly this reason — read the number before theorising.

Guard: `tests/e2e/console-card-availability.spec.ts` — parameterised over `tv-4k` + `fhd`,
measuring the real boxes: availability above rules, both above the command bar and below the
counter, availability never clipped, the head never collapsing, one shared width, and a stable
column top across a card with a panel and one without.

The failure this file exists to prevent: a player holding **510 M€** opened «СТАНДАРТНЫЕ ПРОЕКТЫ»,
found «КОЛОНИЯ» greyed out, and was told «Сейчас недоступно». The real cause — every colony tile was
full — was invisible to the client, and the client's own fallback ("cost > my M€ → not enough money")
would have been a *different* lie.

## The three reason engines (one family, one shape)

All three produce `UnplayableReason[]` (`src/common/cards/UnplayableReason.ts`) and all three take
their per-card wording from a **co-located hook in the card file**, never a fork-only central table —
so an upstream change to the gate lands in the same diff as its reason and the two cannot drift.

| Engine | Answers | Hook | Model field |
| --- | --- | --- | --- |
| `models/unplayableReasons.ts` | why a card in HAND can't be played | `ICard.unplayableReason?` | `CardModel.unplayableReasons` |
| `models/actionUnavailableReasons.ts` | why a blue card's ACTION can't be used | `ICard.actionUnavailableReason?` | `CardModel.actionReasons` |
| **`models/standardProjectReasons.ts`** | why a STANDARD PROJECT can't be used | `ICard.actionUnavailableReason?` (same hook) | `CardModel.actionReasons` |

### Why standard projects needed their own engine
They are the ONE family the menu deliberately lists while NOT actable (`Player.getStandardProjectOption`
passes a parallel `enabled` array), and their gate is bespoke: a free space for the tile, an open
colony slot, moon land, corruption, cards in hand. `isIProjectCard` and `isIActionCard` are both false
for them, so neither older engine ever saw them, and `SelectCardToPlay.toModel` had a `disabledReasons`
slot it never filled. The client was left guessing by construction.

### Wiring
`ModelUtils.cardsToModel` → the `enabled?.[index] === false` branch → `isIStandardProjectCard(card)`
→ `standardProjectUnavailableReasons(player, card)` → `model.actionReasons`. No opt-in flag: `enabled`
is only ever false for a standard project in this menu, and the call never re-runs `canAct` (pricey
for the placement projects — the caller already established unavailability).

### Order is deliberate — the STRUCTURAL blocker leads
A rules block survives any amount of money, so it is the honest headline; the M€ gap follows (and the
screen's wallet strip already shows it). One-line consumers take `[0]`.

`StandardProjectCard.canPlayOptions` is **public** so the explainer reads the SAME affordability
request the gate uses — a hand-built cost/TR/reserve triple would drift from `canAct`.
`Player.affordabilityDeficitFor(options)` is the generalization of `affordabilityDeficit(card)`.
A missing RESERVED cube (the Moon projects' titanium/steel) is named as a RESOURCE, not folded into
the M€ gap — `maxSpendable` goes negative there and would report a missing cube as a money problem.

### Adding a standard project
If its `canAct` is affordability-only, nothing to do. If it overrides `canAct`, add
`actionUnavailableReason(player)` right next to that override, mirroring the same checks in the same
order, returning `undefined` when its own condition is satisfied (the block is the payment).
Builders live in `src/server/cards/actionReasons.ts`.

### Aggregate reasons (Build Colony)
When N objects are each blocked, one sentence must still be exactly true.
`BuildColonyStandardProject.colonyBlocker` classifies every tile with the same checks in the same
order as `Colonies.getPlayableColonies`, then names ONE cause when a single cause explains every tile
(«Все колонии заполнены»), and otherwise reports the **inventory** («заполнено — 3, уже ваши — 2») —
a fact, not a disjunction. An "every/all" claim is only made when the count actually equals the total.

## The client contract
`consoleQuickModel.buildStdProjectItems` reads `c.actionReasons?.[0]` FIRST; the off-turn and
M€-deficit branches remain only as fallbacks for when the server sent nothing. **Never re-derive a
reason client-side when the server can know it** — a guess is right only by accident.

Guards: `tests/models/standardProjectReasons.spec.ts` (incl. the explainer → `cardsToModel` →
`CardModel.actionReasons` wiring test, which is the piece that would otherwise degrade silently) and
the "SERVER reason wins over the client M€ guess" rows in
`tests/client/components/console/consoleQuickModel.spec.ts`.

## The server sweep — where a reason could go missing, and why it can't now

An exhaustive audit of every server producer of disabled/unavailable state found the
gaps below. The fixes are deliberately **structural** (one place, can't be forgotten)
rather than per-call-site.

### Preview branches — the worst offender (18 sites, one fix)
`ActionPreviewBranch.available:false` with no `unavailableReason`. This is the reason
the repeat picker, the action confirm modal and the console composers printed
«Сейчас недоступно» or nothing: those surfaces deliberately ignore the card-level
`actionReasons` and show the BRANCH reason only. 18 `singleBranch` callers had a
co-located `actionUnavailableReason` hook and never threaded it.
**Fix:** `singleBranch` and `dynamic` (`cards/actionPreviews.ts`) now fall back to
`card.actionUnavailableReason?.(player)` themselves — the same fallback the bespoke
path in `models/actionPreview.ts` already made. The declarative single-action branch
there falls back too (its `subAvailability` scan only walks the behavior, so a card
blocked by a BESPOKE gate collected nothing).
**Guard:** `tests/models/actionPreviewReasonCoverage.spec.ts` — behavioural, not a
source sniff: it previews every in-scope action card in a fixture where most are
blocked and fails listing any branch with a blank reason. Verified to bite (it
reports exactly those 16 cards when the fallback is removed) and carries
anti-vacuous floors on cards-walked and branches-blocked.

### Templated reasons losing their params
`models/cardPlayPreview.ts` sent `unavailableReason` without `unavailableReasonParams`
(its action-preview twin always did), so «Need ${0} more M€» reached the player with a
literal, unfilled `${0}`.

### Type-level guarantees (a silent producer becomes a compile error)
- `DisabledOptionModel.reason` is **required** (`common/models/PlayerInputModel.ts`).
  All five producers already complied; the type now keeps it that way.
- `IColonyTrader.disabledReason` returns `string | Message | undefined`, and
  `undefined` has ONE documented meaning: the player doesn't own the card, so there is
  nothing to explain. Every other refusal names its blocker.

### Colony trade fee — four card traders that vanished silently
`TitanFloatingLaunchPad`, `DarksideSmugglersUnion`, `CollegiumCopernicus`,
`HecateSpeditions` implemented neither `optionMetadata` nor `disabledReason`, and
`Colonies.ts` gated the disabled row on **both**, so a player who owned the card
watched their payment path disappear. Each now mirrors its own `canUse` in order
(no floaters → already used this generation → …), and the gate is the REASON alone;
metadata stays a presentation extra. Guard: `tests/cards/colonies/colonyTraderReasons.spec.ts`.

### Draft re-pick
`Draft.ts` disabled the already-chosen card via `enabled` with no parallel reason, so
the draft screen greyed a card the player picked themselves and said «Недоступна».
Now sends `enabledReasons` (the option added for Merger).

### Self vanishing from its own picker
`DecreaseAnyProduction.blockedTargets` walked `opponents` while the candidate list is
`game.players` — so the VIEWER disappeared from the target picker, unexplained,
whenever their own production sat at the minimum.

### Known frontier (NOT fixed — needs a Moon-board reasoner)
`illegalSpaces` is auto-derived only by `createMarsSelectSpace` (Mars-only). Eight
`SelectSpace` prompts bypass it, so their dimmed cells carry no reason:
`BasePlaceMoonTile` + `PlaceSpecialMoonTile` (these two cover ALL moon placements),
`HostileTakeover` ×2, `LunarMineUrbanization`, `Eris` (community), `DesperateMeasures`
(ares), `RemoveOceanTile` (turmoil). The moon ones need a moon equivalent of
`MarsBoard.computeIllegalReasons`; the removal/hazard prompts need a `customReasoner`
plus new `PlacementIllegalReason` members, because the generic placement vocabulary
("Already has a tile") is nonsense for a prompt asking what to REMOVE. Moon /
community / turmoil are outside the premium-subsystem scope
(`docs/claude/expansion-adaptation-checklist.md`).

Also deliberately left: `Player.getActions()` never calls `setDisabledOptions`, so the
top-level action menu lists only what IS available. The console derives its own
reasons for those verbs (`turnIntents` / `consoleQuickModel` / `consoleMaModel`), and
adding a parallel disabled channel there is a larger change to the load-bearing
"availability = option PRESENCE" contract — worth doing, but not as a side effect.

## Related fixes in the same pass (2026-08-07)
- `ConsoleColoniesSection.reasonFor` pinned `myTurn: true, awaitingInput: true`, making rung 3 of
  `colonyTradeReason` always fire and rung 4 unreachable — off-turn players were told «не хватает
  ресурсов на оплату». They are props now, fed the shell's real signals.
- `ConsolePlayCardConfirm` never passed `requirementReason` to `computePrimaryAction`, so the biggest
  control on the screen read «Сейчас недоступно» while the server's concrete reason sat two rows
  above it; its `statusLabel` also said «требуется выбор» for a rules-blocked branch that offers no
  choice. Both now carry the branch reason (mirroring `ConsoleActionComposer.commitGate`).
- `consoleMaModel` re-derived milestone readiness with `claimable === true || score >= threshold`,
  letting a met-on-paper threshold override a server "no"; and its blocker tail returned «завершите
  текущее действие» while the free action menu WAS live. Now `claimable ?? threshold` (server first,
  heuristic only when the flag is absent) and a kind-specific honest tail. Same tail fixed in
  `ConsoleShell.maConfirmBlockReason`.
- `Merger` now sends `enabledReasons` (new `SelectCard` option, parallel to `enabled`), and
  `ConsoleStartScene` renders it — a disabled start-scene candidate used to hardcode
  `reason: undefined`, so it showed a bare «Недоступна» badge and nothing else.
