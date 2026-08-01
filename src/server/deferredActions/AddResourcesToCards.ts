import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';
import {CardName} from '../../common/cards/CardName';
import {SelectAmount} from '../inputs/SelectAmount';
import {AndOptions} from '../inputs/AndOptions';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {message} from '../logs/MessageBuilder';

export class AddResourcesToCards extends DeferredAction {
  constructor(
    player: IPlayer,
    public resourceType: CardResource,
    public count: number,
    /** WHO caused this — see `inputs/choiceContext.ts`. */
    private cause?: ChoiceContextSource) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  public execute() {
    if (this.count === 0) {
      return undefined;
    }
    const cards = this.player.getResourceCards(this.resourceType);

    if (cards.length === 0) {
      return undefined;
    }
    if (cards.length === 1) {
      this.player.addResourceTo(cards[0], {qty: this.count, log: true});
      return undefined;
    }
    const map = new Map<CardName, number>();
    const options = cards.map((card) => {
      return new SelectAmount(card.name, '', 0, this.count)
        .andThen((amount) => {
          map.set(card.name, amount);
          return undefined;
        });
    });

    // A TITLE, always: `AndOptions` defaults to '' and this prompt shipped with
    // a blank header over a column of bare card names — the player was asked to
    // distribute something without being told what, or how many.
    const and = new AndOptions(...options)
      .setTitle(message('Distribute ${0} ${1}', (b) => b.number(this.count).string(this.resourceType)));
    if (this.cause !== undefined) {
      and.markChoiceContext({source: this.cause, mode: 'reward'});
    }
    return and.andThen(() => {
      let sum = 0;
      cards.forEach((card) => {
        sum += map.get(card.name) ?? 0;
      });
      if (sum !== this.count) {
        throw new Error(`Expecting ${this.count} resources distributed, got ${sum}.`);
      }
      cards.forEach((card) => {
        const amount = map.get(card.name) ?? 0;
        if (amount > 0) {
          this.player.addResourceTo(card, {qty: amount, log: true});
        }
      });
      return undefined;
    });
  }
}
