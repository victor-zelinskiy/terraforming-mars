import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {ICard} from '../cards/ICard';
import {DeferredAction} from './DeferredAction';
import {Message} from '../../common/logs/Message';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';

export type Options = {
  title?: string | Message;
  buttonLabel?: string;
  /** WHO caused this pick — see `inputs/choiceContext.ts`. */
  cause?: ChoiceContextSource;
}

export class SelectCardDeferred extends DeferredAction<ICard> {
  constructor(
    player: IPlayer,
    public cards: ReadonlyArray<ICard>,
    public options: Options = {},
  ) {
    super(player);
  }

  public execute() {
    if (this.cards.length === 0) {
      return undefined;
    }

    if (this.cards.length === 1) {
      this.cb(this.cards[0]);
      return undefined;
    }

    const title = this.options.title ?? 'Select a card';
    const buttonLabel = this.options.buttonLabel ?? 'Select';

    const select = new SelectCard(title, buttonLabel, this.cards)
      .andThen(([card]) => {
        this.cb(card);
        return undefined;
      });
    return this.options.cause === undefined ?
      select :
      select.markChoiceContext({source: this.options.cause, mode: 'reward'});
  }
}
