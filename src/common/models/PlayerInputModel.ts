import {CardModel} from './CardModel';
import {ColonyModel} from './ColonyModel';
import type {ActionEffect} from './ActionPreviewModel';
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
 */
export type StartGamePromptMeta = {
  kind: 'corporationPlay' | 'corporationPay' | 'corporationInitialAction' | 'corporationSelection' | 'preludeSelection';
  preludeMode?: 'hand' | 'draw' | 'copy';
  /** corporationPay: exactly what answering this prompt deducts. */
  payment?: {megacredits: number, cards: number};
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
  awardFundingPrompt?: AwardFundingPromptMeta;
  choiceContext?: ChoiceContext;
  placementContext?: PlacementContext;
  venusBonusPrompt?: VenusBonusPromptMeta;
  spendHeatPrompt?: SpendHeatPromptMeta;
  discardPrompt?: DiscardPromptMeta;
  finalGreeneryPrompt?: FinalGreeneryPromptMeta;
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
  // User-facing reason it can't be picked (already localized key/template).
  reason?: string | Message;
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
}

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
  DeltaProjectInputModel;
