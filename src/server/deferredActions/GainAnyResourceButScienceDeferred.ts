import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {CardResource} from '../../common/CardResource';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlayerInput} from '../PlayerInput';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {UnderworldExpansion} from '../underworld/UnderworldExpansion';
import {SelectResource} from '../inputs/SelectResource';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';

export class GainAnyResourceButScienceDeferred extends DeferredAction {
  constructor(
    player: IPlayer,
    /** WHO caused this — see `inputs/choiceContext.ts`. Without it the prompt
     *  is the most context-free in the game: a bare «Выберите вариант» with
     *  three unexplained branches and nothing naming the effect that fired. */
    private cause?: ChoiceContextSource,
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  public override execute(): PlayerInput | undefined {
    const orOptions = new OrOptions().setTitle('Select one option');
    if (this.cause !== undefined) {
      orOptions.markChoiceContext({source: this.cause, mode: 'reward'});
    }

    const cards = this.player.getResourceCards(undefined).filter((card) => card.resourceType !== CardResource.SCIENCE);
    if (cards.length > 0) {
      orOptions.options.push(new SelectCard('Gain 1 card resource', undefined, cards)
        .andThen(([card]) => {
          this.player.addResourceTo(card, {log: true});
          return undefined;
        }));
    }
    orOptions.options.push(new SelectResource('Gain 1 standard resource')
      .andThen((resource) => {
        this.player.stock.add(resource, 1, {log: true});
        return undefined;
      }));
    orOptions.options.push(new SelectOption('Gain 1 corruption')
      .andThen(() => {
        UnderworldExpansion.gainCorruption(this.player, 1, {log: true});
        return undefined;
      }));

    return orOptions;
  }
}
