<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. -->

## ⭐⭐ THE «ПОЧЕМУ»-LAYER (2026-09-02) — every band answers WHY, typed end to end

**The contract:** every green/red band («Вы получили / Вы потеряли») carries
`ViewerImpactMeta.causes` — a REQUIRED, non-empty (for a non-neutral sign)
list of typed cause groups, each `{origin, own?, trigger?, triggerTile?,
triggerCard?, gains, losses}`. `origin` REUSES the server's own `EventSource`
union (card / corporation / spaceBonus / oceanBonus / colony+benefit /
bonusCard / milestone / award / globalParameter / …) plus ONE client fallback
`{kind:'action', category?}` — the root action itself, whose category names
the rule (solar phase, planetary event). The renderer never guesses from
text, never reads live game state, and never invents a cause.

**Where the causes come from (nothing new is recorded — the events already
knew):**
- **Root chains** — `viewerImpactOfChain` groups every viewer chip by the
  recording event's `source`, else the nearest `effect-triggered` ancestor's
  (walk `parentId`; that ancestor also donates `trigger` — only when its
  source IS the cause's source), else the chain ROOT's source, else the root
  category. `triggerTile` = the chain's ONE `tile-placed` event (ambiguous ⇒
  generic tail); `triggerCard` = the root card for `card-played*` triggers.
  `own` = the source card/corp belongs to the viewer (Tharsis' owner reads
  «ВАША КОРПОРАЦИЯ Tharsis Republic · за размещение города» while the actor
  chip stays the builder — source, trigger and actor never substitute).
- **Bot turns** — `AutomaTurnLog.finish()` JOINS the turn's event chain
  (sliced by the correlationId captured at `begin()`) back onto each non-bot
  participant's snapshot diff: `MarsBotImpact.causes` (per-source SIGNED
  per-resource sums, effect triggers included). The card stays BORN FINAL —
  no event fetch at presentation time; `viewerImpactOfBotTurn` converts the
  script causes and adds ONE residual group for whatever share of the band's
  totals the attribution didn't cover (a cube attack, an old save), keyed on
  the turn's REVEALED card (`botTurnFallbackOrigin`). The causes ride
  `turnHistory` and round-trip serialization (S10 asserts byte-equality).
- **The standalone hostile fallback** (`buildNegativeNotification`) builds
  its causes through the SAME `lossCausesOf` derivation — the two hostile
  presentations cannot disagree.

**Rendering — ONE grammar, one place (`notificationCauseView.ts`, pure):**
`causeLinesOf(meta)` → `[{labelKey, nameKey, detailKey?, triggerKey?,
triggerParamKey?, chips?}]`. The console card renders them as the
`.con-notif__why` zone hanging DIRECTLY off the band (a sign-tinted left rail
states the association geometrically): the stable dim anchor («ИСТОЧНИК» /
«ВАША КАРТА» / «ВАША КОРПОРАЦИЯ»), the accent name (card / «Бонус клетки» /
«Торговый доход · Европа» / the bonus card), the quiet trigger tail («за
размещение города» — the three base tiles are complete phrases for clean RU
declension, special tiles ride `for placing: ${0}`). SEVERAL causes each
carry their own delta chips (`__chip--mini`) — a multi-source total never
claims one origin. The actor stays in the head chip ONLY (the old «Из-за
actor card» line is gone); the bot card's headline-as-cause special case is
gone too — under a live band the zone IS the cause voice for every family,
and the headline returns only when the zone could not be built (old saves).

**The guarantee is structural, never a placeholder:** `causes` is a REQUIRED
field (a producer cannot compile without deciding it); the mapper is
EXHAUSTIVE over `EventSource['kind']` and `EventTrigger` (a `never` guard + a
`Record` — a new kind/trigger fails the compile); an unattributable origin
('system' with no category) yields NO line + a `console.warn` in the card's
`mounted()` — «Игровой эффект»-style masking is forbidden. The corpus proof:
`crossPlayerDeliveryAudit.spec.ts`'s `bandOf` asserts, for EVERY scenario
S1–S21, that a non-neutral band carries causes AND that `causeLinesOf`
renders ≥1 nameable line; `notificationCauseView.spec.ts` is the render-side
worklist (every origin family → a real i18n key). Grep-verified RU keys for
every label/trigger phrase live in `ru/ui.json`.

**Known attribution shapes (correct, documented):** the Ares owner benefit
inherits the PLACER's card as its source (the cause names the card whose
placement paid you); a WGT payout answers with the root category («Солнечная
фаза»); colony income splits by `benefit` («Торговый доход» / «Бонус
колонии» · colony name). The production phase records no events and shows no
notifications (pre-existing frontier — nothing causeless is shown).

## ⭐⭐ ITERATION 3 (2026-09-01) — ATOMIC DELIVERY: the lifecycle is monotonic

**The contract: `created → prepared → queued → presented → dismissed/expired`,
with NO backward edges.** A presented card is DELIVERED — from its first
visible frame it leaves only by its own timer or the player's explicit B.

**1. The PREPARING stage (semantic completeness before frame one).** The server
reports the causal chains that may STILL GROW — `GameModel.openEventCorrelations`
(= rootIds captured by pending deferred actions + each player's pending prompt's
scope; `Game.openEventCorrelations()`). A root-event model whose correlation is
open waits in `notificationState.preparing` (rebuilt from the fresh stream on
every diff via `diffRootNotifications`' `rebuildIds`), and enters the queue only
when the chain closes — so the frame-one snapshot (sign, hero, importance, TTL,
source) is final. Bounded by `PREPARING_MAX_MS` (90 s, warn — a leaked open
chain must not swallow the event). The initial silent seed stashes nothing.
`refreshVisibleImpacts` is GONE: its in-place upgrade of a VISIBLE card (band
appears, sign flips, importance→critical, TTL re-arms) was the late-hero defect.
Only QUEUED models may still enrich (`refreshQueuedImpacts` — the degraded-mode
net for servers without the field; bot-turn cards excluded outright).

**2. The BOT card is born final.** `viewerImpactOfBotTurn` reads the ATTACK
steps too (the end-of-turn snapshot deliberately DROPS a change an attack step
already narrated — the server's `coveredByAttack` de-dup — so for a bonus-card
attack the attack step is the ONLY carrier of the loss; reading impacts alone
built the card NEUTRAL and the hero arrived through the visible refresh). The
attack share is BACKED OUT of the surviving snapshot net, so the two carriers
never double-count and a mixed result keeps both directions. A loss-carrying
turn card gets the hostile 13 s TTL AT BUILD and is EXEMPT from
`trimBotTurnBacklog` (a loss is not «бот походил» noise); the victim's own
summary line is dropped STRUCTURALLY (`step.attack.target === viewer`), and the
card's headline («разыграл бонусную карту ‹X›») renders UNDER the band as the
cause voice (`.con-notif__headline--cause`) — the one-shot bonus card leaves the
game right after resolving, so that line is the player's only in-flow causal
anchor. Server side, the bonus card's identity is fixed at the moment it ACTS:
`EventSource {kind:'bonusCard'}` (wrapped around `resolveBonusCard`) + the fate
lines name the card («MarsBot bonus card ${0} was destroyed…»; old keys stay for
archived games). The turn's type label is the neutral «Turn finished» — the
actor chip is the ONE identity statement.

**3. The delivery gate is not a visibility gate.** Blockers
(`notificationDeliveryBlocked` — animation / reveal / theater / ceremony) gate
exactly ONE transition: queued → presented (`pushTransient` /
`promoteFromQueue`). `holdVisibleTransient` + the `onForegroundBlocked`
re-queue are DELETED: a player animation used to yank an already-read card
behind «ДАЛЬШЕ +N», and — worse — the bot card's own delivery TRIGGERS the
bot's tile animation (`deliverBotTurnVisual`), so the very card explaining the
tile evicted itself and re-entered enriched with a fresh TTL: BOTH of the
suspected «late hero / two versions» shapes came from this one edge. The
PRIORITY EVICTION is gone for the same reason (presented → queued is a
backward edge): priority now acts only inside the queue, at promotion.

**4. TWO queue indicators, mutually exclusive by construction.**
`.con-notifq` («ДАЛЬШЕ +N») is CONTEXTUAL: it renders only UNDER an active
card (`transient.length > 0 && queue.length > 0`) and leaves with it. With NO
active card the backlog signal is the top-bar `.con-status__evq` slot right
after «ПКЛ.» (ConsoleStatusStrip) — a PERMANENT compact HUD instrument
(polish iteration): the same three pieces always render (hairline divider ·
the ◈ event glyph · a fixed-width tabular count cell), so nothing ever
appears, disappears or moves — DORMANT is a low-contrast «0», WAITING
(`--on`) raises contrast only (paint, zero layout). A non-zero count is
admitted only through the **500 ms DWELL** (`pendingEngageMs`): the raw state
(«no active card + non-empty queue + `isNotificationDeliveryBlocked()`») must
hold CONTINUOUSLY — any interruption cancels the timer, and the expiry
re-checks the live conditions (`shown = engagedLatch && raw`), so a sub-500 ms
blocker never flashes a «1». Engagement shows the ACTUAL count at once;
subsequent churn coalesces in `pendingCoalesceMs` (120 ms) into one calm
digit crossfade (two grid layers — never `mode="out-in"`); the return to
dormant «0» is immediate. NO pulse/scale/blink; reduced motion drops the
crossfade and the contrast ease (instant, still zero reflow). Purely
presentational — real delivery/FIFO never waits on any of it. Guards: the
evq describe in `consoleStatusStrip.spec.ts` (dwell, cancellation, re-check,
coalescing, active-card rest, 9+, read-only) + the e2e's per-frame rect
assertion (the slot and the «ПКЛ.» block hold ONE box across the whole run).

Guards: the preparing/monotonic blocks in `notificationState.spec.ts`, the
attack-step blocks in `notificationSemantics.spec.ts`, the atomic bonus-card
build + hostile trim-exemption in `marsBotPresentation.spec.ts`, `rebuildIds`
in `notificationModel.spec.ts`, `tests/events/openEventCorrelations.spec.ts` +
`bonusCardAttackEvents.spec.ts` + `tests/automa/trackTagLabelLocalization.spec.ts`
(server), and the frame-observed e2e
`tests/e2e/console-notification-bonus-attack.spec.ts` (a LIVE B01 Meteor
Shower run: sign frozen at mount, band from frame one, one episode per id, TTL
armed once, indicators exclusive in every sampled frame, the card named, B
final).

## ⭐⭐ CROSS-PLAYER COMPLETENESS (2026-09-02) — the Tharsis gap, the bot-script seam, and the coverage guard

**The reported defect:** a foreign city raised the Tharsis Republic owner's M€
production and the owner heard NOTHING. Root cause (bot actor — the fork's
primary mode): Tharsis' `onTilePlaced` DEFERS its payout (`GainProduction`),
and `AutomaTurnLog.finish()` used to close the turn script BEFORE the deferred
queue drained — the mutation was real and evented (the deferred action carries
the captured `automa-turn` context), but the whole-turn snapshot diff ran too
early, so the change was ABSENT from the script's impact steps, and the bot
turn card (the SINGLE presentation owner for `automa-turn` chains — the
generic root pipeline deliberately skips them) never told its owner. The gain
then fell in the SEAM between two turns: the next turn's `begin()` re-snapshots
AFTER the drain, so no turn ever carried it. The human-actor path was already
delivered end to end (S8 proves it).

**The fix (`AutomaController.takeTurn`):** the queue drains BEFORE the script
closes — `finish()` runs when the drain empties, or immediately at an INPUT
boundary (a victim's pick pauses the drain; that interactive tail is narrated
by its own attack step announced at defer time, and `turnRecording` is
transient by construction so it must not survive the request). `begin()` now
captures the turn's correlationId (finish runs outside the scope). Bonus
repairs for free: an attack RESOLVED during the drain now lands its
`note()`/logs in the script (they used to no-op after finish), and colony
payouts of a bot trade (B19/B20 → `GiveColonyBonus`) reach the script's impact
steps. Specs: S10 (deferred payout reaches the script + single-owner
presentation), S18 (sync + deferred payouts merge into ONE impact step).

**Recorder hardening:** the loose-bookkeeping drop rescue is now
SIGN-AGNOSTIC — `crossPlayerTouch` (a foreign player's `from`, either
direction) keeps the delta recorded even with no scope; previously only
losses were rescued and a cross-player GAIN with an explicit foreign `from`
could vanish. The Hydronetwork's Jovian-tag fan-out
(`onNonCardTagAddedByAnyPlayer`) now wraps per owner in `withEffect` like
every sibling fan-out.

**THE COVERAGE GUARD — `tests/notifications/crossPlayerCoverageGuard.spec.ts`.**
The machine-checked completeness proof (the thing that makes «100% of sources
classified» a spec, not a claim). Three legs: (1) the chokepoint invariant —
delivery is a property of the recorder chokepoints + scoped doors, never of a
card author remembering an API; (2) the delivery scenarios — one per
cross-player MECHANISM FAMILY (S1–S20 in `crossPlayerDeliveryAudit.spec.ts`);
(3) the enumeration — every card of the premium 8-module scope (520 sources)
is classified structurally (reactive any-player hooks / cross-player behavior
fields / attack-API tokens in the class's own source) or via an audited
MANUAL map; a card that merely LOOKS at the table (`.opponents`,
`game.players`, `SelectPlayer`, `giveColonyBonus`, …) without a recognized
family FAILS the guard until classified. Non-card doors ride a compile-time
exhaustive `Record<JournalActionCategory, …>`; automa sources ride
`Record<BonusCardId, …>` + `Record<MarsBotCorpId, …>` — a new door / bonus
card / bot corporation cannot compile without a classification decision.
Families: reactive-owner-payout · production-attack · stock-attack ·
stock-steal · card-resource-attack · table-payout · card-draw-payout ·
track-attack.

**Scenario index (crossPlayerDeliveryAudit.spec.ts):** S1–S7 (2026-09-01
audit) · S8 Tharsis human actor (deferred production) · S9 Tharsis self
(policy intact) · S10 bot city → script + one presentation owner · S11 floor
no-op silent + honest partial · S12 sequential order · S13 multi-recipient
isolation · S14 steal (attacker named, transfer) · S15 blue-action door +
card-resource attack · S16 colony trade payout · S17 opponents' card draw ·
S18 bot multi-change turn · S19 save/reload round-trip · S20 undo leaves
nothing stale (client half: notificationState.spec «dropPreparing forgets an
undone event»; prompt-open queueing: notificationState.spec blocking-foreground
specs — delivery waits, never drops).

## ⭐⭐ CROSS-PLAYER DELIVERY AUDIT (2026-09-01) — the viewer HEARS about every foreign action that touches them

**The contract:** any change to the VIEWER's state caused by ANOTHER player's
action must produce a typed event INSIDE that action's correlation — that is
the one and only thing that lets the pipeline lead a card with «вы получили /
вы потеряли». The recorder DROPS a delta with no source, no live scope and no
cross-player `from` (gains have NO rescue at all), so **every action door must
open a scope and every cross-player mutation must carry `from` or run inside
one**. The corpus vehicle is `tests/notifications/crossPlayerDeliveryAudit.spec.ts`
(REAL doors → real events → the client's own `diffRootNotifications` → the
band): S1 the reported Ares owner benefit (card-play placement, incl. the
open-correlation hold mid-prompt), S2 foreign-city passive payouts (Rover
Construction M€ + Pets animal, `ownSource`), S3 the plants-conversion door,
S4 a deferred victim pick (one hostile story, no `neg…` twin), S5-S7 the
holes fixed by this audit.

**Holes found & fixed (all were SILENT — no event, nothing to deliver):**
- **WGT / solar phase had NO scope** (`Game.worldGovernmentTerraformingInput`)
  — a WGT ocean's Ares owner benefit and any passive payout it triggered were
  dropped outright, their logs ungrouped orphans. Now every branch runs in
  `wgtAct` (category `'solar-phase'`, header logged FIRST so the root actor is
  the acting player — a payout line leading the group would self-suppress the
  card on its recipient's own screen).
- **`playCorporationCard` had NO scope** — the corp's deferred `play()`
  captured nothing, so Mons Insurance's −2 M€ production on every opponent
  produced NO event (compounded by a missing `from`, now also fixed — mirrors
  Recession). Scoped as category `'card-play'`; the scope ends BEFORE
  `playerIsFinishedWithResearchPhase` (the game's phase progression must not
  fold into one corp's correlation).
- **The FINAL greenery had NO scope** (`takeActionForFinalGreenery`) — the
  end-of-game Ares neighbour income vanished. Scoped per placement as the
  conversion (`standard-project` / CONVERT_PLANTS); ends before the deferred
  drain (the next placement is its own action).
- **Deimos' colony bonus wrote `stock.megacredits +=` directly** — the last
  cross-player field-write bypass; now `stock.add` (recorded + logged).
- **`GiveColonyBonus` cube #2..n lost the chain** — `Player.process` runs the
  continuation OUTSIDE the prompt's context by design, so the recursion now
  restores its own `eventContext` around `giveColonyBonus`.
- **Structural wrappers:** `onIncreaseTerraformRatingByAnyPlayer` and Mars
  Nomads' `onTilePlaced` fan-outs now run per-owner `withEffect` (like Game's
  tile fan-out) — a foreign owner's payout records as THEIR effect, never the
  actor's own gain; `recordCardResourceDelta` gained the crossPlayerAttack
  rescue (+`from: removingPlayer` at `removeResourceFrom`; deliberately NO
  `target` — that field means «moved to», steal semantics).
- **Layer gates:** an open journal / `drainQueueToJournal` no longer swallow
  PERSONAL-sign cards — a gain presents like a loss does (`sign !== 'neutral'`
  is journal-exempt).

**Documented frontier (no premium-scope card hits these today):**
`discardCardFromHand` emits no event (cross-player only via community's
Hygiea); `Player.ts` defer-outside-withEffect for hooks that RETURN an input;
the Ares owner payout inherits the placer's card as `source` (attribution,
not delivery — the band and cause line are correct); the MOON `onTilePlaced`
fan-out and all `onIdentificationByAnyPlayer` sites are BARE (moon/underworld
— out of premium scope, widen with the expansion checklist); Law Suit's
tableau transfer (`suedPlayer.playedCards.push`) is not evented — the victim's
notification rides the recorded M€ steal of the same chain.
(2026-09-02: the delta `onNonCardTagAddedByAnyPlayer` fan-out is now WRAPPED;
the recorder rescue is sign-agnostic — see § CROSS-PLAYER COMPLETENESS above.)

## ⭐ VIEWER-FIRST SEMANTICS (the 2026-09-01 rework) — the notification is about the VIEWER

The top-right toast leads with **what changed for its recipient**, not with the initiator's
chronology. Two INDEPENDENT semantic axes ride every `NotificationModel` (required fields —
a producer cannot compile without deciding both):

- **`sign: 'positive'|'negative'|'neutral'|'mixed'`** — viewer-relative, derived from TYPED
  event data only (`notificationSemantics.ts`), never from text. A mixed result is stated as
  BOTH lists (losses + gains) — deltas merge to the net WITHIN a direction, never across
  (netting a −2/+2 pair to silence would hide the attack; the task's mixed-result rule).
- **`importance: 'ambient'|'notable'|'critical'|'attention'`** — informational weight,
  deliberately decoupled from the sign: an opponent's big engine play stays `ambient` for a
  bystander; a viewer loss is `critical` whatever its size; a viewer gain / milestone /
  threat is `notable`; the turn prompts and warnings are `attention`.

**The pure core is `notificationSemantics.ts`**: `viewerImpactOfChain(chain, viewer, actor)`
(the viewer's own deltas inside a correlation chain — empty when viewer IS the actor, so own
actions never grow a "you paid 8" band), `viewerImpactOfBotTurn(turn, viewer, botColor)`
(from the typed turn script), `importanceForRoot(...)`, `signOf(...)`. The result is
`NotificationModel.viewerImpact: ViewerImpactMeta` — {sign, gains, losses, attacker,
sourceCard (+`ownSource` when it is the VIEWER's card that paid them), transfer, scope}.

**The console card (`ConsoleNotificationCard.vue`) renders the hierarchy**:
1. the **VIEWER BAND** (`.con-notif__you--<sign>`) — «▲ ВЫ ПОЛУЧИЛИ / ▼ ВЫ ПОТЕРЯЛИ / ⇄ ДЛЯ
   ВАС» label + glyph + tone (three channels — never colour alone), big delta chips (losses
   first), the transfer «→ attacker» tail, the honest scope + `before → after` line;
2. the **cause line** — «Из-за <actor> <card>» (the initiator is the reason, not the story);
3. the event's own voice (headline tokens / reveal line / bot outcome lines) — PRIMARY only
   when nothing personal happened (sign neutral ⇒ the old event-first layout);
4. context pills = the action's own outcome EXCLUDING the viewer's rows (they live in the
   band; shown for neutral/positive cards, dropped for a loss — the band + journal carry it).
The card also carries `.con-notif--sign-<sign>` + `.con-notif--imp-<importance>` (chrome
grades: ambient calm → notable rim → critical wide rail + one-shot opacity-only arrival wash
— the old `filter:brightness` prestige keyframes NEVER rendered under the console paint
baseline and were replaced the same way) and `data-notif-id` (the model id, for probes).

**ONE ACTION → ONE CARD (the de-dup contract).** `diffRootNotifications` now returns
`hostileCoveredIds` + `revealCoveredKeys` beside the models: a chain carrying a viewer loss
emits ONE hostile-upgraded root card (kind `negative`, priority/TTL/exemptions unchanged
machinery) and the layer seeds `seenNegativeIds` BEFORE the standalone hostile diff runs —
the old `g<corr>` + `neg<corr>` double is structurally impossible. Same for a public reveal
riding a root chain: it folds INTO that card (`model.reveal`) and its key silences
`diffRevealNotifications`. The standalone diffs stay as FALLBACKS for what a root card can't
cover: a loss recorded AFTER the root was seen/dismissed, a loss inside the viewer's own
suppressed action, a reveal outside a fresh root. (Iteration 3 superseded the old
visible-card upgrade: an open chain now waits in PREPARING and presents complete —
see § ATOMIC DELIVERY above; a visible card's semantics are frozen.)
`diffNegativeNotifications` also SKIPS `automa-turn` chains — the bot pipeline's own card
leads with `viewerImpact` from the turn script (`buildBotTurnNotification`), so a bot attack
is one card too. `coalesceBurst` merges ONLY sign-neutral normals — a personally-relevant
card is never swallowed into «События: N» (the summary restates sign neutral / imp ambient).

**The pad DETAIL contract widened**: press-and-HOLD X on ANY toast with a `correlationId`
opens the journal AT that event (`ConsoleShell.openJournalToNotification` — same guards as
the View toggle: board home only, never over a placement, refusals speak) and dismisses the
toast; the bot-turn card keeps its «Осмотреть ход» hold. The card's footer advertises
whichever it has («Зажать X Журнал» / «Осмотреть ход» + «B Закрыть»).

**Feed-mode semantics unchanged**: the hostile-upgraded root card is exempt via kind
`negative` (like the old standalone card), shows even with the journal open, and the
`affects` metadata is untouched — the personal filter behaves byte-identically, with fewer
cards. Console TV overrides in `console_tv.less` §16 (band label at the type floor).

## ⭐ ITERATION 2 (2026-09-01) — one premium system for EVERY family

**ONE ACTOR STATEMENT.** The initiator lives in the head's actor chip and
NOWHERE else: the headline and every bot outcome line render through
`withoutLeadingActor` (the same compaction `JournalGroup.childTokens` uses), so
«Бот» / a player's name never re-opens a line. A summary line that RESTATES the
viewer's own delta while the band leads is dropped at BUILD time
(`summaryLinesOf(…, dropViewer)` — one fact, one voice; the inspect keeps the
full log).

**OWNERSHIP CLUSTERS (`NotificationModel.pillGroups`).** Context deltas are
split by owner at the producer: `planet` (global parameters / neutral
readouts) · `actor` (the initiator's own changes) · `others` (a third player,
named). The card renders each cluster under a compact scope tag
(`.con-notif__cluster-tag` — МАРС / the actor's name / the player's name+dot),
so a bot's own +1 M€ can never masquerade as the viewer's reward. The viewer's
deltas are NEVER clustered — they are the band by construction. Root cards:
`contextPillGroups(contextVms)`; bot cards: planet=`turn.visual` params,
actor=the bot's own impact chips. The flat `pills` stays for burst summaries.

**ADAPTIVE HERO.** One delta → the band is a single confident statement (grid:
sign label left, `[icon] UNIT +N` flush right — `.con-notif__you--dense`; the
unit is SPOKEN via `UNIT_LABEL`, «ТЕПЛО +1», so a lone chip never floats in an
empty frame); several deltas wrap under the label as before. `__chip-value` is
the card's largest number (tabular).

**PLURAL GROUPS CROSS TOKEN BOUNDARIES.** `logLocalization.ts` is the ONE
localisation seam for token-rendered lines (`parseLocalizedLog` = translate +
`Log.parse` + `resolveEntriesPluralGroups`, which carries the nearest preceding
NUMBER over fragment seams — `b.number` emits a separate RAW_STRING token).
Wired into the console card, `JournalGroup`, `JournalEntry` and
`BotReviewLineContent`; the whole-string path (`translateMessage`) already
resolved groups. Server templates were renamed onto group form («${0} raised
${1} ${2} {step|steps}», the Hydronetwork spent/advanced pair, the colony
storage line, «${0} played the bonus card ${1}» — now NAMED) with proper RU
three-form values; the old keys stay in the locale files so archived games
keep rendering. «1 ряд(а)» / «шаг(ов)» / «ед. карт» are no longer expressible
on any tokenised line. The capped-list tail is plural-correct too
(«+${0} more {event|events}»).

**THE SCALE-BONUS TOAST IS DELETED — the claim is a beat of its action.**
`Game.claimScaleBonus` logs inside the LIVE action scope (verified by spec: the
claim line shares the crossing action's correlationId with the reward it
granted) and carries the parameter as a RESOURCE token (icon chip), so the
journal group / bot-turn script owns the whole story. The old client channel
(`handleScaleBonusClaims` diffing `game.scaleBonusClaims`, `seenScaleClaims`,
`buildScaleBonusClaimNotification`) is gone — it had no correlation, no
inspect, arrived after the turn's story, spoke the zone's imperative rule text
(«Повысьте производство тепла на 1») and, for MarsBot, misstated the reward
outright (the bot takes +2 M€, never heat production — automa p.9). The
board's claimed-zone marker remains the persistent record. **The class rule:**
a notification channel may not diff public game state for something an action
CAUSED — if it has a causing action, it rides that action's correlation.

**THE QUEUE COUNTER IS A TAIL, NOT A BANNER.** The centre-stage
`.con-banner--events` chip is deleted; the pending count renders as
`.con-notifq` — a quiet right-aligned service chip UNDER the toast stack
(«ДАЛЬШЕ +N», critical accent = warmer dot/ring only), visually bound to the
surface whose backlog it describes. FIFO semantics untouched
(`pendingSummary`).

**MATERIAL + TYPE.** The card is effectively opaque plate glass (laminate
gradient ≥0.985 alpha + top hairline + double drop shadow) — the right rail no
longer bleeds through the text. Importance grades restate the full material
stack with a stronger ring; `__headline` is the event-first primary voice (a
step above context type); summary lines are the secondary voice. The journal
chip's px label cap is re-capped in rem inside the card (TV truncation fix).

Guards: `logLocalization.spec.ts` (cross-token plurals), the ownership-cluster
blocks in `notificationModel.spec.ts` / `marsBotPresentation.spec.ts` (incl.
the viewer-line drop), `ScaleBonusClaims.spec.ts` (the claim's correlation +
RESOURCE token), and the e2e pair `console-notification-semantics.spec.ts`
(the actor-stated-once headline) + `console-notification-premium-bot.spec.ts`
(a LIVE bot turn: no line re-opens with the actor, clusters label the chips,
the centre banner does not exist, no «(s)»-compromise survives).

---

Guards: `notificationSemantics.spec.ts` (pure axes), the viewer-first blocks in
`notificationModel.spec.ts` (band, hostile merge, reveal fold, burst opt-out, automa skip),
`marsBotPresentation.spec.ts` (bot band), and the e2e
`tests/e2e/console-notification-semantics.spec.ts` — a REAL two-seat game (the rival driven
over the API), at 720p AND 4K: ambient card → TTL dismissal → an Energy-Tapping attack →
ONE `g…` hostile card with the band/cause/scope, the X-hold → journal handoff, and a
MutationObserver audit that no `neg…` twin ever appeared. Screenshots land in
`screenshots/notification-semantics/`.

---

## Premium notification system (the live game-feedback layer)

The bottom-bar journal can be collapsed — so the fork has a **NotificationCenter** that surfaces important game events as floating sci-fi cards (top-right, where the journal opens) even when the journal is closed: opponents' card plays, your turn, mandatory decisions, milestones/awards, new generations, passes. It is a SEPARATE layer (`src/client/components/notifications/`), NOT bolted into the journal — they REUSE data + renderers but aren't coupled. **100% client-side, NO server change** — the journal's own per-generation streams already carry everything (root events keyed by `correlationId`, the universal stable id).

**Architecture (mirrors the journal's module-state + App-level mounting):**
- `notificationTypes.ts` — the pure vocabulary: `NotificationKind` (`action-required` › `your-turn` › `warning` › `important` › `normal`, also the priority order), `NotificationModel` (render-agnostic: carries the journal `LogMessage` header + `JournalChildVM` children + headline pills + a CTA), `NOTIFICATION_TTL` (0 = persistent for turn cards), `MAX_VISIBLE_TRANSIENT` (3), `COALESCE_THRESHOLD` (3).
- `notificationModel.ts` — PURE mappers (unit-tested under the server runner, like `journalView.ts`): `diffRootNotifications` (diff the current generation's `buildJournalView` nodes against a seen `correlationId` set → new cards; SUPPRESSES the viewer's OWN ordinary actions, shows milestone/award highlights regardless of actor; returns ALL encountered ids so suppressed ones are still seeded), `buildEventChildren`-driven `summarizeImpact` (merged net pills + "+N details"), `coalesceBurst` (a >3 same-actor burst → ONE "Events: N" summary so an opponent's whole turn doesn't spam), `buildTurnNotification` (waitingFor → your-turn for the inline action menu [`ACTION_MENU_TITLES`, kept in sync with `WaitingFor.vue`], else action-required with the prompt text), `buildGenerationNotification` / `buildPassNotification`. **"Your turn" announces ONLY at the START of a fresh turn** — the `freshTurn` flag is a STRUCTURAL signal computed in the layer: the action menu titled `'Take your first action'` (NOT `'Take your next action'`, the continuation after a sub-prompt / a 2nd action) AND the viewer is NOT the lone non-passed player (`isLonePlayer()` via `game.passedPlayers`). It is NOT re-announced mid-turn (the menu returns as 'next action') nor for the lone player repeating turns. (An earlier transition-tracking impl — `viewerWasWaiting`, NOT-waiting→waiting — showed it only EVERY OTHER turn because the server doesn't always emit a waitingFor-cleared update between turns; the title+passed-players signal is robust to that.) action-required (sub-prompts) is unaffected — it always shows. **Both the pills (`chipRank`) AND the journal's own child rows (`buildEventChildren`'s final `childTier` sort) order GAINS first → the action's own result, then indirect gains, then discounts, then the cost/losses last** — "what I GOT before what I paid" (the colony test asserts this; gains-first applies to the JOURNAL too, not just the cards). **A still-visible root card is REFRESHED when its chain grows** — `recomputeRootImpact(events, correlationId, actor)` re-derives the pills + breakdown, and the layer's `refreshVisibleImpacts` updates header-bearing transient cards in place (no re-animate). This fixes a poll-timing race: an opponent's colony trade whose reward is a DEFERRED "add floaters to a card" pick (Titan, 2+ candidate cards → the trade PAUSES for the opponent's pick) could be diffed between the fee and the reward, so the first build saw only the spent energy — the refresh adds the gained floaters once they record. The CTA «В ЖУРНАЛ» (`labelKey: 'To journal'`, action `open-journal`) is a SECONDARY ghost button (`notification-card__cta--ghost`: no fill / no glow / smaller) — the card is the info, the journal is a peek; the primary CTAs (Посмотреть / Перейти) keep the bright plate.
- `notificationState.ts` — the module-level reactive store (survives the playerkey remount): a SINGLETON `turn` channel (your-turn/action-required) + a `transient` feed (cap 3 + `queue` overflow, promoted on dismiss) + the `seenRootIds` / `lastGeneration` / `passedSeen` / `seeded` lifecycle + a `settings` block (future on/off toggles). `dismiss` of a turn card records `dismissedTurnId` so an acknowledged prompt stays hidden until the prompt id CHANGES.
- `NotificationLayer.vue` — App-level (sibling of `<player-home>`, like the journal), Teleport to body. Fetches `/api/game/logs` + `/api/game/journal-events` for the current generation on every `playerView` change + a light 2.2 s poll (catches opponent actions during simultaneous research/draft, mirroring the journal). FIRST fetch seeds silently (no spam on load/reconnect). When the journal is OPEN, normal/important toasts are SUPPRESSED (the feed shows everything) but still marked seen; turn cards always show. END phase silences everything (the endgame experience owns the screen). Generation-went-backwards → `resetNotifications` (a different game opened in-session).
- `NotificationCard.vue` — compact (type label + glyph + headline + headline pills + CTA) → click (or the explicit «Подробнее» button — a chevron + accent count BADGE, unmistakably interactive) to EXPAND the breakdown, which REUSES `JournalChildRow` so the card and the journal never diverge. Lifetime indicator is a CSS-driven `scaleX` shrink (paused on `:hover` / `--expanded` via CSS — no per-frame JS), `animationend` → auto-dismiss. The generation shows as a CLEAR «Поколение N» line (`metaLine`), never a cryptic chip. **The YOUR-TURN card is persistent ONLY while the player is AFK: on the FIRST real activity (pointer move past a threshold / key / click / wheel — window listeners armed in `mounted`) it ARMS a ~5 s countdown** (`activityArmed` → `showProgress`/`effectiveTtl`), so it fades once the player is clearly playing but stays put if they stepped away. action-required stays persistent until resolved.

**Typed event-VARIANT styling — a player tells the TYPE at a glance, before reading.** `kind` (action-required/your-turn/warning/important/normal) drives BEHAVIOUR (priority / TTL / persistence / channel); a SEPARATE `NotificationVariant` (`notificationTypes.ts`) drives the VISUAL — accent colour + glyph + header label. `notificationModel.rootVariant(header, chain)` maps a journal root event → variant via the server-stamped `category` (+ chain event types): `card-play`→`play-card` (cyan ◈), `card-action`/`corporation-action`/`ceo-action`/`copied-action`→`blue-action` (azure ⟳), `standard-project`→`standard-project` (steel ⬡), `colony`→`colony` (violet ◉), `milestone`→`milestone` (GOLD 🏆), `award`→`award` (medal-purple 🏅), a standalone effect-trigger root→`passive-effect` (teal ✦), else `event`. Turn/generation/pass/warning builders set their own variant. The card adds `notification-card--variant-<v>`; `notifications.less` keys the accent/glyph off it. **Milestones & awards are kind `important` (shown even for the viewer's OWN, never self-suppressed like ordinary actions) + a prestige look** (gold/medal rim + a ONE-SHOT calm celebration glow on arrival, never looping + a native trophy/medal glyph) — so when ANY player claims a milestone / funds an award the viewer gets a distinct premium card, NOT a "played a card" look. The rail tints to the actor colour only for the "what an opponent did" variants (`ACTOR_RAIL_VARIANTS`); prestige/system variants keep their variant accent. To add a new variant: add the enum member, a `rootVariant` case, a `.notification-card--variant-X { --notif-accent }` rule + a glyph case.

**Hostile / NEGATIVE events — the viewer never silently loses something to another player.** A dedicated kind `negative` (priority just under your-turn, TTL 13 s, longer because a loss must not be missed) + the hostile variants `destroy` / `steal` / `production-reduction` / `production-transfer` (+ the Vermin `threat` / `vp-loss`). **100% client-derived from the VICTIM's `GameEvent`** — no server change for destroy/steal/transfer/reduction. `notificationModel.diffNegativeNotifications` scans the generation's events for ones where `e.player === viewerColor` AND there's a NEGATIVE impact AND `attackerOf(e)` (= `target.player` ?? a card/corp `source.owner` that ISN'T the viewer) — i.e. a cross-player attack, NOT a cost / own-spend / global event (those have no other-player attacker → skipped). It classifies from the single victim event: negative `impact.stock` + no `target.player` → **destroy**; + `target.player` → **steal** (the `stealing` flag set `target`); negative `impact.production` + no target → **production-reduction**; + target → **production-transfer** (shown as ONE linked event with a mirror `+X` gain chip for the attacker, never two independent rows). Grouped by `correlationId` (all the viewer's losses in one attacking action → one card), de-duped via a SEPARATE `notificationState.seenNegativeIds` (the loss lives inside the attacker's root action, which `diffRootNotifications` already saw). Only the **viewer-as-victim** gets a dedicated hostile card (the attacker/observer perspective is the ordinary root play-card card + its expanded breakdown — no spam); hostile cards show **even when the journal is open** (critical, like turn cards) and are **priority-aware inside the QUEUE** (promotion picks them first; iteration 3 removed the old eviction of a visible card — presented is monotonic). `NotificationCard` renders a hostile layout (`negative` meta): "Из-за <attacker chip> <source card chip>", a victim/attacker `−X → +X` flow for steal/transfer, a stock-vs-production marker («из запаса»/«доход»), and a `before → after` computed from the viewer's current `PublicPlayerModel` value (single-resource case). Styles + a calm ONE-SHOT impact glow + loss-pill flash in `notifications.less` (per-variant hostile accents: destroy red, reduction orange, steal purple, transfer cyan, vp-loss red-gold). **Vermin** is handled in TWO honest stages (its real rule: ≥10 animals on the card → −1 VP per city for EVERY player at SCORING, no mid-game VP events): the WARNING stage is the Vermin PLAY recognised by `CardName.VERMIN` on a `card-play` root → variant `threat` (amber, "potential VP loss"); the DAMAGE stage is a server signal — `Player.addResourceTo`'s Vermin hook, the moment `verminInEffect` flips false→true, roots a `'vp-pressure'` journal event (`category` added to `GameEvent.ts`) → client variant `vp-loss` (strong red-gold, shown to everyone incl. the owner). Forced-negative prompts (discard / pick-to-lose) already fire the persistent `action-required` card via the `waitingFor` path. Guarded by `notificationModel.spec.ts` (classification + Vermin variants) + `tests/events/verminJournal.spec.ts`. **Documented frontier:** observer-between-others hostile cards (folded into the root event today), the child-row-precise journal highlight (currently highlights the root group), and a hostile FLAVOUR on the forced-negative action-required card (needs a server "this prompt is hostile" marker).

**Server fix — milestones / awards are now journal ROOT events (the only server change this layer needed).** Claiming a milestone (`Player.claimMilestone`) and funding an award (`Game.fundAward`) used to emit BARE logs (no `correlationId`/`role`/`category`), so `diffRootNotifications` (which requires a `correlationId`) skipped them entirely — the flagship gap. Both are now wrapped in `events.beginAction(player, {kind:'milestone'|'award', name}, {category:'milestone'|'award'})` … `endScope()`, so the log becomes a root-action with a `correlationId` + the new `'milestone'`/`'award'` `JournalActionCategory` (added to `src/common/events/GameEvent.ts`). The premium journal groups them and the notification system surfaces them (detected by category — no separate `milestone-claimed`/`award-funded` GameEvent needed). Guarded by `tests/events/milestoneAwardJournal.spec.ts`. **Documented remaining frontier (lower priority):** production-phase per-player income, standalone tile / global-parameter board-accent variants, and wiring server input errors to `pushWarning` — these would each need the same "wrap in a root scope / add a mapper" treatment.

**z-index 12650 (ABOVE every full-screen blur backdrop — so a modal's `backdrop-filter` blur/dim never smears the cards).** A `backdrop-filter` only blurs what paints BELOW it, so the layer must sit ABOVE the HIGHEST blur backdrop. The blur modals: mandatory-input-modal (12000), the drawn-cards reveal `.draw-reveal` (12600). z=12050 once sat UNDER the drawn-reveal (12600) and got blurred — hence 12650 (only the native-dialog CardZoomModal, top layer, is above us). To PRESERVE the "the modal IS the prompt → no redundant turn card" design now that the layer paints above the modals, body-class rules HIDE the turn card (action-required / your-turn) when a FULL mandatory modal (`body.mandatory-input-modal-open:has(.mandatory-input-modal:not(--minimized):not(--picker-mode):not(--suppressed))`) OR the drawn-reveal (`body:has(.draw-reveal)`) is displayed; the TRANSIENT feed (reveals / losses / events) stays crisp on top. The layer container is `pointer-events: none` (only the cards are interactive). When the journal opens, the layer slides left of it (`--journal-open` → `right: var(--journal-overlay-clearance)`), reusing the overlay-yield geometry.

**Passive-effect notification — name + hover effect-block popover + a details/stats modal.** A «сработал эффект» card (variant `passive-effect`, a passive effect that surfaced as its OWN root chain) used to be info-less. It now carries the effect's source card: `notificationModel.effectSourceCard(chain, correlationId)` reads the `effect-triggered` root event's `source.card` → `NotificationModel.effectCard`. The card shows a highlighted effect CHIP (the card name) that (a) on HOVER opens `EffectPreviewPopover.vue` — the SAME effect block the «Эффекты» overlay renders (reuses `EffectBlock` via `playerEffectGroups([{name}])[0]`), and (b) on CLICK opens `EffectDetailOverlay.vue` (App-level, module state `effectDetailState`) — a modal mirroring the additional-resources modal style that REUSES the overlay's `EffectDetailsPanel` (graphic + «Описание» + per-game stats). The modal fetches the effect OWNER's `/api/game/effect-stats?id=&color=` (the actor) and finds that card's stat; with no viewerId/stats it degrades to the base rule + thematic note. Its CSS classes are `effect-detail-modal*` (NOT `effect-detail*`, which the overlay's `EffectDetailsPanel` already owns — collision avoided). Guarded by `notificationModel.spec.ts` (effectCard extraction).

**Public card REVEALS / SHOWS — a calm informational layer + a read-only viewer.** When another player PUBLICLY reveals cards from the deck (then discards — SearchForLife / AsteroidDeflectionSystem) or SHOWS cards from hand (PublicPlans / «Общественные планы»), opponents get a premium info notification with a «Посмотреть» CTA. **The card names are ALREADY public** (they ride the log's `CARD`/`CARDS` tokens — the journal already renders them as clickable chips), so the ONLY server change is a structural marker `LogMessage.reveal?: RevealLogMeta` (`{origin: 'deck'|'hand', result: 'discarded'|'shown'|…, source?}`, in `src/common/logs/RevealLogMeta.ts`) set via a new `game.log(…, {reveal})` option at the 3 reveal sites (PublicPlans / SearchForLife / AsteroidDeflectionSystem) + the `IGame.log` signature. This lets the client detect a reveal STRUCTURALLY (deck-reveal vs hand-show) without parsing the message text. Client: `notificationModel.diffRevealNotifications` scans the fetched `LogMessage[]` for `m.reveal !== undefined`, reads the card names from the `CARD`/`CARDS` tokens, and emits a `reveal-deck` (calm blue-cyan, kind normal) or `reveal-hand` (blue-purple, kind important, slightly longer) notification — SUPPRESSED for the actor (they know their own hand / have the self `RevealResultOverlay`), de-duped via a SEPARATE string `seenRevealIds` set. The compact card shows the actor + verb + (1 card → the highlighted `JournalCardChip` name / N → a count) + a result chip («сброшена»). The «Посмотреть» CTA → `openRevealViewer` (`revealViewerState.ts`) → `RevealedCardsModal.vue` (App-level, read-only, adaptive — a centred row for ≤3, a wrapping grid for 4+, click a card → fullscreen via `CardZoomModal`'s navigable browser; NO selection/play/discard, only close + ESC). Reveals are suppressed when the journal is open (the cards are already there as clickable chips). The existing self-only `recordReveal`/`lastReveal`/`RevealResultOverlay` (the actor's ✓/✗ result for SearchForLife/AsteroidDeflectionSystem) is untouched and coexists. Guarded by `notificationModel.spec.ts` (reveal classification) + `tests/events/revealLog.spec.ts` (the markers). **Documented frontier:** look-at-and-discard (BusinessNetwork's rejected card stays private by rules — not revealed), filtered draws (Celestic/MorningStar draw-to-hand, not a reveal+discard), a journal-row «view» CTA (the cards are already individually clickable in the journal), and a tag filter in the viewer (optional per spec).

**Drawn-cards reveal modal — the SOURCE is always shown as a hoverable/clickable link.** The "you received N cards via an effect" modal (`DrawCardRevealContent.vue`, the `.draw-reveal` flow at z 12600) used to show only «Вы получили N карт(ы)». It now ALWAYS renders the count + a `Source:` chip naming WHERE the cards came from, premium and interactive. The source rides `CardDrawRevealModel.source: CardDrawRevealSource` (`src/common/models/CardDrawRevealModel.ts`) — a discriminated union `{type:'card', cardName} | {type:'colony', colonyName} | {type:'tile'} | {type:'other'}`, attributed where cheaply known: the behavior executor already knows the played card; a tile bonus tags itself; **a colony DRAW_CARDS bonus now tags itself** — `Colony.ts`'s `DRAW_CARDS` case passes `{source: {type: 'colony', colonyName: this.name}}` to `DrawCards.keepAll` (the ONE server change for this feature, additive + backward-compatible — an omitted source degrades to the generic text). Client-side, `DrawCardRevealContent` derives `sourceCard` / `sourceColony` from the union and renders the SAME hover chips the journal uses: a `card` source → `<JournalCardChip>` (hover mini-card popover + click → fullscreen `CardZoomModal`), a `colony` source → `<JournalColonyChip>` (hover read-only colony mini-card), a `tile` source → a plain «Бонус клетки» label. The chips' popovers (z 12700) float above the reveal modal. New ru keys: `Source`→«Источник», `Tile bonus`→«Бонус клетки» (`ui.json`). **To attribute a new draw source:** add a `CardDrawRevealSource` variant + pass `{source}` to the `DrawCards.*` builder at the site, and add a render branch in `DrawCardRevealContent` (reuse the journal chips — don't invent a new preview).

**Journal link (no divergence).** Every normal/important card's CTA is «Показать в журнале» → `openJournalToEvent(correlationId, generation)` (in `journalState.ts`): opens the journal + sets a `highlight` nonce; `JournalFeed` watches it, scrolls to the `[data-correlation-id]` row (`JournalGroup`/`JournalEntry` carry the attr) and flashes `.journal-group--pulse` (bounded rAF retries until the row lays out — the journal may still be fetching). Turn-card CTAs DIFFER by kind: your-turn shows «Понятно» (action `dismiss` — just acknowledges + closes, since the action UI is already in front of the player; the ack clears when the prompt id changes — and `setTurn(undefined)` between turns resets it so each new turn re-shows); action-required shows «Перейти к действию» (action `go-to-action`) → dispatches `tm-notification-go-to-action` → `MandatoryInputModal` restores from minimized + `PlayerHome` restores the hand/award/std-project pill (`restoreHandPill`), so the card actually DIRECTS the player to the pending decision.

Tests: `tests/client/components/notifications/notificationModel.spec.ts` (pure mappers) + `notificationState.spec.ts` (queue/priority/turn-ack lifecycle). i18n: new keys in `ru/ui.json` (type labels / CTAs / bodies; canonical terms — Достижение/Награда/директор). **To add a new notification source:** if it's a journal root event it's auto-covered (diff by `correlationId`); a NON-journal signal (a new game-state diff) gets a `buildXNotification` mapper + a push from the layer's `update()`. Honour `prefers-reduced-motion` (handled) and never use native `title` (the card has no tooltips).


## Quick-toast FEED MODE — «Быстрые уведомления»: Все события / Только связанные со мной

A persisted presentation preference (`notificationFeedMode.ts`, localStorage `tm_notification_feed`, default `'all'` — the pre-setting behaviour is byte-equivalent) that filters WHICH of the existing top-right transient toasts present. **ONE policy source**: `notificationFeedPolicy.quickToastAllowed(model, mode, viewer)` (pure, spec'd under the server runner), applied in exactly ONE place — `notificationState.pushTransient`'s `feedModeAllows` gate. No component carries its own `if`.

**Classification is STRUCTURAL, never text.** Kind-level exemptions (`negative` — the viewer IS the victim by construction, `warning`, `your-turn`, `action-required`) + an exhaustive `VARIANT_RELEVANCE: Record<NotificationVariant, 'exempt'|'involves'>` (`terraforming-complete` is exempt — the game-end condition). An `involves` variant presents in `'personal'` mode iff `actor === viewer` or the viewer is in the model's **`affects`** list — structured presentation metadata the producers derive from typed data: root events → `affectedPlayersOfChain(chain)` (owners of personal `EventImpact` deltas + explicit `target.player`; global parameters / tiles are deliberately NOT personal), bot turns → `affectedPlayersOfBotTurn(turn)` (attack targets — even zero-outcome — + non-bot impact targets), `coalesceBurst` unions its members. The viewer identity is `playerView.thisPlayer.color` (set via `setNotificationViewer` in the layer's update), NEVER the active player. Unknown variant / unknown viewer → **fail-open** (show) + a once-per-variant dev `console.warn`.

**FIFO stays intact when a toast is suppressed.** A filtered model never enters transient/queue: no 5 s auto-close lifetime, no `holdsFlow`, `notificationsSettled()` reads true immediately (a mandatory prompt never waits behind a phantom toast); the journal/event stream is untouched (seen-sets are marked at diff time regardless, so flipping the mode back replays nothing). The bot staged-commit pipeline advances via the generalized **`ensureBotPresentationLiveness` front-walk**: leading pending turns with NO card in the presentation deliver their visuals immediately in order (a fully-filtered batch walks to the end = the authoritative commit), and the walk STOPS at the first pending turn whose card is still visible/queued — a later turn can never commit ahead of an earlier card's presentation. Filtered bot turns are soft-ACKED at push time (`presentFreshBotTurns` ack loop — no card will ever finish to ack them). A mode switch re-checks the QUEUE only (`reconcileQueueWithFeedMode`, wired by a module watch): visible toasts finish their own lifecycle; dropped queued bot cards are acked and the staging module's own liveness watcher drains their timeline in order (delivering from the reconcile would commit a batch out of order — deliberately NOT done).

**The setting** is a ring row (`notifications`) in `consoleSettingsModel.ts`'s ИНТЕРФЕЙС category (both hosts: main menu + in-game system menu). `.con-set` heights were re-calibrated for the five-row category (base 20.4rem / TV 25.4rem) — «no category ever needs to scroll» is guarded by the `console-options-settings` e2e. i18n keys in `ru/console.json` («Быстрые уведомления», «Все события», «Только связанные со мной» + the description). Guards: `tests/notifications/notificationFeedPolicy.spec.ts` (exhaustive classification worklist + fail-open + locale independence), `notificationFeedMode.spec.ts`, feed-mode blocks in `notificationState.spec.ts` / `marsBotStagedCommits.spec.ts` (full/partial-filter FIFO) / `consoleOptionsPanel.spec.ts`.
