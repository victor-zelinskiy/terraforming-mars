import {IPlayer} from '../IPlayer';
import {SelectColony} from '../inputs/SelectColony';
import {IColony} from '../colonies/IColony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';

export class BuildColony extends DeferredAction<IColony> {
  constructor(
    player: IPlayer,
    private options?: {
      allowDuplicate?: boolean, // Allow placing a colony on a tile that already has a colony.
      title?: string,
      colonies?: Array<IColony>, // If not specified, will accept all playable colonies.
      giveBonusTwice?: boolean, // Custom for Vital Colony. Rewards the bonus when placing a colony a second time.
    },
  ) {
    super(player, Priority.BUILD_COLONY);
  }

  public execute() {
    const colonies = this.options?.colonies || this.player.colonies.getPlayableColonies(this.options?.allowDuplicate);

    if (colonies.length === 0) {
      return undefined;
    }

    const title = this.options?.title ?? 'Select where to build a colony';
    const select = new SelectColony(title, 'Build', colonies);

    // Surface the OTHER in-play colonies the player can't build on right now as
    // DISABLED cards with a reason (full / already-owned / TR affordability),
    // instead of dropping them from the picker. `colonies` stays the selectable
    // set the server validates against.
    const selectableNames = new Set(colonies.map((c) => c.name));
    select.disabledColonies = this.player.game.colonies
      .filter((colony) => !selectableNames.has(colony.name))
      .map((colony) => ({colony, reason: this.disabledReason(colony)}));

    return select
      .andThen((colony: IColony) => {
        colony.addColony(this.player, {giveBonusTwice: this.options?.giveBonusTwice ?? false});
        this.cb(colony);
        return undefined;
      });
  }

  /** Why an in-play colony can't be built on now (mirrors getPlayableColonies). */
  private disabledReason(colony: IColony): string {
    if (colony.isActive === false) {
      return 'Colony is inactive';
    }
    if (colony.isFull()) {
      return 'Colony is full';
    }
    if (this.options?.allowDuplicate !== true && colony.colonies.includes(this.player.id)) {
      return 'You already have a colony here';
    }
    // The only remaining playable-filter rejections are TR-affordability ones
    // the client can't compute: building Venus/Europa raises a global parameter
    // and Leavitt raises TR directly, so the player must afford that TR gain
    // (the Reds tax, when in effect). Which parameter is obvious from the tile.
    if (colony.name === ColonyName.VENUS || colony.name === ColonyName.EUROPA || colony.name === ColonyName.LEAVITT) {
      return 'Cannot afford the TR increase to build here';
    }
    return 'Cannot build on this colony right now';
  }
}
