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
`ConsoleCardAvailabilityPanel` (`variant="compact"` — the ONE-ROW status block of the draft
workspace and the start wizard's rail: name + status + the compact counter reason;
`variant="line"` — a NAME-LESS one-liner embedded inside a host's own verdict/status bar (the
hand's sale/discard modes, the deck pick's foot: the host names the card and owns the selection
state, the line adds only verdict + compact primary reason and renders NOTHING without a view);
`variant="panel"` — the fullscreen viewer's «ДОСТУПНОСТЬ» aside ABOVE «ПРАВИЛА», the ONE density
that speaks the full reason sentences + the modifier notes). Contexts:

- **`'draft'`** (evaluation for later): only `requirement: true` reasons speak; `unattainable` →
  the red «Требование уже не выполнить», otherwise the amber «Требование пока не выполнено»;
  informational always — the pick/buy is never blocked, disabled or auto-deselected.
- **`'play'`** (immediate decision): every real blocker is red under «Нельзя разыграть»; the
  turn/phase window is NOT a card defect (`AvailabilityBlocker` semantics) — it stays a separate
  amber note at the END of the list, and becomes the amber headline only when it is the ONLY thing
  in the way. The window flag is the SHELL's (`handTurnWindowClosed`), never re-derived.

### WHERE availability speaks is ONE policy (2026-09-02)

«Does this context show availability at all, and in which voice?» is a property of the
SELECTION'S SEMANTICS, decided once in **`availabilityContextFor(intent)`**
(`cardAvailability.ts`), never per call site. The product rule for an unlisted context:
availability speaks exactly when the CURRENT player is deciding the fate of an UNPLAYED card of
their own and «will I still get to play this?» informs that choice.

- **For-later decisions → `'draft'`:** `start-pick`, `draft-pick`, `research-buy`, `deck-keep`
  («оставь K из N» — ConsoleDeckPick), `drafted-review` (own mid-draft shelf/popover),
  `hand-sell` (patent sale), `hand-give` (discard / reveal / place-under) and **`draw-take`
  (2026-09-03: the «Получены карты» reveal — standalone, embedded, the single-card headless
  fullscreen, the multi-card X-zoom and the L3 swap back to the received card)**. A drawn card is
  the viewer's own future project arriving into the hand — the decision the reveal hosts is
  exactly «will I ever get to play this?». A sale/give-up is the same question from the other
  side — «what still has practical value?» — so this whole family deliberately speaks the
  requirement voice, never the play voice's red «нельзя разыграть» (which would read as an error
  of the CURRENT action) and never money/turn facts.
- **Play-now decisions → `'play'`:** `hand-play`, `project-play` (the degenerate `projectCard`
  pick→pay prompt — its candidates are usually playable, so the panel stays silent there).
- **Informational contexts → `undefined`, listed EXPLICITLY** so the exclusion is a documented
  decision: `played-browse`, `opponent-card`, `journal-link`, `endgame-review`, `reveal-view`
  (the reveals that are NOT `draw-take`: a deck-check verdict — «Поиск жизни» and family, where
  the revealed card is only an input of the effect; the conditional search's DISCARD pile;
  another player's public reveal), `source-inspect` («L3 Источник»), `target-pick`,
  `bot-review`. The `draw-take` / `reveal-view` split is by the CARD'S FATE in the flow, never
  by the surface's name: taken into the viewer's hand → decision; checked/discarded/foreign →
  information. **The safe default is silence**: an unknown intent (and an absent one) maps to
  `undefined` — never a player-specific verdict painted where nobody is deciding.

The fullscreen viewer receives the resolved context as an EXPLICIT opt-in
(`consoleCardZoom.availability`, set at open time through the policy) and builds its panel with
the pure **`buildZoomAvailability`** — the ONE builder, which also enforces three safety rules:
a non-card zoom entry (an Automa bonus plate — no `unplayableReasons`) never grows a panel; in
the play voice the LIVE hand offer wins over the reasons (a prompt-carried discount); and the
hand-flavoured turn note attaches ONLY to a card the viewer's own hand carries.
`repointConsoleCardZoom` (the reveal's received ⇄ source swap) takes the context PER REPOINT:
the swap back to the RECEIVED card re-attaches the `draw-take` voice, the swap to the SOURCE
passes nothing (an informational inspect stays silent) — a carried-over context would paint the
previous card's viewing intent onto a different card.

**The drawn reveal's own STATUS RAIL** (`.con-reveal__namebar`, both hosts — the standalone
modal and the embedded workspace stage) renders the shared line register beside the focused
card's name: `ConsoleCardAvailabilityPanel` (`variant="line"`) over the same view. It carries NO
take verb — the one bottom command bar owns «A Взять» (the local per-card `.con-start__slot-a`
pill and the namebar's verb chip were duplicates and are deleted); the rail's content stays
held (`--held`) through the embedded arrival gate AND a standalone deal cinematic
(`revealSceneStaged`), so a verdict is never published for a card still airborne. The subject
player is the batch OWNER by construction: `cardDrawReveals` lives only on the owner's own
PlayerViewModel and its cards are serialized with `unplayableReasons` (the same evaluator, the
same modifiers — Inventrix, Adaptation Technology, temporary bonuses — as the hand). Guard:
`tests/models/cardDrawRevealAvailability.spec.ts`, e2e
`tests/e2e/console-reveal-availability.spec.ts`.

**Availability never touches prompt eligibility.** In the sale/discard/deck-keep pickers the
prompt's own candidacy (`disabled`/`reasonsFor`), the selection state and the pick limits stay the
authoritative layers; the availability line is informational beside them — it never gates a pick,
never restyles the prompt's reason, never intercepts input. Parity is structural: the hand verdict
bar renders rows of the SAME view the fullscreen panel shows
(`ConsoleHandSection.playAvailability` / `evaluationAvailability` /
`ConsoleShell.zoomAvailabilityView`).

Server data feeding it: `cardsInHand` / `cardDrawReveals` / `draftedCards` (all
`unplayableReasons: true` in `ServerModel`), and `SelectCard.config.showUnplayableReasons` — set
by `Draft.ts`, `SelectInitialCards` and **every** `ChooseCards` prompt (buy AND keep, 2026-09-02:
the keep-some pick is the same for-later decision). The subject player is always the player the
model/prompt is built FOR — a drafted/dealt card is evaluated against the decider even before it
formally joins their hand.

Guards: `tests/client/components/console/cardAvailability.spec.ts` (incl. the policy table, the
safe default and the zoom builder), `consoleCardAvailabilityPanel.spec.ts` (all three densities),
`tests/deferredActions/ChooseCards.spec.ts` (keep-mode reasons),
`tests/models/ServerModel.spec.ts` (draftedCards reasons).

### …and the GAME'S FIRST card decision — the start wizard's buy step (2026-08-19)

The setup wizard's project buy is a pick FOR LATER exactly like a draft pick, so it is the same
system, not a second one:

- **Server.** `SelectInitialCards` passes `showUnplayableReasons: true` on the PROJECT step only —
  the same flag `Draft.ts` and the research buy (`ChooseCards`, `paying`) already set. Nothing
  special is computed: the model is built while the board still stands at its start-of-game values
  and no track has moved, so «требуется 0 °C · сейчас −30 °C» IS the reading the game will open on.
  The M€ line the engine also produces (no corporation, no money yet) is filtered out by the draft
  voice, and the corporation / prelude / CEO steps stay clean — those are not project cards and
  their own risk grammar (the burn gate) already speaks for them.
- **Client.** `consoleStartState.startCardAvailability(card)` / `stepShowsAvailability(cards)` are
  thin calls into `buildCardAvailability(…, 'draft')` — never a second filter. The status rail
  hosts the SAME `ConsoleCardAvailabilityPanel` (`variant="compact"`) the draft pins under its
  spread, carrying the card NAME itself so the rail never states it twice, and X opens the
  fullscreen viewer with `availability: 'draft'` (the summary review carries the reasons across on
  its synthetic models, so a bought card keeps its verdict).
- **The rail is ONE FIXED ROW in every state — the card-status contract (2026-09-03).** Every
  card-selection / card-browsing status rail (the start wizard's rail, the draft workspace's
  status bar, the hand's verdict bar) reserves EXACTLY `--con-cardstatus-h` (2.6rem base / 3rem
  TV / 2rem Deck — profiles override the TOKEN, never a surface): fixed `height`, never
  `min-height`, overflow hidden, no wrap. The taller per-step «avail» reserve
  (`--con-start-rail-avail-h`, the 4.3/5.6rem two-row zone) is DELETED — it let a long RU reason
  fold the rail to two lines and re-lay the whole card scene out (the reported start-buy jump).
  What made one row possible is the COMPACT REASON FORM: `unplayableReasonCompact()`
  (`unplayableReasonFormat.ts`) renders the same semantic fact as a counter — «Метки 1/3»,
  «Кислород 2/9%», «Температура −10/≤−14°C» (a max requirement marks its bound `≤`, at the
  EFFECTIVE value when modifiers stretch it); reasons with no counter shape (money, placement,
  targets, party situations) fall back to the full line, which is short. Every
  `CardAvailabilityReasonView` carries BOTH `text` (fullscreen) and `compact` (rails) — one
  model, two lengths; `stepShowsAvailability` only picks which CONTENT stands on the rail, never
  a different box. Guard: `tests/console/cardStatusContract.spec.ts` (stylesheet lock-step).

Guards: the `project requirement reasons` block in `tests/inputs/SelectInitialCards.spec.ts`,
the `start-hand availability` block in `tests/client/components/console/consoleStartState.spec.ts`,
and `tests/e2e/console-start-availability.spec.ts` (a production-sized deal — never test-mode —
measuring that the reserved rail actually fits its block and that the grid stays out of scroll).

### The status rail publishes only past the FOCUS COMMIT (2026-09-02)

The prelude → projects hop used to flash: the next step's entries and the default focus index land
at the director's commit phase, THREE phases before the new surface may paint, and the rail — a
SIBLING of the step pane, covered by neither the pane's entrance hold nor the deal's slot hold —
published the first project's name in that very frame, faded it out under the deal (the `--held`
opacity was a 150 ms TRANSITION, so the commit frame painted at ~full strength), and brought the
same name back after the deal: «появилось → исчезло → появилось». On the no-deal re-entries (LT
back, a consumed deal key, reduced motion) the rail simply named a card that was not on screen for
the whole transition span.

The fix is a LIFECYCLE, never a delay/debounce/fade:

- **`startRailCommitted({dealActive, transitionPhase})`** (`consoleStartState.ts`, pure) — the
  rail may publish card-specific payload only when the stage transition has settled
  (`!inputLocked(phase)` — releases on `'stabilizing-focus'`, the same beat that reopens selection
  input, so the rail reacts INSTANTLY to every ordinary d-pad move) AND the deal cinematic is not
  holding the cards.
- **One gated source:** every card-specific rail node (name, availability block, pick-state line,
  the coloured kind modifier) derives from `ConsoleStartScene.railCard`
  (`railCommitted ? focusedCard : undefined`), so the payload publishes and retracts ATOMICALLY —
  a name without availability, or a stale predecessor, is unrepresentable. Non-card rail parts
  (funds chip, header counter) are deliberately NOT gated.
- **The hold lands instantly:** `.con-start__status-inner--held` sets `transition: none` — the
  base 150 ms opacity transition is the RELEASE fade only.
- The rail's height is a constant (`--con-cardstatus-h`, the card-status contract) — layout never
  rides the payload, so the hold and release are pure opacity.

The sibling rails were already structurally sound and are the models this follows: the draft
workspace freezes its SOURCE until the same statement that arms its hold
(`presentedPacketFrozen` + `beatActive`), the deck pick's bar mounts already-held, and the hand
album arms motion only after the first settled paint (`pageMotionLive`).

Guards: the `startRailCommitted` block in `consoleStartState.spec.ts` (every input-locked phase
holds, deal holds, release edges) and `tests/e2e/console-start-rail-commit.spec.ts` — a
MutationObserver+interval probe (never rAF) armed BEFORE the advance press, asserting lifecycle
ORDER: no readable card name over held slots, exactly one off→on publish edge, and every readable
sample naming the one committed card.

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


## A CONTAINER IS AVAILABLE ONLY IF SOMETHING INSIDE IT IS (2026-08-18)

The player opened «ДЕЙСТВИЯ КАРТ», pressed «Права на астероиды · ВАРИАНТ 2» — offered
green, «Можно выполнить» in the dossier — and landed on a setup stage whose BOTH options
were refused: «✕ Недостаточно ресурсов на этой карте» twice, «◈ Выберите вариант» over a
dead confirm, and nothing to press but B. The card holds 0 asteroids; the row spends one.

**The cause is a mapping that legitimately has no answer.** A printed action row is not
always one server branch. `Права на астероиды` draws two rows over THREE branches — its
second row («астероид отсюда → производство M€ ИЛИ титан») stands for two of them —
`Атмосферные коллекторы` draws its spend row over three, and `Robinson Industries` draws
its whole action as ONE row over six. `branchPositionForNode` returns `undefined` for such
a row **by construction** (the row maps to a SET, so no single position is the answer), and
every reader then fell back to the CARD's verdict — which was legitimately «available»,
because the card's OTHER row (pay 1 M€, add an asteroid) was live. The variant inherited a
yes that was never about it.

**The rule, in one line:** a variant is unavailable exactly when EVERY branch it offers is
unavailable. One live inner branch keeps the row live; the single-branch case is a set of
one, so there is no second code path. It lives in ONE place —
`actionBranchView.nodeAvailability(group, branches, nodeIndex)` (and
`branchSetAvailability(set)` for a caller that already resolved the set) — and is asked at
both levels that offer the action:

- **the browse grid** (`consoleCardActions.buildTiles`) — the tile's `status` / `reason` /
  `blocker`, in the normal AND the repeat-mode paths, so a dead row is «НЕДОСТУПНА» with
  the concrete reason and A on it shakes instead of descending;
- **the composer** (`ConsoleActionComposer.variantBlockedReason` → `commitGate`) — asked
  again because the state can move between the press and the mount. Then the gate is
  `blocked` and its reason is the CTA hint: «Выберите вариант» is an instruction the player
  cannot follow when no option is selectable, and `selectBranch` refuses every one of them.

**Reasons are a CONJUNCTION here, never a disjunction.** When the whole set is refused,
each branch's own reason is true simultaneously, so `NodeAvailability.reasons` keeps them
all (deduped, in branch order) and a one-line consumer takes `[0]`. That is a fact, not a
«X or Y» guess — the rule this file opens with holds.

**What makes the client's rule SAFE is a server invariant:** `canAct === true` ⇒ at least
one preview branch is available. If that ever broke, «all branches blocked» would refuse an
action the engine WOULD have performed — strictly worse than the bug. It is guarded
corpus-wide (`tests/models/actionBranchAvailability.spec.ts`, three fixtures: destitute /
rich / rich-with-stored-resources). The CONVERSE is deliberately not asserted: a branch
models its own DIFFERENTIATING gate and leaves the card's shared one to `canAct` (Bio
Printing Facility's «gain 2 plants» branch says `available: true` while the card is out of
energy — the card level covers it).

Guards, in the order they bite:
- `tests/client/components/actions/actionBranchView.spec.ts` — the rule itself, incl. the
  templated reason keeping its params and «an unloaded preview is UNKNOWN, never blocked».
- `tests/client/components/console/consoleCardActions.spec.ts` — the tile: the exact
  Asteroid-Rights state, the branching row that names its «Выберите вариант» ask, and the
  repeat-mode twin.
- `tests/client/components/console/composerRender.spec.ts` — the gate/hint on the screen
  the report came from.
- `tests/models/actionBranchAvailability.spec.ts` — the CORPUS: every in-scope action card,
  both levels, with anti-vacuous floors including «at least 3 MULTI-branch dead variants
  exercised» (the bug's own shape). Verified to bite: reverting the browse fix reports
  Asteroid Rights, Atmo Collectors and Robinson Industries by name.

⚠️ Two smaller lies fell out of the same read and are fixed with it: a BRANCHING row now
declares the option choice it will ask for (`choiceKinds` gains `'or'`, so the tile does not
read as a one-press activation), and `ConsoleActionComposer.textOf` now forwards
`unavailableReasonParams` — a templated branch reason («Need ${0} more M€») was rendering
its slot literally, which is exactly the defect the `cardPlayPreview` fix above removed on
the play side.

The DESKTOP overlay had this right all along (`ActionGroupCard.rowStatus`:
`branches.every((b) => b.available === false)`) — the console rewrite resolved to a single
branch instead of the set. Sibling family, probed and clean: `canPlay === true` ⇒ some
`cardPlayPreview` branch available holds across all 455 in-scope project/prelude cards, and
the play surface has no printed-variant rows, so the ambiguity that caused this cannot arise
there.

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
