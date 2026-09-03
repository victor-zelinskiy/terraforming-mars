import {CardModel} from './CardModel';
import {ColonyModel} from './ColonyModel';
import type {ActionEffect, VictoryPointsDelta} from './ActionPreviewModel';
import type {BotAttackPromptMeta} from './BotAttackPromptModel';
import type {DeltaBonusPromptMeta} from './DeltaBonusPromptModel';
import type {DeltaBlockadeProjectionModel} from './DeltaBlockadeModel';
import type {DeltaEspionageProjectionModel} from './DeltaEspionageModel';
import type {TargetImpact, TargetImpactChange} from './TargetImpactModel';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';
import {Color, ColorWithNeutral} from '../Color';
import {PayProductionModel} from './PayProductionUnitsModel';
import {ProductionLossSource} from './ProductionLossSource';
import {AresData} from '../ares/AresData';
import {Message} from '../logs/Message';
import {PartyName} from '../turmoil/PartyName';
import {SpaceId} from '../Types';
import {PaymentOptions} from '../inputs/Payment';
import {GlobalEventName} from '../turmoil/globalEvents/GlobalEventName';
import {Warning} from '../cards/Warning';
import {Units} from '../Units';
import {ClaimedToken} from '../underworld/UnderworldPlayerData';

/**
 * EXPLICIT, translation-proof marker that a top-level prompt belongs to the
 * start-of-game flow (StartGameFlowOverlay). Set server-side at the prompt's
 * construction and serialized centrally in ServerModel.getWaitingFor. The
 * client routes/labels purely off this — never off the (translatable) title.
 *
 *  - corporationPlay: 'play your chosen corporation' — the deferred REAL play
 *    of the picked corporation (tableau + starting M€ + corp effects happen
 *    only when the player answers THIS prompt, so the corporation is never
 *    "already played" before the player presses it).
 *  - corporationPay: 'pay for the project cards you bought' — the deferred
 *    card payment of the start (offered only when cards WERE bought). The
 *    M€ leave the stock only when the player answers it, so the deduction
 *    is a beat the player performs, never a number that already moved.
 *    `payment` carries what the press costs (structural — the client never
 *    parses the title).
 *  - corporationInitialAction: the corp first-action OrOptions
 *    ('Take first action of X corporation' + Pass).
 *  - corporationSelection: a 'choose an additional corporation to merge' SelectCard
 *    (Merger prelude) — pick ONE of the dealt corps; it joins the player's tableau.
 *  - preludeSelection: a 'play a prelude' SelectCard. `preludeMode`:
 *      'hand' = the player's own starting preludes (play each, one at a time);
 *      'draw' = drew N, play exactly ONE, discard the rest (New Partner /
 *               Valley Trust) — rendered as a distinct "choose one" block;
 *      'copy' = pick one ALREADY-PLAYED prelude to copy (Double Down) — the
 *               source must stay in the grid (nothing is drawn or discarded).
 *  - corporationMerge: CAMPAIGN missions 2–3 — the deliberate «Слияние»
 *    press: the freshly picked corporation is played ON TOP of the already
 *    deployed company (its own starting M€ / effects apply at THIS press,
 *    never silently inside the base deployment).
 *  - campaignLegacy: CAMPAIGN missions 2–4 — receive the project cards
 *    carried from the previous mission («Наследие проектов»), a deployment
 *    stage of its own AFTER the starting-hand purchase. `legacy` carries the
 *    count for the CTA (structural — the client never parses the title).
 */
export type StartGamePromptMeta = {
  kind: 'corporationPlay' | 'corporationPay' | 'corporationInitialAction' | 'corporationSelection' | 'preludeSelection'
    | 'corporationMerge' | 'campaignLegacy';
  preludeMode?: 'hand' | 'draw' | 'copy';
  /** corporationPay: exactly what answering this prompt deducts. */
  payment?: {megacredits: number, cards: number};
  /** campaignLegacy: how many carried cards this press receives. */
  legacy?: {cards: number};
}

/**
 * EXPLICIT, translation-proof marker that this ACTION MENU is a BONUS ACTION —
 * an action a card granted OUTSIDE the normal turn structure («Фора» /
 * Head Start: «immediately take 2 actions», taken during the PRELUDES phase).
 *
 * The prompt is a byte-identical `OrOptions` action menu (same titles, same
 * option shapes) so every existing action surface keeps working unchanged; the
 * ONE thing that differs is that `Pass` and `End Turn` are not offered — a
 * bonus action cannot concede a generation that has not started. This marker is
 * what lets the client say WHY instead of «сейчас недоступно», and what lets
 * the console's start workspace hand the screen to the board and take it back
 * again. Detecting any of that from the menu's TITLE is impossible by design:
 * the title is the normal action-menu title precisely so the wheel, the task
 * router and the status label keep classifying it as an action menu.
 *
 * `remaining` counts the bonus actions still owed INCLUDING this one, so the
 * readout is `granted - remaining + 1` of `granted`.
 */
export type BonusActionPromptMeta = {
  /** The card that granted the bonus actions (its name IS its i18n key). */
  source: CardName;
  /** Bonus actions still owed, including the one this prompt is asking for. */
  remaining: number;
  /** How many the card granted in this batch. */
  granted: number;
  /**
   * PENDING GAINS the player may claim on THIS prompt without spending an
   * action («Фора»: the steel / M€ whose timing the card leaves to the
   * player). Each entry is a real option of the OrOptions — `index` is its
   * position, so the client submits `{type:'or', index, response:{type:
   * 'option'}}` and never has to find it by title. `amount` is the value AT
   * THIS MOMENT (the M€ gain depends on the hand size at claim time).
   */
  gains?: ReadonlyArray<{
    resource: 'steel' | 'megacredits',
    amount: number,
    index: number,
    /** The per-card rate behind `amount` (Head Start's M€): the client renders
     *  the FORMULA («по 2 M€ за карту в руке»), because the player's ordering
     *  decision depends on understanding that playing cards from hand shrinks
     *  the claim and drawing grows it. */
    perCardInHand?: number,
  }>;
}

/**
 * EXPLICIT, translation-proof marker that a top-level prompt is an AWARD-FUNDING
 * selection — an OrOptions with one SelectOption per fundable award, each titled
 * with the bare AwardName. The premium client routes it to the modern
 * AwardsOverlay (in a dedicated funding mode) instead of the generic option
 * modal, reusing the shared findAwardOptionPath / submitInnerActionResponse
 * machinery. `free` = the funding costs 0 M€ (e.g. Vitor's start-of-game action),
 * so the overlay shows "free sponsorship" pricing. Set server-side at the
 * prompt's construction; serialized centrally in ServerModel.getWaitingFor.
 */
export type AwardFundingPromptMeta = {
  free: boolean;
}

/** Where a contextual choice originated — the card / corporation / system that
 *  asks the player to decide. Drives the premium modal's source-card preview +
 *  kicker chip. `card` is the source card's name (undefined for system choices). */
export type ChoiceContextSource = {
  kind: 'card' | 'corporation' | 'standardProject' | 'colony' | 'system';
  card?: CardName;
  /**
   * The concrete NAME of a non-card source (which colony, which standard
   * project, which rule). Without it the console can only say «Колония», which
   * is barely better than saying nothing when three colonies could have paid
   * the bonus. Never set alongside `card` — a card face already is its name.
   */
  name?: string | Message;
}

/**
 * EXPLICIT context for a top-level choice prompt (an `OrOptions` produced by a
 * triggered effect, an on-play decision, or a deferred action). Lets the premium
 * client (ContextualChoiceContent) render a CONTEXTUAL modal — source card on the
 * left, a "why this appeared" trigger line, rich per-option result chips — instead
 * of a context-less "Select one option" list. Set server-side, CO-LOCATED in the
 * card that builds the prompt (e.g. `OrOptions(...).markChoiceContext(...)`), and
 * serialized centrally in `ServerModel.getWaitingFor`. Backward-compatible: a
 * prompt WITHOUT it renders via the existing ModernOptionPicker.
 */
export type ChoiceContext = {
  source: ChoiceContextSource;
  /** A short "why this choice appeared" explanation (i18n text/Message), e.g.
   *  "A science tag was played." Rendered as the trigger/reason block. */
  trigger?: string | Message;
  /** Semantic mode — drives the kicker copy + accent. `optional-effect` =
   *  apply-or-skip (Pharmacy Union); `effect-choice` = pick between effects
   *  (Olympus); `attack` = target an opponent; `reward` = collect a bonus. */
  mode?: 'optional-effect' | 'effect-choice' | 'attack' | 'reward';
}

/**
 * EXPLICIT marker describing whether a tile-placement prompt (`SelectSpace`) can
 * be CANCELLED before it commits. Set server-side (CO-LOCATED in the deferred
 * placement action via `BasePlayerInput.markPlacementContext`), serialized
 * centrally in `ServerModel.getWaitingFor`. The client `PlacementBanner` reads
 * `cancellable` to decide whether to show "Отменить размещение"; when it's false
 * it shows the honest `reason` (e.g. "resources already spent"). Backward-
 * compatible: a prompt without it keeps the previous client-hardcoded behaviour.
 */
export type PlacementContext = {
  cancellable: boolean;
  /** When `cancellable === false`, the honest reason (i18n text/Message). */
  reason?: string | Message;
  /** Where the placement came from, for the banner's source line. */
  source?: ChoiceContextSource;
}

/**
 * EXPLICIT, translation-proof marker that a top-level prompt is a VENUS ALT-TRACK
 * bonus selection — the reward for crossing a bonus step on the Alternative Venus
 * Board. Routes the prompt to the premium VenusBonusContent modal (selectable
 * resource tiles + the final-step wild bonus with an on-card target preview)
 * instead of the legacy numeric-distribution / OrOptions forms. Set server-side in
 * `GrantVenusAltTrackBonusDeferred`; serialized centrally in
 * `ServerModel.getWaitingFor`. Backward-compatible: a prompt without it renders via
 * the existing fallbacks.
 *
 *  - kind 'standard': pick `baseCount` standard resources (repeats allowed). The
 *    prompt is a `GainResources` (AndOptions of 6 SelectAmount).
 *  - kind 'final': the 30% milestone reward. The prompt is a single `OrOptions`:
 *      branch 0 = AndOptions(SelectCard wild-on-card, GainResources(baseCount));
 *      branch 1 = GainResources(baseCount + 1)  // the wild folded in as standard.
 *    `wildCardTargets` is the server's exact eligible-card set for the on-card
 *    option (so the client offers precisely those, never a card the server rejects).
 */
export type VenusBonusPromptMeta = {
  kind: 'standard' | 'final';
  /** Distinct standard resources granted by the base bonus. */
  baseCount: number;
  /** (final only) Card names eligible to receive the wild card-resource. */
  wildCardTargets?: ReadonlyArray<CardName>;
  /**
   * (final only) What the wild resource would do to each candidate's VICTORY
   * POINTS — the SAME authoritative reading `ActionPreviewStep.vpBox` carries
   * for every other target picker (`actionPreviews.targetVictoryPoints`), so
   * the shared played-target selector explains this prompt exactly as it
   * explains «Обстрел кометами» or Predators.
   *
   * READ-ONLY PREVIEW DATA. It changes nothing about what the server asks or
   * accepts: the prompt shape, the eligible set and the bonus size are
   * untouched, and a card whose points the resource never moves is simply
   * ABSENT here (never a fabricated zero).
   */
  wildCardVp?: Partial<Record<CardName, VictoryPointsDelta>>;
}

/**
 * Marks a "how to spend N heat" AndOptions (Stormcraft Incorporated: stock heat
 * and/or floaters-as-heat). Routes the prompt to the premium SpendHeatContent
 * modal instead of the legacy AndOptions widget. `amount` is the heat to cover.
 */
export type SpendHeatPromptMeta = {
  amount: number;
}

/**
 * Marks the DISCARD half of a colony bonus that pays "draw 1, then discard 1"
 * (Pluto). Structural, never detected from the title: the console reveal modal
 * reads it to host the discard as the closing step of the SAME payout the card
 * arrived in — the player must not be told to discard by a detached prompt that
 * looks unrelated to the trade they just made.
 *
 * By the rules EACH colony resolves separately and in full before the next one
 * is revealed, so a recipient with several cubes answers several of these — one
 * per cube. `index` (1-based) and `total` are the recipient's position in that
 * sequence: they let the modal lay out one zone per colony and show which is
 * resolving («Бонус колонии 2 из 3») without re-deriving anything client-side.
 */
export type ColonyBonusDiscardMeta = {
  colonyName: ColonyName;
  index: number;
  total: number;
}

/**
 * Marks the COLLECT prompt of a colony bonus paid to someone who did NOT make
 * the trade — «другой игрок торговал здесь, заберите свою карту».
 *
 * WHY A PROMPT AT ALL. A plain card draw (Miranda's owner bonus) used to land
 * silently in the recipient's hand while a full-bleed reveal appeared over
 * whatever screen they were on: a card they never asked for, arriving from
 * nowhere, over someone else's turn. The bonus is now DELIVERED — the card is
 * drawn only when its owner answers this prompt, so nothing enters a hand the
 * player has not looked at, and the answer takes them to the colony that paid.
 *
 * Structural and translation-proof (cross-cutting invariant 1). Like the
 * discard half, EACH cube resolves separately, so `index`/`total` are the
 * recipient's position in their own sequence on this tile.
 */
export type ColonyBonusCollectMeta = {
  colonyName: ColonyName;
  /** How many cards the collection draws (Miranda: 1). */
  cards: number;
  index: number;
  total: number;
  /** Whose trade paid it — the stage names the trigger. */
  trader?: Color;
}

/**
 * EXPLICIT, translation-proof marker that a `SelectCard` prompt is a DISCARD
 * FROM HAND — the ONE signal the console's unified discard flow keys off.
 *
 * Every place the rules make a player throw cards away (the generic
 * `DiscardCards` deferred action, Mars University's science-tag exchange, a
 * colony bonus / effect, a global event, a CEO action, …) attaches this at the
 * prompt's construction — CO-LOCATED with the rule that demands it — and the
 * client routes ALL of them to the same surface, the same copy and the same
 * "card physically leaves the hand" animation. Without the marker a discard is
 * indistinguishable from "reveal a card" / "keep a card" / "place a card",
 * which is why the console used to grow a separate flow per case.
 *
 * NEVER detected from the title or the button label: `Message.message` is
 * rewritten in place by i18n, so an English-text match stops matching after the
 * first render.
 */
export type DiscardPromptMeta = {
  /** Prompt bounds, mirrored so the flow can phrase "1 card" / "up to N". */
  min: number;
  max: number;
  /** Who demands the discard — drives the source-card preview + kicker. */
  source?: ChoiceContextSource;
  /**
   * What the discard BUYS, when it is an exchange rather than a pure loss
   * (Mars University: 1 card back; Ceres Tech Market: 2 M€ per card). `perCard`
   * marks a payout that scales with the number of cards thrown. Rendered as the
   * "→" side of the flow header and as the closing beat of the animation.
   */
  exchange?: {icon: string, amount: number, perCard?: boolean};
  /**
   * Pluto's "draw 1, then discard 1" sequencing. Present ONLY on a colony-bonus
   * discard; `index`/`total` are the recipient's position in the per-cube
   * sequence, so the payout surface can lay out one zone per colony.
   */
  colonyBonus?: ColonyBonusDiscardMeta;
}

/**
 * EXPLICIT, translation-proof marker that a `SelectCard`'s candidates are a
 * TEMPORARY REVEAL — cards that were just turned over off the deck (or the
 * discard pile) FOR this decision, and that do not belong to anyone yet.
 *
 * WHY THE CLIENT CANNOT DERIVE IT. On the wire "look at the top 7 cards of the
 * deck and take 2" is byte-identical to "pick a card in someone's tableau": a
 * `SelectCard` with N candidates, a min and a max. The console's only
 * discriminators were `buyMode`, `discardPrompt`, `buttonLabel === 'Keep'` and
 * "are all candidates already in my hand?" — so a keep-some landed in the
 * generic card-target browser, with no deck to come out of, no source card
 * named, and nothing to say the unpicked cards are about to be discarded.
 *
 * NEVER detected from the title or the button label: `Message.message` is
 * rewritten in place by i18n, so an English-text match stops matching after the
 * first render (cross-cutting invariant 1).
 *
 * Set by `ChooseCards` — the ONE deferred action that builds this prompt for
 * every producer in the game (behavior `drawCard: {count, keep|pay}`, the
 * bespoke `drawCardKeepSome` calls, the Leavitt colony, the Delta science
 * stage, the discard-pile diggers) — and serialized on `SelectCard.toModel`
 * rather than centrally, so it survives nesting exactly like `discardPrompt`.
 */
export type DeckPickPromptMeta = {
  /** How many cards were turned over for this decision (the candidate count,
   *  mirrored so the flow can phrase «2 из 7» before it has laid the row out). */
  revealed: number;
  /** Prompt bounds, mirrored so the flow can phrase «ровно 2» vs «до 2». */
  min: number;
  max: number;
  /** WHERE the cards physically came from — the flight's real origin, and the
   *  only thing that decides whether they fly off the deck stack or the
   *  discard pile. `discard` = a pile-digging effect (Junk Ventures, Return to
   *  Abandoned Technology). */
  origin: 'deck' | 'discard';
  /**
   * 'keep' — the picks are free and the rest is discarded (the look-at-N
   * family); 'buy' — each pick costs `player.cardCost` and a payment prompt
   * follows. `buyMode` already says the same thing for the client's cost UI;
   * this repeats it so a consumer of THIS marker never has to read two fields
   * to know which grammar it is in.
   */
  mode: 'keep' | 'buy';
  /** Who turned the cards over — drives the source-card anchor + the crumb.
   *  Absent when the engine itself dealt them (the research phase). */
  source?: ChoiceContextSource;
}

/**
 * EXPLICIT, translation-proof marker that a `SelectCard` is a DRAFT PICK —
 * «keep some of this packet and pass the rest on». Attached in ONE place
 * (`Draft.askPlayerToDraft`, the funnel every draft variant goes through) and
 * serialized on `SelectCard.toModel` (nesting-safe, like `deckPickPrompt`).
 *
 * The client's draft flow is built ENTIRELY on this marker plus the phase:
 * routing (a live pick vs the optional re-pick wait rides `optional`),
 * the pass direction the packet physically leaves toward, WHO the neighbors
 * are (the server's own participant circle — the client cannot re-derive it:
 * MarsBot is a seat in the generation draft and excluded from the initial
 * one), and how many picks this player's draft will total (the flow rail's
 * substep count — stable across keep-2 rounds and the auto-pushed last card).
 */
export type DraftPromptMeta = {
  /** Which draft this pick belongs to (initial iterations / preludes / CEOs
   *  ride the same funnel; the between-generation flow keys on 'standard'). */
  draftType: 'standard' | 'initial' | 'prelude' | 'ceos';
  /** The rule-derived pass direction: 'after' = the next seat, 'before' = the
   *  previous one (`Draft.passDirection` — generation parity / iteration). */
  direction: 'before' | 'after';
  /** The neighbor the rest of this packet goes TO. */
  givingTo: Color;
  /** The neighbor the next packet comes FROM. */
  takingFrom: Color;
  /** Cards this player will have drafted when this draft ends — picks so far
   *  + the packet in front of them (invariant across every round, including
   *  the final auto-pushed card). The flow rail's substep total. */
  total: number;
}

/**
 * EXPLICIT marker for the FINAL GREENERY prompt — the endgame beat where a
 * player turns leftover plants into greeneries, one at a time, until they stop.
 *
 * It looks like an ordinary two-branch choice and is anything but: the second
 * branch does NOT decline an effect, it ENDS THAT PLAYER'S GAME
 * (`playerIsDoneWithGame`). Rendering it as a calm "do nothing" row — which is
 * what a generic option list does — invites an irreversible misclick at the
 * most expensive moment of the match. The console routes it to its own finale
 * screen instead, where that branch is destructive, explained and two-step.
 *
 * Carries ONLY what the client cannot derive: the board's remaining legal
 * spaces. Plants and `plantsNeededForGreenery` already ride the public player
 * model, so they are read there (never duplicated into metadata).
 */
export type FinalGreeneryPromptMeta = {
  /** Legal spaces left for a greenery — a board rule the client cannot know. */
  spaces: number;
}

export type BaseInputModel = {
  title: string | Message;
  warning?: string | Message;
  buttonLabel: string;
  // When true the input is optional: the client should keep polling rather than
  // block on it (draft re-pick). See PlayerInput.optional.
  optional?: boolean;
  startGamePrompt?: StartGamePromptMeta;
  /** Explicit "this action menu is a card-granted BONUS action" marker (see
   *  BonusActionPromptMeta). Serialized centrally in ServerModel.getWaitingFor
   *  — a bonus action menu is always the TOP-LEVEL prompt. */
  bonusActionPrompt?: BonusActionPromptMeta;
  awardFundingPrompt?: AwardFundingPromptMeta;
  choiceContext?: ChoiceContext;
  /**
   * THE CARD WHOSE ACTION IS BEING COPIED — present iff this prompt was raised
   * inside a copied action (see `BasePlayerInput.copiedActionSource`). Server-
   * stamped from the event scope, so it covers every card that can be copied,
   * including ones not written yet.
   *
   * The console's stage-bound gate reads it: a Hydronetwork traversal resolves
   * the whole path in ONE request, so a stage-7 reuse puts its prompts on the
   * wire while the marker is still cells back, and «whose step is this?» cannot
   * be answered from the prompt's own text or type.
   */
  copiedActionSource?: CardName;
  placementContext?: PlacementContext;
  venusBonusPrompt?: VenusBonusPromptMeta;
  spendHeatPrompt?: SpendHeatPromptMeta;
  discardPrompt?: DiscardPromptMeta;
  deckPickPrompt?: DeckPickPromptMeta;
  /** Explicit "this SelectCard is a DRAFT PICK" marker (see DraftPromptMeta) —
   *  direction, neighbors and pick total for the console draft workspace.
   *  Serialized on `SelectCard.toModel` (nesting-safe), not centrally. */
  draftPrompt?: DraftPromptMeta;
  finalGreeneryPrompt?: FinalGreeneryPromptMeta;
  /** Explicit "collect the colony bonus another player's trade paid you"
   *  marker (see ColonyBonusCollectMeta). Serialized on `SelectOption.toModel`
   *  (nesting-safe), not centrally. */
  colonyBonusPrompt?: ColonyBonusCollectMeta;
  /** Explicit "a MarsBot effect is forcing this choice on you" context — who
   *  attacks, which of the bot's cards, what leaves and what each candidate
   *  costs (see {@link BotAttackPromptMeta}). Serialized on the input's own
   *  `toModel` (nesting-safe), not centrally. */
  botAttackPrompt?: BotAttackPromptMeta;
  /** Explicit "a card is offering you a BONUS move on the Delta Project track"
   *  marker (see {@link DeltaBonusPromptMeta}) — source card, destination and
   *  the server's own verdict on cost. Serialized centrally in
   *  ServerModel.getWaitingFor: a bonus offer is always the TOP-LEVEL prompt. */
  deltaBonusPrompt?: DeltaBonusPromptMeta;
}

export type AndOptionsModel = BaseInputModel & {
  type: 'and';
  options: Array<PlayerInputModel>;
}

export type OrOptionsModel = BaseInputModel & {
  type: 'or';
  options: Array<PlayerInputModel>;
  // When set, initialIdx represents the option within `options` that should be
  // shows as the default selection.
  initialIdx?: number;
  // OPTIONAL informational-only entries the premium client renders as DISABLED
  // (greyed, non-selectable) cards alongside the real options, each with a
  // user-facing reason. Lets a card surface "this target exists but you can't
  // pick it right now (no plants / protected / …)" instead of silently
  // dropping it. Never submitted — purely for clarity. See `DisabledOptionModel`.
  disabledOptions?: ReadonlyArray<DisabledOptionModel>;
}

/** An informational, non-selectable option shown in a premium OrOptions modal. */
export type DisabledOptionModel = {
  title: string | Message;
  // Same rich-render metadata as a real option (player chip + icon), so a
  // disabled target looks like a greyed twin of a selectable one.
  metadata?: OptionMetadata;
  // User-facing reason it can't be picked (an English i18n key/template).
  // REQUIRED on purpose: a disabled option with no reason forces the client to
  // paint a bare «Сейчас недоступно», which is the one thing this model exists
  // to prevent. Making it non-optional turns every silent producer into a
  // compile error instead of a runtime blank.
  reason: string | Message;
}

export type SelectInitialCardsModel = BaseInputModel & {
  type: 'initialCards';
  options: Array<PlayerInputModel>;
}

/**
 * OPTIONAL structured UI metadata attached to a SelectOption so the premium
 * client can render a rich choice card (icon + player chip + impact preview)
 * instead of a text-only row. Everything is optional and backward-compatible:
 * an option WITHOUT metadata still renders via the text fallback. The server
 * fills it for in-scope cards via the `option-metadata.ts` helpers; the client
 * (ModernOptionPicker) reads it and a dev playground flags options that are
 * still on the fallback path.
 */
export type OptionMetadata = {
  /** Semantic kind — drives accent/icon defaults + playground status. */
  kind?: 'resourceRemoval' | 'resourceGain' | 'steal' | 'globalParameter' | 'playerTarget' | 'skip' | 'confirm' | 'generic';
  /** Icon key (a resource or global-parameter token), e.g. 'plants',
   *  'megacredits', 'steel', 'titanium', 'energy', 'heat', 'microbe',
   *  'animal', 'floater', 'temperature', 'venus', 'oxygen', 'oceans'. */
  icon?: string;
  /** Magnitude involved (plants removed, M€ stolen, parameter steps…). */
  amount?: number;
  /** Player-target context (remove / steal from a player) for the preview.
   *  `changes` is the SERVER-computed before→after (correct for a MarsBot too —
   *  its stock loss drains M€, not the named resource); the client renders it
   *  VERBATIM and only falls back to `current`/`resulting` when absent. */
  player?: {color: Color, current?: number, resulting?: number, changes?: ReadonlyArray<TargetImpactChange>};
  /** Global-parameter context for the preview. */
  global?: {current?: number, resulting?: number, unit?: string};
  /** SELF-resource spend context (e.g. paying a trade fee) — the viewer's own
   *  stock of `icon` before/after, for a "5 → 2" preview + "available" badge. */
  resource?: {current: number, resulting: number};
  /**
   * The CARD this option is powered by — a colony trade fee paid with a card's
   * own resource / action. It is the option's structural IDENTITY: a card whose
   * ACTION offers the same move (Titan Floating Launch-Pad's «spend 1 floater
   * to trade for free») enters this very option, and the console has to find it
   * without matching the translated label. Absent for every plain-resource
   * option, where the icon already identifies the path.
   */
  card?: CardName;
  /** Premium RESULT/COST chips for this option (icon + amount + optional
   *  current → resulting), reusing the `ActionEffect` shape so the contextual
   *  modal renders them with the same `ActionEffectChip` the action-confirm modal
   *  uses (e.g. Pharmacy Union's "+3 TR"). */
  effects?: ReadonlyArray<ActionEffect>;
  /** A NON-numeric downside of taking this option, shown as a warning chip (e.g.
   *  "Card turned face down — its effect stops"). i18n text/Message. */
  tradeoff?: string | Message;
  /** A short descriptive sub-line clarifying what this option does, under the
   *  label (i18n text/Message). */
  description?: string | Message;
};

export type SelectOptionModel = BaseInputModel & {
  type: 'option';
  warnings?: ReadonlyArray<Warning>;
  metadata?: OptionMetadata;
}

export type SelectProjectCardToPlayModel = BaseInputModel & {
  type: 'projectCard';
  cards: ReadonlyArray<CardModel>;
  paymentOptions: Partial<PaymentOptions>,
  microbes: number;
  floaters: number;
  lunaArchivesScience: number;
  seeds: number;
  graphene: number;
  kuiperAsteroids: number;
  auroraiData: number;
  spireScience: number;
  floodgateSteel: number;
}

export type SelectCardModel = BaseInputModel & {
  type: 'card';
  cards: ReadonlyArray<CardModel>;
  max: number;
  min: number;
  showOnlyInLearnerMode: boolean;
  selectBlueCardAction: boolean;
  showOwner: boolean;
  showSelectAll: boolean;
  // OPTIONAL relevant-but-unpickable candidates shown DISABLED (greyed, with a
  // reason on each card's `disabledReason`) — separate from the selectable
  // `cards` so the server never validates/accepts them. The premium picker
  // merges them for display behind an All/Available/Unavailable filter.
  disabledCards?: ReadonlyArray<CardModel>;
  // STRUCTURAL "buy mode" marker (set by ChooseCards when the player is PAYING
  // per card — the research buy flow). The client keys the cost badge / total /
  // M€ check / «КУПИТЬ» label off this, NOT off the prompt title. The title is
  // a translatable `Message` that i18n rewrites in place on render, so a
  // `title.includes('buy')` check silently broke in every non-English locale.
  buyMode?: boolean;
}

export type SelectColonyModel = BaseInputModel & {
  type: 'colony';
  coloniesModel: ReadonlyArray<ColonyModel>;
  // Distinguishes "pick an existing in-game colony" (show ALL game colonies,
  // disabling the unpickable ones) from "add a NEW colony tile to the game"
  // (show only the offered tiles). Defaults to 'selectExistingColony'.
  purpose?: 'selectExistingColony' | 'addNewColonyToGame';
  // OPTIONAL relevant-but-unpickable colonies shown DISABLED with a reason —
  // populated by the server for rule failures the client can't derive (e.g.
  // Venus/Europa/Leavitt TR affordability). The selectable `coloniesModel` is
  // what the server validates against; these never submit.
  disabledColonies?: ReadonlyArray<{name: import('../colonies/ColonyName').ColonyName, reason: string | Message}>;
}

export type SelectPaymentModel = BaseInputModel & {
  type: 'payment';
  amount: number;
  paymentOptions: Partial<PaymentOptions>;
  seeds: number;
  auroraiData: number;
  kuiperAsteroids: number;
  spireScience: number;
  reserveUnits: Readonly<Units> | undefined; // Built to support the Merchant milestone.

  floaters: number,
  microbes: number,
  graphene: number,
  floodgateSteel: number,
}

export type SelectPlayerModel = BaseInputModel & {
  type: 'player';
  players: ReadonlyArray<Color>;
  // OPTIONAL premium-UI hint describing the action applied to the chosen player
  // (constant across candidates, e.g. "remove 4 M€"): `icon` is an icon-key and
  // `amount` the magnitude. Backward-compatible — omit for a bare player list.
  icon?: string;
  amount?: number;
  // Whether `icon`/`amount` affect the player's resource STOCK (e.g. spend M€)
  // or their PRODUCTION rate (e.g. decrease energy production). Lets the premium
  // picker read the right per-target value and frame the icon accordingly.
  // Defaults to 'stock' when omitted.
  scope?: 'stock' | 'production';
  // OPTIONAL informational-only targets the premium picker renders as DISABLED
  // (greyed, non-selectable) cards with a reason — players who are potentially
  // relevant but can't be chosen right now (production at minimum, protected,
  // no Venus tag, …). The selectable `players` list is unchanged (and is what
  // the server validates against); these never get submitted.
  disabledPlayers?: ReadonlyArray<{color: Color, reason?: string | Message}>;
  // SERVER-computed `current → resulting` per selectable player — the picker
  // renders this VERBATIM instead of deriving numbers from the public model, so
  // a MarsBot target reads correctly (its production hit regresses a TRACK, its
  // stock loss drains M€). One entry per `players` colour; present only for a
  // resource attack (`icon` is a Resource + `amount`). See TargetImpactModel.
  targetImpacts?: ReadonlyArray<TargetImpact>;
}

export type SelectSpaceModel = BaseInputModel & {
  type: 'space';
  spaces: ReadonlyArray<SpaceId>;
  /**
   * Per-cell illegality reasons for the cells NOT in `spaces`. Optional
   * because not every SelectSpace caller derives them (small custom paths
   * may pass nothing). The client falls back to no tooltip when absent.
   * See `PlacementIllegalReason.ts` for the value space.
   */
  illegalSpaces?: ReadonlyArray<import('../inputs/PlacementIllegalReason').PlacementIllegalSpace>;
  /**
   * Target spaces whose CURRENT tile will be physically REMOVED before the
   * new tile is placed (KaguyaTech removes a greenery → places a city;
   * LunarMineUrbanization removes a mine → places its tile). During selection
   * the client renders these cells WITHOUT the doomed tile graphic and WITH
   * the placement bonus, so the player sees what they'll GAIN — not a tile
   * that's about to disappear.
   *
   * Absent / empty → the existing tile on every occupied target stays
   * VISIBLE (the default: an overlay marker like St. Joseph's cathedral, a
   * place-over-hazard, picking an ocean to remove, etc. — the base tile is
   * information the player needs).
   */
  hiddenTiles?: ReadonlyArray<SpaceId>;
  /**
   * The placement kind (city / greenery / ocean / …) when known — lets the
   * client fetch a kind-accurate BoardPlacementPreview for the hovered cell.
   * Mirrors `src/server/boards/PlacementType.ts`. Absent on custom paths.
   */
  placementType?: import('../boards/BoardInformationFacts').BoardPlacementKind;
  /**
   * The TileType being placed, when known. The placement KIND alone can't always
   * identify the tile's scoring identity — an `upgradeable-ocean` placement is
   * shared by Ocean City (counts as a CITY) and Ocean Farm / Ocean Sanctuary
   * (do NOT). Passing the concrete tile lets the preview show a composite
   * over-ocean tile's city VP ("+VP per adjacent greenery"). Absent → the
   * preview falls back to the kind-derived scoring.
   */
  tileType?: import('../TileType').TileType;
  /**
   * The card driving this placement, when there is one. The client forwards it to
   * the board-cell-preview endpoint so the preview can include the CARD's own
   * space-dependent consequences (Solar Farm's energy production per plant bonus
   * on the chosen cell, Mining Area's steel-or-titanium production) — effects the
   * generic cell explainer cannot see. Absent → generic cell facts only.
   */
  sourceCard?: CardName;
  /** See {@link PlacementEffect} — absent means the default `'tile'`. */
  placementEffect?: PlacementEffect;
}

/**
 * What picking a cell on a `SelectSpace` prompt actually DOES:
 *   - `'tile'` (default) — a tile is placed and everything that keys off a
 *     placed tile happens.
 *   - `'bonus-only'` — the cell's placement bonuses are granted but NO tile
 *     lands (Mars Nomads moving its camp). No Ares adjacency, no endgame VP, no
 *     milestone/award tile count, and no "when a tile is placed" card effect —
 *     the card's own tabletop ruling spells this out ("Mining Guild and Philares
 *     cannot take advantage of it").
 *   - `'marker'` — nothing is granted at all; the cell is claimed or marked
 *     (Land Claim, an Arcadian Communities marker, a St. Joseph cathedral).
 * The placement preview reads it so it can never promise what the commit
 * suppresses.
 */
export type PlacementEffect = 'tile' | 'bonus-only' | 'marker';

/**
 * OPTIONAL conversion context for a SelectAmount whose semantics are "spend X
 * of FROM, receive X×ratio of TO" (Supercapacitors energy→heat, Insulation heat
 * production→M€ production). The modern stepper renders a premium
 * `[from] → [to]` composition and — when the icon is a standard resource — a
 * live `current → resulting` preview for BOTH sides, derived client-side from
 * the viewer's public stock/production. The server only sends the HINT (what
 * converts into what, at which scope), never per-step values.
 */
export type AmountConversionModel = {
  /** Icon-key of the resource SPENT per unit (e.g. 'energy'). */
  from: string;
  /** Icon-key of the resource RECEIVED per unit (e.g. 'heat'). */
  to: string;
  /** Which player figure the FROM side reads ('stock' default). */
  fromScope?: 'stock' | 'production';
  /** Which player figure the TO side reads ('stock' default). */
  toScope?: 'stock' | 'production';
  /** Units of TO received per 1 FROM spent (default 1). */
  ratio?: number;
}

/**
 * OPTIONAL "what this amount produces" hint for the modern amount stepper. When
 * set, the selector renders a compact SPEND → RESULT composition: the chosen
 * `amount` of the spent resource (the model's `icon`) on the left, and
 * `amount × perUnit` of `icon` (this descriptor) on the right — so the player
 * sees the practical change live (e.g. "spend X energy → draw X cards"). Falls
 * back cleanly: a model without it renders a bare stepper.
 */
export type AmountResultModel = {
  /** Icon-key of the thing produced per unit selected (e.g. 'cards'). */
  icon: string;
  /** How many of `icon` per 1 unit selected (default 1). */
  perUnit?: number;
  /** OPTIONAL i18n label shown above the result figure (e.g. 'Cards drawn'). */
  label?: string;
}

/**
 * OPTIONAL "what each unit COSTS" hint — the mirror image of `AmountResultModel`,
 * for a dial that counts what the player RECEIVES while the price is a DIFFERENT
 * pool (Energy Market: "spend 2X M€ to gain X energy" — the dial is the energy,
 * the price is 2 M€ per step). Without it such a dial is mute: the player picks a
 * number with no idea what it costs. The client renders it as a live cost chip
 * with `current → resulting` on the paying pool, exactly like a fixed cost chip.
 * The server only sends the HINT (which pool, at which rate), never per-step values.
 *
 * Use `AmountConversionModel`/`AmountResultModel` instead when the dial counts the
 * thing being SPENT — those are the common shape; this one is for the inverse.
 */
export type AmountCostModel = {
  /** Icon-key of the resource spent per unit selected (e.g. 'megacredits'). */
  icon: string;
  /** How many of `icon` per 1 unit selected (default 1). */
  perUnit?: number;
  /** Which player figure the cost is taken from ('stock' default). */
  scope?: 'stock' | 'production';
}

export type SelectAmountModel = BaseInputModel & {
  type: 'amount';
  min: number;
  max: number;
  maxByDefault: boolean;
  // OPTIONAL premium-UI hints. `icon` is an icon-key (a standard resource like
  // 'heat'/'energy', a global parameter, or a card resource) shown beside the
  // amount; `unit` is a short suffix ('°C', '%') for parameter-style amounts.
  // Both fall back cleanly — a model without them renders a bare stepper.
  icon?: string;
  unit?: string;
  // OPTIONAL conversion context (see AmountConversionModel) — renders the
  // stepper as a rich "spend → receive" composition. Falls back cleanly.
  conversion?: AmountConversionModel;
  // OPTIONAL "practical change" hint (see AmountResultModel) — renders a compact
  // SPEND → RESULT composition (e.g. "spend X energy → draw X cards"). Falls
  // back cleanly when absent.
  amountResult?: AmountResultModel;
  // OPTIONAL per-unit PRICE (see AmountCostModel) — for a dial that counts what
  // is GAINED and is paid for out of another pool ("2X M€ → X energy"). Falls
  // back cleanly when absent.
  amountCost?: AmountCostModel;
}

export type DeltaProjectInputModel = BaseInputModel & {
  type: 'deltaProject';
  validSteps: ReadonlyArray<number>;
}

/** A REWARD-ONLY Hydronetwork stage claim (Dutch Mountains): the server's own
 *  list of claimable stage positions — the client renders and validates
 *  against THIS, never a re-derivation. */
export type DeltaStageRewardInputModel = BaseInputModel & {
  type: 'deltaStageReward';
  claimable: ReadonlyArray<number>;
}

/** Corporate Espionage (DP10): the whole play's server-authored projection —
 *  the target candidates with their exact `from → to` and resulting rewards,
 *  and the owner's own mandatory advance. The client renders and validates
 *  against THIS, never a re-derivation. See {@link DeltaEspionageProjectionModel}. */
export type DeltaEspionageInputModel = BaseInputModel & {
  type: 'deltaEspionage';
  projection: DeltaEspionageProjectionModel;
}

/** Modular Floodgates (DP11), variant B: the deployment's server-authored
 *  projection — every candidate with their live position, the cell the
 *  blockade would occupy, and each refusal named. The client renders and
 *  validates against THIS, never a re-derivation.
 *  See {@link DeltaBlockadeProjectionModel}. */
export type DeltaBlockadeInputModel = BaseInputModel & {
  type: 'deltaBlockade';
  projection: DeltaBlockadeProjectionModel;
}

export type SelectDelegateModel = BaseInputModel & {
  type: 'delegate';
  players: Array<ColorWithNeutral>;
}

export type SelectPartyModel = BaseInputModel & {
  type: 'party';
  parties: Array<PartyName>;
}

export type SelectProductionToLoseModel = BaseInputModel & {
  type: 'productionToLose';
  payProduction: PayProductionModel;
  /** What forces the reduction (hazard / a card) — shown as a source chip. */
  source?: ProductionLossSource;
}

export type ShiftAresGlobalParametersModel = BaseInputModel & {
  type: 'aresGlobalParameters';
  aresData: AresData;
}

export type SelectGlobalEventModel = BaseInputModel & {
  type: 'globalEvent';
  globalEventNames: Array<GlobalEventName>;
}

export type SelectResourceModel = BaseInputModel & {
  type: 'resource';
  include: ReadonlyArray<keyof Units>;
}

export type SelectResourcesModel = BaseInputModel & {
  type: 'resources';
  count: number;
}

export type SelectClaimedUndergroundTokenModel = BaseInputModel & {
  type: 'claimedUndergroundToken';
  max: number;
  min: number;
  tokens: ReadonlyArray<ClaimedToken>;
}

export type PlayerInputModel =
  AndOptionsModel |
  OrOptionsModel |
  SelectInitialCardsModel |
  SelectOptionModel |
  SelectProjectCardToPlayModel |
  SelectCardModel |
  SelectAmountModel |
  SelectCardModel |
  SelectColonyModel |
  SelectDelegateModel |
  SelectPartyModel |
  SelectPaymentModel |
  SelectPlayerModel |
  SelectProductionToLoseModel |
  SelectProjectCardToPlayModel |
  SelectSpaceModel |
  ShiftAresGlobalParametersModel |
  SelectGlobalEventModel |
  SelectResourceModel |
  SelectResourcesModel |
  SelectClaimedUndergroundTokenModel |
  DeltaProjectInputModel |
  DeltaStageRewardInputModel |
  DeltaEspionageInputModel |
  DeltaBlockadeInputModel;
