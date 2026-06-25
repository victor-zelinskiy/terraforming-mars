import {ICard} from './cards/ICard';
import {Message} from '../common/logs/Message';
import {PlayerInputType} from '../common/input/PlayerInputType';
import {InputResponse} from '../common/inputs/InputResponse';
import {IPlayer} from './IPlayer';
import {PlayerInputModel, StartGamePromptMeta, AwardFundingPromptMeta, ChoiceContext, PlacementContext, VenusBonusPromptMeta, SpendHeatPromptMeta} from '../common/models/PlayerInputModel';

export interface PlayerInput {
    type: PlayerInputType;
    buttonLabel: string;
    title: string | Message;
    warning?: string | Message;
    // Explicit start-of-game-flow marker (see StartGamePromptMeta). Serialized
    // centrally in ServerModel.getWaitingFor.
    startGamePrompt?: StartGamePromptMeta;
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
  public awardFundingPrompt: AwardFundingPromptMeta | undefined;
  public choiceContext: ChoiceContext | undefined;
  public placementContext: PlacementContext | undefined;
  public venusBonusPrompt: VenusBonusPromptMeta | undefined;
  public spendHeatPrompt: SpendHeatPromptMeta | undefined;

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
}

export function getCardFromPlayerInput<T extends ICard>(cards: ReadonlyArray<T>, cardName: string): {card: T, idx: number} {
  const idx = cards.findIndex((card) => card.name === cardName);
  if (idx === -1) {
    throw new Error(`Card ${cardName} not found`);
  }
  const card = cards[idx];
  return {card, idx};
}
