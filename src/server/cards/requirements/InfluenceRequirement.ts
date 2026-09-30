import {RequirementType} from '../../../common/cards/RequirementType';
import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';

/**
 * «Requires that you have no more than N Influence» / «…at least N Influence»
 * (Turmoil Redux — TR04 Minority Representation prints the first, a MAX).
 *
 * The score is the player's WHOLE influence as the rule adds it up — the
 * Agenda track's level, every influence bonus a card or a colony granted, and
 * the tableau's own `getInfluenceBonus` hooks — read through the political
 * facade (`PoliticalOps.influence`): the Mars Parliament answers
 * `Parliament.influence`, classic Turmoil its `getInfluence`, a game with no
 * political engine 0. Never the marker's POSITION: a card that lifted the
 * player's influence lifts this count with it, and «max 1» closes the door
 * exactly when the rule says it does.
 */
export class InfluenceRequirement extends InequalityRequirement {
  public readonly type = RequirementType.INFLUENCE;
  public getScore(player: IPlayer): number {
    return player.game.politics?.influence(player) ?? 0;
  }
}
