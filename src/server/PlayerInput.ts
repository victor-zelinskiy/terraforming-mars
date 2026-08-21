import {ICard} from './cards/ICard';
import {Message} from '../common/logs/Message';
import {PlayerInputType} from '../common/input/PlayerInputType';
import {InputResponse} from '../common/inputs/InputResponse';
import {IPlayer} from './IPlayer';
import {PlayerInputModel, StartGamePromptMeta, BonusActionPromptMeta, AwardFundingPromptMeta, ChoiceContext, ColonyBonusCollectMeta, DeckPickPromptMeta, DiscardPromptMeta, DraftPromptMeta, FinalGreeneryPromptMeta, PlacementContext, VenusBonusPromptMeta, SpendHeatPromptMeta} from '../common/models/PlayerInputModel';
import {BotAttackPromptMeta} from '../common/models/BotAttackPromptModel';

export interface PlayerInput {
    type: PlayerInputType;
    buttonLabel: string;
    title: string | Message;
    warning?: string | Message;
    // Explicit start-of-game-flow marker (see StartGamePromptMeta). Serialized
    // centrally in ServerModel.getWaitingFor.
    startGamePrompt?: StartGamePromptMeta;
    // Explicit "this action menu is a card-granted BONUS action" marker (see
    // BonusActionPromptMeta). Serialized centrally in ServerModel.getWaitingFor.
    bonusActionPrompt?: BonusActionPromptMeta;
    // Explicit award-funding marker (see AwardFundingPromptMeta). Routes the
    // prompt to the modern AwardsOverlay. Serialized in ServerModel.getWaitingFor.
    awardFundingPrompt?: AwardFundingPromptMeta;
    // Explicit contextual-choice marker (see ChoiceContext). Routes the prompt to
    // the premium ContextualChoiceContent modal. Serialized in getWaitingFor.
    choiceContext?: ChoiceContext;
    // Explicit placement cancellability marker (see PlacementContext). Drives the
    // PlacementBanner's "cancel"/honest-reason UI. Serialized in getWaitingFor.
    placementContext?: PlacementContext;
    // Explicit Venus alt-track bonus marker (see VenusBonusPromptMeta). Routes the
    // prompt to the premium VenusBonusContent modal. Serialized in getWaitingFor.
    venusBonusPrompt?: VenusBonusPromptMeta;
    // Explicit "spend N heat" marker (see SpendHeatPromptMeta). Routes the Stormcraft
    // heat-source AndOptions to the premium SpendHeatContent modal. Serialized in
    // getWaitingFor.
    spendHeatPrompt?: SpendHeatPromptMeta;
    // Explicit "this SelectCard is a DISCARD FROM HAND" marker (see
    // DiscardPromptMeta) — the ONE signal the console's unified discard flow
    // keys off, whoever demands the discard. Serialized in getWaitingFor.
    discardPrompt?: DiscardPromptMeta;
    // Explicit "these candidates were just turned over off the deck FOR this
    // decision" marker (see DeckPickPromptMeta) — what tells the console the
    // cards are a temporary reveal rather than anybody's property. Serialized
    // on SelectCard.toModel (nesting-safe), not centrally.
    deckPickPrompt?: DeckPickPromptMeta;
    // Explicit "this SelectCard is a DRAFT PICK" marker (see DraftPromptMeta) —
    // pass direction, neighbors and pick total for the console draft flow.
    // Serialized on SelectCard.toModel (nesting-safe).
    draftPrompt?: DraftPromptMeta;
    // Explicit "this is the FINAL GREENERY beat" marker (see
    // FinalGreeneryPromptMeta) — one branch places, the other ENDS the game.
    finalGreeneryPrompt?: FinalGreeneryPromptMeta;
    // Explicit "collect the colony bonus another player's trade paid you"
    // marker (see ColonyBonusCollectMeta). Serialized on SelectOption.toModel
    // (nesting-safe), not centrally.
    colonyBonusPrompt?: ColonyBonusCollectMeta;
    // Explicit "a MarsBot effect forces this choice on you" context (see
    // BotAttackPromptMeta) — attacker, source card, what leaves and the exact
    // per-candidate consequence. Serialized on the input's own toModel
    // (nesting-safe), not centrally.
    botAttackPrompt?: BotAttackPromptMeta;

    // Contextual annotation identifying this PlayerInput.
    annotation: string | undefined;
    /**
     * When false, this input should not be the default selected PlayerInput.
     * When unset or true, this input may be the default selected PlayerInput.
     *
     * Used only when this option is a child option of an OrOptions.
     */
    eligibleForDefault?: boolean;
    /**
     * When true, this indicates that the input is optional and the user should
     * continue to poll for updates. Used by the draft re-pick flow: after a
     * player has made their required pick they get an optional re-pick prompt
     * while others are still choosing. The premium client treats optional
     * inputs as "waiting for others" (see DraftFlowOverlay / WaitingFor.vue),
     * so re-pick UI is intentionally not surfaced.
     */
    optional?: boolean;

    cb(...item: any): PlayerInput | undefined;

    /**
     * Converts this PlayerInput to the model received by the UI.
     */
    toModel(player: IPlayer): PlayerInputModel;

    /**
     * Processes and validates `response` for this PlayerInput which is meant for the given `player`.
     *
     * This is another mechainsm for calling cb() with a client-side response.
     */
    process(response: InputResponse, player: IPlayer): PlayerInput | undefined;
}

const NULL_FUNCTION = () => undefined;

export abstract class BasePlayerInput<T> implements PlayerInput {
  public readonly type: PlayerInputType;
  public buttonLabel: string = 'Save';
  public title: string | Message;
  public warning?: string | Message;
  public cb: (param: T) => PlayerInput | undefined = NULL_FUNCTION;
  public eligibleForDefault: boolean | undefined = undefined;
  public optional?: boolean;
  public annotation: string | undefined;
  public startGamePrompt: StartGamePromptMeta | undefined;
  public bonusActionPrompt: BonusActionPromptMeta | undefined;
  public awardFundingPrompt: AwardFundingPromptMeta | undefined;
  public choiceContext: ChoiceContext | undefined;
  public placementContext: PlacementContext | undefined;
  public venusBonusPrompt: VenusBonusPromptMeta | undefined;
  public spendHeatPrompt: SpendHeatPromptMeta | undefined;
  public discardPrompt: DiscardPromptMeta | undefined;
  public deckPickPrompt: DeckPickPromptMeta | undefined;
  public draftPrompt: DraftPromptMeta | undefined;
  public finalGreeneryPrompt: FinalGreeneryPromptMeta | undefined;
  public colonyBonusPrompt: ColonyBonusCollectMeta | undefined;
  public botAttackPrompt: BotAttackPromptMeta | undefined;

  public abstract toModel(player: IPlayer): PlayerInputModel;
  public abstract process(response: InputResponse, player: IPlayer): PlayerInput | undefined;

  constructor(type: PlayerInputType, title: string | Message = '') {
    this.type = type;
    this.title = title;
  }

  public andThen(cb: (param: T) => PlayerInput | undefined): this {
    if (this.cb !== NULL_FUNCTION) {
      const THROW_STATE_ERRORS = Boolean(process.env.THROW_STATE_ERRORS);
      if (THROW_STATE_ERRORS) {
        throw new Error('andThen called twice');
      } else {
        console.error('andThen called twice');
        return this;
      }
    }
    this.cb = cb;
    return this;
  }

  public setTitle(title: string | Message) : this {
    this.title = title;
    return this;
  }

  public setButtonLabel(buttonLabel: string) : this {
    this.buttonLabel = buttonLabel;
    return this;
  }

  public setWarning(warning: string | Message) : this {
    this.warning = warning;
    return this;
  }

  annotate(annotation: string): this {
    this.annotation = annotation;
    return this;
  }

  /** Mark this prompt as belonging to the start-of-game flow (chainable). */
  public markStartGamePrompt(meta: StartGamePromptMeta): this {
    this.startGamePrompt = meta;
    return this;
  }

  /** Mark this action menu as a card-granted BONUS action (chainable). */
  public markBonusActionPrompt(meta: BonusActionPromptMeta): this {
    this.bonusActionPrompt = meta;
    return this;
  }

  /** Mark this prompt as an award-funding selection (chainable). */
  public markAwardFundingPrompt(meta: AwardFundingPromptMeta): this {
    this.awardFundingPrompt = meta;
    return this;
  }

  /** Attach contextual-choice metadata (source card + trigger) so the premium
   *  client renders a CONTEXTUAL modal instead of a bare option list (chainable). */
  public markChoiceContext(meta: ChoiceContext): this {
    this.choiceContext = meta;
    return this;
  }

  /** Mark whether this tile-placement prompt can be cancelled before it commits
   *  (chainable). The PlacementBanner reads it to show "cancel" or an honest
   *  "can't cancel" reason. */
  public markPlacementContext(meta: PlacementContext): this {
    this.placementContext = meta;
    return this;
  }

  /** Mark this prompt as a Venus alt-track bonus selection (chainable). */
  public markVenusBonusPrompt(meta: VenusBonusPromptMeta): this {
    this.venusBonusPrompt = meta;
    return this;
  }

  /** Mark this prompt as a "spend N heat" Stormcraft source selection (chainable). */
  public markSpendHeatPrompt(meta: SpendHeatPromptMeta): this {
    this.spendHeatPrompt = meta;
    return this;
  }

  /** Mark this `SelectCard` as a DISCARD FROM HAND (chainable). Every rule that
   *  makes a player throw cards away attaches this at the prompt's construction
   *  so the client can route ALL discards — a card effect, a colony bonus, a
   *  global event, a CEO action — to the same surface and the same animation.
   *  See {@link DiscardPromptMeta} and `inputs/discardPrompt.ts` for factories. */
  public markDiscardPrompt(meta: DiscardPromptMeta): this {
    this.discardPrompt = meta;
    return this;
  }

  /** Mark this `SelectCard`'s candidates as a TEMPORARY REVEAL off the deck (or
   *  the discard pile) — cards turned over FOR this decision that belong to
   *  nobody yet, and of which the unpicked ones are about to be discarded.
   *  Attached by `ChooseCards`, the one deferred action every producer of this
   *  prompt goes through. See {@link DeckPickPromptMeta} and
   *  `inputs/deckPickPrompt.ts` for the factories. */
  public markDeckPickPrompt(meta: DeckPickPromptMeta): this {
    this.deckPickPrompt = meta;
    return this;
  }

  /** Mark this `SelectOption` as the COLLECT step of a colony bonus paid by
   *  ANOTHER player's trade (chainable). The card is drawn on the answer, so
   *  nothing reaches a hand its owner has not looked at, and the console can
   *  announce the delivery and take the player to the colony that paid it.
   *  See {@link ColonyBonusCollectMeta}. */
  public markColonyBonusPrompt(meta: ColonyBonusCollectMeta): this {
    this.colonyBonusPrompt = meta;
    return this;
  }

  /** Mark this `SelectCard` as a DRAFT PICK (chainable). Attached in ONE place —
   *  `Draft.askPlayerToDraft`, the funnel every draft variant goes through — so
   *  the client's draft flow keys off structure (direction / neighbors / pick
   *  total), never off the translatable title. See {@link DraftPromptMeta}. */
  public markDraftPrompt(meta: DraftPromptMeta): this {
    this.draftPrompt = meta;
    return this;
  }

  /** Mark this prompt as the FINAL GREENERY beat (chainable): one branch places
   *  a greenery, the other ENDS the player's game. The client must never have
   *  to tell those apart by reading their titles. */
  public markFinalGreeneryPrompt(meta: FinalGreeneryPromptMeta): this {
    this.finalGreeneryPrompt = meta;
    return this;
  }

  /** Mark this prompt as a MANDATORY choice a MarsBot effect forces on its
   *  victim (chainable): who attacks, which of the bot's cards did it, what
   *  leaves, and the exact per-candidate consequence. Built by
   *  `automa/AutomaAttackPrompt.ts` — every hostile bot effect that makes a
   *  human point at one of their own objects goes through it, so the console
   *  never has to recover any of that from an English sentence.
   *  See {@link BotAttackPromptMeta}. */
  public markBotAttackPrompt(meta: BotAttackPromptMeta): this {
    this.botAttackPrompt = meta;
    return this;
  }
}

export function getCardFromPlayerInput<T extends ICard>(cards: ReadonlyArray<T>, cardName: string): {card: T, idx: number} {
  const idx = cards.findIndex((card) => card.name === cardName);
  if (idx === -1) {
    throw new Error(`Card ${cardName} not found`);
  }
  const card = cards[idx];
  return {card, idx};
}
