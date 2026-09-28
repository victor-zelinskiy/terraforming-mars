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
import {DisabledOptionModel} from '../../common/models/PlayerInputModel';

/**
 * Asks the player to increase the colony track as many steps as it can go.
 *
 * Player has the option to move zero, one, or as many steps as it can go —
 * down to `minSteps`: a colony may REFUSE this player its income at the lower
 * positions (the Turmoil Redux Pluto: data with no card to hold it), and
 * landing there would be a trade that pays nothing. Those steps are still
 * LISTED, disabled with the colony's reason, so the player reads why the
 * ladder starts where it does; «don't increase» exists only when staying put
 * is legal.
 */
export class IncreaseColonyTrack extends DeferredAction {
  constructor(
    player: IPlayer,
    public colony: IColony,
    public steps: number,
    public minSteps: number = 0,
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
    // ([steps … minSteps, don't]) is load-bearing: the colony workspace
    // pre-collects this prompt and replays a captured INDEX
    // (colonyTradePlan.trackChoiceResponse: N steps → index steps − N).
    const options = new OrOptions()
      .setTitle(message('Increase ${0} colony track before trade', (b) => b.colony(this.colony)))
      .markChoiceContext({
        source: colonySource(this.colony.name),
        trigger: message('Increase ${0} colony track before trade', (b) => b.colony(this.colony)),
        mode: 'reward',
      });

    const minSteps = Math.max(0, Math.min(this.minSteps, this.steps));
    const disabled: Array<DisabledOptionModel> = [];
    const current = this.colony.trackPosition;
    for (let step = this.steps; step > 0; step--) {
      const title = message('Increase colony track ${0} step(s)', (b) => b.number(step));
      if (step < minSteps) {
        // Refused, and SHOWN refused: the colony's own reason at that landing.
        disabled.push({title, reason: this.colony.tradeIncomeBlockedReason(this.player, current + step) ?? 'Unavailable right now'});
        continue;
      }
      options.options.push(
        new SelectOption(title)
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

    if (minSteps === 0) {
      options.options.push(
        new SelectOption('Don\'t increase colony track').withMetadata(skip()).andThen(() => {
          this.cb(undefined);
          return undefined;
        }),
      );
    } else {
      disabled.push({
        title: 'Don\'t increase colony track',
        reason: this.colony.tradeIncomeBlockedReason(this.player, current) ?? 'Unavailable right now',
      });
    }
    if (disabled.length > 0) {
      options.setDisabledOptions(disabled);
    }

    return options;
  }
}
