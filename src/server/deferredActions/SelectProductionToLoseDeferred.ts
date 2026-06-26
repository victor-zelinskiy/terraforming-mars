import {SelectProductionToLose} from '../inputs/SelectProductionToLose';
import {IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Units} from '../../common/Units';
import {ProductionLossSource} from '../../common/models/ProductionLossSource';

export class SelectProductionToLoseDeferred extends DeferredAction {
  constructor(
    player: IPlayer,
    private unitsToLose: number,
    // What forces the reduction (e.g. {type:'hazard'} for an adjacent Ares hazard,
    // {type:'card', card: …} for a CEO/card attack) — shown as a source chip so the
    // player sees WHY. Omit when not cheaply known.
    private source?: ProductionLossSource,
    private title: string = `Choose ${unitsToLose} unit(s) of production to lose`,
  ) {
    super(player, Priority.LOSE_RESOURCE_OR_PRODUCTION);
  }

  public execute() {
    const input = new SelectProductionToLose(
      this.title,
      this.unitsToLose,
      this.player);
    input.source = this.source;
    return input
      .andThen((production) => {
        this.player.production.adjust(Units.negative(production), {log: true});
        return undefined;
      });
  }
}
