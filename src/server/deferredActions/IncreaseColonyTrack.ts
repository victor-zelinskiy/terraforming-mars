import {IPlayer} from '../IPlayer';
import {IColony} from '../colonies/IColony';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {LogHelper} from '../LogHelper';
import {message} from '../logs/MessageBuilder';
import {colonySource} from '../inputs/choiceContext';
import {skip} from '../inputs/optionMetadata';

/**
 * Asks the player to increase the colony track as many steps as it can go.
 *
 * Player has the option to move zero, one, or as many steps as it can go.
 */
export class IncreaseColonyTrack extends DeferredAction {
  constructor(
    player: IPlayer,
    public colony: IColony,
    public steps: number,
  ) {
    super(player, Priority.INCREASE_COLONY_TRACK);
  }

  public execute() {
    if (this.steps === 0) {
      this.cb(undefined);
      return undefined;
    }

    // The colony names itself (the wave-3 `cause` contract) — without the
    // marker this pre-trade boost rendered as the context-less two-step list.
    // The trigger doubles the title because the premium decision screen keeps
    // trigger + source and DROPS the server title. ⚠️ The option ORDER below
    // ([steps … 1, don't]) is load-bearing: the colony workspace pre-collects
    // this prompt and replays a captured INDEX (colonyTradePlan.trackChoiceResponse).
    const options = new OrOptions()
      .setTitle(message('Increase ${0} colony track before trade', (b) => b.colony(this.colony)))
      .markChoiceContext({
        source: colonySource(this.colony.name),
        trigger: message('Increase ${0} colony track before trade', (b) => b.colony(this.colony)),
        mode: 'reward',
      });

    for (let step = this.steps; step > 0; step--) {
      options.options.push(
        new SelectOption(message('Increase colony track ${0} step(s)', (b) => b.number(step)))
          .andThen(() => {
            const oldPosition = this.colony.trackPosition;
            this.colony.increaseTrack(step);
            LogHelper.logColonyTrackIncrease(this.player, this.colony, step);
            this.colony.recordTradeTrackBonus(this.player, oldPosition, this.colony.trackPosition - oldPosition);
            this.cb(undefined);
            return undefined;
          }),
      );
    }

    options.options.push(
      new SelectOption('Don\'t increase colony track').withMetadata(skip()).andThen(() => {
        this.cb(undefined);
        return undefined;
      }),
    );

    return options;
  }
}
