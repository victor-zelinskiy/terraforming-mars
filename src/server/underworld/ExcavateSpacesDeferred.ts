import {inplaceRemove} from '../../common/utils/utils';
import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {Priority} from '../deferredActions/Priority';
import {RunNTimes} from '../deferredActions/RunNTimes';
import {UnderworldExpansion} from '../underworld/UnderworldExpansion';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';

export class ExcavateSpacesDeferred extends RunNTimes<void> {
  private spaces: Array<Space> | undefined;
  private ignorePlacementRestrictions: boolean;
  constructor(
    player: IPlayer,
    count: number,
    ignorePlacementRestrictions: boolean = false,
    spaces?: ReadonlyArray<Space>,
  ) {
    super(player, count, Priority.EXCAVATE_UNDERGROUND_RESOURCE);
    this.ignorePlacementRestrictions = ignorePlacementRestrictions;
    this.spaces = spaces ? spaces.slice() : undefined;
  }

  protected run() {
    const title = this.createTitle('Select space to excavate');
    this.player.defer(() => {
      const spaces =
        this.spaces ??
        UnderworldExpansion.excavatableSpaces(this.player, {
          ignorePlacementRestrictions: this.ignorePlacementRestrictions,
        });
      if (spaces.length === 0) {
        const undergroundResource = UnderworldExpansion.drawExcavationToken(this.player.game);
        this.player.game.log('${0} excavated ${1} from the draw pile', (b) =>
          b.player(this.player).undergroundToken(undergroundResource));
        UnderworldExpansion.claimToken(this.player, undergroundResource, /* isExcavate= */ true, /* space= */ undefined);
        return this.next();
      }

      // slicing a copy because the spaces array is mutated between calls.
      return createMarsSelectSpace(this.player, title, spaces.slice(), {
        customReasoner: (space) => {
          if (space.undergroundResources === undefined) return 'not-identified';
          if (space.excavator !== undefined) return 'already-excavated';
          return undefined;
        },
      })
        .andThen((space) => {
          UnderworldExpansion.excavate(this.player, space);
          if (this.spaces) {
            inplaceRemove(this.spaces, space);
          }
          this.next();
          return undefined;
        });
    }, Priority.EXCAVATE_UNDERGROUND_RESOURCE);
    return undefined;
  }
}
