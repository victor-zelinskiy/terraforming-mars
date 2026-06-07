import {UndergroundResourceToken} from '../../common/underworld/UndergroundResourceToken';
import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {Priority} from '../deferredActions/Priority';
import {RunNTimes} from '../deferredActions/RunNTimes';
import {UnderworldExpansion} from './UnderworldExpansion';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';

export class IdentifySpacesDeferred extends RunNTimes<Space | UndergroundResourceToken> {
  constructor(player: IPlayer, count: number) {
    super(player, count, Priority.IDENTIFY_UNDERGROUND_RESOURCE);
  }

  protected run() {
    const title = this.createTitle('Select space to identify');
    this.player.defer(() => {
      const identifiableSpaces = UnderworldExpansion.identifiableSpaces(this.player);
      if (identifiableSpaces.length === 0) {
        const token = UnderworldExpansion.drawExcavationToken(this.player.game);
        this.collection.push(token);
        this.player.game.log('${0} identified ${1} from the draw pile', (b) => b.player(this.player).undergroundToken(token));
        this.player.game.triggerForAllCards((p, c) => c.onIdentificationByAnyPlayer?.(p, this.player, token));
        return this.next();
      }
      // Identify ALREADY-empty-of-resource cells. Inverse semantics from
      // Excavate: legal = NOT yet identified. Custom reasons surface the
      // identify-specific filter (canIdentify) precisely.
      return createMarsSelectSpace(this.player, title, identifiableSpaces, {
        customReasoner: (space) => {
          if (space.undergroundResources !== undefined) {
            return 'already-identified';
          }
          if (space.excavator !== undefined) {
            return 'already-excavated';
          }
          return undefined; // generic 'occupied' / 'reserved-colony' handle the rest
        },
      })
        .andThen((space) => {
          UnderworldExpansion.identify(this.player.game, space, this.player);
          this.collection.push(space);
          return this.next();
        });
    });
    return undefined;
  }
}
