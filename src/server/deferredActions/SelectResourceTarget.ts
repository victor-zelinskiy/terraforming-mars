import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {SelectCard} from '../inputs/SelectCard';
import {CardResource} from '../../common/CardResource';
import {Message} from '../../common/logs/Message';
import {ChoiceContextSource, SelectCardModel} from '../../common/models/PlayerInputModel';
import {AdjacencyAmountBasis} from '../../common/models/CardAdjacencyPayoutModel';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {AddResourcesToCard} from './AddResourcesToCard';
import {cardResourceIcon} from '../cards/actionPreviews';

/**
 * «CHOOSE THE CARD THE RESOURCES WILL LAND ON — THE NUMBER COMES LATER»: the
 * target pick of a card whose reward depends on a cell chosen AFTER it
 * (Turmoil Redux TR21 Arboretum — «add 1 data to ANY card for each city
 * adjacent to this tile»; docs/TURMOIL_REDUX_ARBORETUM.md).
 *
 * WHY BEFORE THE CELL. The fork's order for «a card target + a tile» is the
 * target first (`Priority.PLAY_CARD_RESOURCE_CHOICE` — Bio-Fertilizer
 * Facility, Large Convoy, Imported Hydrogen): the whole play stays reversible
 * until the cell is confirmed, and the board dossier then knows WHERE the
 * units will land, so every cell can print that card's `before → after`.
 *
 * WHAT IT IS NOT. It never adds anything and never knows a number: the caller
 * reads `chosen` once the amount exists (the placement's `andThen`) and pays
 * it there. The candidates are `AddResourcesToCard`'s own — the SAME instance
 * kind is asked, never a copied filter — so «who may receive» cannot read
 * apart from every other «add to ANY card».
 *
 * NO AUTO-SELECT: a single holder is still ASKED (invariant 3 — the player
 * sees which card is hit). No holder at all asks nothing; the payout then
 * names the loss with its size (`recordSkippedEffect`), because only the
 * payout knows the size.
 *
 * THE MARKER is `resourceGainPrompt` WITHOUT an `amount` and WITH the
 * `amountBasis` — the console reads «+1 for each adjacent city» from it and
 * guesses no number. A reload between the pick and the cell loses the queue,
 * as for any deferred step (the engine's known behaviour): `chosen` lives on
 * this instance only and never sticks to a later play.
 */
export class SelectResourceTarget extends DeferredAction<ICard | undefined> {
  /** The card the player chose — undefined until answered, and when nothing could be asked. */
  public chosen: ICard | undefined = undefined;
  private readonly candidates: AddResourcesToCard;

  constructor(
    player: IPlayer,
    public readonly resource: CardResource,
    private readonly cause: ChoiceContextSource,
    public readonly basis: AdjacencyAmountBasis,
    private readonly title: string | Message = 'Select the card for the resources — 1 for each adjacent city',
  ) {
    super(player, Priority.PLAY_CARD_RESOURCE_CHOICE);
    this.candidates = new AddResourcesToCard(player, resource, {autoSelect: false, cause});
  }

  /** The holders that may receive — `AddResourcesToCard.getCards`, the family's one rule. */
  public getCards(): Array<ICard> {
    return this.candidates.getCards();
  }

  public execute() {
    const cards = this.getCards();
    if (cards.length === 0) {
      this.cb(undefined);
      return undefined;
    }
    return this.buildSelectCard(cards).andThen(([card]) => {
      this.chosen = card;
      this.cb(card);
      return undefined;
    });
  }

  /** READ-ONLY twin: the `SelectCardModel` the live path presents, or `undefined` when there is nobody to ask. */
  public previewSelectCard(): SelectCardModel | undefined {
    const cards = this.getCards();
    return cards.length === 0 ? undefined : this.buildSelectCard(cards).toModel(this.player);
  }

  private buildSelectCard(cards: ReadonlyArray<ICard>): SelectCard<ICard> {
    return new SelectCard(this.title, 'Select', cards)
      .markResourceGainPrompt({
        cardResource: cardResourceIcon(this.resource),
        amountBasis: this.basis,
      })
      .markChoiceContext({source: this.cause, mode: 'reward'});
  }
}
