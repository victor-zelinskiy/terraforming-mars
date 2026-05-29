import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {Space} from '../boards/Space';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {UnderworldExpansion} from './UnderworldExpansion';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';

export class ClaimSpaceDeferred extends DeferredAction<Space> {
  constructor(
    player: IPlayer,
    private claimableSpaces: ReadonlyArray<Space>,
    private title: string = 'Select space to excavate',
  ) {
    super(player, Priority.EXCAVATE_UNDERGROUND_RESOURCE);
  }

  public execute(): PlayerInput {
    // Caller pre-filters claimable spaces; helper provides generic
    // tooltips (occupied / reserved-*) for the rest of the board.
    // Card-specific filter (whatever caller used) falls through to
    // generic 'unavailable' which is acceptable here.
    return createMarsSelectSpace(this.player, this.title, this.claimableSpaces)
      .andThen((space) => {
        UnderworldExpansion.claim(this.player, space);
        this.cb(space);
        return undefined;
      });
  }
}
